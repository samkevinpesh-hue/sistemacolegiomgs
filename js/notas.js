// ================================================
// notas.js — Módulo Notas (Padre + Profesor) con Firebase RTDB + Storage + Foto de perfil
// + Buscador por nombre/fecha para padres y profesores
// + Soporte: PDF, Word, Excel, PowerPoint, Imágenes, Videos
// ================================================

import { getData, pushData, updateData, deleteData } from './firebase-config.js';
import { SESION, getEstudiantes, getHijosPadre, getUsuarioActual, escapeHTML, toast, leerArchivo, subirArchivoStorage, descargarArchivo, confirmarEliminar, getFotoPerfil, renderFotoPerfilMini } from './data.js';

// Cargar librerías necesarias para vista previa
(function cargarLibrerias() {
    // Mammoth para Word
    if (!window.mammoth) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
        document.head.appendChild(s);
    }
    // XLSX para Excel
    if (!window.XLSX) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        document.head.appendChild(s);
    }
    // PDF.js para PDF
    if (!window.pdfjsLib) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
        };
        document.head.appendChild(s);
    }
})();

function initNotas(contenedor) {
    const rol = SESION.get("rol");
    _quitarBtnRecargar("btn-recargar");
    if (rol === "profesor" || rol === "admin" || rol === "psicologo" || rol === "psicólogo") {
        renderNotasProfesor(contenedor);
    } else {
        _inyectarBtnRecargar("btn-recargar", () => renderNotasPadre(contenedor));
        renderNotasPadre(contenedor);
    }
}

function _inyectarBtnRecargar(id, callback) {
    _quitarBtnRecargar(id);
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    topbar.style.display = "flex";
    topbar.style.justifyContent = "space-between";
    topbar.style.alignItems = "center";
    const btn = document.createElement("button");
    btn.id = id;
    btn.title = "Actualizar";
    btn.style.cssText = `
        display:inline-flex; align-items:center; gap:6px;
        background:linear-gradient(135deg,#1cc88a,#17a673);
        color:white; border:none; border-radius:50px;
        padding:7px 14px 7px 9px; font-size:0.78rem; font-weight:700;
        cursor:pointer; font-family:inherit; letter-spacing:0.4px;
        box-shadow:0 3px 10px rgba(28,200,138,0.4);
        transition:all 0.25s ease; flex-shrink:0;
    `;
    btn.innerHTML = `
        <span id="${id}-svg" style="display:inline-flex;align-items:center;justify-content:center;
            width:22px;height:22px;background:rgba(255,255,255,0.25);border-radius:50%;flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"
                stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
        </span>
        <span>Actualizar</span>
    `;
    btn.onmouseenter = () => { btn.style.transform="translateY(-2px)"; btn.style.boxShadow="0 6px 18px rgba(28,200,138,0.5)"; };
    btn.onmouseleave = () => { btn.style.transform=""; btn.style.boxShadow="0 3px 10px rgba(28,200,138,0.4)"; };
    btn.onclick = async () => {
        btn.disabled = true;
        btn.style.opacity = "0.7";
        const svgEl = document.getElementById(`${id}-svg`);
        let deg = 0;
        const spin = setInterval(() => { deg += 15; if(svgEl) svgEl.style.transform=`rotate(${deg}deg)`; }, 30);
        await callback();
        clearInterval(spin);
        if(svgEl) svgEl.style.transform = "";
        btn.disabled = false;
        btn.style.opacity = "";
    };
    topbar.appendChild(btn);
}

function _quitarBtnRecargar(id) {
    const viejo = document.getElementById(id);
    if (viejo) viejo.remove();
    const topbar = document.querySelector(".topbar");
    if (topbar) { topbar.style.display = ""; topbar.style.justifyContent = ""; topbar.style.alignItems = ""; }
}

/* ==================== VISTA PADRE ==================== */
async function renderNotasPadre(cont) {
    const hijos = getHijosPadre();
    const usuario = SESION.get("usuario");

    if (!hijos.length) { 
        cont.innerHTML = "<p class='vacio'>No tienes hijos asignados.</p>"; 
        return; 
    }

    try {
        const notasData = await getData('notas');
        const notas = [];

        if (notasData) {
            Object.entries(notasData).forEach(([key, n]) => {
                if (hijos.some(h => h.dni === n.estudiante_dni)) {
                    notas.push({ ...n, id: key });
                }
            });
        }

        notas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!notas.length) { 
            cont.innerHTML = "<p class='vacio'>No hay notas disponibles aún.</p>"; 
            return; 
        }

        const buscadorPadreHtml = `
        <div class="buscador-historial buscador-padre">
            <div class="buscador-inputs">
                <div class="buscador-grupo">
                    <i class="bx bx-search"></i>
                    <input type="text" id="buscarPadreProfesorNota" placeholder="Buscar por nombre de profesor..." oninput="filtrarNotasPadre()">
                </div>
                <div class="buscador-grupo">
                    <i class="bx bx-calendar"></i>
                    <input type="date" id="buscarPadreFechaNota" onchange="filtrarNotasPadre()">
                </div>
                <button class="btn-limpiar-busqueda" onclick="limpiarBusquedaPadreNota()" title="Limpiar filtros">
                    <i class="bx bx-x"></i>
                </button>
            </div>
            <div id="resultados-info-padre-nota" class="resultados-info"></div>
        </div>`;

        const profesores = await getData('profesores');

        const profesoresKeys = [...new Set(notas.map(n => n.profesor_usuario))];
        const fotosPerfil = {};
        await Promise.all(profesoresKeys.map(async (profUser) => {
            const foto = await getFotoPerfil(profUser, 'profesor');
            if (foto) fotosPerfil[profUser] = foto;
        }));

        const cardsHtml = notas.map(n => {
            const hijo = hijos.find(h => h.dni === n.estudiante_dni);
            const prof = profesores ? profesores[n.profesor_usuario.replace(/[.@]/g, '_')] : null;
            const fotoProf = fotosPerfil[n.profesor_usuario] || null;

            return `
            <div class="card nota-card">
                <div class="nota-header">
                    <div class="nota-header-con-foto">
                        ${renderFotoPerfilMini(fotoProf, prof?.nombre || "Profesor")}
                        <div class="nota-header-info">
                            <h4>${escapeHTML(prof?.emoji || "👨‍🏫")} De: <strong>${escapeHTML(prof?.nombre || "Profesor")}</strong></h4>
                            ${prof?.curso ? `<span class="curso-tag">${escapeHTML(prof.curso)}</span>` : ""}
                        </div>
                        <span class="fecha">${formatFecha(n.fecha)}</span>
                    </div>
                </div>
                <div class="destinatario-badge">
                    👦 Para: <strong>${escapeHTML(hijo?.nombre || n.nombre_estudiante)}</strong>
                    <span class="grado-badge">${escapeHTML(n.grado || "")}° ${escapeHTML(n.seccion || "")}</span>
                </div>
                <p class="mensaje-texto">${escapeHTML(n.mensaje || "")}</p>
                <div class="galeria-fotos">${generarGaleria(n)}</div>
            </div>`;
        }).join("");

        cont.innerHTML = buscadorPadreHtml + `<div id="lista-notas-padre">${cardsHtml}</div>`;

        activarModalNotas();

        const cards = cont.querySelectorAll('.nota-card');
        if (window.animarEntrada) animarEntrada(cards, 100, 80);

    } catch (e) {
        cont.innerHTML = "<p class='vacio'>Error al cargar notas.</p>";
        console.error(e);
    }
}

/* ==================== DETECTAR TIPO DE ARCHIVO ==================== */
function detectarTipoArchivo(arc) {
    const tipo = arc.tipo || '';
    const nombre = arc.nombre || '';
    const ext = nombre.split('.').pop().toLowerCase();

    if (tipo.startsWith("image") || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(nombre)) {
        return 'imagen';
    }
    if (tipo.includes("pdf") || ext === 'pdf') {
        return 'pdf';
    }
    if (tipo.includes("word") || /^(doc|docx)$/i.test(ext)) {
        return 'word';
    }
    if (tipo.includes("excel") || tipo.includes("sheet") || tipo.includes("spreadsheet") || /^(xls|xlsx|xlsm|csv)$/i.test(ext)) {
        return 'excel';
    }
    if (tipo.includes("powerpoint") || tipo.includes("presentation") || /^(ppt|pptx|pps|ppsx)$/i.test(ext)) {
        return 'powerpoint';
    }
    if (tipo.startsWith("video") || /^(mp4|webm|mov|avi|mkv|flv)$/i.test(ext)) {
        return 'video';
    }
    return 'generico';
}

/* ==================== VISTA PREVIA MODAL ==================== */
async function abrirVistaPrevia(source, tipo, nombre) {
    let modalVP = document.getElementById("modal-vista-previa");
    if (!modalVP) {
        modalVP = document.createElement("div");
        modalVP.id = "modal-vista-previa";
        modalVP.className = "modal modal-vp";
        modalVP.innerHTML = `
            <div class="modal-vp-content">
                <div class="modal-vp-header">
                    <h3 id="vp-titulo">Vista previa</h3>
                    <span class="cerrar-modal" onclick="cerrarVistaPrevia()">&times;</span>
                </div>
                <div class="modal-vp-body" id="vp-body"></div>
                <div class="modal-vp-footer">
                    <a id="vp-descargar" href="javascript:void(0)" class="btn-descargar" onclick="descargarArchivo(this.dataset.url, this.dataset.nombre)">⬇ Descargar archivo</a>
                </div>
            </div>
        `;
        document.body.appendChild(modalVP);
        modalVP.addEventListener("click", e => {
            if (e.target === modalVP) cerrarVistaPrevia();
        });
    }

    const titulo = document.getElementById("vp-titulo");
    const body = document.getElementById("vp-body");
    const descargar = document.getElementById("vp-descargar");

    titulo.textContent = nombre;
    descargar.download = nombre;
    descargar.dataset.url = source instanceof File ? await sourceUrl() : source;
    descargar.dataset.nombre = nombre;
    body.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;">⏳ Cargando vista previa...</div>`;
    modalVP.style.display = "flex";

    const obtenerArrayBuffer = async (input) => {
        if (input instanceof File) {
            return await input.arrayBuffer();
        }
        if (typeof input === 'string' && input.startsWith('data:')) {
            const b64 = input.split(',')[1];
            const binary = atob(b64);
            const buffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
            return buffer.buffer;
        }

        // NO modificar la URL - ahora todo se sube como image
        let url = input;

        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.arrayBuffer();
        } catch (e) {
            throw e;
        }
    };

    const sourceUrl = async () => {
        if (source instanceof File) {
            return await leerArchivoComoDataURL(source);
        }
        return source;
    };

    // ===== PDF CON PDF.js =====
    if (tipo === 'pdf') {
        const cargarPDF = async () => {
            try {
                if (!window.pdfjsLib) {
                    body.innerHTML = `<div style="text-align:center;padding:40px;">
                        <div style="font-size:3rem;margin-bottom:16px;">📕</div>
                        <p style="color:#64748b;">Cargando visor de PDF...</p>
                    </div>`;
                    let intentos = 0;
                    const esperar = setInterval(() => {
                        intentos++;
                        if (window.pdfjsLib) { clearInterval(esperar); cargarPDF(); }
                        else if (intentos > 30) {
                            clearInterval(esperar);
                            body.innerHTML = `<div style="text-align:center;padding:40px;">
                                <div style="font-size:3rem;margin-bottom:16px;">📕</div>
                                <p style="color:#dc2626;">No se pudo cargar el visor de PDF</p>
                                <p style="color:#64748b;">Usa el botón de descarga</p>
                            </div>`;
                        }
                    }, 200);
                    return;
                }

                const arrayBuffer = await obtenerArrayBuffer(source);
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                
                body.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px;background:#f1f5f9;min-height:300px;">
                        <p style="color:#64748b;font-size:0.9rem;font-weight:600;">📕 PDF — ${pdf.numPages} página${pdf.numPages > 1 ? 's' : ''}</p>
                        <div id="pdf-pages" style="display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;max-width:800px;"></div>
                    </div>
                `;

                const pagesContainer = document.getElementById('pdf-pages');
                const paginasARenderizar = Math.min(pdf.numPages, 5);
                
                for (let i = 1; i <= paginasARenderizar; i++) {
                    const page = await pdf.getPage(i);
                    const scale = 1.5;
                    const viewport = page.getViewport({ scale });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.style.maxWidth = '100%';
                    canvas.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    canvas.style.borderRadius = '8px';
                    
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    const wrapper = document.createElement('div');
                    wrapper.style.display = 'flex';
                    wrapper.style.flexDirection = 'column';
                    wrapper.style.alignItems = 'center';
                    wrapper.style.gap = '8px';
                    
                    if (pdf.numPages > 1) {
                        const label = document.createElement('span');
                        label.textContent = `Página ${i}`;
                        label.style.color = '#94a3b8';
                        label.style.fontSize = '0.8rem';
                        label.style.fontWeight = '600';
                        wrapper.appendChild(label);
                    }
                    
                    wrapper.appendChild(canvas);
                    pagesContainer.appendChild(wrapper);
                }

                if (pdf.numPages > 5) {
                    const mas = document.createElement('p');
                    mas.textContent = `... y ${pdf.numPages - 5} páginas más. Descarga el archivo para ver completo.`;
                    mas.style.color = '#94a3b8';
                    mas.style.fontSize = '0.85rem';
                    mas.style.fontStyle = 'italic';
                    pagesContainer.appendChild(mas);
                }

                const src = await sourceUrl();
                descargar.href = src;

            } catch (e) {
                console.error('Error PDF:', e);
                const src = await sourceUrl();

                // Error genérico - ya no hay CLOUDINARY_401 porque subimos como image
                body.innerHTML = `
                    <div style="text-align:center;padding:40px;">
                        <div style="font-size:3rem;margin-bottom:16px;">📕</div>
                        <p style="color:#dc2626;font-weight:600;margin-bottom:8px;">No se pudo renderizar el PDF</p>
                        <p style="color:#64748b;font-size:0.9rem;margin-bottom:20px;">${e.message || 'Error desconocido'}</p>
                        <button onclick="descargarArchivo('${src}', '${nombre}')" style="
                            display:inline-flex;align-items:center;gap:8px;
                            background:linear-gradient(135deg,#4e73df,#3b5dd9);
                            color:white;padding:12px 24px;border-radius:12px;
                            border:none;cursor:pointer;font-weight:700;font-size:0.95rem;
                        ">⬇ Descargar PDF</button>
                    </div>
                `;
                descargar.href = src;
            }
        };

        cargarPDF();
        return;
    }

    // ===== WORD =====
    if (tipo === 'word') {
        const cargarWord = async () => {
            try {
                const arrayBuffer = await obtenerArrayBuffer(source);
                if (!window.mammoth) {
                    let intentos = 0;
                    const esperar = setInterval(() => {
                        intentos++;
                        if (window.mammoth) { clearInterval(esperar); cargarWord(); }
                        else if (intentos > 20) {
                            clearInterval(esperar);
                            body.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;">📝 Descarga el archivo para verlo</div>`;
                        }
                    }, 200);
                    return;
                }

                mammoth.convertToHtml({ arrayBuffer })
                    .then(result => {
                        body.innerHTML = `<div class="vp-word-render">${result.value || "<p style='color:#999'>Documento vacío o sin contenido legible.</p>"}</div>`;
                    })
                    .catch(() => {
                        body.innerHTML = `<div class="vp-word">
                            <div class="vp-word-icon">📝</div>
                            <p class="vp-word-text">No se pudo renderizar el documento</p>
                            <p class="vp-word-hint">Descarga el archivo para verlo completo</p>
                        </div>`;
                    });
            } catch(e) {
                body.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ Error al leer el archivo</div>`;
            }
        };

        cargarWord();
        const src = await sourceUrl();
        descargar.href = src;
        return;
    }

    // ===== EXCEL =====
    if (tipo === 'excel') {
        const cargarExcel = async () => {
            try {
                const buffer = await obtenerArrayBuffer(source);
                const workbook = XLSX.read(buffer, { type: "array" });

                if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                    throw new Error("No hay hojas en el libro");
                }

                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const html = XLSX.utils.sheet_to_html(sheet, { 
                    id: "tabla-excel", 
                    editable: false,
                    header: "<thead><tr>",
                    footer: "</tr></thead>"
                });

                body.innerHTML = `
                    <div class="vp-excel-render">
                        <p style="font-size:0.85rem;color:#64748b;margin-bottom:12px;padding:0 4px;display:flex;align-items:center;gap:8px;">
                            <span style="font-size:1.2rem;">📊</span> 
                            Hoja: <strong style="color:#1e293b;">${escapeHTML(sheetName)}</strong>
                            ${workbook.SheetNames.length > 1 ? `<span style="font-size:0.75rem;color:#94a3b8;">(+${workbook.SheetNames.length - 1} más)</span>` : ''}
                        </p>
                        <div style="overflow:auto;max-height:400px;border-radius:12px;border:1px solid #e2e8f0;">
                            ${html}
                        </div>
                    </div>`;

                const tabla = body.querySelector("#tabla-excel");
                if (tabla) {
                    tabla.style.borderCollapse = "collapse";
                    tabla.style.fontSize = "0.85rem";
                    tabla.style.minWidth = "100%";
                    tabla.style.fontFamily = "'Plus Jakarta Sans', sans-serif";

                    tabla.querySelectorAll("th").forEach(th => {
                        th.style.background = "linear-gradient(135deg, #4e73df 0%, #3b5dd9 100%)";
                        th.style.color = "white";
                        th.style.padding = "10px 12px";
                        th.style.textAlign = "left";
                        th.style.fontWeight = "600";
                    });

                    tabla.querySelectorAll("td").forEach(td => {
                        td.style.padding = "8px 12px";
                        td.style.borderBottom = "1px solid #e2e8f0";
                        td.style.color = "#475569";
                    });

                    tabla.querySelectorAll("tr:nth-child(even)").forEach(tr => {
                        tr.style.background = "#f8fafc";
                    });
                }
            } catch(e) {
                console.error("Error Excel:", e);
                body.innerHTML = `
                    <div style="text-align:center;padding:40px;">
                        <div style="font-size:3rem;margin-bottom:16px;">📊</div>
                        <p style="color:#dc2626;font-weight:600;margin-bottom:8px;">No se pudo renderizar el archivo Excel</p>
                        <p style="color:#64748b;font-size:0.9rem;">${e.message || 'El formato puede no ser compatible'}</p>
                    </div>`;
            }
        };

        if (window.XLSX && window.XLSX.read) {
            cargarExcel();
        } else {
            let intentos = 0;
            const maxIntentos = 30;
            const esperar = setInterval(() => {
                intentos++;
                if (window.XLSX && window.XLSX.read) { 
                    clearInterval(esperar); 
                    cargarExcel(); 
                }
                else if (intentos > maxIntentos) {
                    clearInterval(esperar);
                    body.innerHTML = `<div style="text-align:center;padding:40px;">
                        <div style="font-size:3rem;margin-bottom:16px;">📊</div>
                        <p style="color:#64748b;">Cargando librería... usa la descarga</p>
                    </div>`;
                }
            }, 200);
        }
        const src = await sourceUrl();
        descargar.href = src;
        return;
    }

    // ===== POWERPOINT =====
    if (tipo === 'powerpoint') {
        const src = await sourceUrl();
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:20px;padding:40px;">
                <div style="font-size:4rem;">📊</div>
                <p style="color:#1e293b;font-weight:700;font-size:1.1rem;">Presentación de PowerPoint</p>
                <p style="color:#64748b;font-size:0.9rem;text-align:center;max-width:400px;">
                    Las presentaciones no se pueden previsualizar directamente en el navegador.
                </p>
                <a href="${src}" download="${nombre}" style="
                    display:inline-flex;align-items:center;gap:8px;
                    background:linear-gradient(135deg,#c026d3,#a21caf);
                    color:white;padding:12px 24px;border-radius:12px;
                    text-decoration:none;font-weight:700;font-size:0.95rem;
                    transition:all 0.3s;
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                    📥 Descargar para ver
                </a>
            </div>
        `;
        descargar.href = src;
        return;
    }

    // ===== VIDEO =====
    if (tipo === 'video') {
        const src = await sourceUrl();
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:20px;">
                <video controls style="max-width:100%;max-height:70vh;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);" poster="">
                    <source src="${src}" type="video/mp4">
                    Tu navegador no soporta video HTML5.
                </video>
                <p style="color:#64748b;font-size:0.85rem;">${escapeHTML(nombre)}</p>
            </div>
        `;
        descargar.href = src;
        return;
    }

    // ===== IMAGEN =====
    if (tipo === 'imagen') {
        const src = await sourceUrl();
        body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;padding:20px;min-height:300px;">
                <img src="${src}" style="max-width:100%;max-height:70vh;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);" alt="${escapeHTML(nombre)}">
            </div>
        `;
        descargar.href = src;
        return;
    }

    // ===== GENÉRICO =====
    const src = await sourceUrl();
    body.innerHTML = `
        <div style="text-align:center;padding:40px;">
            <div style="font-size:4rem;margin-bottom:16px;">📎</div>
            <p style="color:#1e293b;font-weight:700;font-size:1.1rem;">${escapeHTML(nombre)}</p>
            <p style="color:#64748b;font-size:0.9rem;margin-top:8px;">Este tipo de archivo no se puede previsualizar.</p>
            <a href="${src}" download="${nombre}" style="
                display:inline-flex;align-items:center;gap:8px;
                background:linear-gradient(135deg,#4e73df,#3b5dd9);
                color:white;padding:12px 24px;border-radius:12px;
                text-decoration:none;font-weight:700;font-size:0.95rem;
                margin-top:16px;
            ">📥 Descargar archivo</a>
        </div>
    `;
    descargar.href = src;
}

function cerrarVistaPrevia() {
    const modal = document.getElementById("modal-vista-previa");
    if (modal) modal.style.display = "none";
    // Pausar videos al cerrar
    const videos = modal?.querySelectorAll('video');
    videos?.forEach(v => v.pause());
}

/* ==================== VISTA PROFESOR ==================== */
let selNotas = [];
let archivosNotas = [];
let selectedAulas = [];

function renderNotasProfesor(cont) {
    selNotas = []; 
    archivosNotas = [];
    selectedAulas = [];

    cont.innerHTML = `
        <div class="box">
            <h3>📚 Subir notas</h3>
            <div class="buscador">
                <input type="text" id="buscarNota" placeholder="Buscar nombre o DNI">
                <select id="gradoNota">
                    <option value="">Grado</option>
                    <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                </select>
                <select id="seccionNota">
                    <option value="">Sección</option>
                    <option>A</option><option>B</option>
                </select>
                    <button type="button" id="btnTodoAula" class="btn-seleccionar-aula-mini" disabled title="Seleccionar toda el aula">📚 Aula completa</button>
            </div>
            <div id="listaNotas" class="lista-scroll"></div>
            <div id="msg-seleccion" class="msg-seleccion" style="display:none;">
                <div class="msg-seleccion-content">
                    <span class="msg-icon">✅</span>
                    <div class="msg-text">
                        <p><strong>¡Estudiante agregado!</strong></p>
                        <p>Puedes buscar y agregar más estudiantes, o confirmar para continuar.</p>
                    </div>
                </div>
            </div>
            <div class="seleccionados-box">
                <h4>Seleccionados: <span id="contadorSeleccionados">0</span></h4>
                <div id="selNotasBox"></div>
                <button class="btn-confirmar" onclick="confirmarNotas()">Confirmar</button>
            </div>
            <div id="formSubida" class="form-subida" style="display:none;">
                <textarea id="msgNota" placeholder="Escribe un mensaje..."></textarea>
                <div class="archivos-preview" id="archivosPreview"></div>
                <input type="file" id="fileNota" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.webm,.mov,image/*" onchange="handleFilesNotas(this)">
                <label for="fileNota" class="btn-file">📎 Adjuntar archivos (PDF, Word, Excel, PowerPoint, Video, Imágenes)</label>
                <button class="btn-enviar" onclick="subirNotas()">📤 Enviar</button>
            </div>
        </div>
        <div id="previewNotas"></div>
    `;

    document.getElementById("buscarNota").addEventListener("input", buscarNotas);
    document.getElementById("gradoNota").addEventListener("change", buscarNotas);
    document.getElementById("seccionNota").addEventListener("change", buscarNotas);
    mostrarPreviewNotas();

    const btnTodo = document.getElementById('btnTodoAula');
    function actualizarBtnAula() {
        if (!btnTodo) return;
        const g = document.getElementById('gradoNota').value;
        const s = document.getElementById('seccionNota').value;
        btnTodo.disabled = !(g && s);
        btnTodo.style.opacity = btnTodo.disabled ? '0.6' : '1';
    }
    if (btnTodo) {
        actualizarBtnAula();
        document.getElementById('gradoNota').addEventListener('change', actualizarBtnAula);
        document.getElementById('seccionNota').addEventListener('change', actualizarBtnAula);

        btnTodo.addEventListener('click', () => {
            const grado = document.getElementById('gradoNota').value;
            const seccion = document.getElementById('seccionNota').value;
            if (!grado || !seccion) { toast('Selecciona grado y sección primero', 'warning'); return; }

            const estudiantes = getEstudiantes();
            const aula = estudiantes.filter(est => String(est.grado) === String(grado) && String(est.seccion) === String(seccion));
            if (!aula.length) { toast(`No hay estudiantes en ${grado}° "${seccion}"`, 'warning'); return; }

            const aulaExiste = selectedAulas.some(a => String(a.grado) === String(grado) && String(a.seccion) === String(seccion));
            if (!aulaExiste) {
                selectedAulas.push({ grado, seccion, label: `Aula ${grado} ${seccion.toUpperCase()}` });
            }

            let agregados = 0;
            aula.forEach(est => { if (!selNotas.some(s => s.dni === est.dni)) { selNotas.push(est); agregados++; } });

            if (agregados > 0 || !aulaExiste) {
                actualizarContador();
                renderSelNotas();
                buscarNotas();
                toast(`✅ Aula ${grado} ${seccion.toUpperCase()} seleccionada`,'success');
            } else {
                toast('Todos los estudiantes de esta aula ya están seleccionados', 'info');
            }
        });
    }
}

function handleFilesNotas(input) {
    archivosNotas = Array.from(input.files);
    const preview = document.getElementById("archivosPreview");

    if (!archivosNotas.length) {
        preview.innerHTML = "";
        return;
    }

    preview.innerHTML = archivosNotas.map(file => {
        const tipoArchivo = detectarTipoArchivo({ tipo: file.type, nombre: file.name });
        
        const iconos = {
            imagen: '🖼️', pdf: '📕', word: '📝', excel: '📊', 
            powerpoint: '📊', video: '🎬', generico: '📎'
        };

        return `
            <div class="file-tag file-tag-preview">
                <span>${iconos[tipoArchivo] || '📎'} ${escapeHTML(file.name)}</span>
            </div>
        `;
    }).join("");
}

function leerArchivoComoDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function previewFileNota(index) {
    const file = archivosNotas[index];
    if (!file) return;

    const tipo = detectarTipoArchivo({ tipo: file.type, nombre: file.name });
    if (tipo === 'generico') return;
    
    const source = await leerArchivoComoDataURL(file);
    abrirVistaPrevia(source, tipo, file.name);
}

function buscarNotas() {
    const texto = document.getElementById("buscarNota").value.toLowerCase();
    const grado = document.getElementById("gradoNota").value;
    const seccion = document.getElementById("seccionNota").value;
    const lista = document.getElementById("listaNotas");
    const msgSeleccion = document.getElementById("msg-seleccion");
    lista.innerHTML = "";

    const estudiantes = getEstudiantes();
    const res = estudiantes.filter(est =>
        (est.nombre.toLowerCase().includes(texto) || est.dni.includes(texto)) &&
        (!grado || String(est.grado) === String(grado)) &&
        (!seccion || String(est.seccion) === String(seccion))
    );

    if (!res.length) {
        lista.innerHTML = `<div class="lista-vacia"><p>🔍 No se encontraron estudiantes</p></div>`;
        return;
    }

    res.forEach((est, index) => {
        const seleccionado = selNotas.some(s => s.dni === est.dni);
        const div = document.createElement("div");
        div.className = "item-estudiante";
        div.innerHTML = `
            <span>
                <strong>${escapeHTML(est.nombre)}</strong>
                <small>${est.grado}° ${est.seccion}</small>
            </span>
            ${seleccionado ?
                `<button class="btn-agregar btn-agregado" disabled>Seleccionado</button>` :
                `<button class="btn-agregar" onclick="agregarNota('${est.dni}')">Agregar</button>`}
        `;
        lista.appendChild(div);

        if (window.animarEntradaUnica) animarEntradaUnica(div, index * 60);
    });

    msgSeleccion.style.display = "none";
}

function agregarNota(dni) {
    const est = getEstudiantes().find(e => e.dni === dni);
    if (!est || selNotas.some(s => s.dni === dni)) return;
    selNotas.push(est);

    document.getElementById("buscarNota").value = "";
    document.getElementById("msg-seleccion").style.display = "block";

    actualizarContador();
    buscarNotas();
    renderSelNotas();

    setTimeout(() => {
        const msg = document.getElementById("msg-seleccion");
        if (msg) msg.style.display = "none";
    }, 3000);
}

function renderSelNotas() {
    const box = document.getElementById("selNotasBox");
    if (!selNotas.length) {
        box.innerHTML = "<p class='hint'>No hay seleccionados</p>";
        return;
    }

    const gruposHtml = selectedAulas.map((aula, i) =>
        `<span class="tag tag-aula">${escapeHTML(aula.label)} <b onclick="quitarAula(${i})" title="Quitar aula">×</b></span>`
    ).join("");

    const estudiantesIndividuales = selNotas.filter(est =>
        !selectedAulas.some(aula => String(est.grado) === String(aula.grado) && String(est.seccion) === String(aula.seccion))
    );

    const alumnosHtml = estudiantesIndividuales.map(est =>
        `<span class="tag">${escapeHTML(est.nombre)} <b onclick="quitarNota('${escapeHTML(est.dni)}')" title="Quitar">×</b></span>`
    ).join("");

    box.innerHTML = gruposHtml + alumnosHtml;
}

function actualizarContador() {
    const contador = document.getElementById('contadorSeleccionados');
    if (contador) contador.textContent = selNotas.length;
}

function quitarAula(i) {
    const aula = selectedAulas[i];
    if (!aula) return;
    selectedAulas.splice(i, 1);
    selNotas = selNotas.filter(est => !(String(est.grado) === String(aula.grado) && String(est.seccion) === String(aula.seccion)));
    actualizarContador();
    buscarNotas();
    renderSelNotas();
}

function quitarNota(dni) {
    selNotas = selNotas.filter(est => est.dni !== dni);
    actualizarContador();
    buscarNotas();
    renderSelNotas();
}

function confirmarNotas() {
    if (!selNotas.length) {
        toast("Selecciona al menos un estudiante", "warning");
        return;
    }
    document.getElementById("formSubida").style.display = "block";
    const msg = document.getElementById("msg-seleccion");
    if (msg) msg.style.display = "none";
}

async function subirNotas() {
    const msg = document.getElementById("msgNota").value.trim();
    if (!selNotas.length) {
        toast("Selecciona estudiantes", "warning");
        return;
    }
    if (!archivosNotas.length) {
        toast("Selecciona archivos", "warning");
        return;
    }

    const prof = getUsuarioActual();

    mostrarOverlayCarga(
        "Enviando notas...", 
        `Subiendo ${archivosNotas.length} archivo${archivosNotas.length > 1 ? 's' : ''} para ${selNotas.length} estudiante${selNotas.length > 1 ? 's' : ''}`
    );

    try {
        actualizarOverlayCarga(
            "Subiendo archivos...", 
            "Esto puede tardar unos segundos dependiendo del tamaño"
        );

        const archivosSubidos = await Promise.all(archivosNotas.map(async (file) => {
            const path = `notas/${Date.now()}_${file.name}`;
            const url = await subirArchivoStorage(file, path);
            return {
                nombre: file.name,
                tipo: file.type,
                url: url,
                base64: null
            };
        }));

        const fechaEnvio = new Date();
        fechaEnvio.setMilliseconds(0);
        const fechaISO = fechaEnvio.toISOString();

        actualizarOverlayCarga(
            "Guardando notas...", 
            `Registrando para ${selNotas.length} estudiante${selNotas.length > 1 ? 's' : ''}`
        );

        for (const est of selNotas) {
            const notaData = {
                profesor_usuario: prof.usuario,
                estudiante_dni: est.dni,
                nombre_estudiante: est.nombre,
                grado: est.grado,
                seccion: est.seccion,
                mensaje: msg,
                fecha: fechaISO,
                archivos: archivosSubidos
            };
            await pushData('notas', notaData);
        }

        ocultarOverlayCarga();
        
        selNotas = []; 
        archivosNotas = [];
        renderNotasProfesor(document.getElementById("modulo-contenido"));
        toast("✅ Notas enviadas correctamente", "success");

    } catch (e) {
        ocultarOverlayCarga();
        toast("❌ Error al enviar notas", "error");
        console.error(e);
    }
}

async function mostrarPreviewNotas() {
    const preview = document.getElementById("previewNotas");
    if (!preview) return;

    const usuario = SESION.get("usuario");

    try {
        const notasData = await getData('notas');
        const notas = [];

        if (notasData) {
            Object.entries(notasData).forEach(([key, n]) => {
                if (n.profesor_usuario === usuario) {
                    notas.push({ ...n, id: key });
                }
            });
        }

        notas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!notas.length) { 
            preview.innerHTML = "<p class='vacio'>No hay notas enviadas aún</p>"; 
            return; 
        }

        const enviosMap = new Map();

        notas.forEach(n => {
            const fechaObj = new Date(n.fecha);
            fechaObj.setMilliseconds(0);
            const fechaKey = fechaObj.toISOString();

            const archivosKey = (n.archivos || [])
                .map(a => a.nombre || a.url?.split('/').pop() || '')
                .sort()
                .join('|');

            const mensajeKey = (n.mensaje || '').trim();
            const envioKey = `${fechaKey}||${mensajeKey}||${archivosKey}`;

            if (!enviosMap.has(envioKey)) {
                enviosMap.set(envioKey, {
                    fecha: n.fecha,
                    mensaje: n.mensaje,
                    archivos: n.archivos,
                    estudiantes: [],
                    ids: []
                });
            }

            const envio = enviosMap.get(envioKey);
            if (!envio.estudiantes.some(e => e.dni === n.estudiante_dni)) {
                envio.estudiantes.push({
                    nombre: n.nombre_estudiante,
                    dni: n.estudiante_dni,
                    grado: n.grado,
                    seccion: n.seccion
                });
                envio.ids.push(n.id);
            }
        });

        const envios = Array.from(enviosMap.values());

        const buscadorProfHtml = `
        <div class="buscador-historial buscador-profesor">
            <div class="buscador-inputs">
                <div class="buscador-grupo">
                    <i class="bx bx-search"></i>
                    <input type="text" id="buscarProfEstudianteNota" placeholder="Buscar por nombre de estudiante..." oninput="filtrarNotasProfesor()">
                </div>
                <div class="buscador-grupo">
                    <i class="bx bx-calendar"></i>
                    <input type="date" id="buscarProfFechaNota" onchange="filtrarNotasProfesor()">
                </div>
                <button class="btn-limpiar-busqueda" onclick="limpiarBusquedaProfesorNota()" title="Limpiar filtros">
                    <i class="bx bx-x"></i>
                </button>
            </div>
            <div id="resultados-info-profesor-nota" class="resultados-info"></div>
        </div>`;

        const profesores = await getData('profesores');
        const prof = profesores ? profesores[usuario.replace(/\./g, '_')] : null;
        const fotoProf = await getFotoPerfil(usuario, 'profesor');

        const cardsHtml = envios.map(envio => {
            const totalEst = envio.estudiantes.length;
            const primeros3 = envio.estudiantes.slice(0, 3);
            const restantes = totalEst - 3;

            let destinatariosHtml = '';
            if (totalEst === 1) {
                destinatariosHtml = `<strong>${escapeHTML(envio.estudiantes[0].nombre)}</strong>`;
            } else {
                const nombresPrimeros = primeros3.map(e => escapeHTML(e.nombre)).join(', ');
                destinatariosHtml = `<strong>${nombresPrimeros}</strong>`;
                if (restantes > 0) {
                    destinatariosHtml += ` <span class="badge-mas-est">+${restantes} más</span>`;
                }
                destinatariosHtml += ` <span class="badge-total-est">${totalEst} estudiante${totalEst > 1 ? 's' : ''}</span>`;
            }

            const aulasUnicas = [...new Set(envio.estudiantes.map(e => `${e.grado}° ${e.seccion}`))];
            const aulasBadge = aulasUnicas.length > 0 
                ? `<span class="aula-badge">${aulasUnicas.join(', ')}</span>` 
                : '';

            const idsJson = JSON.stringify(envio.ids);

            return `
            <div class="card nota-card" data-ids='${idsJson}'>
                <div class="header">
                    <div class="nota-header-con-foto">
                        ${renderFotoPerfilMini(fotoProf, prof?.nombre || usuario)}
                        <div class="nota-header-info">
                            <h4>👦 Para: ${destinatariosHtml}</h4>
                            ${aulasBadge}
                        </div>
                        <span class="fecha">${formatFecha(envio.fecha)}</span>
                    </div>
                </div>
                <div class="profesor-badge">
                    ${escapeHTML(prof?.emoji || "👨‍🏫")} ${escapeHTML(prof?.nombre || usuario)} 
                    ${prof?.curso ? "· " + escapeHTML(prof.curso) : ""}
                </div>
                <p class="mensaje-texto">${escapeHTML(envio.mensaje || "")}</p>
                <div class="galeria-fotos">${(envio.archivos || []).map(a => mostrarArchivoNota(a)).join("")}</div>
                <button class="btn-eliminar" onclick="eliminarNotaEnvio('${idsJson.replace(/"/g, '&quot;')}', '${totalEst}')">❌ Eliminar envío</button>
            </div>
            `;
        }).join("");

        preview.innerHTML = buscadorProfHtml + `<div id="lista-notas-profesor">${cardsHtml}</div>`;

        activarModalNotas();

        const cards = preview.querySelectorAll('.nota-card');
        if (window.animarEntrada) animarEntrada(cards, 100, 80);

    } catch (e) {
        preview.innerHTML = "<p class='vacio'>Error al cargar notas.</p>";
        console.error(e);
    }
}

function mostrarArchivoNota(a) {
    const tipoArchivo = detectarTipoArchivo(a);
    const archivoUrl = a.url || a.base64;
    const nombreSafe = escapeHTML(a.nombre || 'archivo');
    const downloadAttr = `download="${nombreSafe}"`;

    if (tipoArchivo === 'imagen') {
        return `
        <div class="foto-item">
            <img src="${archivoUrl}" class="img-click" alt="${nombreSafe}" onclick="abrirModal('${archivoUrl}')">
            <a href="javascript:void(0)" onclick="descargarArchivo('${archivoUrl}', '${nombreSafe}')" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    if (tipoArchivo === 'pdf') {
        return `
        <div class="foto-item archivo-item">
            <div class="vista-previa-pdf" onclick="abrirVistaPrevia('${archivoUrl}', 'pdf', '${nombreSafe}')">
                <div class="preview-icon">📕</div>
                <div class="preview-info">
                    <span class="preview-nombre">${nombreSafe}</span>
                    <span class="preview-tipo">PDF Documento</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>
            <a href="javascript:void(0)" onclick="descargarArchivo('${archivoUrl}', '${nombreSafe}')" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    if (tipoArchivo === 'word') {
        return `
        <div class="foto-item archivo-item">
            <div class="vista-previa-word" onclick="abrirVistaPrevia('${archivoUrl}', 'word', '${nombreSafe}')">
                <div class="preview-icon">📝</div>
                <div class="preview-info">
                    <span class="preview-nombre">${nombreSafe}</span>
                    <span class="preview-tipo">Word Documento</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>
            <a href="javascript:void(0)" onclick="descargarArchivo('${archivoUrl}', '${nombreSafe}')" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    if (tipoArchivo === 'excel') {
        return `
        <div class="foto-item archivo-item">
            <div class="vista-previa-excel" onclick="abrirVistaPrevia('${archivoUrl}', 'excel', '${nombreSafe}')">
                <div class="preview-icon">📊</div>
                <div class="preview-info">
                    <span class="preview-nombre">${nombreSafe}</span>
                    <span class="preview-tipo">Excel Hoja de cálculo</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>
            <a href="javascript:void(0)" onclick="descargarArchivo('${archivoUrl}', '${nombreSafe}')" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    if (tipoArchivo === 'powerpoint') {
        return `
        <div class="foto-item archivo-item">
            <div class="vista-previa-powerpoint" onclick="abrirVistaPrevia('${archivoUrl}', 'powerpoint', '${nombreSafe}')">
                <div class="preview-icon">📊</div>
                <div class="preview-info">
                    <span class="preview-nombre">${nombreSafe}</span>
                    <span class="preview-tipo">PowerPoint Presentación</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>
            <a href="javascript:void(0)" onclick="descargarArchivo('${archivoUrl}', '${nombreSafe}')" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    if (tipoArchivo === 'video') {
        return `
        <div class="foto-item archivo-item">
            <div class="vista-previa-video" onclick="abrirVistaPrevia('${archivoUrl}', 'video', '${nombreSafe}')">
                <div class="preview-icon">🎬</div>
                <div class="preview-info">
                    <span class="preview-nombre">${nombreSafe}</span>
                    <span class="preview-tipo">Video</span>
                </div>
                <div class="preview-ver">▶ Reproducir</div>
            </div>
            <a href="javascript:void(0)" onclick="descargarArchivo('${archivoUrl}', '${nombreSafe}')" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    return `
    <div class="foto-item archivo-item">
        <div class="archivo-adjunto archivo-generico">
            <div class="preview-icon">📎</div>
            <div class="preview-nombre">${nombreSafe}</div>
        </div>
        <a href="javascript:void(0)" onclick="descargarArchivo('${archivoUrl}', '${nombreSafe}')" class="btn-descargar">⬇ Descargar</a>
    </div>`;
}

function formatFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function eliminarNotaEnvio(idsJson, cantidad) {
    const ids = JSON.parse(idsJson);
    const texto = cantidad > 1 ? `este envío (${cantidad} estudiantes)` : "esta nota";
    
    confirmarEliminar(texto, async () => {
        try {
            for (const id of ids) {
                await deleteData(`notas/${id}`);
            }
            await mostrarPreviewNotas();
            toast(cantidad > 1 ? `🗑️ Envío eliminado (${cantidad} notas)` : "🗑️ Nota eliminada", "delete");
        } catch (e) {
            toast("❌ Error al eliminar", "error");
        }
    });
}

function activarModalNotas() {
    document.querySelectorAll(".img-pequena, .img-click").forEach(img => {
        img.onclick = () => abrirModal(img.src);
    });
}

/* ==================== BUSCADORES ==================== */
function filtrarNotasPadre() {
    const texto = document.getElementById('buscarPadreProfesorNota')?.value.toLowerCase().trim() || '';
    const fecha = document.getElementById('buscarPadreFechaNota')?.value || '';
    const contenedor = document.getElementById('lista-notas-padre');
    const info = document.getElementById('resultados-info-padre-nota');
    if (!contenedor) return;

    const cards = contenedor.querySelectorAll('.nota-card');
    let visibles = 0;

    cards.forEach(card => {
        const nombreProf = card.querySelector('.nota-header-info h4 strong')?.textContent.toLowerCase() || '';
        const fechaTexto = card.querySelector('.fecha')?.textContent || '';
        const fechaCard = extraerFechaDeTextoNota(fechaTexto);

        const coincideTexto = !texto || nombreProf.includes(texto);
        const coincideFecha = !fecha || fechaCard === fecha;

        if (coincideTexto && coincideFecha) {
            card.style.display = '';
            visibles++;
        } else {
            card.style.display = 'none';
        }
    });

    if (info) {
        if (texto || fecha) {
            info.innerHTML = `<span class="info-badge">${visibles} resultado${visibles !== 1 ? 's' : ''}</span>`;
        } else {
            info.innerHTML = '';
        }
    }

    const sinResultados = contenedor.querySelector('.sin-resultados-busqueda');
    if (visibles === 0 && (texto || fecha)) {
        if (!sinResultados) {
            const div = document.createElement('div');
            div.className = 'sin-resultados-busqueda';
            div.innerHTML = `
                <div class="sin-resultados-icon">🔍</div>
                <p>No se encontraron notas</p>
                <p class="hint">Intenta con otro nombre o fecha</p>
            `;
            contenedor.appendChild(div);
        }
    } else if (sinResultados) {
        sinResultados.remove();
    }
}

function limpiarBusquedaPadreNota() {
    const inputTexto = document.getElementById('buscarPadreProfesorNota');
    const inputFecha = document.getElementById('buscarPadreFechaNota');
    if (inputTexto) inputTexto.value = '';
    if (inputFecha) inputFecha.value = '';
    filtrarNotasPadre();
}

function filtrarNotasProfesor() {
    const texto = document.getElementById('buscarProfEstudianteNota')?.value.toLowerCase().trim() || '';
    const fecha = document.getElementById('buscarProfFechaNota')?.value || '';
    const contenedor = document.getElementById('lista-notas-profesor');
    const info = document.getElementById('resultados-info-profesor-nota');
    if (!contenedor) return;

    const cards = contenedor.querySelectorAll('.nota-card');
    let visibles = 0;

    cards.forEach(card => {
        const nombreEst = card.querySelector('.nota-header-info h4')?.textContent.toLowerCase() || '';
        const fechaTexto = card.querySelector('.fecha')?.textContent || '';
        const fechaCard = extraerFechaDeTextoNota(fechaTexto);

        const coincideTexto = !texto || nombreEst.includes(texto);
        const coincideFecha = !fecha || fechaCard === fecha;

        if (coincideTexto && coincideFecha) {
            card.style.display = '';
            visibles++;
        } else {
            card.style.display = 'none';
        }
    });

    if (info) {
        if (texto || fecha) {
            info.innerHTML = `<span class="info-badge">${visibles} resultado${visibles !== 1 ? 's' : ''}</span>`;
        } else {
            info.innerHTML = '';
        }
    }

    const sinResultados = contenedor.querySelector('.sin-resultados-busqueda');
    if (visibles === 0 && (texto || fecha)) {
        if (!sinResultados) {
            const div = document.createElement('div');
            div.className = 'sin-resultados-busqueda';
            div.innerHTML = `
                <div class="sin-resultados-icon">🔍</div>
                <p>No se encontraron notas</p>
                <p class="hint">Intenta con otro nombre o fecha</p>
            `;
            contenedor.appendChild(div);
        }
    } else if (sinResultados) {
        sinResultados.remove();
    }
}

function limpiarBusquedaProfesorNota() {
    const inputTexto = document.getElementById('buscarProfEstudianteNota');
    const inputFecha = document.getElementById('buscarProfFechaNota');
    if (inputTexto) inputTexto.value = '';
    if (inputFecha) inputFecha.value = '';
    filtrarNotasProfesor();
}

function extraerFechaDeTextoNota(texto) {
    if (!texto) return '';
    const limpio = texto.replace('📅', '').trim();
    const partes = limpio.split(',');
    const fechaParte = partes[0].trim();
    const meses = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    const match = fechaParte.match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})/i);
    if (match) {
        const dia = match[1].padStart(2, '0');
        const mes = meses[match[2].toLowerCase()] || '01';
        const anio = match[3];
        return `${anio}-${mes}-${dia}`;
    }
    return '';
}

/* ==================== OVERLAY DE CARGA ==================== */
function mostrarOverlayCarga(mensaje, subtexto) {
    let overlay = document.getElementById('overlay-carga-notas');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'overlay-carga-notas';
        overlay.className = 'overlay-carga';
        overlay.innerHTML = `
            <div class="overlay-carga-contenido">
                <div class="spinner-carga"></div>
                <div class="overlay-carga-barra"></div>
                <p class="overlay-carga-texto" id="overlay-carga-texto">Enviando notas...</p>
                <p class="overlay-carga-subtexto" id="overlay-carga-subtexto">Subiendo archivos, por favor espera</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const textoEl = document.getElementById('overlay-carga-texto');
    const subtextoEl = document.getElementById('overlay-carga-subtexto');
    
    if (textoEl && mensaje) textoEl.textContent = mensaje;
    if (subtextoEl && subtexto) subtextoEl.textContent = subtexto;
    
    overlay.classList.add('activo');
    document.body.style.overflow = 'hidden';
}

function ocultarOverlayCarga() {
    const overlay = document.getElementById('overlay-carga-notas');
    if (overlay) {
        overlay.classList.remove('activo');
    }
    document.body.style.overflow = '';
}

function actualizarOverlayCarga(mensaje, subtexto) {
    const textoEl = document.getElementById('overlay-carga-texto');
    const subtextoEl = document.getElementById('overlay-carga-subtexto');
    if (textoEl && mensaje) textoEl.textContent = mensaje;
    if (subtextoEl && subtexto) subtextoEl.textContent = subtexto;
}

// Exponer funciones globales necesarias
window.initNotas = initNotas;
window.descargarArchivo = descargarArchivo;
window.agregarNota = agregarNota;
window.quitarNota = quitarNota;
window.quitarAula = quitarAula;
window.confirmarNotas = confirmarNotas;
window.subirNotas = subirNotas;
window.eliminarNotaEnvio = eliminarNotaEnvio;
window.abrirVistaPrevia = abrirVistaPrevia;
window.cerrarVistaPrevia = cerrarVistaPrevia;
window.handleFilesNotas = handleFilesNotas;
window.previewFileNota = previewFileNota;
window.filtrarNotasPadre = filtrarNotasPadre;
window.limpiarBusquedaPadreNota = limpiarBusquedaPadreNota;
window.filtrarNotasProfesor = filtrarNotasProfesor;
window.limpiarBusquedaProfesorNota = limpiarBusquedaProfesorNota;
window.mostrarOverlayCarga = mostrarOverlayCarga;
window.ocultarOverlayCarga = ocultarOverlayCarga;
window.actualizarOverlayCarga = actualizarOverlayCarga;
// ================================================
// notas.js — Módulo Notas (Padre + Profesor) con Firebase RTDB + Storage + Foto de perfil
// ================================================

import { getData, pushData, updateData, deleteData } from './firebase-config.js';
import { SESION, getEstudiantes, getHijosPadre, getUsuarioActual, escapeHTML, toast, leerArchivo, subirArchivoStorage, confirmarEliminar, getFotoPerfil, renderFotoPerfilMini } from './data.js';

// Cargar librerías necesarias para vista previa
(function cargarLibrerias() {
    if (!window.mammoth) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
        document.head.appendChild(s);
    }
    if (!window.XLSX) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        document.head.appendChild(s);
    }
})();

function initNotas(contenedor) {
    const rol = SESION.get("rol");
    _quitarBtnRecargar("btn-recargar");
    if (rol === "profesor" || rol === "admin") {
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

        // Ordenar por fecha descendente
        notas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!notas.length) { 
            cont.innerHTML = "<p class='vacio'>No hay notas disponibles aún.</p>"; 
            return; 
        }

        const profesores = await getData('profesores');

        // Precargar fotos de perfil de todos los profesores que enviaron notas
        const profesoresKeys = [...new Set(notas.map(n => n.profesor_usuario))];
        const fotosPerfil = {};
        await Promise.all(profesoresKeys.map(async (profUser) => {
            const foto = await getFotoPerfil(profUser, 'profesor');
            if (foto) fotosPerfil[profUser] = foto;
        }));

        cont.innerHTML = notas.map(n => {
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

        activarModalNotas();
    } catch (e) {
        cont.innerHTML = "<p class='vacio'>Error al cargar notas.</p>";
        console.error(e);
    }
}

function generarGaleria(n) {
    const archivos = n.archivos || [];
    if (!archivos.length) return "";

    return archivos.map(arc => {
        const esImg = arc.tipo?.startsWith("image");
        const esPDF = arc.tipo?.includes("pdf") || arc.nombre?.match(/\.(pdf)$/i);
        const esWord = arc.tipo?.includes("word") || arc.nombre?.match(/\.(doc|docx)$/i);
        const esExcel = arc.tipo?.includes("excel") || arc.tipo?.includes("sheet") || arc.tipo?.includes("spreadsheet") || arc.nombre?.match(/\.(xls|xlsx|xlsm)$/i);

        let previewHTML = "";
        let icono = "📎";

        // Usar URL de Storage si existe, sino base64
        const archivoUrl = arc.url || arc.base64;

        if (esImg) {
            return `
            <div class="foto-item">
                <img src="${archivoUrl}" class="img-pequena" alt="${escapeHTML(arc.nombre)}" onclick="abrirModal('${archivoUrl}')">
                <a href="${archivoUrl}" download="${escapeHTML(arc.nombre || 'archivo')}" class="btn-descargar">⬇ Descargar</a>
            </div>`;
        } else if (esPDF) {
            previewHTML = `<div class="vista-previa-pdf" onclick="abrirVistaPrevia('${archivoUrl}', 'pdf', '${escapeHTML(arc.nombre)}')">
                <div class="preview-icon">📕</div>
                <div class="preview-info">
                    <span class="preview-nombre">${escapeHTML(arc.nombre)}</span>
                    <span class="preview-tipo">PDF Documento</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>`;
        } else if (esWord) {
            previewHTML = `<div class="vista-previa-word" onclick="abrirVistaPrevia('${archivoUrl}', 'word', '${escapeHTML(arc.nombre)}')">
                <div class="preview-icon">📝</div>
                <div class="preview-info">
                    <span class="preview-nombre">${escapeHTML(arc.nombre)}</span>
                    <span class="preview-tipo">Word Documento</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>`;
        } else if (esExcel) {
            previewHTML = `<div class="vista-previa-excel" onclick="abrirVistaPrevia('${archivoUrl}', 'excel', '${escapeHTML(arc.nombre)}')">
                <div class="preview-icon">📊</div>
                <div class="preview-info">
                    <span class="preview-nombre">${escapeHTML(arc.nombre)}</span>
                    <span class="preview-tipo">Excel Hoja de cálculo</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>`;
        } else {
            previewHTML = `<div class="archivo-adjunto archivo-generico">
                <div class="preview-icon">${icono}</div>
                <div class="preview-nombre">${escapeHTML(arc.nombre)}</div>
            </div>`;
        }

        return `
        <div class="foto-item archivo-item">
            ${previewHTML}
            <a href="${archivoUrl}" download="${escapeHTML(arc.nombre || 'archivo')}" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }).join("");
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
                    <a id="vp-descargar" href="#" download="#" class="btn-descargar">⬇ Descargar archivo</a>
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
    descargar.href = typeof source === 'string' ? source : '#';
    descargar.download = nombre;
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
        const response = await fetch(input);
        return await response.arrayBuffer();
    };

    const sourceUrl = async () => {
        if (source instanceof File) {
            return await leerArchivoComoDataURL(source);
        }
        return source;
    };

    if (tipo === 'pdf') {
        const src = await sourceUrl();
        body.innerHTML = `<iframe src="${src}" class="vp-iframe" title="Vista previa PDF"></iframe>`;
        descargar.href = src;

    } else if (tipo === 'word') {
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

    } else if (tipo === 'excel') {
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
                        <p style="color:#94a3b8;font-size:0.85rem;margin-top:16px;">Usa el botón de descarga para verlo</p>
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
                        <p style="color:#64748b;">Cargando librería... usa la descarga temporal</p>
                    </div>`;
                }
            }, 200);
        }
    }
}

function cerrarVistaPrevia() {
    const modal = document.getElementById("modal-vista-previa");
    if (modal) modal.style.display = "none";
}

/* ==================== VISTA PROFESOR ==================== */
let selNotas = [];
let archivosNotas = [];

function renderNotasProfesor(cont) {
    selNotas = []; 
    archivosNotas = [];

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
                <h4>Seleccionados:</h4>
                <div id="selNotasBox"></div>
                <button class="btn-confirmar" onclick="confirmarNotas()">Confirmar</button>
            </div>
            <div id="formSubida" class="form-subida" style="display:none;">
                <textarea id="msgNota" placeholder="Escribe un mensaje..."></textarea>
                <div class="archivos-preview" id="archivosPreview"></div>
                <input type="file" id="fileNota" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onchange="handleFilesNotas(this)">
                <label for="fileNota" class="btn-file">📎 Adjuntar archivos (PDF, Word, Excel, Imágenes)</label>
                <button class="btn-enviar" onclick="subirNotas()">📤 Enviar</button>
            </div>
        </div>
        <div id="previewNotas"></div>
    `;

    document.getElementById("buscarNota").addEventListener("input", buscarNotas);
    document.getElementById("gradoNota").addEventListener("change", buscarNotas);
    document.getElementById("seccionNota").addEventListener("change", buscarNotas);
    mostrarPreviewNotas();
}

function handleFilesNotas(input) {
    archivosNotas = Array.from(input.files);
    const preview = document.getElementById("archivosPreview");

    if (!archivosNotas.length) {
        preview.innerHTML = "";
        return;
    }

    preview.innerHTML = archivosNotas.map(file => {
        const esImg = file.type.startsWith("image");
        const esPDF = file.type.includes("pdf") || file.name.match(/\.(pdf)$/i);
        const esWord = file.type.includes("word") || file.name.match(/\.(doc|docx)$/i);
        const esExcel = file.type.includes("excel") || file.type.includes("sheet") || file.type.includes("spreadsheet") || file.name.match(/\.(xls|xlsx|xlsm)$/i);

        let icono = "📎";
        if (esImg) icono = "🖼️";
        else if (esPDF) icono = "📕";
        else if (esWord) icono = "📝";
        else if (esExcel) icono = "📊";

        return `
            <div class="file-tag file-tag-preview">
                <span>${icono} ${escapeHTML(file.name)}</span>
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

    const tipo = file.type.includes("pdf") ? "pdf"
        : file.type.includes("word") || file.name.match(/\.(doc|docx)$/i) ? "word"
        : file.type.includes("excel") || file.type.includes("sheet") || file.type.includes("spreadsheet") || file.name.match(/\.(xls|xlsx|xlsm)$/i) ? "excel"
        : file.type.startsWith("image") ? "image"
        : null;

    if (!tipo) return;
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
        (!grado || est.grado === grado) &&
        (!seccion || est.seccion === seccion) &&
        !selNotas.some(s => s.dni === est.dni)
    );

    if (!res.length) {
        const todosSeleccionados = estudiantes.filter(est =>
            (est.nombre.toLowerCase().includes(texto) || est.dni.includes(texto)) &&
            (!grado || est.grado === grado) &&
            (!seccion || est.seccion === seccion)
        ).every(est => selNotas.some(s => s.dni === est.dni));

        if (todosSeleccionados && selNotas.length > 0) {
            lista.innerHTML = `
                <div class="lista-vacia">
                    <p>✅ Todos los estudiantes de esta búsqueda ya están seleccionados</p>
                    <p class="lista-vacia-hint">Puedes confirmar los seleccionados o buscar otros</p>
                </div>`;
        } else if (texto || grado || seccion) {
            lista.innerHTML = `<div class="lista-vacia"><p>🔍 No se encontraron estudiantes</p></div>`;
        }
        return;
    }

    res.forEach(est => {
        const div = document.createElement("div");
        div.className = "item-estudiante";
        div.innerHTML = `
            <span>
                <strong>${escapeHTML(est.nombre)}</strong>
                <small>${est.grado}° ${est.seccion}</small>
            </span>
            <button class="btn-agregar" onclick="agregarNota('${est.dni}')">Agregar</button>
        `;
        lista.appendChild(div);
    });

    msgSeleccion.style.display = "none";
}

function agregarNota(dni) {
    const est = getEstudiantes().find(e => e.dni === dni);
    if (!est || selNotas.some(s => s.dni === dni)) return;
    selNotas.push(est);

    document.getElementById("buscarNota").value = "";
    document.getElementById("msg-seleccion").style.display = "block";

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
    box.innerHTML = selNotas.map((est, i) => 
        `<span class="tag">${escapeHTML(est.nombre)} <b onclick="quitarNota(${i})" title="Quitar">×</b></span>`
    ).join("");
}

function quitarNota(i) {
    selNotas.splice(i, 1);
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

    try {
        // Subir archivos a Firebase Storage primero
        const archivosSubidos = await Promise.all(archivosNotas.map(async (file) => {
            const path = `notas/${Date.now()}_${file.name}`;
            const url = await subirArchivoStorage(file, path);
            return {
                nombre: file.name,
                tipo: file.type,
                url: url,
                base64: null // Ya no necesitamos base64, usamos URL de Storage
            };
        }));

        // Crear notas en RTDB para cada estudiante
        for (const est of selNotas) {
            const notaData = {
                profesor_usuario: prof.usuario,
                estudiante_dni: est.dni,
                nombre_estudiante: est.nombre,
                grado: est.grado,
                seccion: est.seccion,
                mensaje: msg,
                fecha: new Date().toISOString(),
                archivos: archivosSubidos
            };
            await pushData('notas', notaData);
        }

        selNotas = []; 
        archivosNotas = [];
        renderNotasProfesor(document.getElementById("modulo-contenido"));
        toast("✅ Notas enviadas correctamente");
    } catch (e) {
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

        // Ordenar por fecha descendente
        notas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!notas.length) { 
            preview.innerHTML = "<p class='vacio'>No hay notas enviadas aún</p>"; 
            return; 
        }

        const profesores = await getData('profesores');
        const prof = profesores ? profesores[usuario.replace(/\./g, '_')] : null;

        // Precargar foto de perfil del profesor logueado
        const fotoProf = await getFotoPerfil(usuario, 'profesor');

        preview.innerHTML = notas.map(n => `
            <div class="card nota-card">
                <div class="header">
                    <div class="nota-header-con-foto">
                        ${renderFotoPerfilMini(fotoProf, prof?.nombre || usuario)}
                        <div class="nota-header-info">
                            <h4>👦 ${escapeHTML(n.nombre_estudiante)}</h4>
                        </div>
                        <span class="fecha">${formatFecha(n.fecha)}</span>
                    </div>
                </div>
                <div class="profesor-badge">
                    ${escapeHTML(prof?.emoji || "👨‍🏫")} ${escapeHTML(prof?.nombre || usuario)} 
                    ${prof?.curso ? "· " + escapeHTML(prof.curso) : ""}
                </div>
                <p class="mensaje-texto">${escapeHTML(n.mensaje || "")}</p>
                <div class="galeria-fotos">${(n.archivos || []).map(a => mostrarArchivoNota(a)).join("")}</div>
                <button class="btn-eliminar" onclick="eliminarNota('${n.id}', '${escapeHTML(n.nombre_estudiante)}')">❌ Eliminar</button>
            </div>
        `).join("");

        activarModalNotas();
    } catch (e) {
        preview.innerHTML = "<p class='vacio'>Error al cargar notas.</p>";
        console.error(e);
    }
}

function mostrarArchivoNota(a) {
    const esImg = a.tipo?.startsWith("image");
    const esPDF = a.tipo?.includes("pdf") || a.nombre?.match(/\.(pdf)$/i);
    const esWord = a.tipo?.includes("word") || a.nombre?.match(/\.(doc|docx)$/i);
    const esExcel = a.tipo?.includes("excel") || a.tipo?.includes("sheet") || a.tipo?.includes("spreadsheet") || a.nombre?.match(/\.(xls|xlsx|xlsm)$/i);

    const archivoUrl = a.url || a.base64;

    if (esImg) {
        return `
        <div class="foto-item">
            <img src="${archivoUrl}" class="img-click" alt="${escapeHTML(a.nombre)}" onclick="abrirModal('${archivoUrl}')">
            <a href="${archivoUrl}" download="${escapeHTML(a.nombre || 'archivo')}" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    if (esPDF) {
        return `
        <div class="foto-item archivo-item">
            <div class="vista-previa-pdf" onclick="abrirVistaPrevia('${archivoUrl}', 'pdf', '${escapeHTML(a.nombre)}')">
                <div class="preview-icon">📕</div>
                <div class="preview-info">
                    <span class="preview-nombre">${escapeHTML(a.nombre)}</span>
                    <span class="preview-tipo">PDF Documento</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>
            <a href="${archivoUrl}" download="${escapeHTML(a.nombre || 'archivo')}" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    if (esWord) {
        return `
        <div class="foto-item archivo-item">
            <div class="vista-previa-word" onclick="abrirVistaPrevia('${archivoUrl}', 'word', '${escapeHTML(a.nombre)}')">
                <div class="preview-icon">📝</div>
                <div class="preview-info">
                    <span class="preview-nombre">${escapeHTML(a.nombre)}</span>
                    <span class="preview-tipo">Word Documento</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>
            <a href="${archivoUrl}" download="${escapeHTML(a.nombre || 'archivo')}" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    if (esExcel) {
        return `
        <div class="foto-item archivo-item">
            <div class="vista-previa-excel" onclick="abrirVistaPrevia('${archivoUrl}', 'excel', '${escapeHTML(a.nombre)}')">
                <div class="preview-icon">📊</div>
                <div class="preview-info">
                    <span class="preview-nombre">${escapeHTML(a.nombre)}</span>
                    <span class="preview-tipo">Excel Hoja de cálculo</span>
                </div>
                <div class="preview-ver">👁 Ver</div>
            </div>
            <a href="${archivoUrl}" download="${escapeHTML(a.nombre || 'archivo')}" class="btn-descargar">⬇ Descargar</a>
        </div>`;
    }

    return `
    <div class="foto-item archivo-item">
        <div class="archivo-adjunto archivo-generico" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;border:2px solid var(--border);background:#f8fafc;">
            <span style="font-size:2rem">📎</span>
            <span class="preview-nombre">${escapeHTML(a.nombre)}</span>
        </div>
        <a href="${archivoUrl}" download="${escapeHTML(a.nombre || 'archivo')}" class="btn-descargar">⬇ Descargar</a>
    </div>`;
}

function formatFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function eliminarNota(id, nombreEstudiante) {
    confirmarEliminar(nombreEstudiante || "esta nota", async () => {
        try {
            await deleteData(`notas/${id}`);
            await mostrarPreviewNotas();
            toast("🗑️ Nota eliminada", "delete");
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

// Exponer funciones globales necesarias
window.initNotas = initNotas;
window.agregarNota = agregarNota;
window.quitarNota = quitarNota;
window.confirmarNotas = confirmarNotas;
window.subirNotas = subirNotas;
window.eliminarNota = eliminarNota;
window.abrirVistaPrevia = abrirVistaPrevia;
window.cerrarVistaPrevia = cerrarVistaPrevia;
window.handleFilesNotas = handleFilesNotas;
window.previewFileNota = previewFileNota;
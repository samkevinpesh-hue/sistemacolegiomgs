// ================================================
// anuncios.js — Módulo Anuncios (Padre + Profesor + Admin) con Foto de perfil
// ================================================

import { getData, pushData, updateData, deleteData } from './firebase-config.js';
import { SESION, getUsuarioActual, escapeHTML, toast, confirmarEliminar, subirArchivoStorage, getFotoPerfil, renderFotoPerfilMini } from './data.js';

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

function initAnuncios(contenedor) {
    const rol = SESION.get("rol");
    _quitarBtnRecargar("btn-recargar");
    if (rol === "admin") {
        renderAnunciosAdmin(contenedor);
    } else {
        _inyectarBtnRecargar("btn-recargar", () => renderAnunciosVista(contenedor));
        renderAnunciosVista(contenedor);
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

/* ==================== VISTA PADRE / PROFESOR ==================== */
async function renderAnunciosVista(cont) {
    const usuario = SESION.get("usuario");
    const rol = SESION.get("rol");

    try {
        const data = await getData('anuncios');
        const anuncios = [];
        if (data) {
            Object.entries(data).forEach(([key, a]) => {
                if (!a.destinatarios || a.destinatarios.includes(rol)) {
                    anuncios.push({ ...a, id: key });
                }
            });
        }
        anuncios.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!anuncios.length) {
            cont.innerHTML = `
                <div class="sin-anuncios">
                    <div class="sin-icon">📢</div>
                    <p>No hay anuncios aún</p>
                    <p class="hint">Los administradores publicarán anuncios aquí</p>
                </div>`;
            return;
        }

        // Precargar fotos de perfil de todos los admins que publicaron anuncios
        const adminUsers = [...new Set(anuncios.map(a => a.autor_usuario).filter(Boolean))];
        const fotosPerfil = {};
        await Promise.all(adminUsers.map(async (au) => {
            const foto = await getFotoPerfil(au, 'profesor'); // admin está en profesores
            if (foto) fotosPerfil[au] = foto;
        }));

        cont.innerHTML = anuncios.map(a => {
            const fotoAutor = fotosPerfil[a.autor_usuario] || null;
            return `
            <div class="anuncio-card">
                <div class="anuncio-header">
                    <div class="anuncio-header-con-foto">
                        ${renderFotoPerfilMini(fotoAutor, a.autor_nombre || "Administrador")}
                        <div>
                            <h4 class="anuncio-titulo">${escapeHTML(a.titulo)}</h4>
                            <span class="profesor-badge">${escapeHTML(a.autor_nombre || "Administrador")}</span>
                        </div>
                    </div>
                    <span class="anuncio-fecha">${formatFechaAnuncio(a.fecha)}</span>
                </div>
                <div class="anuncio-destinatarios">
                    ${(a.destinatarios||[]).map(d => `<span class="badge-${d === 'padre' ? 'padres' : 'profesores'}">${d === 'padre' ? '👨‍👩‍👧 Padres' : '👨‍🏫 Profesores'}</span>`).join("")}
                </div>
                <p class="anuncio-mensaje">${escapeHTML(a.mensaje)}</p>
                <div class="galeria-fotos">${renderArchivosAnuncios(a.archivos)}</div>
            </div>`;
        }).join("");

        activarModalAnuncios();
    } catch (e) {
        cont.innerHTML = "<p class='vacio'>Error al cargar anuncios.</p>";
        console.error(e);
    }
}

/* ==================== VISTA ADMIN ==================== */
let archivosAnuncio = [];

async function renderAnunciosAdmin(cont) {
    archivosAnuncio = [];
    const usuario = SESION.get("usuario");
    const nombre = SESION.get("nombre") || usuario;

    // Precargar foto de perfil del admin
    const fotoAdmin = await getFotoPerfil(usuario, 'profesor') || SESION.get("foto_perfil");

    cont.innerHTML = `
        <div class="anuncio-form">
            <h3><i class="bx bx-megaphone"></i> Publicar nuevo anuncio</h3>
            <div class="anuncio-header-con-foto" style="margin-bottom:16px;">
                ${renderFotoPerfilMini(fotoAdmin, nombre)}
                <div>
                    <span style="font-weight:700;color:#1e293b;">${escapeHTML(nombre)}</span>
                    <span style="font-size:0.8rem;color:#64748b;display:block;">Administrador</span>
                </div>
            </div>
            <input type="text" id="anuncioTitulo" placeholder="Título del anuncio">
            <textarea id="anuncioMsg" placeholder="Escribe el mensaje del anuncio..."></textarea>
            <div class="anuncio-destinos">
                <label><input type="checkbox" id="destPadres" checked> <i class="bx bx-user"></i> Padres</label>
                <label><input type="checkbox" id="destProfesores" checked> <i class="bx bx-chalkboard"></i> Profesores</label>
            </div>
            <div class="archivos-preview" id="anuncioArchivosPreview"></div>
            <input type="file" id="fileAnuncio" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onchange="handleFilesAnuncio(this)">
            <label for="fileAnuncio" class="btn-file"><i class="bx bx-paperclip"></i> Adjuntar archivos (opcional)</label>
            <button class="btn-publicar" onclick="publicarAnuncio()"><i class="bx bx-send"></i> Publicar anuncio</button>
        </div>
        <h3 class="anuncios-historial-title"><i class="bx bx-history"></i> Historial de anuncios</h3>
        <div id="anunciosAdminList"></div>
    `;

    cargarHistorialAdmin();
}

function handleFilesAnuncio(input) {
    archivosAnuncio = Array.from(input.files);
    const preview = document.getElementById("anuncioArchivosPreview");
    if (!archivosAnuncio.length) { preview.innerHTML = ""; return; }
    preview.innerHTML = archivosAnuncio.map(f => {
        const esImg = f.type.startsWith("image");
        const esPDF = f.type.includes("pdf") || f.name.match(/\.(pdf)$/i);
        const esWord = f.type.includes("word") || f.name.match(/\.(doc|docx)$/i);
        const esExcel = f.type.includes("excel") || f.type.includes("sheet") || f.type.includes("spreadsheet") || f.name.match(/\.(xls|xlsx|xlsm)$/i);
        let icono = "📎";
        if (esImg) icono = "🖼️";
        else if (esPDF) icono = "📕";
        else if (esWord) icono = "📝";
        else if (esExcel) icono = "📊";
        return `<span class="file-tag">${icono} ${escapeHTML(f.name)}</span>`;
    }).join("");
}

async function publicarAnuncio() {
    const titulo = document.getElementById("anuncioTitulo").value.trim();
    const mensaje = document.getElementById("anuncioMsg").value.trim();
    const destPadres = document.getElementById("destPadres")?.checked;
    const destProfesores = document.getElementById("destProfesores")?.checked;

    if (!titulo) { toast("Escribe un título", "warning"); return; }
    if (!mensaje) { toast("Escribe un mensaje", "warning"); return; }
    if (!destPadres && !destProfesores) { toast("Selecciona al menos un destinatario", "warning"); return; }

    const btn = document.querySelector(".btn-publicar");
    if (btn) { btn.disabled = true; btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Publicando..."; }

    try {
        const destinatarios = [];
        if (destPadres) destinatarios.push("padre");
        if (destProfesores) destinatarios.push("profesor");

        const archivosSubidos = await Promise.all(archivosAnuncio.map(async file => {
            const url = await subirArchivoStorage(file, `anuncios/${Date.now()}_${file.name}`);
            return { nombre: file.name, tipo: file.type, url };
        }));

        const prof = getUsuarioActual();
        await pushData('anuncios', {
            autor_usuario: prof.usuario,
            autor_nombre: prof.nombre || prof.usuario,
            titulo,
            mensaje,
            destinatarios,
            archivos: archivosSubidos,
            fecha: new Date().toISOString()
        });

        document.getElementById("anuncioTitulo").value = "";
        document.getElementById("anuncioMsg").value = "";
        document.getElementById("anuncioArchivosPreview").innerHTML = "";
        document.getElementById("fileAnuncio").value = "";
        archivosAnuncio = [];
        toast("✅ Anuncio publicado");
        cargarHistorialAdmin();
    } catch (e) {
        toast("❌ Error al publicar", "error");
        console.error(e);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = "<i class='bx bx-send'></i> Publicar anuncio"; }
    }
}

async function cargarHistorialAdmin() {
    const cont = document.getElementById("anunciosAdminList");
    if (!cont) return;
    const usuario = SESION.get("usuario");

    try {
        const data = await getData('anuncios');
        const anuncios = [];
        if (data) {
            Object.entries(data).forEach(([key, a]) => {
                // Mostrar anuncios del usuario actual O anuncios sin autor (anuncios antiguos)
                if (a.autor_usuario === usuario || !a.autor_usuario) anuncios.push({ ...a, id: key });
            });
        }
        anuncios.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!anuncios.length) {
            cont.innerHTML = `
                <div class="sin-anuncios">
                    <div class="sin-icon">📢</div>
                    <p>No has publicado anuncios aún</p>
                    <p class="hint">Usa el formulario de arriba para crear uno</p>
                </div>`;
            return;
        }

        // Precargar foto de perfil del admin logueado
        const fotoAdmin = await getFotoPerfil(usuario, 'profesor') || SESION.get("foto_perfil");

        cont.innerHTML = anuncios.map(a => `
            <div class="anuncio-card">
                <div class="anuncio-header">
                    <div class="anuncio-header-con-foto">
                        ${renderFotoPerfilMini(fotoAdmin, a.autor_nombre || "Administrador")}
                        <div>
                            <h4 class="anuncio-titulo">${escapeHTML(a.titulo)}</h4>
                            <span class="profesor-badge">${escapeHTML(a.autor_nombre || "Administrador")}</span>
                        </div>
                    </div>
                    <span class="anuncio-fecha">${formatFechaAnuncio(a.fecha)}</span>
                </div>
                <div class="anuncio-destinatarios">
                    ${(a.destinatarios||[]).map(d => `<span class="badge-${d === 'padre' ? 'padres' : 'profesores'}">${d === 'padre' ? '👨‍👩‍👧 Padres' : '👨‍🏫 Profesores'}</span>`).join("")}
                </div>
                <p class="anuncio-mensaje">${escapeHTML(a.mensaje)}</p>
                <div class="galeria-fotos">${renderArchivosAnuncios(a.archivos)}</div>
                <button class="btn-eliminar-anuncio" onclick="eliminarAnuncio('${a.id}', '${escapeHTML(a.titulo)}')">
                    <i class="bx bx-trash"></i> Eliminar
                </button>
            </div>
        `).join("");

        activarModalAnuncios();
    } catch (e) {
        cont.innerHTML = "<p class='vacio'>Error al cargar historial.</p>";
        console.error(e);
    }
}

async function eliminarAnuncio(id, titulo) {
    confirmarEliminar(titulo || "este anuncio", async () => {
        try {
            await deleteData(`anuncios/${id}`);
            toast("🗑️ Anuncio eliminado", "delete");
            cargarHistorialAdmin();
        } catch (e) {
            toast("❌ Error al eliminar", "error");
        }
    });
}

/* ==================== HELPERS ==================== */
function renderArchivosAnuncios(archivos) {
    if (!archivos || !archivos.length) return "";
    return `<div class="galeria-fotos">` +
        archivos.map(a => {
            const esImg = a.tipo?.startsWith("image");
            const esPDF = a.tipo?.includes("pdf") || a.nombre?.match(/\.(pdf)$/i);
            const esWord = a.tipo?.includes("word") || a.nombre?.match(/\.(doc|docx)$/i);
            const esExcel = a.tipo?.includes("excel") || a.tipo?.includes("sheet") || a.tipo?.includes("spreadsheet") || a.nombre?.match(/\.(xls|xlsx|xlsm)$/i);

            if (esImg) {
                return `
                <div class="foto-item">
                    <img src="${a.url}" class="img-click" alt="${escapeHTML(a.nombre)}" onclick="abrirModal('${a.url}')">
                    <a href="${a.url}" download="${escapeHTML(a.nombre)}" class="btn-descargar">⬇ Descargar</a>
                </div>`;
            }

            if (esPDF) {
                return `
                <div class="foto-item archivo-item">
                    <div class="vista-previa-pdf" onclick="abrirVistaPrevia('${a.url}', 'pdf', '${escapeHTML(a.nombre)}')">
                        <div class="preview-icon">📕</div>
                        <div class="preview-info">
                            <span class="preview-nombre">${escapeHTML(a.nombre)}</span>
                            <span class="preview-tipo">PDF Documento</span>
                        </div>
                        <div class="preview-ver">👁 Ver</div>
                    </div>
                    <a href="${a.url}" download="${escapeHTML(a.nombre)}" class="btn-descargar">⬇ Descargar</a>
                </div>`;
            }

            if (esWord) {
                return `
                <div class="foto-item archivo-item">
                    <div class="vista-previa-word" onclick="abrirVistaPrevia('${a.url}', 'word', '${escapeHTML(a.nombre)}')">
                        <div class="preview-icon">📝</div>
                        <div class="preview-info">
                            <span class="preview-nombre">${escapeHTML(a.nombre)}</span>
                            <span class="preview-tipo">Word Documento</span>
                        </div>
                        <div class="preview-ver">👁 Ver</div>
                    </div>
                    <a href="${a.url}" download="${escapeHTML(a.nombre)}" class="btn-descargar">⬇ Descargar</a>
                </div>`;
            }

            if (esExcel) {
                return `
                <div class="foto-item archivo-item">
                    <div class="vista-previa-excel" onclick="abrirVistaPrevia('${a.url}', 'excel', '${escapeHTML(a.nombre)}')">
                        <div class="preview-icon">📊</div>
                        <div class="preview-info">
                            <span class="preview-nombre">${escapeHTML(a.nombre)}</span>
                            <span class="preview-tipo">Excel Hoja de cálculo</span>
                        </div>
                        <div class="preview-ver">👁 Ver</div>
                    </div>
                    <a href="${a.url}" download="${escapeHTML(a.nombre)}" class="btn-descargar">⬇ Descargar</a>
                </div>`;
            }

            return `
            <div class="foto-item archivo-item">
                <div class="archivo-adjunto archivo-generico" style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;border:2px solid var(--border);background:#f8fafc;">
                    <span style="font-size:2rem">📎</span>
                    <span class="preview-nombre">${escapeHTML(a.nombre)}</span>
                </div>
                <a href="${a.url}" download="${escapeHTML(a.nombre)}" class="btn-descargar">⬇ Descargar</a>
            </div>`;
        }).join("") + `</div>`;
}

function formatFechaAnuncio(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function leerArchivoComoDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
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
                        body.innerHTML = `<div class="vp-word">\n                            <div class="vp-word-icon">📝</div>\n                            <p class="vp-word-text">No se pudo renderizar el documento</p>\n                            <p class="vp-word-hint">Descarga el archivo para verlo completo</p>\n                        </div>`;
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
                    body.innerHTML = `<div style="text-align:center;padding:40px;">\n                        <div style="font-size:3rem;margin-bottom:16px;">📊</div>\n                        <p style="color:#64748b;">Cargando librería... usa la descarga temporal</p>\n                    </div>`;
                }
            }, 200);
        }
    }
}

function cerrarVistaPrevia() {
    const modal = document.getElementById("modal-vista-previa");
    if (modal) modal.style.display = "none";
}

function activarModalAnuncios() {
    document.querySelectorAll(".img-pequena").forEach(img => {
        img.onclick = () => abrirModal(img.src);
    });
}

// Exponer globales
window.initAnuncios = initAnuncios;
window.handleFilesAnuncio = handleFilesAnuncio;
window.publicarAnuncio = publicarAnuncio;
window.eliminarAnuncio = eliminarAnuncio;
window.abrirVistaPrevia = abrirVistaPrevia;
window.cerrarVistaPrevia = cerrarVistaPrevia;

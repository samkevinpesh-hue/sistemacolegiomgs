// ================================================
// comportamiento.js — Módulo Comportamiento
// + Un solo mensaje en historial del profesor
// + Marcar como leído + Respuestas funcionales
// + Confirmar respuestas de padres por el profesor
// ================================================

import { getData, pushData, updateData, deleteData } from './firebase-config.js';
import { SESION, getEstudiantes, getHijosPadre, getUsuarioActual, escapeHTML, toast, confirmarEliminar, getFotoPerfil, renderFotoPerfilMini } from './data.js';

function initComportamiento(contenedor) {
    const rol = SESION.get("rol");
    _quitarBtnRecargar("btn-recargar");
    if (rol === "profesor" || rol === "admin") {
        renderComportProfesor(contenedor);
    } else if (rol === "padre") {
        _inyectarBtnRecargarComp("btn-recargar", () => renderComportPadre(contenedor));
        renderComportPadre(contenedor);
    } else {
        renderComportPadre(contenedor);
    }
}

function _inyectarBtnRecargarComp(id, callback) {
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
        btn.disabled = true; btn.style.opacity = "0.7";
        const svgEl = document.getElementById(`${id}-svg`);
        let deg = 0;
        const spin = setInterval(() => { deg += 15; if(svgEl) svgEl.style.transform=`rotate(${deg}deg)`; }, 30);
        await callback();
        clearInterval(spin);
        if(svgEl) svgEl.style.transform = "";
        btn.disabled = false; btn.style.opacity = "";
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
async function renderComportPadre(cont) {
    const hijos = getHijosPadre();
    if (!hijos.length) { cont.innerHTML = "<p class='vacio'>No tienes hijos asignados</p>"; return; }

    cont.innerHTML = "<p class='vacio'>Cargando...</p>";

    try {
        const compsData = await getData('comportamientos');
        const data = [];

        if (compsData) {
            Object.entries(compsData).forEach(([key, c]) => {
                const dnis = c.destinatarios ? c.destinatarios.map(d => d.dni) : [c.estudiante_dni];
                const hijoMatch = hijos.find(h => dnis.includes(h.dni));
                if (hijoMatch) {
                    data.push({ ...c, id: key, _hijoMatch: hijoMatch });
                }
            });
        }

        data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!data.length) { cont.innerHTML = "<p class='vacio'>No hay comunicados aún</p>"; return; }

        const profesores = await getData('profesores');
        const padreUsuario = SESION.get("usuario");
        const padreNombre = SESION.get("nombre");

        const profesoresKeys = [...new Set(data.map(c => c.profesor_usuario))];
        const fotosPerfil = {};
        await Promise.all(profesoresKeys.map(async (profUser) => {
            const foto = await getFotoPerfil(profUser, 'profesor');
            if (foto) fotosPerfil[profUser] = foto;
        }));

        cont.innerHTML = data.map(c => {
            const prof = profesores ? profesores[c.profesor_usuario.replace(/[.@]/g, '_')] : null;
            const fotoProf = fotosPerfil[c.profesor_usuario] || null;
            const padreKey = padreUsuario.replace(/[.@]/g, '_');
            const vistos = c.vistos || {};
            const yaVio = vistos[padreKey] !== undefined;

            const hijo = c._hijoMatch;
            const nombreHijo = hijo ? hijo.nombre : (c.nombre_estudiante || "");
            const gradoHijo  = hijo ? `${hijo.grado}° ${hijo.seccion}` : `${c.grado || ""}° ${c.seccion || ""}`;

            const respuestas = c.respuestas || {};
            const respuestasPadre = Object.values(respuestas).filter(r => r.padre_usuario === padreUsuario);

            const respuestasHtml = respuestasPadre.length ? `
                <div class="respuestas-list">
                    ${respuestasPadre.map(r => `
                        <div class="respuesta-item respuesta-padre">
                            <span class="respuesta-autor">👤 Tú</span>
                            <p>${escapeHTML(r.mensaje)}</p>
                            <small>${formatFecha(r.fecha)}</small>
                        </div>`).join("")}
                </div>` : "";

            return `
            <div class="card-msg" id="card-${c.id}">
                <div class="header-msg">
                    <div class="nota-header comport-header-con-foto">
                        ${renderFotoPerfilMini(fotoProf, prof?.nombre || "Profesor")}
                        <div class="comport-header-info">
                            <h4>${escapeHTML(prof?.emoji || "👨‍🏫")} De: <strong>${escapeHTML(prof?.nombre || "Profesor")}</strong>
                                ${prof?.curso ? `<span class="curso-tag">${escapeHTML(prof.curso)}</span>` : ""}
                            </h4>
                        </div>
                        <span class="fecha" style="margin-left:auto;">📅 ${formatFecha(c.fecha)}</span>
                    </div>
                    <div class="destinatario-badge">
                        👦 Para: <strong>${escapeHTML(nombreHijo)}</strong>
                        <span class="grado-badge">${escapeHTML(gradoHijo)}</span>
                    </div>
                </div>
                <p class="mensaje">${escapeHTML(c.mensaje)}</p>
                ${respuestasHtml}
                <div class="acciones-padre">
                    ${yaVio
                        ? `<span class="badge-visto">✅ Visto</span>`
                        : `<button class="btn-marcar-visto" onclick="marcarVistoPadre('${c.id}', '${escapeHTML(padreKey)}', '${escapeHTML(padreNombre)}')">👁️ Marcar como leído</button>`
                    }
                    <button class="btn-responder" onclick="toggleRespuesta('${c.id}')">💬 Responder</button>
                </div>
                <div id="form-resp-${c.id}" class="form-respuesta" style="display:none;">
                    <textarea id="txt-resp-${c.id}" class="edit-input" placeholder="Escribe tu respuesta aquí..." rows="3"></textarea>
                    <button class="btn-guardar" style="margin-top:8px;" onclick="enviarRespuestaPadre('${c.id}', '${escapeHTML(padreKey)}', '${escapeHTML(padreNombre)}')">📨 Enviar respuesta</button>
                </div>
            </div>`;
        }).join("");

    } catch (e) {
        cont.innerHTML = "<p class='vacio'>Error al cargar comunicados.</p>";
        console.error(e);
    }
}

/* ==================== MARCAR COMO VISTO (padre) ==================== */
async function marcarVistoPadre(compId, padreKey, padreNombre) {
    try {
        await updateData(`comportamientos/${compId}/vistos/${padreKey}`, {
            nombre: padreNombre,
            fecha: new Date().toISOString()
        });
        const btn = document.querySelector(`#card-${compId} .btn-marcar-visto`);
        if (btn) btn.outerHTML = `<span class="badge-visto">✅ Visto</span>`;
        toast("✅ Marcado como leído");
    } catch (e) {
        toast("Error al marcar como leído", "error");
        console.error(e);
    }
}

/* ==================== RESPONDER (padre) ==================== */
function toggleRespuesta(compId) {
    const form = document.getElementById(`form-resp-${compId}`);
    if (!form) return;
    const abierto = form.style.display !== "none";
    form.style.display = abierto ? "none" : "block";
    if (!abierto) {
        setTimeout(() => {
            const txt = document.getElementById(`txt-resp-${compId}`);
            if (txt) txt.focus();
        }, 50);
    }
}

async function enviarRespuestaPadre(compId, padreKey, padreNombre) {
    const txt = document.getElementById(`txt-resp-${compId}`);
    const msg = txt ? txt.value.trim() : "";
    if (!msg) { toast("Escribe una respuesta", "warning"); return; }

    try {
        const respuesta = {
            padre_usuario: SESION.get("usuario"),
            padre_nombre: padreNombre,
            mensaje: msg,
            fecha: new Date().toISOString()
        };
        await pushData(`comportamientos/${compId}/respuestas`, respuesta);
        txt.value = "";
        document.getElementById(`form-resp-${compId}`).style.display = "none";
        toast("💬 Respuesta enviada");

        let listaResp = document.querySelector(`#card-${compId} .respuestas-list`);
        if (!listaResp) {
            listaResp = document.createElement("div");
            listaResp.className = "respuestas-list";
            document.querySelector(`#card-${compId} .acciones-padre`).insertAdjacentElement('beforebegin', listaResp);
        }
        const item = document.createElement("div");
        item.className = "respuesta-item respuesta-padre";
        item.innerHTML = `
            <span class="respuesta-autor">👤 Tú</span>
            <p>${escapeHTML(msg)}</p>
            <small>${formatFecha(respuesta.fecha)}</small>`;
        listaResp.appendChild(item);
    } catch (e) {
        toast("Error al enviar respuesta", "error");
        console.error(e);
    }
}

/* ==================== VISTA PROFESOR ==================== */
let selComps = [];
let selectedAulasComp = [];

function renderComportProfesor(cont) {
    selComps = [];
    selectedAulasComp = [];
    cont.innerHTML = `
        <div class="box">
            <h3>📢 Enviar Comunicado</h3>
            <div class="buscador">
                <input type="text" id="buscarComp" placeholder="Buscar nombre o DNI">
                <select id="gradoComp">
                    <option value="">Grado</option>
                    <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                </select>
                <select id="seccionComp">
                    <option value="">Sección</option>
                    <option>A</option><option>B</option>
                </select>
                <button type="button" id="btnTodoAulaComp" class="btn-seleccionar-aula-mini" disabled title="Seleccionar toda el aula">📚 Aula completa</button>
            </div>
            <div id="listaComp" class="lista-scroll"></div>
            <div class="seleccionados-box">
                <h4>Seleccionados:</h4>
                <div id="selCompBox"><p class="hint">Ninguno seleccionado</p></div>
            </div>
            <textarea id="msgComp" placeholder="Escribe la incidencia o comunicado..."></textarea>
            <button class="btn-enviar" onclick="enviarComp()">📨 Enviar a seleccionados</button>
            <hr class="separador">
            <h3>📋 Mi Historial</h3>
            <div id="previewComp"></div>
        </div>
    `;

    document.getElementById("buscarComp").addEventListener("input", buscarComp);
    document.getElementById("gradoComp").addEventListener("change", buscarComp);
    document.getElementById("seccionComp").addEventListener("change", buscarComp);

    const btnTodo = document.getElementById('btnTodoAulaComp');
    function actualizarBtnAulaComp() {
        if (!btnTodo) return;
        const g = document.getElementById('gradoComp').value;
        const s = document.getElementById('seccionComp').value;
        btnTodo.disabled = !(g && s);
        btnTodo.style.opacity = btnTodo.disabled ? '0.6' : '1';
    }
    if (btnTodo) {
        actualizarBtnAulaComp();
        document.getElementById('gradoComp').addEventListener('change', actualizarBtnAulaComp);
        document.getElementById('seccionComp').addEventListener('change', actualizarBtnAulaComp);
        btnTodo.addEventListener('click', () => {
            const grado = document.getElementById('gradoComp').value;
            const seccion = document.getElementById('seccionComp').value;
            if (!grado || !seccion) { toast('Selecciona grado y sección primero', 'warning'); return; }
            const estudiantes = getEstudiantes();
            const aula = estudiantes.filter(est => String(est.grado) === String(grado) && String(est.seccion) === String(seccion));
            if (!aula.length) { toast(`No hay estudiantes en ${grado}° "${seccion}"`, 'warning'); return; }
            const aulaExiste = selectedAulasComp.some(a => String(a.grado) === String(grado) && String(a.seccion) === String(seccion));
            if (!aulaExiste) selectedAulasComp.push({ grado, seccion, label: `Aula ${grado} ${seccion.toUpperCase()}` });
            let agregados = 0;
            aula.forEach(est => { if (!selComps.some(s => s.dni === est.dni)) { selComps.push(est); agregados++; } });
            if (agregados > 0 || !aulaExiste) {
                renderSelComps(); buscarComp();
                toast(`✅ Aula ${grado} ${seccion.toUpperCase()} seleccionada`, 'success');
            } else {
                toast('Todos los estudiantes de esta aula ya están seleccionados', 'info');
            }
        });
    }

    buscarComp();
    mostrarHistorialComp();
}

function buscarComp() {
    const texto = document.getElementById("buscarComp").value.toLowerCase();
    const grado = document.getElementById("gradoComp").value;
    const seccion = document.getElementById("seccionComp").value;
    const lista = document.getElementById("listaComp");
    if (!lista) return;
    lista.innerHTML = "";
    const estudiantes = getEstudiantes() || [];
    const res = estudiantes.filter(est =>
        (est.nombre.toLowerCase().includes(texto) || (est.dni && est.dni.includes(texto))) &&
        (!grado   || String(est.grado)   === String(grado)) &&
        (!seccion || String(est.seccion) === String(seccion))
    );
    if (!res.length) { lista.innerHTML = `<div class="lista-vacia"><p>🔍 No se encontraron estudiantes</p></div>`; return; }
    res.forEach((est, index) => {
        const seleccionado = selComps.some(s => s.dni === est.dni);
        const div = document.createElement("div");
        div.className = "item-estudiante";
        div.innerHTML = `
            <span><strong>${escapeHTML(est.nombre)}</strong><small>${est.grado}° ${est.seccion}</small></span>
            ${seleccionado
                ? `<button class="btn-agregar btn-agregado" disabled>Seleccionado</button>`
                : `<button class="btn-agregar" onclick="agregarComp('${est.dni}')">Agregar</button>`}
        `;
        lista.appendChild(div);
        if (window.animarEntradaUnica) animarEntradaUnica(div, index * 60);
    });
}

function agregarComp(dni) {
    const est = getEstudiantes().find(e => e.dni === dni);
    if (!est || selComps.some(s => s.dni === dni)) return;
    selComps.push(est);
    document.getElementById("buscarComp").value = "";
    buscarComp(); renderSelComps();
}

function quitarComp(i) { selComps.splice(i, 1); buscarComp(); renderSelComps(); }

function renderSelComps() {
    const box = document.getElementById("selCompBox");
    if (!selComps.length) { box.innerHTML = "<p class='hint'>Ninguno seleccionado</p>"; return; }
    const gruposHtml = selectedAulasComp.map((aula, i) =>
        `<span class="tag tag-aula">${escapeHTML(aula.label)} <b onclick="quitarAulaComp(${i})" title="Quitar aula">×</b></span>`
    ).join("");
    const estudiantesIndividuales = selComps.filter(est =>
        !selectedAulasComp.some(aula => String(est.grado) === String(aula.grado) && String(est.seccion) === String(aula.seccion))
    );
    const alumnosHtml = estudiantesIndividuales.map((est, i) =>
        `<span class="tag">${escapeHTML(est.nombre)} <b onclick="quitarComp(${i})" title="Quitar">×</b></span>`
    ).join("");
    box.innerHTML = gruposHtml + alumnosHtml;
}

function quitarAulaComp(i) {
    const aula = selectedAulasComp[i];
    if (!aula) return;
    selectedAulasComp.splice(i, 1);
    selComps = selComps.filter(est => !(String(est.grado) === String(aula.grado) && String(est.seccion) === String(aula.seccion)));
    buscarComp(); renderSelComps();
}

/* ==================== ENVIAR (UN SOLO REGISTRO) ==================== */
async function enviarComp() {
    if (!selComps.length) { toast("Selecciona al menos un estudiante", "warning"); return; }
    const msg = document.getElementById("msgComp").value.trim();
    if (!msg) { toast("Escribe un mensaje", "warning"); return; }

    const prof = getUsuarioActual();

    try {
        const compData = {
            profesor_usuario: prof.usuario,
            mensaje: msg,
            fecha: new Date().toISOString(),
            destinatarios: selComps.map(est => ({
                dni: est.dni,
                nombre: est.nombre,
                grado: est.grado,
                seccion: est.seccion
            })),
            vistos: {},
            respuestas: {}
        };
        await pushData('comportamientos', compData);

        document.getElementById("msgComp").value = "";
        selComps = [];
        selectedAulasComp = [];
        renderSelComps();
        buscarComp();
        await mostrarHistorialComp();
        toast("✅ Comunicado enviado");
    } catch (e) {
        toast("❌ Error al enviar", "error");
        console.error(e);
    }
}

/* ==================== HISTORIAL PROFESOR ==================== */
async function mostrarHistorialComp() {
    const cont = document.getElementById("previewComp");
    if (!cont) return;
    const usuario = SESION.get("usuario");

    try {
        const compsData = await getData('comportamientos');
        const data = [];

        if (compsData) {
            Object.entries(compsData).forEach(([key, c]) => {
                if (c.profesor_usuario === usuario) data.push({ ...c, id: key });
            });
        }

        data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!data.length) {
            cont.innerHTML = `
            <div class="sin-comunicados">
                <div class="sin-icon">📢</div>
                <p>No hay comunicados enviados aún</p>
                <p class="hint">Selecciona un estudiante y escribe un mensaje</p>
            </div>`;
            return;
        }

        const profesores = await getData('profesores');
        const prof = profesores ? profesores[usuario.replace(/[.@]/g, '_')] : null;
        const fotoProf = await getFotoPerfil(usuario, 'profesor');

        cont.innerHTML = data.map(c => {
            const vistos = c.vistos || {};
            const cantVistos = Object.keys(vistos).length;
            const respuestas = c.respuestas || {};
            const cantResp = Object.keys(respuestas).length;

            let destinatariosHtml = "";
            if (c.destinatarios && c.destinatarios.length) {
                if (c.destinatarios.length === 1) {
                    const d = c.destinatarios[0];
                    destinatariosHtml = `<div class="destinatario-badge">
                        👦 Para: <strong>${escapeHTML(d.nombre)}</strong>
                        <span class="grado-badge">${escapeHTML(d.grado)}° ${escapeHTML(d.seccion)}</span>
                    </div>`;
                } else {
                    const preview = c.destinatarios.slice(0, 2).map(d => escapeHTML(d.nombre)).join(", ");
                    const resto = c.destinatarios.length - 2;
                    destinatariosHtml = `<div class="destinatario-badge destinatario-multiple">
                        👦 Para: <strong>${preview}${resto > 0 ? ` <span class="ver-mas-dest" onclick="toggleDestinatarios('${c.id}')">+${resto} más</span>` : ""}</strong>
                        <span class="grado-badge">${c.destinatarios.length} estudiantes</span>
                    </div>
                    <div id="dest-full-${c.id}" class="dest-full-list" style="display:none;">
                        ${c.destinatarios.map(d => `<span class="dest-chip">${escapeHTML(d.nombre)} <small>${d.grado}°${d.seccion}</small></span>`).join("")}
                    </div>`;
                }
            } else {
                destinatariosHtml = `<div class="destinatario-badge">
                    👦 Para: <strong>${escapeHTML(c.nombre_estudiante || "")}</strong>
                    <span class="grado-badge">${escapeHTML(c.grado || "")}° ${escapeHTML(c.seccion || "")}</span>
                </div>`;
            }

            const respuestasHtml = cantResp ? `
                <div class="respuestas-list">
                    <div class="respuestas-titulo">💬 Respuestas de padres (${cantResp})</div>
                    ${Object.values(respuestas).map(r => `
                        <div class="respuesta-item respuesta-de-padre">
                            <span class="respuesta-autor">👤 ${escapeHTML(r.padre_nombre || r.padre_usuario)}</span>
                            <p>${escapeHTML(r.mensaje)}</p>
                            <small>${formatFecha(r.fecha)}</small>
                        </div>`).join("")}
                </div>` : "";

            return `
            <div class="card-msg">
                <div class="header-msg">
                    <div class="nota-header comport-header-con-foto">
                        ${renderFotoPerfilMini(fotoProf, prof?.nombre || usuario)}
                        <div class="comport-header-info">
                            <h4>${escapeHTML(prof?.emoji || "👨‍🏫")} De: <strong>${escapeHTML(prof?.nombre || usuario)}</strong>
                                ${prof?.curso ? `<span class="curso-tag">${escapeHTML(prof.curso)}</span>` : ""}
                            </h4>
                        </div>
                        <span class="fecha" style="margin-left:auto;">${formatFecha(c.fecha)}</span>
                    </div>
                    ${destinatariosHtml}
                </div>
                <p id="texto-${c.id}" class="mensaje">${escapeHTML(c.mensaje)}</p>
                <textarea id="input-${c.id}" class="edit-input" style="display:none;">${escapeHTML(c.mensaje)}</textarea>
                ${respuestasHtml}
                <div class="acciones">
                    <button onclick="activarEdicionC('${c.id}')" class="btn-editar" title="Editar">✏️</button>
                    <button onclick="guardarEdicionC('${c.id}')" class="btn-guardar" title="Guardar">💾</button>
                    <button onclick="verVistosComp('${c.id}')" class="btn-ver-vistos" title="Ver quién vio el mensaje">
                        👁️ ${cantVistos > 0 ? `<span class="badge-count">${cantVistos}</span>` : ""}
                    </button>
                    <button onclick="eliminarComp('${c.id}', '')" class="btn-eliminar" title="Eliminar">❌</button>
                </div>
            </div>`;
        }).join("");
    } catch (e) {
        cont.innerHTML = "<p class='vacio'>Error al cargar historial.</p>";
        console.error(e);
    }
}

function toggleDestinatarios(id) {
    const el = document.getElementById(`dest-full-${id}`);
    if (!el) return;
    el.style.display = el.style.display === "none" ? "flex" : "none";
}

/* ==================== MODAL VISTOS ==================== */
async function verVistosComp(compId) {
    try {
        const comp = await getData(`comportamientos/${compId}`);
        const vistos = comp?.vistos || {};
        const respuestas = comp?.respuestas || {};
        const lista = Object.values(vistos);
        const listaResp = Object.entries(respuestas).map(([k, r]) => ({ ...r, respKey: k }));

        let modal = document.getElementById("modal-vistos-comp");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "modal-vistos-comp";
            modal.className = "modal-vistos-overlay";
            document.body.appendChild(modal);
        }

        const totalDest = comp?.destinatarios?.length || 1;

        const vistosHtml = lista.length
            ? lista.map(v => `
                <div class="visto-item">
                    <div class="visto-avatar">${(v.nombre || "?").charAt(0).toUpperCase()}</div>
                    <div class="visto-info">
                        <span class="visto-nombre">${escapeHTML(v.nombre)}</span>
                        <span class="visto-fecha">${formatFecha(v.fecha)}</span>
                    </div>
                    <span class="visto-check">✅</span>
                </div>`).join("")
            : `<div class="sin-vistos"><span>👁️</span><p>Nadie ha visto este mensaje aún</p></div>`;

        const respHtml = listaResp.length
            ? listaResp.map(r => `
                <div class="visto-item">
                    <div class="visto-avatar resp-avatar">${(r.padre_nombre || "?").charAt(0).toUpperCase()}</div>
                    <div class="visto-info">
                        <span class="visto-nombre">${escapeHTML(r.padre_nombre || r.padre_usuario)}</span>
                        <p class="resp-msg-preview">${escapeHTML(r.mensaje)}</p>
                        <span class="visto-fecha">${formatFecha(r.fecha)}</span>
                    </div>
                    ${r.confirmado
                        ? `<span class="respuesta-check" title="Respuesta confirmada por el profesor">✅</span>`
                        : `<button class="btn-confirmar-respuesta" onclick="confirmarRespuestaProfesor('${compId}', '${r.respKey}', this)" title="Confirmar respuesta">✓</button>`
                    }
                </div>`).join("")
            : `<div class="sin-vistos"><span>💬</span><p>Sin respuestas aún</p></div>`;

        modal.innerHTML = `
            <div class="modal-vistos-box">
                <button class="modal-vistos-close" onclick="cerrarModalVistos()">×</button>
                <h3 class="modal-vistos-titulo">📊 Estado del comunicado</h3>
                <p class="modal-vistos-subtitulo">${lista.length} de ${totalDest} padre(s) lo vieron</p>
                <div class="modal-vistos-tabs">
                    <button class="tab-btn tab-activo" onclick="switchTabVistos('vistos', this)">
                        👁️ Vistos <span class="badge-tab">${lista.length}</span>
                    </button>
                    <button class="tab-btn" onclick="switchTabVistos('respuestas', this)">
                        💬 Respuestas <span class="badge-tab">${listaResp.length}</span>
                    </button>
                </div>
                <div id="tab-vistos" class="tab-content tab-content-activo">${vistosHtml}</div>
                <div id="tab-respuestas" class="tab-content">${respHtml}</div>
            </div>`;

        modal.style.display = "flex";
        modal.onclick = (e) => { if (e.target === modal) cerrarModalVistos(); };
    } catch (e) {
        toast("Error al cargar vistos", "error");
        console.error(e);
    }
}

function switchTabVistos(tab, btnEl) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-activo"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("tab-content-activo"));
    btnEl.classList.add("tab-activo");
    document.getElementById(`tab-${tab}`)?.classList.add("tab-content-activo");
}

async function confirmarRespuestaProfesor(compId, respKey, btnEl) {
    try {
        await updateData(`comportamientos/${compId}/respuestas/${respKey}`, { confirmado: true });
        btnEl.outerHTML = `<span class="respuesta-check" title="Respuesta confirmada">✅</span>`;
        toast("✅ Respuesta confirmada");
    } catch(e) {
        toast("Error al confirmar respuesta", "error");
    }
}
window.confirmarRespuestaProfesor = confirmarRespuestaProfesor;

function cerrarModalVistos() {
    const modal = document.getElementById("modal-vistos-comp");
    if (modal) modal.style.display = "none";
}

/* ==================== EDICIÓN / ELIMINACIÓN ==================== */
function activarEdicionC(id) {
    document.getElementById("texto-" + id).style.display = "none";
    document.getElementById("input-" + id).style.display = "block";
}

async function guardarEdicionC(id) {
    const nuevo = document.getElementById("input-" + id).value.trim();
    if (!nuevo) { toast("Mensaje vacío", "warning"); return; }
    try {
        await updateData(`comportamientos/${id}`, { mensaje: nuevo });
        await mostrarHistorialComp();
        toast("💾 Guardado");
    } catch (e) { toast("❌ Error al guardar", "error"); }
}

async function eliminarComp(id, nombreEstudiante) {
    confirmarEliminar(nombreEstudiante || "este comunicado", async () => {
        try {
            await deleteData(`comportamientos/${id}`);
            await mostrarHistorialComp();
            toast("🗑️ Comunicado eliminado", "delete");
        } catch (e) { toast("❌ Error al eliminar", "error"); }
    });
}

function formatFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Exponer funciones globales
window.initComportamiento   = initComportamiento;
window.agregarComp          = agregarComp;
window.quitarComp           = quitarComp;
window.quitarAulaComp       = quitarAulaComp;
window.enviarComp           = enviarComp;
window.activarEdicionC      = activarEdicionC;
window.guardarEdicionC      = guardarEdicionC;
window.eliminarComp         = eliminarComp;
window.marcarVistoPadre     = marcarVistoPadre;
window.toggleRespuesta      = toggleRespuesta;
window.enviarRespuestaPadre = enviarRespuestaPadre;
window.verVistosComp        = verVistosComp;
window.cerrarModalVistos    = cerrarModalVistos;
window.switchTabVistos      = switchTabVistos;
window.toggleDestinatarios  = toggleDestinatarios;
window.confirmarRespuestaProfesor = confirmarRespuestaProfesor;
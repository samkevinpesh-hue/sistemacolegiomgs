// ================================================
// comportamiento.js — Módulo Comportamiento (Padre + Profesor) con Firebase RTDB + Foto de perfil
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
async function renderComportPadre(cont) {
    const hijos = getHijosPadre();

    if (!hijos.length) { 
        cont.innerHTML = "<p class='vacio'>No tienes hijos asignados</p>"; 
        return; 
    }

    cont.innerHTML = "<p class='vacio'>Cargando...</p>";

    try {
        const compsData = await getData('comportamientos');
        const data = [];

        if (compsData) {
            Object.entries(compsData).forEach(([key, c]) => {
                if (hijos.some(h => h.dni === c.estudiante_dni)) {
                    data.push({ ...c, id: key });
                }
            });
        }

        data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (!data.length) { 
            cont.innerHTML = "<p class='vacio'>No hay comunicados aún</p>"; 
            return; 
        }

        const profesores = await getData('profesores');

        // Precargar fotos de perfil de todos los profesores
        const profesoresKeys = [...new Set(data.map(c => c.profesor_usuario))];
        const fotosPerfil = {};
        await Promise.all(profesoresKeys.map(async (profUser) => {
            const foto = await getFotoPerfil(profUser, 'profesor');
            if (foto) fotosPerfil[profUser] = foto;
        }));

        cont.innerHTML = data.map(c => {
            // ✅ FIX: reemplazar tanto puntos como @ para generar la key del profesor
            const prof = profesores ? profesores[c.profesor_usuario.replace(/[.@]/g, '_')] : null;
            const fotoProf = fotosPerfil[c.profesor_usuario] || null;
            return `
            <div class="card-msg">
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
                        👦 Para: <strong>${escapeHTML(c.nombre_estudiante)}</strong>
                        <span class="grado-badge">${escapeHTML(c.grado)}° ${escapeHTML(c.seccion)}</span>
                    </div>
                </div>
                <p class="mensaje">${escapeHTML(c.mensaje)}</p>
            </div>`;
        }).join("");
    } catch (e) {
        cont.innerHTML = "<p class='vacio'>Error al cargar comunicados.</p>";
        console.error(e);
    }
}

/* ==================== VISTA PROFESOR ==================== */
let selComps = [];

function renderComportProfesor(cont) {
    selComps = [];
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
            </div>
            <div id="listaComp" class="lista-scroll"></div>
            <div class="seleccionados-box">
                <h4>Seleccionados:</h4>
                <div id="selCompBox"><p class="hint">Ninguno seleccionado</p></div>
            </div>
            <textarea id="msgComp" placeholder="Escribe el comportamiento o comunicado..."></textarea>
            <button class="btn-enviar" onclick="enviarComp()">📨 Enviar a seleccionados</button>
            <hr class="separador">
            <h3>📋 Mi Historial</h3>
            <div id="previewComp"></div>
        </div>
    `;

    document.getElementById("buscarComp").addEventListener("input", buscarComp);
    document.getElementById("gradoComp").addEventListener("change", buscarComp);
    document.getElementById("seccionComp").addEventListener("change", buscarComp);
    mostrarHistorialComp();
}

function buscarComp() {
    const texto = document.getElementById("buscarComp").value.toLowerCase();
    const grado = document.getElementById("gradoComp").value;
    const seccion = document.getElementById("seccionComp").value;
    const lista = document.getElementById("listaComp");
    lista.innerHTML = "";

    const estudiantes = getEstudiantes();
    const res = estudiantes.filter(est =>
        (est.nombre.toLowerCase().includes(texto) || est.dni.includes(texto)) &&
        (!grado   || est.grado   === grado) &&
        (!seccion || est.seccion === seccion) &&
        !selComps.some(s => s.dni === est.dni)
    );

    if (!res.length) {
        if (texto || grado || seccion) {
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
            <button class="btn-agregar" onclick="agregarComp('${est.dni}')">Agregar</button>
        `;
        lista.appendChild(div);
    });
}

function agregarComp(dni) {
    const est = getEstudiantes().find(e => e.dni === dni);
    if (!est || selComps.some(s => s.dni === dni)) return;
    selComps.push(est);
    document.getElementById("buscarComp").value = "";
    buscarComp();
    renderSelComps();
}

function quitarComp(i) {
    selComps.splice(i, 1);
    buscarComp();
    renderSelComps();
}

function renderSelComps() {
    const box = document.getElementById("selCompBox");
    if (!selComps.length) {
        box.innerHTML = "<p class='hint'>Ninguno seleccionado</p>";
        return;
    }
    box.innerHTML = selComps.map((est, i) =>
        `<span class="tag">${escapeHTML(est.nombre)} <b onclick="quitarComp(${i})" title="Quitar">×</b></span>`
    ).join("");
}

async function enviarComp() {
    if (!selComps.length) {
        toast("Selecciona al menos un estudiante", "warning");
        return;
    }
    const msg = document.getElementById("msgComp").value.trim();
    if (!msg) {
        toast("Escribe un mensaje", "warning");
        return;
    }

    const prof = getUsuarioActual();

    try {
        for (const est of selComps) {
            const compData = {
                profesor_usuario: prof.usuario,
                estudiante_dni: est.dni,
                nombre_estudiante: est.nombre,
                grado: est.grado,
                seccion: est.seccion,
                mensaje: msg,
                fecha: new Date().toISOString()
            };
            await pushData('comportamientos', compData);
        }

        document.getElementById("msgComp").value = "";
        selComps = [];
        renderSelComps();
        buscarComp();
        await mostrarHistorialComp();
        toast("✅ Comunicado enviado");
    } catch (e) {
        toast("❌ Error al enviar", "error");
        console.error(e);
    }
}

async function mostrarHistorialComp() {
    const cont = document.getElementById("previewComp");
    if (!cont) return;

    const usuario = SESION.get("usuario");

    try {
        const compsData = await getData('comportamientos');
        const data = [];

        if (compsData) {
            Object.entries(compsData).forEach(([key, c]) => {
                if (c.profesor_usuario === usuario) {
                    data.push({ ...c, id: key });
                }
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
        // ✅ FIX: reemplazar tanto puntos como @ para generar la key del profesor
        const prof = profesores ? profesores[usuario.replace(/[.@]/g, '_')] : null;

        // Precargar foto de perfil del profesor logueado
        const fotoProf = await getFotoPerfil(usuario, 'profesor');

        cont.innerHTML = data.map(c => `
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
                    <div class="destinatario-badge">
                        👦 Para: <strong>${escapeHTML(c.nombre_estudiante)}</strong>
                        <span class="grado-badge">${escapeHTML(c.grado)}° ${escapeHTML(c.seccion)}</span>
                    </div>
                </div>
                <p id="texto-${c.id}" class="mensaje">${escapeHTML(c.mensaje)}</p>
                <textarea id="input-${c.id}" class="edit-input" style="display:none;">${escapeHTML(c.mensaje)}</textarea>
                <div class="acciones">
                    <button onclick="activarEdicionC('${c.id}')" class="btn-editar" title="Editar">✏️</button>
                    <button onclick="guardarEdicionC('${c.id}')" class="btn-guardar" title="Guardar">💾</button>
                    <button onclick="eliminarComp('${c.id}', '${escapeHTML(c.nombre_estudiante)}')" class="btn-eliminar" title="Eliminar">❌</button>
                </div>
            </div>
        `).join("");
    } catch (e) {
        cont.innerHTML = "<p class='vacio'>Error al cargar historial.</p>";
        console.error(e);
    }
}

function activarEdicionC(id) {
    document.getElementById("texto-" + id).style.display = "none";
    document.getElementById("input-" + id).style.display = "block";
}

async function guardarEdicionC(id) {
    const nuevo = document.getElementById("input-" + id).value.trim();
    if (!nuevo) {
        toast("Mensaje vacío", "warning");
        return;
    }

    try {
        await updateData(`comportamientos/${id}`, { mensaje: nuevo });
        await mostrarHistorialComp();
        toast("💾 Guardado");
    } catch (e) {
        toast("❌ Error al guardar", "error");
    }
}

async function eliminarComp(id, nombreEstudiante) {
    confirmarEliminar(nombreEstudiante || "este comunicado", async () => {
        try {
            await deleteData(`comportamientos/${id}`);
            await mostrarHistorialComp();
            toast("🗑️ Comunicado eliminado", "delete");
        } catch (e) {
            toast("❌ Error al eliminar", "error");
        }
    });
}

function formatFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Exponer funciones globales necesarias
window.initComportamiento = initComportamiento;
window.agregarComp = agregarComp;
window.quitarComp = quitarComp;
window.enviarComp = enviarComp;
window.activarEdicionC = activarEdicionC;
window.guardarEdicionC = guardarEdicionC;
window.eliminarComp = eliminarComp;
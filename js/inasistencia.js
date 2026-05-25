// ================================================
// inasistencia.js — Módulo Inasistencia (Padre + Profesor) con Foto de perfil
// ================================================

import { getData, pushData, updateData, deleteData } from './firebase-config.js';
import { SESION, getEstudiantes, getHijosPadre, getUsuarioActual, escapeHTML, toast, confirmarEliminar, subirArchivoStorage, getFotoPerfil, renderFotoPerfilMini } from './data.js';

function initInasistencia(contenedor) {
    const rol = SESION.get("rol");
    _quitarBtnRecargar("btn-recargar");
    if (rol === "padre") {
        _inyectarBtnRecargar("btn-recargar", () => renderInasistenciaPadre(contenedor));
        renderInasistenciaPadre(contenedor);
    } else {
        _inyectarBtnRecargar("btn-recargar", () => renderInasistenciaProfesor(contenedor));
        renderInasistenciaProfesor(contenedor);
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

/* ================================================
   VISTA PADRE
   ================================================ */
let archivosInasistencia = [];
let diasSelInas = [];

async function renderInasistenciaPadre(cont) {
    const hijos = getHijosPadre();
    if (!hijos.length) { cont.innerHTML = "<p class='vacio'>No tienes hijos asignados.</p>"; return; }

    const profesores = await getData('profesores');
    const listaProfes = profesores ? Object.entries(profesores).map(([key, p]) => ({ key, ...p })) : [];

    // Precargar fotos de perfil de profesores
    const fotosPerfil = {};
    await Promise.all(listaProfes.map(async (p) => {
        // Reconstruir el email original desde la key
        const emailOriginal = p.key.replace(/_/g, '.');
        const foto = await getFotoPerfil(emailOriginal, 'profesor');
        if (foto) fotosPerfil[p.key] = foto;
    }));

    cont.innerHTML = `
        <div class="inas-tabs">
            <button class="inas-tab active" id="ptab-enviar" onclick="switchTabPadre('enviar')"><i class="bx bx-send"></i> Enviar justificación</button>
            <button class="inas-tab" id="ptab-historial" onclick="switchTabPadre('historial')"><i class="bx bx-folder"></i> Mi historial</button>
        </div>

        <div id="ppanel-enviar" class="inas-panel">
            <div class="inas-box">
                <h3><i class="bx bx-clipboard"></i> Nueva justificación de inasistencia</h3>
                <div class="inas-form-group">
                    <label>Hijo</label>
                    <select id="inaHijo">
                        ${hijos.map(h => `<option value="${h.dni}">${escapeHTML(h.nombre)} — ${h.grado}° ${h.seccion}</option>`).join("")}
                    </select>
                </div>
                <div class="inas-form-group">
                    <label>Profesor destinatario</label>
                    <select id="inaProfesor">
                        <option value="">Selecciona un profesor</option>
                        ${listaProfes.map(p => {
                            const fotoHtml = fotosPerfil[p.key] 
                                ? `<img src="${fotosPerfil[p.key]}" class="foto-perfil-mini-inas" style="width:24px;height:24px;border-radius:50%;object-fit:cover;margin-right:6px;vertical-align:middle;">`
                                : `<span style="display:inline-flex;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#4e73df,#1cc88a);color:white;font-size:0.7rem;align-items:center;justify-content:center;margin-right:6px;vertical-align:middle;font-weight:700;">${(p.nombre || "?").charAt(0).toUpperCase()}</span>`;
                            return `<option value="${p.key}">${fotoHtml}${escapeHTML(p.nombre)} ${p.curso ? "· " + escapeHTML(p.curso) : ""}</option>`;
                        }).join("")}
                    </select>
                </div>
                <div class="inas-form-group">
                    <label>Días de inasistencia</label>
                    <div class="inas-date-picker-wrap">
                        <input type="date" id="inaFechaInput" min="${fechaHoy()}" onchange="agregarDiaInas()">
                        <span class="inas-date-hint">Selecciona los días uno por uno (no sábado/domingo)</span>
                    </div>
                    <div id="inasDiasSelBox" class="inas-dias-sel-box"><span class="inas-date-hint">Ningún día seleccionado</span></div>
                </div>
                <div class="inas-form-group">
                    <label>Motivo / Mensaje</label>
                    <textarea id="inaMsg" placeholder="Describe el motivo de la inasistencia..."></textarea>
                </div>
                <div class="inas-form-group">
                    <div id="inaArchivosPreview" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;"></div>
                    <input type="file" id="fileInasistencia" multiple accept="image/*,.pdf" onchange="handleFilesInasistencia(this)">
                    <label for="fileInasistencia" class="btn-file"><i class="bx bx-paperclip"></i> Adjuntar receta médica o imagen (opcional)</label>
                </div>
                <button class="btn-inas-enviar" onclick="enviarJustificacion()"><i class="bx bx-send"></i> Enviar justificación</button>
            </div>
        </div>

        <div id="ppanel-historial" class="inas-panel" style="display:none;">
            <div class="inas-box">
                <h3><i class="bx bx-folder"></i> Mis justificaciones enviadas</h3>
                <div id="inaHistorialPadre"><p class="vacio">Cargando...</p></div>
            </div>
        </div>
    `;

    cargarHistorialPadre(hijos);
}

function switchTabPadre(tab) {
    document.getElementById('ptab-enviar').classList.toggle('active', tab === 'enviar');
    document.getElementById('ptab-historial').classList.toggle('active', tab === 'historial');
    document.getElementById('ppanel-enviar').style.display = tab === 'enviar' ? 'block' : 'none';
    document.getElementById('ppanel-historial').style.display = tab === 'historial' ? 'block' : 'none';
}

function fechaHoy() {
    return new Date().toISOString().split('T')[0];
}

function agregarDiaInas() {
    const input = document.getElementById("inaFechaInput");
    const val = input.value;
    if (!val) return;
    const fecha = new Date(val + 'T00:00:00');
    const dow = fecha.getDay();
    if (dow === 0 || dow === 6) { toast("⚠️ No puedes seleccionar sábado o domingo", "error"); input.value = ""; return; }
    if (diasSelInas.includes(val)) { toast("⚠️ Ese día ya fue agregado", "error"); input.value = ""; return; }
    diasSelInas.push(val);
    input.value = "";
    renderDiasSelBox("inasDiasSelBox", diasSelInas, "quitarDiaInas");
}

function quitarDiaInas(dia) {
    diasSelInas = diasSelInas.filter(d => d !== dia);
    renderDiasSelBox("inasDiasSelBox", diasSelInas, "quitarDiaInas");
}

let diasSelInasProf = [];

function agregarDiaInasProf() {
    const input = document.getElementById("inaFechaInputProf");
    const val = input.value;
    if (!val) return;
    const fecha = new Date(val + 'T00:00:00');
    const dow = fecha.getDay();
    if (dow === 0 || dow === 6) { toast("⚠️ No puedes seleccionar sábado o domingo", "error"); input.value = ""; return; }
    if (diasSelInasProf.includes(val)) { toast("⚠️ Ese día ya fue agregado", "error"); input.value = ""; return; }
    diasSelInasProf.push(val);
    input.value = "";
    renderDiasSelBox("inasDiasSelBoxProf", diasSelInasProf, "quitarDiaInasProf");
}

function quitarDiaInasProf(dia) {
    diasSelInasProf = diasSelInasProf.filter(d => d !== dia);
    renderDiasSelBox("inasDiasSelBoxProf", diasSelInasProf, "quitarDiaInasProf");
}

function renderDiasSelBox(boxId, dias, fnQuitar) {
    const box = document.getElementById(boxId);
    if (!box) return;
    if (!dias.length) { box.innerHTML = "<span class='inas-date-hint'>Ningún día seleccionado</span>"; return; }
    box.innerHTML = dias.map(d => {
        const label = new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        return `<span class="dia-badge-sel">${label} <b onclick="${fnQuitar}('${d}')" style="cursor:pointer;margin-left:6px;font-size:1rem;">×</b></span>`;
    }).join("");
}

function handleFilesInasistencia(input) {
    archivosInasistencia = Array.from(input.files);
    const preview = document.getElementById("inaArchivosPreview");
    if (!archivosInasistencia.length) { preview.innerHTML = ""; return; }
    preview.innerHTML = archivosInasistencia.map(f => `
        <span class="file-tag">
            ${f.type.startsWith("image") ? '<i class="bx bx-image"></i>' : '<i class="bx bx-file"></i>'} ${escapeHTML(f.name)}
        </span>
    `).join("");
}

async function enviarJustificacion() {
    const dniHijo = document.getElementById("inaHijo").value;
    const profKey = document.getElementById("inaProfesor").value;
    const msg = document.getElementById("inaMsg").value.trim();
    if (!profKey) return alert("Selecciona un profesor");
    if (!diasSelInas.length) return alert("Selecciona al menos un día");
    if (!msg) return alert("Escribe el motivo");

    const btn = document.querySelector("#ppanel-enviar .btn-inas-enviar");
    if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }

    try {
        const hijos = getHijosPadre();
        const hijo = hijos.find(h => h.dni === dniHijo);
        const prof = await getData(`profesores/${profKey}`);

        const archivosSubidos = await Promise.all(archivosInasistencia.map(async file => {
            const url = await subirArchivoStorage(file, `inasistencias/${Date.now()}_${file.name}`);
            return { nombre: file.name, tipo: file.type, url };
        }));

        await pushData('inasistencias', {
            tipo: 'padre',
            padre_usuario: SESION.get("usuario"),
            nombre_padre: SESION.get("nombre"),
            estudiante_dni: dniHijo,
            nombre_estudiante: hijo?.nombre || "",
            grado: hijo?.grado || "",
            seccion: hijo?.seccion || "",
            profesor_key: profKey,
            nombre_profesor: prof?.nombre || "",
            dias: diasSelInas,
            mensaje: msg,
            archivos: archivosSubidos,
            fecha: new Date().toISOString(),
            leido: false
        });

        document.getElementById("inaMsg").value = "";
        document.getElementById("inaProfesor").value = "";
        document.getElementById("inaArchivosPreview").innerHTML = "";
        document.getElementById("fileInasistencia").value = "";
        diasSelInas = [];
        renderDiasSelBox("inasDiasSelBox", diasSelInas, "quitarDiaInas");
        archivosInasistencia = [];
        toast("Justificación enviada", "success");
        cargarHistorialPadre(getHijosPadre());
    } catch (e) {
        toast("Error al enviar", "error");
        console.error(e);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Enviar justificación"; }
    }
}

async function cargarHistorialPadre(hijos) {
    const cont = document.getElementById("inaHistorialPadre");
    if (!cont) return;
    cont.innerHTML = "<p class='vacio'>Cargando...</p>";
    try {
        const data = await getData('inasistencias');
        if (!data) { cont.innerHTML = "<p class='vacio'>No hay justificaciones enviadas aún</p>"; return; }
        const lista = Object.entries(data)
            .map(([key, v]) => ({ ...v, id: key }))
            .filter(v => hijos.some(h => h.dni === v.estudiante_dni) && v.tipo === 'padre')
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        if (!lista.length) { cont.innerHTML = "<p class='vacio'>No hay justificaciones enviadas aún</p>"; return; }

        // Precargar fotos de perfil de profesores destinatarios
        const profKeys = [...new Set(lista.map(j => j.profesor_key).filter(Boolean))];
        const fotosPerfil = {};
        await Promise.all(profKeys.map(async (pk) => {
            const emailOriginal = pk.replace(/_/g, '.');
            const foto = await getFotoPerfil(emailOriginal, 'profesor');
            if (foto) fotosPerfil[pk] = foto;
        }));

        cont.innerHTML = lista.map(j => {
            const fotoProf = fotosPerfil[j.profesor_key] || null;
            return `
            <div class="inas-card">
                <div class="inas-card-header">
                    <div class="inas-header-con-foto">
                        ${renderFotoPerfilMini(fotoProf, j.nombre_profesor || "Profesor")}
                        <div class="inas-header-info">
                            <h4><i class="bx bx-user"></i> ${escapeHTML(j.nombre_estudiante)}</h4>
                            <span class="inas-profe-badge"><i class="bx bx-chalkboard"></i> Para: ${escapeHTML(j.nombre_profesor || "Profesor")}</span>
                        </div>
                        <span class="inas-fecha">${formatFechaInas(j.fecha)}</span>
                    </div>
                </div>
                <div class="inas-dias-list"><i class="bx bx-calendar"></i> Días: ${(j.dias||[]).map(d=>`<span class="dia-badge">${formatDiaSimple(d)}</span>`).join("")}</div>
                <p class="inas-mensaje">${escapeHTML(j.mensaje)}</p>
                ${renderArchivosInas(j.archivos)}
                <div class="inas-card-acciones">
                    <span class="inas-estado ${j.leido?'leido':'pendiente'}">${j.leido?'<i class="bx bx-check-circle"></i> Visto':'<i class="bx bx-time"></i> Pendiente'}</span>
                    <button class="btn-eliminar" onclick="eliminarJustificacion('${j.id}', true)">Eliminar</button>
                </div>
            </div>`;
        }).join("");
    } catch (e) { cont.innerHTML = "<p class='vacio'>Error al cargar.</p>"; }
}

/* ================================================
   VISTA PROFESOR — 3 TABS
   ================================================ */
function renderInasistenciaProfesor(cont) {
    cont.innerHTML = `
        <div class="inas-tabs">
            <button class="inas-tab active" id="tab-historial" onclick="switchTabInas('historial')"><i class="bx bx-folder"></i> Historial</button>
            <button class="inas-tab" id="tab-justificar" onclick="switchTabInas('justificar')"><i class="bx bx-pencil"></i> Justificación</button>
            <button class="inas-tab" id="tab-cuadro" onclick="switchTabInas('cuadro')"><i class="bx bx-table"></i> Cuadro</button>
        </div>

        <!-- PANEL HISTORIAL -->
        <div id="panel-historial" class="inas-panel">
            <div class="inas-box">
                <h3><i class="bx bx-inbox"></i> Justificaciones recibidas</h3>
                <div id="inaJustRecibidas"><p class="vacio">Cargando...</p></div>
            </div>
            <div class="inas-box" style="margin-top:16px;">
                <h3><i class="bx bx-clipboard"></i> Mis justificaciones registradas</h3>
                <div id="inaHistorialProf"><p class="vacio">Cargando...</p></div>
            </div>
        </div>

        <!-- PANEL JUSTIFICACIÓN -->
        <div id="panel-justificar" class="inas-panel" style="display:none;">
            <div class="inas-box">
                <h3><i class="bx bx-edit"></i> Registrar justificación</h3>
                <div class="inas-form-group">
                    <label>Buscar alumno</label>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <input type="text" id="inasBuscarAlumno" placeholder="Nombre o DNI" oninput="buscarAlumnoInas()">
                        <select id="inasGradoFiltro" onchange="buscarAlumnoInas()">
                            <option value="">Grado</option>
                            <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                        </select>
                        <select id="inasSeccionFiltro" onchange="buscarAlumnoInas()">
                            <option value="">Sección</option>
                            <option>A</option><option>B</option>
                        </select>
                    </div>
                    <div id="inasListaAlumnos" class="lista-scroll" style="margin-top:8px;"></div>
                    <div id="inasAlumnoSelBox" style="margin-top:8px;"></div>
                </div>
                <div class="inas-form-group">
                    <label>Días de inasistencia</label>
                    <div class="inas-date-picker-wrap">
                        <input type="date" id="inaFechaInputProf" min="${fechaHoy()}" onchange="agregarDiaInasProf()">
                        <span class="inas-date-hint">Selecciona los días uno por uno (no sábado/domingo)</span>
                    </div>
                    <div id="inasDiasSelBoxProf" class="inas-dias-sel-box"><span class="inas-date-hint">Ningún día seleccionado</span></div>
                </div>
                <div class="inas-form-group">
                    <label>Motivo / Observación</label>
                    <textarea id="inaMsgProf" placeholder="Escribe el motivo o detalle..."></textarea>
                </div>
                <div class="inas-form-group">
                    <div id="inaArchivosPreviewProf" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;"></div>
                    <input type="file" id="fileInasistenciaProf" multiple accept="image/*,.pdf" onchange="handleFilesInasistenciaProf(this)">
                    <label for="fileInasistenciaProf" class="btn-file"><i class="bx bx-paperclip"></i> Adjuntar archivo (opcional)</label>
                </div>
                <button class="btn-inas-enviar" onclick="enviarJustificacionProf()"><i class="bx bx-save"></i> Registrar justificación</button>
            </div>
        </div>

        <!-- PANEL CUADRO -->
        <div id="panel-cuadro" class="inas-panel" style="display:none;">
            <div class="inas-box">
                <h3><i class="bx bx-grid-alt"></i> Cuadro de asistencia semanal</h3>
                <div class="inas-cuadro-filtros">
                    <select id="cuadroGrado">
                        <option value="">Grado</option>
                        <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                    </select>
                    <select id="cuadroSeccion">
                        <option value="">Sección</option>
                        <option>A</option><option>B</option>
                    </select>
                    <button class="btn-inas-buscar" onclick="cargarCuadroAsistencia()"><i class="bx bx-show"></i> Ver cuadro</button>
                </div>
                <div class="inas-semana-nav">
                    <button onclick="cambiarSemana(-1)"><i class="bx bx-chevron-left"></i> Semana anterior</button>
                    <span id="semanaLabel">—</span>
                    <button onclick="cambiarSemana(1)">Semana siguiente <i class="bx bx-chevron-right"></i></button>
                </div>
                <div id="cuadroAsistencia" style="overflow-x:auto;margin-top:12px;"></div>
            </div>
        </div>
    `;

    cargarHistorialProfesor();
    cargarJustificacionesProfesor();
    actualizarSemanaLabel();
}

function switchTabInas(tab) {
    ['historial','justificar','cuadro'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
        document.getElementById(`panel-${t}`).style.display = t === tab ? 'block' : 'none';
    });
}

let alumnoSelInas = null;
let archivosInasProf = [];

function buscarAlumnoInas() {
    const texto = document.getElementById("inasBuscarAlumno").value.toLowerCase();
    const grado = document.getElementById("inasGradoFiltro").value;
    const seccion = document.getElementById("inasSeccionFiltro").value;
    const lista = document.getElementById("inasListaAlumnos");
    lista.innerHTML = "";
    if (!texto && !grado && !seccion) return;
    const res = getEstudiantes().filter(est =>
        (est.nombre.toLowerCase().includes(texto) || est.dni.includes(texto)) &&
        (!grado || est.grado === grado) && (!seccion || est.seccion === seccion)
    ).slice(0, 8);
    if (!res.length) { lista.innerHTML = `<div class="lista-vacia"><p>Sin resultados</p></div>`; return; }
    res.forEach(est => {
        const div = document.createElement("div");
        div.className = "item-estudiante";
        div.innerHTML = `<span><strong>${escapeHTML(est.nombre)}</strong><small>${est.grado}° ${est.seccion}</small></span>
            <button class="btn-agregar" onclick="seleccionarAlumnoInas('${est.dni}')">Seleccionar</button>`;
        lista.appendChild(div);
    });
}

function seleccionarAlumnoInas(dni) {
    const est = getEstudiantes().find(e => e.dni === dni);
    if (!est) return;
    alumnoSelInas = est;
    document.getElementById("inasListaAlumnos").innerHTML = "";
    document.getElementById("inasBuscarAlumno").value = "";
    document.getElementById("inasAlumnoSelBox").innerHTML = `
        <span class="tag"><i class="bx bx-user"></i> ${escapeHTML(est.nombre)} — ${est.grado}° ${est.seccion}
            <b onclick="limpiarAlumnoInas()" title="Quitar">×</b></span>`;
}

function limpiarAlumnoInas() {
    alumnoSelInas = null;
    document.getElementById("inasAlumnoSelBox").innerHTML = "";
}

function handleFilesInasistenciaProf(input) {
    archivosInasProf = Array.from(input.files);
    const preview = document.getElementById("inaArchivosPreviewProf");
    if (!archivosInasProf.length) { preview.innerHTML = ""; return; }
    preview.innerHTML = archivosInasProf.map(f => `
        <span class="file-tag">
            ${f.type.startsWith("image") ? '<i class="bx bx-image"></i>' : '<i class="bx bx-file"></i>'} ${escapeHTML(f.name)}
        </span>
    `).join("");
}

async function enviarJustificacionProf() {
    if (!alumnoSelInas) return alert("Selecciona un alumno");
    if (!diasSelInasProf.length) return alert("Selecciona al menos un día");
    const msg = document.getElementById("inaMsgProf").value.trim();
    if (!msg) return alert("Escribe el motivo");

    const btn = document.querySelector("#panel-justificar .btn-inas-enviar");
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }

    try {
        const prof = getUsuarioActual();
        const archivosSubidos = await Promise.all(archivosInasProf.map(async file => {
            const url = await subirArchivoStorage(file, `inasistencias/${Date.now()}_${file.name}`);
            return { nombre: file.name, tipo: file.type, url };
        }));

        await pushData('inasistencias', {
            tipo: 'profesor',
            profesor_usuario: prof.usuario,
            nombre_profesor: prof.nombre,
            estudiante_dni: alumnoSelInas.dni,
            nombre_estudiante: alumnoSelInas.nombre,
            grado: alumnoSelInas.grado,
            seccion: alumnoSelInas.seccion,
            dias: diasSelInasProf,
            mensaje: msg,
            archivos: archivosSubidos,
            fecha: new Date().toISOString()
        });

        limpiarAlumnoInas();
        document.getElementById("inaMsgProf").value = "";
        document.getElementById("inaArchivosPreviewProf").innerHTML = "";
        document.getElementById("fileInasistenciaProf").value = "";
        diasSelInasProf = [];
        renderDiasSelBox("inasDiasSelBoxProf", diasSelInasProf, "quitarDiaInasProf");
        archivosInasProf = [];
        toast("Justificación registrada", "success");
        cargarJustificacionesProfesor();
    } catch (e) {
        toast("Error al guardar", "error");
        console.error(e);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Registrar justificación"; }
    }
}

async function cargarHistorialProfesor() {
    const cont = document.getElementById("inaJustRecibidas");
    if (!cont) return;
    const usuario = SESION.get("usuario");
    try {
        const data = await getData('inasistencias');
        if (!data) { cont.innerHTML = "<p class='vacio'>No hay justificaciones recibidas</p>"; return; }
        const lista = Object.entries(data)
            .map(([key, v]) => ({ ...v, id: key }))
            .filter(v => v.tipo === 'padre' && v.profesor_key === usuario.replace(/[.@]/g, '_'))
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        if (!lista.length) { cont.innerHTML = "<p class='vacio'>No hay justificaciones recibidas aún</p>"; return; }

        // Precargar fotos de perfil de padres
        const padreUsers = [...new Set(lista.map(j => j.padre_usuario).filter(Boolean))];
        const fotosPerfil = {};
        await Promise.all(padreUsers.map(async (pu) => {
            const foto = await getFotoPerfil(pu, 'padre');
            if (foto) fotosPerfil[pu] = foto;
        }));

        cont.innerHTML = lista.map(j => {
            const fotoPadre = fotosPerfil[j.padre_usuario] || null;
            return `
            <div class="inas-card ${!j.leido?'inas-no-leido':''}">
                <div class="inas-card-header">
                    <div class="inas-header-con-foto">
                        ${renderFotoPerfilMini(fotoPadre, j.nombre_padre || "Padre")}
                        <div class="inas-header-info">
                            <h4><i class="bx bx-user"></i> ${escapeHTML(j.nombre_estudiante)} — ${j.grado}° ${j.seccion}</h4>
                            <span class="inas-profe-badge"><i class="bx bx-home"></i> De: ${escapeHTML(j.nombre_padre||"Padre")}</span>
                        </div>
                        <span class="inas-fecha">${formatFechaInas(j.fecha)}</span>
                    </div>
                </div>
                <div class="inas-dias-list"><i class="bx bx-calendar"></i> Días: ${(j.dias||[]).map(d=>`<span class="dia-badge">${formatDiaSimple(d)}</span>`).join("")}</div>
                <p class="inas-mensaje">${escapeHTML(j.mensaje)}</p>
                ${renderArchivosInas(j.archivos)}
                <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
                    ${!j.leido?`<button class="btn-inas-leido" onclick="marcarLeido('${j.id}')"><i class="bx bx-check-circle"></i> Marcar visto</button>`:`<span class="inas-estado leido"><i class="bx bx-check-circle"></i> Visto</span>`}
                    <a href="#" onclick="descargarTXTJustificacion(${JSON.stringify(j).replace(/"/g,'&quot;')})" class="btn-inas-pdf"><i class="bx bx-file"></i> Descargar</a>
                    <button class="btn-eliminar" onclick="eliminarJustificacion('${j.id}', false)">Eliminar</button>
                </div>
            </div>`;
        }).join("");
    } catch (e) { cont.innerHTML = "<p class='vacio'>Error al cargar.</p>"; }
}

async function cargarJustificacionesProfesor() {
    const cont = document.getElementById("inaHistorialProf");
    if (!cont) return;
    const usuario = SESION.get("usuario");
    try {
        const data = await getData('inasistencias');
        if (!data) { cont.innerHTML = "<p class='vacio'>No hay registros aún</p>"; return; }
        const lista = Object.entries(data)
            .map(([key, v]) => ({ ...v, id: key }))
            .filter(v => v.tipo === 'profesor' && v.profesor_usuario === usuario)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        if (!lista.length) { cont.innerHTML = "<p class='vacio'>No has registrado justificaciones aún</p>"; return; }

        // Precargar foto de perfil del profesor logueado
        const fotoProf = await getFotoPerfil(usuario, 'profesor');

        cont.innerHTML = lista.map(j => `
            <div class="inas-card">
                <div class="inas-card-header">
                    <div class="inas-header-con-foto">
                        ${renderFotoPerfilMini(fotoProf, j.nombre_profesor || "Profesor")}
                        <div class="inas-header-info">
                            <h4><i class="bx bx-user"></i> ${escapeHTML(j.nombre_estudiante)} — ${j.grado}° ${j.seccion}</h4>
                        </div>
                        <span class="inas-fecha">${formatFechaInas(j.fecha)}</span>
                    </div>
                </div>
                <div class="inas-dias-list"><i class="bx bx-calendar"></i> Días: ${(j.dias||[]).map(d=>`<span class="dia-badge">${formatDiaSimple(d)}</span>`).join("")}</div>
                <p class="inas-mensaje">${escapeHTML(j.mensaje)}</p>
                ${renderArchivosInas(j.archivos)}
                <div style="margin-top:10px;">
                    <button class="btn-eliminar" onclick="eliminarJustificacion('${j.id}', false)">Eliminar</button>
                </div>
            </div>`).join("");
    } catch (e) { cont.innerHTML = "<p class='vacio'>Error al cargar.</p>"; }
}

async function marcarLeido(id) {
    try {
        await updateData(`inasistencias/${id}`, { leido: true });
        toast("Marcado como visto", "success");
        cargarHistorialProfesor();
    } catch (e) { toast("Error", "error"); }
}

async function eliminarJustificacion(id, esPadre) {
    confirmarEliminar("esta justificación", async () => {
        try {
            await deleteData(`inasistencias/${id}`);
            toast("Eliminado", "delete");
            if (esPadre) cargarHistorialPadre(getHijosPadre());
            else { cargarHistorialProfesor(); cargarJustificacionesProfesor(); }
        } catch (e) { toast("Error", "error"); }
    });
}

function descargarTXTJustificacion(j) {
    const contenido = [
        "JUSTIFICACIÓN DE INASISTENCIA",
        "==============================",
        `Alumno:        ${j.nombre_estudiante}`,
        `Grado/Sección: ${j.grado}° ${j.seccion}`,
        `Padre/Madre:   ${j.nombre_padre || "—"}`,
        `Profesor:      ${j.nombre_profesor || "—"}`,
        `Días:          ${(j.dias||[]).map(d => formatDiaSimple(d)).join(", ")}`,
        `Motivo:        ${j.mensaje}`,
        `Fecha envío:   ${formatFechaInas(j.fecha)}`
    ].join("\n");
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `justificacion_${j.nombre_estudiante.replace(/\s/g,'_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Descargado", "success");
}

/* ================================================
   CUADRO SEMANAL
   ================================================ */
let semanaOffset = 0;

function actualizarSemanaLabel() {
    const dias = getDiasSemana(semanaOffset);
    const label = document.getElementById("semanaLabel");
    if (label) label.textContent = `${dias[0].toLocaleDateString('es-PE',{day:'2-digit',month:'short'})} — ${dias[4].toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})}`;
}

function getDiasSemana(offset = 0) {
    const hoyD = new Date();
    const dow = hoyD.getDay();
    const lunes = new Date(hoyD);
    lunes.setDate(hoyD.getDate() + (dow === 0 ? -6 : 1 - dow) + offset * 7);
    lunes.setHours(0,0,0,0);
    return Array.from({length:5},(_,i)=>{ const d=new Date(lunes); d.setDate(lunes.getDate()+i); return d; });
}

function cambiarSemana(dir) {
    semanaOffset += dir;
    actualizarSemanaLabel();
    const g = document.getElementById("cuadroGrado")?.value;
    const s = document.getElementById("cuadroSeccion")?.value;
    if (g && s) cargarCuadroAsistencia();
}

async function cargarCuadroAsistencia() {
    const grado = document.getElementById("cuadroGrado")?.value;
    const seccion = document.getElementById("cuadroSeccion")?.value;
    const cont = document.getElementById("cuadroAsistencia");
    if (!cont) return;
    actualizarSemanaLabel();
    if (!grado || !seccion) { cont.innerHTML = `<p class="vacio">Selecciona grado y sección</p>`; return; }
    cont.innerHTML = `<p class="vacio">Cargando...</p>`;
    try {
        const dias = getDiasSemana(semanaOffset);
        const diasISO = dias.map(d => d.toISOString().split('T')[0]);
        const diasLabel = dias.map(d => d.toLocaleDateString('es-PE',{weekday:'short',day:'2-digit',month:'short'}));
        const estudiantes = getEstudiantes().filter(e => e.grado === grado && e.seccion === seccion);
        const data = await getData('inasistencias');
        const inasistencias = data ? Object.values(data) : [];
        if (!estudiantes.length) { cont.innerHTML = `<p class="vacio">No hay alumnos en ${grado}° ${seccion}</p>`; return; }

        let html = `<table class="inas-tabla"><thead><tr><th>Alumno</th>
            ${diasLabel.map((d,i)=>`<th>${d}<br><small style="font-weight:400;opacity:0.75;">${diasISO[i]}</small></th>`).join("")}
            </tr></thead><tbody>`;

        estudiantes.forEach(est => {
            html += `<tr><td class="inas-alumno-nombre">${escapeHTML(est.nombre)}</td>`;
            diasISO.forEach(iso => {
                const ausente = inasistencias.some(j => j.estudiante_dni === est.dni && (j.dias||[]).includes(iso));
                html += ausente ? `<td class="inas-cel-ausente"><i class="bx bx-x"></i></td>` : `<td class="inas-cel-presente"><i class="bx bx-check"></i></td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table>
            <div style="margin-top:10px;display:flex;gap:16px;font-size:0.83rem;color:#64748b;">
                <span><i class="bx bx-check"></i> Presente &nbsp; <i class="bx bx-x"></i> Inasistencia justificada</span>
            </div>`;
        cont.innerHTML = html;
    } catch (e) { cont.innerHTML = `<p class="vacio">Error al cargar cuadro.</p>`; }
}

/* ================================================
   HELPERS
   ================================================ */
function renderArchivosInas(archivos) {
    if (!archivos || !archivos.length) return "";
    return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">` +
        archivos.map(a => {
            if (a.tipo?.startsWith("image")) return `
                <div class="foto-item">
                    <img src="${a.url}" class="img-pequena" style="max-width:120px;height:80px;" onclick="abrirModal('${a.url}')">
                    <a href="${a.url}" download="${escapeHTML(a.nombre)}" class="btn-descargar"><i class="bx bx-download"></i></a>
                </div>`;
            return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                <i class="bx bx-file" style="font-size:1.15rem;color:#475569;"></i><span style="font-size:0.85rem;font-weight:600;">${escapeHTML(a.nombre)}</span>
                <a href="${a.url}" download="${escapeHTML(a.nombre)}" class="btn-descargar" style="padding:4px 10px;font-size:0.8rem;"><i class="bx bx-download"></i></a>
            </div>`;
        }).join("") + `</div>`;
}

function formatFechaInas(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function formatDiaSimple(iso) {
    if (!iso) return iso;
    return new Date(iso+'T00:00:00').toLocaleDateString('es-PE',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
}

// Exponer globales
window.initInasistencia = initInasistencia;
window.switchTabPadre = switchTabPadre;
window.switchTabInas = switchTabInas;
window.agregarDiaInas = agregarDiaInas;
window.quitarDiaInas = quitarDiaInas;
window.agregarDiaInasProf = agregarDiaInasProf;
window.quitarDiaInasProf = quitarDiaInasProf;
window.enviarJustificacion = enviarJustificacion;
window.handleFilesInasistencia = handleFilesInasistencia;
window.handleFilesInasistenciaProf = handleFilesInasistenciaProf;
window.enviarJustificacionProf = enviarJustificacionProf;
window.buscarAlumnoInas = buscarAlumnoInas;
window.seleccionarAlumnoInas = seleccionarAlumnoInas;
window.limpiarAlumnoInas = limpiarAlumnoInas;
window.marcarLeido = marcarLeido;
window.eliminarJustificacion = eliminarJustificacion;
window.descargarTXTJustificacion = descargarTXTJustificacion;
window.cambiarSemana = cambiarSemana;
window.cargarCuadroAsistencia = cargarCuadroAsistencia;
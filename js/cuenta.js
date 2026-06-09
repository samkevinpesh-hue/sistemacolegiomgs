// cuenta.js — Módulo Cuenta (Perfil + Hijos + Usuarios Admin)
// ================================================

import { SESION, getHijosPadre, escapeHTML, quitarBtnRecargar, subirArchivoStorage, toast, confirmarEliminar, getFotoPerfil, renderFotoPerfilMini } from './data.js';
import { getData, setData, updateData, deleteData } from './firebase-config.js';

function initCuenta(contenedor) {
    quitarBtnRecargar();
    const rol = SESION.get("rol");
    if (rol === "padre") {
        renderCuentaPadre(contenedor);
    } else {
        renderCuentaGenerica(contenedor);
    }
}

/* ================================================================
   SECCIÓN 1: VISTA CUENTA (Perfil) — PADRE
   ================================================================ */
async function renderCuentaPadre(cont) {
    const datos = getUsuarioActual();
    const hijos = SESION.getJSON("hijos") || [];

    if (!datos) { 
        cont.innerHTML = "<p class='vacio'>No se encontraron datos.</p>"; 
        return; 
    }

    const userKey = datos.usuario.replace(/[.@]/g, '_');
    const padreData = await getData(`padres/${userKey}`);
    const fotoPerfil = padreData?.foto_perfil || "";
    const inicial = (datos.nombre || "").charAt(0).toUpperCase();

    cont.innerHTML = `
        <div class="cuenta-wrapper">
            <div class="cuenta-card">
                <div class="cuenta-avatar-wrapper">
                    ${fotoPerfil 
                        ? `<img src="${fotoPerfil}" class="cuenta-avatar-img" alt="Foto de perfil" onclick="mostrarFotoPerfil(this.src)" title="Ver foto">`
                        : `<div class="cuenta-avatar">${inicial}</div>`
                    }
                    <div class="cuenta-avatar-actions">
                        <button class="btn-cambiar-foto" onclick="abrirSelectorFoto()" title="Cambiar foto">
                            <i class="bx bx-camera"></i>
                        </button>
                        ${fotoPerfil ? `
                        <button class="btn-eliminar-foto" onclick="eliminarFotoPerfil()" title="Eliminar foto">
                            <i class="bx bx-trash"></i>
                        </button>` : ""}
                    </div>
                    <input type="file" id="inputFotoPerfil" accept="image/*" style="display:none;" onchange="subirFotoPerfil(this)">
                </div>
                <div class="cuenta-nombre">${escapeHTML(datos.nombre || datos.usuario)}</div>
                <div class="cuenta-rol-badge">👨‍👩‍👧 Padre de Familia</div>
                <div class="cuenta-info">
                    <div class="cuenta-fila">
                        <span class="cuenta-label">👤 Usuario</span>
                        <span class="cuenta-valor">${escapeHTML(datos.usuario)}</span>
                    </div>
                    <div class="cuenta-fila">
                        <span class="cuenta-label">🔑 Contraseña</span>
                        <span class="cuenta-valor cuenta-pass">••••••••</span>
                    </div>
                    <div class="cuenta-fila">
                        <span class="cuenta-label">🏫 Rol</span>
                        <span class="cuenta-valor">${escapeHTML(datos.rol)}</span>
                    </div>
                </div>
            </div>

            <div class="hijos-section">
                <div class="hijos-header">
                    <h3>👨‍👩‍👧 Mis Hijos</h3>
                    <span class="hijos-count">${hijos.length} estudiante${hijos.length > 1 ? "s" : ""} a cargo</span>
                </div>
                <div class="hijos-grid">
                    ${hijos.length ? hijos.map(h => `
                        <div class="hijo-card">
                            <div class="hijo-avatar">${h.nombre.charAt(0).toUpperCase()}</div>
                            <div class="hijo-info">
                                <h4>${escapeHTML(h.nombre)}</h4>
                                <div class="hijo-badges">
                                    <span class="badge badge-grado">📚 ${h.grado}° Grado</span>
                                    <span class="badge badge-seccion">🏫 Sección ${h.seccion}</span>
                                </div>
                                <p class="hijo-dni">DNI: ${h.dni}</p>
                            </div>
                        </div>
                    `).join("") : "<p class='sin-hijos'>No tienes estudiantes asignados.</p>"}
                </div>
            </div>
        </div>
    `;
}

/* ================================================================
   SECCIÓN 2: VISTA CUENTA (Perfil) — PROFESOR / ADMIN
   ================================================================ */
async function renderCuentaGenerica(cont) {
    const datos = getUsuarioActual();
    if (!datos) { 
        cont.innerHTML = "<p class='vacio'>No se encontraron datos.</p>"; 
        return; 
    }

    const userKey = datos.usuario.replace(/[.@]/g, '_');
    const tabla = datos.rol === "admin" ? "profesores" : "profesores";
    const userData = await getData(`${tabla}/${userKey}`);
    const fotoPerfil = userData?.foto_perfil || "";

    const inicial = (datos.nombre || "").charAt(0).toUpperCase();
    const rolLabel = datos.rol === "profesor" ? "👨‍🏫 Profesor" : (datos.rol === "psicologo" || datos.rol === "psicólogo") ? "🧠 Psicólogo" : "⚙️ Administrador";
    const cursoEmoji = datos.rol === "psicologo" || datos.rol === "psicólogo" ? "🧠" : "📚";

    cont.innerHTML = `
        <div class="cuenta-wrapper">
            <div class="cuenta-card">
                <div class="cuenta-avatar-wrapper">
                    ${fotoPerfil 
                        ? `<img src="${fotoPerfil}" class="cuenta-avatar-img" alt="Foto de perfil" onclick="mostrarFotoPerfil(this.src)" title="Ver foto">`
                        : `<div class="cuenta-avatar">${inicial}</div>`
                    }
                    <div class="cuenta-avatar-actions">
                        <button class="btn-cambiar-foto" onclick="abrirSelectorFoto()" title="Cambiar foto">
                            <i class="bx bx-camera"></i>
                        </button>
                        ${fotoPerfil ? `
                        <button class="btn-eliminar-foto" onclick="eliminarFotoPerfil()" title="Eliminar foto">
                            <i class="bx bx-trash"></i>
                        </button>` : ""}
                    </div>
                    <input type="file" id="inputFotoPerfil" accept="image/*" style="display:none;" onchange="subirFotoPerfil(this)">
                </div>
                <div class="cuenta-nombre">${escapeHTML(datos.nombre || datos.usuario)}</div>
                ${(datos.rol === "profesor" || datos.rol === "psicologo" || datos.rol === "psicólogo") ? `<div class="cuenta-curso">${datos.emoji || cursoEmoji} ${escapeHTML(datos.curso || "")}</div>` : ""}
                <div class="cuenta-rol-badge">${rolLabel}</div>
                <div class="cuenta-info">
                    <div class="cuenta-fila">
                        <span class="cuenta-label">👤 Usuario</span>
                        <span class="cuenta-valor">${escapeHTML(datos.usuario)}</span>
                    </div>
                    <div class="cuenta-fila">
                        <span class="cuenta-label">🔑 Contraseña</span>
                        <span class="cuenta-valor cuenta-pass">••••••••</span>
                    </div>
                    ${(datos.rol === "profesor" || datos.rol === "psicologo" || datos.rol === "psicólogo") ? `
                    <div class="cuenta-fila">
                        <span class="cuenta-label">📖 Curso</span>
                        <span class="cuenta-valor">${escapeHTML(datos.curso || "—")}</span>
                    </div>` : ""}
                    <div class="cuenta-fila">
                        <span class="cuenta-label">🏫 Rol</span>
                        <span class="cuenta-valor">${escapeHTML(datos.rol)}</span>
                    </div>
                </div>

                <!-- 🔐 BOTÓN CAMBIAR CONTRASEÑA - SOLO PROFESORES/ADMIN -->
                <div class="cuenta-cambiar-pass">
                    <button class="btn-cambiar-pass" onclick="abrirModalCambiarPassword()">
                        <i class="bx bx-lock-alt"></i> Cambiar contraseña
                    </button>
                </div>
            </div>
        </div>
    `;
}

function getUsuarioActual() {
    return {
        usuario: SESION.get("usuario"),
        rol: SESION.get("rol"),
        nombre: SESION.get("nombre"),
        curso: SESION.get("curso"),
        emoji: SESION.get("emoji")
    };
}

/* ================================================================
   🔐 CAMBIAR CONTRASEÑA — SOLO PROFESORES / ADMIN
   ================================================================ */
function abrirModalCambiarPassword() {
    let modal = document.getElementById('modal-cambiar-password');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-cambiar-password';
        modal.className = 'modal-usuario-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-cambiar-pass-box">
            <button class="modal-usuario-close" onclick="cerrarModalCambiarPassword()">×</button>
            <div class="cambiar-pass-header">
                <div class="cambiar-pass-icon"><i class="bx bx-lock-alt"></i></div>
                <h3>Cambiar contraseña</h3>
                <p>Ingresa tu contraseña actual y la nueva</p>
            </div>
            <div class="cambiar-pass-body">
                <div class="cambiar-pass-grupo">
                    <label><i class="bx bx-key"></i> Contraseña actual</label>
                    <div class="pass-input-wrapper">
                        <input type="password" id="pass-actual" placeholder="Tu contraseña actual">
                        <button type="button" class="btn-ver-pass-input" onclick="toggleVerPassInput('pass-actual', this)">
                            <i class="bx bx-show"></i>
                        </button>
                    </div>
                </div>
                <div class="cambiar-pass-grupo">
                    <label><i class="bx bx-lock"></i> Nueva contraseña</label>
                    <div class="pass-input-wrapper">
                        <input type="password" id="pass-nueva" placeholder="Mínimo 4 caracteres">
                        <button type="button" class="btn-ver-pass-input" onclick="toggleVerPassInput('pass-nueva', this)">
                            <i class="bx bx-show"></i>
                        </button>
                    </div>
                </div>
                <div class="cambiar-pass-grupo">
                    <label><i class="bx bx-check-shield"></i> Confirmar nueva contraseña</label>
                    <div class="pass-input-wrapper">
                        <input type="password" id="pass-confirmar" placeholder="Repite la nueva contraseña">
                        <button type="button" class="btn-ver-pass-input" onclick="toggleVerPassInput('pass-confirmar', this)">
                            <i class="bx bx-show"></i>
                        </button>
                    </div>
                </div>
                <div id="cambiar-pass-error" class="cambiar-pass-error"></div>
            </div>
            <div class="cambiar-pass-footer">
                <button class="btn-cancelar-pass" onclick="cerrarModalCambiarPassword()">Cancelar</button>
                <button class="btn-guardar-pass" onclick="guardarNuevaPassword()">
                    <i class="bx bx-save"></i> Guardar cambios
                </button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    modal.onclick = (e) => { if (e.target === modal) cerrarModalCambiarPassword(); };
    
    // Focus en el primer campo
    setTimeout(() => document.getElementById('pass-actual')?.focus(), 100);
}

function cerrarModalCambiarPassword() {
    const modal = document.getElementById('modal-cambiar-password');
    if (modal) modal.style.display = 'none';
}

function toggleVerPassInput(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (!input || !icon) return;
    
    const esVisible = input.type === 'text';
    input.type = esVisible ? 'password' : 'text';
    icon.className = esVisible ? 'bx bx-show' : 'bx bx-hide';
}

function mostrarErrorCambiarPass(msg) {
    const errorEl = document.getElementById('cambiar-pass-error');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }
}

function limpiarErrorCambiarPass() {
    const errorEl = document.getElementById('cambiar-pass-error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
}

async function guardarNuevaPassword() {
    limpiarErrorCambiarPass();

    const passActual = document.getElementById('pass-actual')?.value.trim();
    const passNueva = document.getElementById('pass-nueva')?.value.trim();
    const passConfirmar = document.getElementById('pass-confirmar')?.value.trim();

    // Validaciones
    if (!passActual) {
        mostrarErrorCambiarPass('❌ Ingresa tu contraseña actual');
        return;
    }
    if (!passNueva) {
        mostrarErrorCambiarPass('❌ Ingresa la nueva contraseña');
        return;
    }
    if (passNueva.length < 4) {
        mostrarErrorCambiarPass('❌ La nueva contraseña debe tener al menos 4 caracteres');
        return;
    }
    if (passNueva !== passConfirmar) {
        mostrarErrorCambiarPass('❌ Las contraseñas nuevas no coinciden');
        return;
    }
    if (passActual === passNueva) {
        mostrarErrorCambiarPass('❌ La nueva contraseña debe ser diferente a la actual');
        return;
    }

    const usuario = SESION.get("usuario");
    const userKey = usuario.replace(/[.@]/g, '_');
    const rol = SESION.get("rol");
    const tabla = (rol === "padre") ? "padres" : "profesores";

    const btnGuardar = document.querySelector('.btn-guardar-pass');
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Guardando...';
    }

    try {
        // Verificar contraseña actual
        const userData = await getData(`${tabla}/${userKey}`);
        if (!userData) {
            mostrarErrorCambiarPass('❌ Error: No se encontró tu usuario');
            return;
        }
        if (userData.password !== passActual) {
            mostrarErrorCambiarPass('❌ La contraseña actual es incorrecta');
            return;
        }

        // Actualizar contraseña en Firebase
        await updateData(`${tabla}/${userKey}`, { password: passNueva });

        // Cerrar modal y mostrar éxito
        cerrarModalCambiarPassword();
        toast('✅ Contraseña actualizada correctamente', 'success');

        // Opcional: cerrar sesión para que vuelva a loguear con la nueva contraseña
        // setTimeout(() => cerrarSesion(), 2000);

    } catch (e) {
        mostrarErrorCambiarPass('❌ Error al actualizar la contraseña');
        console.error(e);
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="bx bx-save"></i> Guardar cambios';
        }
    }
}

/* ==================== SUBIR / ELIMINAR FOTO DE PERFIL ==================== */
function abrirSelectorFoto() {
    document.getElementById("inputFotoPerfil")?.click();
}

async function subirFotoPerfil(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        toast("Selecciona una imagen válida", "error");
        return;
    }

    const btn = document.querySelector(".btn-cambiar-foto");
    if (btn) { btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i>'; btn.disabled = true; }

    try {
        const usuario = SESION.get("usuario");
        const userKey = usuario.replace(/[.@]/g, '_');
        const rol = SESION.get("rol");
        const tabla = rol === "padre" ? "padres" : "profesores";

        const url = await subirArchivoStorage(file, `perfiles/${userKey}_${Date.now()}`);
        await updateData(`${tabla}/${userKey}`, { foto_perfil: url });
        SESION.set("foto_perfil", url);
        toast("Foto de perfil actualizada", "success");

        const contenedor = document.getElementById("modulo-contenido");
        if (contenedor) {
            if (rol === "padre") renderCuentaPadre(contenedor);
            else renderCuentaGenerica(contenedor);
        }
    } catch (e) {
        toast("Error al subir foto", "error");
        console.error(e);
    } finally {
        if (btn) { btn.innerHTML = '<i class="bx bx-camera"></i>'; btn.disabled = false; }
        input.value = "";
    }
}

async function eliminarFotoPerfil() {
    confirmarEliminar("tu foto de perfil", async () => {
        try {
            const usuario = SESION.get("usuario");
            const userKey = usuario.replace(/[.@]/g, '_');
            const rol = SESION.get("rol");
            const tabla = rol === "padre" ? "padres" : "profesores";

            await updateData(`${tabla}/${userKey}`, { foto_perfil: null });
            SESION.remove("foto_perfil");
            toast("Foto de perfil eliminada", "delete");

            const contenedor = document.getElementById("modulo-contenido");
            if (contenedor) {
                if (rol === "padre") renderCuentaPadre(contenedor);
                else renderCuentaGenerica(contenedor);
            }
        } catch (e) {
            toast("Error al eliminar foto", "error");
            console.error(e);
        }
    });
}

/* ==================== OVERLAY FOTO PERFIL ==================== */
function mostrarFotoPerfil(url) {
    if (!url) return;
    eliminarFotoPerfilOverlay();

    const overlay = document.createElement("div");
    overlay.className = "cuenta-foto-overlay";
    overlay.innerHTML = `
        <div class="cuenta-foto-overlay-inner" role="dialog" aria-label="Vista ampliada de foto de perfil">
            <button class="cuenta-foto-overlay-close" onclick="eliminarFotoPerfilOverlay()" aria-label="Cerrar vista de foto">×</button>
            <img src="${url}" alt="Foto de perfil ampliada" class="cuenta-foto-overlay-img">
        </div>
    `;
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) eliminarFotoPerfilOverlay();
    });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", cerrarOverlayTecla);
}

function cerrarOverlayTecla(event) {
    if (event.key === "Escape") {
        eliminarFotoPerfilOverlay();
    }
}

function eliminarFotoPerfilOverlay() {
    const overlay = document.querySelector(".cuenta-foto-overlay");
    if (overlay) {
        overlay.remove();
        document.removeEventListener("keydown", cerrarOverlayTecla);
    }
}


/* ================================================================
   SECCIÓN 3: MÓDULO USUARIOS — SOLO ADMIN
   ================================================================ */

let usuariosCache = [];
let filtroTipoUsuarios = 'todos';
let busquedaUsuarios = '';

async function initUsuariosAdmin(contenedor) {
    quitarBtnRecargar();
    contenedor.innerHTML = `
        <div class="usuarios-wrapper">
            <!-- Header -->
            <div class="usuarios-header">
                <h2><i class="bx bx-group"></i> Gestión de Usuarios</h2>
                <button class="btn-crear-usuario" onclick="abrirFormularioCrearUsuario()">
                    <i class="bx bx-plus"></i> Nuevo usuario
                </button>
            </div>

            <!-- Buscador + Filtros rápidos -->
            <div class="usuarios-buscador-area">
                <div class="usuarios-filtros-rapidos">
                    <button class="filtro-btn active" data-filtro="todos" onclick="cambiarFiltroUsuarios('todos', this)">
                        <i class="bx bx-list-ul"></i> Todos
                    </button>
                    <button class="filtro-btn" data-filtro="padres" onclick="cambiarFiltroUsuarios('padres', this)">
                        <i class="bx bx-user"></i> Padres
                    </button>
                    <button class="filtro-btn" data-filtro="profesores" onclick="cambiarFiltroUsuarios('profesores', this)">
                        <i class="bx bx-chalkboard"></i> Profesores
                    </button>
                    <button class="filtro-btn" data-filtro="inactivos" onclick="cambiarFiltroUsuarios('inactivos', this)">
                        <i class="bx bx-user-x"></i> Inactivos
                    </button>
                </div>
                <div class="usuarios-buscador-input">
                    <i class="bx bx-search"></i>
                    <input type="text" id="buscadorUsuarios" placeholder="Buscar por nombre, usuario o DNI..." oninput="filtrarUsuariosTexto(this.value)">
                    <button class="btn-limpiar-busqueda" onclick="limpiarBusquedaUsuarios()" title="Limpiar">
                        <i class="bx bx-x"></i>
                    </button>
                </div>
            </div>

            <!-- Contador -->
            <div class="usuarios-contador" id="usuariosContador"></div>

            <!-- Lista de usuarios -->
            <div id="usuariosLista" class="usuarios-lista">
                <p class="vacio">Cargando usuarios...</p>
            </div>
        </div>
    `;

    await cargarUsuarios();
}

async function cargarUsuarios() {
    const listaEl = document.getElementById('usuariosLista');
    if (!listaEl) return;

    try {
        const [padresData, profesoresData] = await Promise.all([
            getData('padres'),
            getData('profesores')
        ]);

        usuariosCache = [];

        if (padresData) {
            Object.entries(padresData).forEach(([key, p]) => {
                usuariosCache.push({
                    key,
                    tipo: 'padre',
                    usuario: p.usuario,
                    nombre: p.nombre,
                    password: p.password,
                    activo: p.activo !== false,
                    foto_perfil: p.foto_perfil || null,
                    hijos_dni: p.hijos_dni || [],
                    raw: p
                });
            });
        }

        if (profesoresData) {
            Object.entries(profesoresData).forEach(([key, p]) => {
                if (p.rol === 'admin') return; // No mostrar admin en la lista
                usuariosCache.push({
                    key,
                    tipo: 'profesor',
                    usuario: p.usuario,
                    nombre: p.nombre,
                    password: p.password,
                    activo: p.activo !== false,
                    foto_perfil: p.foto_perfil || null,
                    curso: p.curso || '',
                    emoji: p.emoji || '',
                    rol: p.rol || 'profesor',
                    raw: p
                });
            });
        }

        renderListaUsuarios();
    } catch (e) {
        listaEl.innerHTML = '<p class="vacio">Error al cargar usuarios.</p>';
        console.error(e);
    }
}

function cambiarFiltroUsuarios(filtro, btn) {
    filtroTipoUsuarios = filtro;
    document.querySelectorAll('.usuarios-filtros-rapidos .filtro-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderListaUsuarios();
}

function filtrarUsuariosTexto(texto) {
    busquedaUsuarios = texto.toLowerCase().trim();
    renderListaUsuarios();
}

function limpiarBusquedaUsuarios() {
    const input = document.getElementById('buscadorUsuarios');
    if (input) input.value = '';
    busquedaUsuarios = '';
    renderListaUsuarios();
}

function renderListaUsuarios() {
    const listaEl = document.getElementById('usuariosLista');
    const contadorEl = document.getElementById('usuariosContador');
    if (!listaEl) return;

    let filtrados = usuariosCache.filter(u => {
        if (filtroTipoUsuarios === 'padres' && u.tipo !== 'padre') return false;
        if (filtroTipoUsuarios === 'profesores' && u.tipo !== 'profesor') return false;
        if (filtroTipoUsuarios === 'inactivos' && u.activo) return false;
        if (busquedaUsuarios) {
            const text = `${u.nombre} ${u.usuario} ${u.hijos_dni?.join(' ') || ''}`.toLowerCase();
            return text.includes(busquedaUsuarios);
        }
        return true;
    });

    if (contadorEl) {
        contadorEl.innerHTML = `
            <span class="contador-badge">${filtrados.length} usuario${filtrados.length !== 1 ? 's' : ''}</span>
            <span class="contador-sep">·</span>
            <span class="contador-activos">${filtrados.filter(u => u.activo).length} activos</span>
            <span class="contador-sep">·</span>
            <span class="contador-inactivos">${filtrados.filter(u => !u.activo).length} inactivos</span>
        `;
    }

    if (!filtrados.length) {
        listaEl.innerHTML = `
            <div class="sin-resultados-usuarios">
                <div class="sin-icon">🔍</div>
                <p>No se encontraron usuarios</p>
                <p class="hint">Intenta con otro término de búsqueda</p>
            </div>
        `;
        return;
    }

    listaEl.innerHTML = filtrados.map((u, idx) => {
        const inicial = (u.nombre || "?").charAt(0).toUpperCase();
        const fotoHtml = u.foto_perfil
            ? `<img src="${u.foto_perfil}" class="usuario-avatar-img" alt="">`
            : `<div class="usuario-avatar-inicial" style="background: ${u.tipo === 'padre' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #4e73df, #1cc88a)'}">${inicial}</div>`;

        const tipoBadge = u.tipo === 'padre'
            ? `<span class="usuario-tipo tipo-padre"><i class="bx bx-user"></i> Padre</span>`
            : `<span class="usuario-tipo tipo-profesor"><i class="bx bx-chalkboard"></i> Profesor</span>`;

        const estadoBadge = u.activo
            ? `<span class="usuario-estado estado-activo"><i class="bx bx-check-circle"></i> Activo</span>`
            : `<span class="usuario-estado estado-inactivo"><i class="bx bx-x-circle"></i> Inactivo</span>`;

        const infoExtra = u.tipo === 'padre'
            ? `<span class="usuario-extra"><i class="bx bx-child"></i> ${u.hijos_dni?.length || 0} hijo(s)</span>`
            : `<span class="usuario-extra">${u.emoji || '📚'} ${escapeHTML(u.curso || 'Sin curso')}</span>`;

        return `
            <div class="usuario-card ${!u.activo ? 'usuario-inactivo' : ''}" onclick="verDetalleUsuario('${u.key}', '${u.tipo}')">
                <div class="usuario-avatar">${fotoHtml}</div>
                <div class="usuario-info">
                    <h4>${escapeHTML(u.nombre)}</h4>
                    <p class="usuario-email"><i class="bx bx-envelope"></i> ${escapeHTML(u.usuario)}</p>
                    <div class="usuario-meta">
                        ${tipoBadge}
                        ${estadoBadge}
                        ${infoExtra}
                    </div>
                </div>
                <div class="usuario-acciones" onclick="event.stopPropagation()">
                    <button class="btn-usuario-toggle ${u.activo ? 'btn-desactivar' : 'btn-activar'}" 
                        onclick="toggleUsuarioActivo('${u.key}', '${u.tipo}', ${u.activo})" 
                        title="${u.activo ? 'Inhabilitar cuenta' : 'Activar cuenta'}">
                        <i class="bx ${u.activo ? 'bx-block' : 'bx-check'}"></i>
                        ${u.activo ? 'Inhabilitar' : 'Activar'}
                    </button>
                    <button class="btn-usuario-ver" onclick="verDetalleUsuario('${u.key}', '${u.tipo}')" title="Ver detalle">
                        <i class="bx bx-show"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Animar entrada
    const cards = listaEl.querySelectorAll('.usuario-card');
    if (window.animarEntrada) animarEntrada(cards, 50, 60);
}

async function toggleUsuarioActivo(key, tipo, actualActivo) {
    const tabla = tipo === 'padre' ? 'padres' : 'profesores';
    const nuevoEstado = !actualActivo;

    try {
        await updateData(`${tabla}/${key}`, { activo: nuevoEstado });

        // Actualizar cache local
        const u = usuariosCache.find(x => x.key === key && x.tipo === tipo);
        if (u) u.activo = nuevoEstado;

        toast(nuevoEstado ? '✅ Cuenta activada' : '🚫 Cuenta inhabilitada', nuevoEstado ? 'success' : 'warning');
        renderListaUsuarios();
    } catch (e) {
        toast('Error al cambiar estado', 'error');
        console.error(e);
    }
}


/* ================================================================
   MODAL DETALLE USUARIO
   ================================================================ */
async function verDetalleUsuario(key, tipo) {
    const u = usuariosCache.find(x => x.key === key && x.tipo === tipo);
    if (!u) return;

    let modal = document.getElementById('modal-detalle-usuario');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-detalle-usuario';
        modal.className = 'modal-usuario-overlay';
        document.body.appendChild(modal);
    }

    const tabla = tipo === 'padre' ? 'padres' : 'profesores';
    const data = await getData(`${tabla}/${key}`);

    const inicial = (data?.nombre || "?").charAt(0).toUpperCase();
    const fotoHtml = data?.foto_perfil
        ? `<img src="${data.foto_perfil}" class="detalle-avatar-img" alt="">`
        : `<div class="detalle-avatar-inicial">${inicial}</div>`;

    let infoExtraHtml = '';

    if (tipo === 'padre') {
        // Cargar info de los hijos
        const hijosHtml = [];
        if (data?.hijos_dni && data.hijos_dni.length > 0) {
            for (const dni of data.hijos_dni) {
                const est = await getData(`estudiantes/${dni}`);
                if (est) {
                    hijosHtml.push(`
                        <div class="detalle-hijo-chip">
                            <span class="hijo-inicial">${est.nombre.charAt(0).toUpperCase()}</span>
                            <div>
                                <strong>${escapeHTML(est.nombre)}</strong>
                                <small>${est.grado}° ${est.seccion} · DNI: ${est.dni}</small>
                            </div>
                        </div>
                    `);
                }
            }
        }

        infoExtraHtml = `
            <div class="detalle-seccion">
                <h5><i class="bx bx-child"></i> Hijos asignados</h5>
                ${hijosHtml.length ? `<div class="detalle-hijos-grid">${hijosHtml.join('')}</div>` : '<p class="hint">Sin hijos asignados</p>'}
            </div>
        `;
    } else {
        infoExtraHtml = `
            <div class="detalle-seccion">
                <h5><i class="bx bx-book"></i> Información profesional</h5>
                <div class="detalle-fila">
                    <span class="detalle-label">Curso / Área</span>
                    <span class="detalle-valor">${escapeHTML(data?.curso || '—')}</span>
                </div>
                <div class="detalle-fila">
                    <span class="detalle-label">Emoji</span>
                    <span class="detalle-valor">${data?.emoji || '—'}</span>
                </div>
                <div class="detalle-fila">
                    <span class="detalle-label">Rol</span>
                    <span class="detalle-valor">${escapeHTML(data?.rol || 'profesor')}</span>
                </div>
            </div>
        `;
    }

    const estadoClass = data?.activo !== false ? 'estado-activo' : 'estado-inactivo';
    const estadoTexto = data?.activo !== false ? 'Activo' : 'Inactivo';
    const estadoIcono = data?.activo !== false ? 'bx-check-circle' : 'bx-x-circle';

    modal.innerHTML = `
        <div class="modal-usuario-box">
            <button class="modal-usuario-close" onclick="cerrarModalDetalleUsuario()">×</button>

            <div class="detalle-header">
                <div class="detalle-avatar">${fotoHtml}</div>
                <div class="detalle-header-info">
                    <h3>${escapeHTML(data?.nombre || 'Sin nombre')}</h3>
                    <p class="detalle-tipo">${tipo === 'padre' ? '👨‍👩‍👧 Padre de Familia' : '👨‍🏫 Profesor'}</p>
                    <span class="detalle-estado ${estadoClass}"><i class="bx ${estadoIcono}"></i> ${estadoTexto}</span>
                </div>
            </div>

            <div class="detalle-body">
                <div class="detalle-seccion">
                    <h5><i class="bx bx-id-card"></i> Datos de la cuenta</h5>
                    <div class="detalle-fila">
                        <span class="detalle-label">Usuario / Email</span>
                        <span class="detalle-valor">${escapeHTML(data?.usuario || '—')}</span>
                    </div>
                    <div class="detalle-fila">
                        <span class="detalle-label">Contraseña</span>
                        <span class="detalle-valor detalle-pass">
                            <span id="pass-masked">••••••••</span>
                            <span id="pass-real" style="display:none;">${escapeHTML(data?.password || '—')}</span>
                            <button class="btn-ver-pass" onclick="toggleVerPassword()" title="Mostrar/Ocultar">
                                <i class="bx bx-show"></i>
                            </button>
                        </span>
                    </div>
                    <div class="detalle-fila">
                        <span class="detalle-label">Clave en Firebase</span>
                        <span class="detalle-valor detalle-key">${escapeHTML(key)}</span>
                    </div>
                </div>

                ${infoExtraHtml}
            </div>

            <div class="detalle-footer">
                <button class="btn-detalle-toggle ${data?.activo !== false ? 'btn-desactivar' : 'btn-activar'}" 
                    onclick="toggleUsuarioActivo('${key}', '${tipo}', ${data?.activo !== false}); cerrarModalDetalleUsuario();">
                    <i class="bx ${data?.activo !== false ? 'bx-block' : 'bx-check'}"></i>
                    ${data?.activo !== false ? 'Inhabilitar cuenta' : 'Activar cuenta'}
                </button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    modal.onclick = (e) => { if (e.target === modal) cerrarModalDetalleUsuario(); };
}

function cerrarModalDetalleUsuario() {
    const modal = document.getElementById('modal-detalle-usuario');
    if (modal) modal.style.display = 'none';
}

function toggleVerPassword() {
    const masked = document.getElementById('pass-masked');
    const real = document.getElementById('pass-real');
    if (!masked || !real) return;
    const visible = real.style.display !== 'none';
    masked.style.display = visible ? 'inline' : 'none';
    real.style.display = visible ? 'none' : 'inline';
}


/* ================================================================
   FORMULARIO CREAR USUARIO
   ================================================================ */
function abrirFormularioCrearUsuario() {
    let modal = document.getElementById('modal-crear-usuario');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-crear-usuario';
        modal.className = 'modal-usuario-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-crear-box">
            <button class="modal-usuario-close" onclick="cerrarModalCrearUsuario()">×</button>
            <h3><i class="bx bx-user-plus"></i> Crear nuevo usuario</h3>

            <div class="crear-tabs">
                <button class="crear-tab active" id="tab-crear-padre" onclick="switchTabCrear('padre')">
                    <i class="bx bx-user"></i> Padre
                </button>
                <button class="crear-tab" id="tab-crear-profesor" onclick="switchTabCrear('profesor')">
                    <i class="bx bx-chalkboard"></i> Profesor
                </button>
            </div>

            <!-- FORM PADRE -->
            <div id="form-padre" class="crear-form-panel">
                <div class="crear-grupo">
                    <label>Nombre completo</label>
                    <input type="text" id="padreNombre" placeholder="Ej: PEREZ GARCIA, JUAN CARLOS">
                </div>
                <div class="crear-grupo">
                    <label>Email / Usuario</label>
                    <input type="email" id="padreUsuario" placeholder="ejemplo@gmail.com">
                </div>
                <div class="crear-grupo">
                    <label>Contraseña</label>
                    <input type="text" id="padrePassword" placeholder="Mínimo 6 caracteres">
                </div>
                <div class="crear-grupo">
                    <label>Seleccionar hijo(s)</label>
                    <div class="crear-buscador-hijos">
                        <input type="text" id="buscarHijoCrear" placeholder="Buscar por nombre o DNI..." oninput="buscarHijosParaCrear()">
                        <select id="filtroGradoHijo" onchange="buscarHijosParaCrear()">
                            <option value="">Grado</option>
                            <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
                        </select>
                        <select id="filtroSeccionHijo" onchange="buscarHijosParaCrear()">
                            <option value="">Sección</option>
                            <option>A</option><option>B</option>
                        </select>
                    </div>
                    <div id="listaHijosCrear" class="lista-hijos-crear"></div>
                    <div id="hijosSeleccionadosCrear" class="hijos-seleccionados-crear"></div>
                </div>
                <button class="btn-crear-submit" onclick="crearUsuarioPadre()">
                    <i class="bx bx-save"></i> Crear cuenta de padre
                </button>
            </div>

            <!-- FORM PROFESOR -->
            <div id="form-profesor" class="crear-form-panel" style="display:none;">
                <div class="crear-grupo">
                    <label>Nombre completo</label>
                    <input type="text" id="profNombre" placeholder="Ej: GARCIA LOPEZ, MARIA">
                </div>
                <div class="crear-grupo">
                    <label>Email / Usuario</label>
                    <input type="email" id="profUsuario" placeholder="ejemplo@gmail.com">
                </div>
                <div class="crear-grupo">
                    <label>Contraseña</label>
                    <input type="text" id="profPassword" placeholder="Mínimo 6 caracteres">
                </div>
                <div class="crear-grupo">
                    <label>Curso / Área</label>
                    <div class="crear-curso-selector">
                        <select id="profCursoSelect" onchange="onCursoSelectChange()">
                            <option value="">Seleccionar área existente</option>
                            <option>CyT</option>
                            <option>Inglés</option>
                            <option>Comunicación</option>
                            <option>CCSS</option>
                            <option>IP</option>
                            <option>Religión</option>
                            <option>EPT</option>
                            <option>DPCC</option>
                            <option>Educación Física</option>
                            <option value="nuevo">+ Nueva área</option>
                        </select>
                        <input type="text" id="profCursoNuevo" placeholder="Escribe nueva área..." style="display:none;">
                    </div>
                </div>
                <div class="crear-grupo">
                    <label>Emoji (opcional)</label>
                    <input type="text" id="profEmoji" placeholder="Ej: 🔬 🌎 📚 💻 🎓" maxlength="2">
                </div>
                <button class="btn-crear-submit" onclick="crearUsuarioProfesor()">
                    <i class="bx bx-save"></i> Crear cuenta de profesor
                </button>
            </div>
        </div>
    `;

    hijosSeleccionadosCrear = [];
    modal.style.display = 'flex';
    modal.onclick = (e) => { if (e.target === modal) cerrarModalCrearUsuario(); };
}

function switchTabCrear(tipo) {
    document.getElementById('tab-crear-padre').classList.toggle('active', tipo === 'padre');
    document.getElementById('tab-crear-profesor').classList.toggle('active', tipo === 'profesor');
    document.getElementById('form-padre').style.display = tipo === 'padre' ? 'block' : 'none';
    document.getElementById('form-profesor').style.display = tipo === 'profesor' ? 'block' : 'none';
}

function onCursoSelectChange() {
    const select = document.getElementById('profCursoSelect');
    const nuevo = document.getElementById('profCursoNuevo');
    if (select.value === 'nuevo') {
        nuevo.style.display = 'block';
        nuevo.focus();
    } else {
        nuevo.style.display = 'none';
        nuevo.value = '';
    }
}

function cerrarModalCrearUsuario() {
    const modal = document.getElementById('modal-crear-usuario');
    if (modal) modal.style.display = 'none';
}

/* ===== BUSCADOR HIJOS PARA CREAR PADRE ===== */
let hijosSeleccionadosCrear = [];

async function buscarHijosParaCrear() {
    const texto = document.getElementById('buscarHijoCrear')?.value.toLowerCase().trim() || '';
    const grado = document.getElementById('filtroGradoHijo')?.value || '';
    const seccion = document.getElementById('filtroSeccionHijo')?.value || '';
    const lista = document.getElementById('listaHijosCrear');
    if (!lista) return;

    const estudiantes = await getData('estudiantes');
    if (!estudiantes) { lista.innerHTML = '<p class="hint">No hay estudiantes</p>'; return; }

    const res = Object.entries(estudiantes)
        .map(([dni, e]) => ({ ...e, dni }))
        .filter(est => {
            const coincideTexto = !texto || est.nombre.toLowerCase().includes(texto) || est.dni.includes(texto);
            const coincideGrado = !grado || String(est.grado) === String(grado);
            const coincideSeccion = !seccion || String(est.seccion) === String(seccion);
            const yaSeleccionado = hijosSeleccionadosCrear.some(h => h.dni === est.dni);
            return coincideTexto && coincideGrado && coincideSeccion && !yaSeleccionado;
        })
        .slice(0, 20);

    if (!res.length) {
        lista.innerHTML = '<p class="hint">No se encontraron estudiantes disponibles</p>';
        return;
    }

    lista.innerHTML = res.map(est => `
        <div class="hijo-item-crear" onclick="agregarHijoCrear('${est.dni}', '${escapeHTML(est.nombre)}', '${est.grado}', '${est.seccion}')">
            <span class="hijo-inicial-crear">${est.nombre.charAt(0).toUpperCase()}</span>
            <div class="hijo-info-crear">
                <strong>${escapeHTML(est.nombre)}</strong>
                <small>${est.grado}° ${est.seccion} · DNI: ${est.dni}</small>
            </div>
            <i class="bx bx-plus-circle hijo-add-icon"></i>
        </div>
    `).join('');
}

function agregarHijoCrear(dni, nombre, grado, seccion) {
    if (hijosSeleccionadosCrear.some(h => h.dni === dni)) return;
    hijosSeleccionadosCrear.push({ dni, nombre, grado, seccion });
    renderHijosSeleccionadosCrear();
    buscarHijosParaCrear();
}

function quitarHijoCrear(dni) {
    hijosSeleccionadosCrear = hijosSeleccionadosCrear.filter(h => h.dni !== dni);
    renderHijosSeleccionadosCrear();
    buscarHijosParaCrear();
}

function renderHijosSeleccionadosCrear() {
    const box = document.getElementById('hijosSeleccionadosCrear');
    if (!box) return;
    if (!hijosSeleccionadosCrear.length) {
        box.innerHTML = '<p class="hint">Ningún hijo seleccionado</p>';
        return;
    }
    box.innerHTML = hijosSeleccionadosCrear.map(h => `
        <span class="tag tag-hijo">
            ${escapeHTML(h.nombre)} <small>${h.grado}° ${h.seccion}</small>
            <b onclick="quitarHijoCrear('${h.dni}')" title="Quitar">×</b>
        </span>
    `).join('');
}

/* ===== CREAR USUARIO PADRE ===== */
async function crearUsuarioPadre() {
    const nombre = document.getElementById('padreNombre').value.trim();
    const usuario = document.getElementById('padreUsuario').value.trim().toLowerCase();
    const password = document.getElementById('padrePassword').value.trim();

    if (!nombre) { toast('Ingresa el nombre completo', 'warning'); return; }
    if (!usuario) { toast('Ingresa el email/usuario', 'warning'); return; }
    if (!password || password.length < 4) { toast('Ingresa una contraseña válida', 'warning'); return; }

    const userKey = usuario.replace(/[.@]/g, '_');

    try {
        // Verificar si ya existe
        const existente = await getData(`padres/${userKey}`) || await getData(`profesores/${userKey}`);
        if (existente) { toast('Este usuario ya existe', 'error'); return; }

        const nuevoPadre = {
            usuario: usuario,
            password: password,
            nombre: nombre,
            activo: true,
            hijos_dni: hijosSeleccionadosCrear.map(h => h.dni)
        };

        await setData(`padres/${userKey}`, nuevoPadre);
        toast('✅ Cuenta de padre creada exitosamente', 'success');
        cerrarModalCrearUsuario();
        await cargarUsuarios();
    } catch (e) {
        toast('Error al crear usuario', 'error');
        console.error(e);
    }
}

/* ===== CREAR USUARIO PROFESOR ===== */
async function crearUsuarioProfesor() {
    const nombre = document.getElementById('profNombre').value.trim();
    const usuario = document.getElementById('profUsuario').value.trim().toLowerCase();
    const password = document.getElementById('profPassword').value.trim();
    const cursoSelect = document.getElementById('profCursoSelect').value;
    const cursoNuevo = document.getElementById('profCursoNuevo').value.trim();
    const emoji = document.getElementById('profEmoji').value.trim();

    const curso = cursoSelect === 'nuevo' ? cursoNuevo : cursoSelect;

    if (!nombre) { toast('Ingresa el nombre completo', 'warning'); return; }
    if (!usuario) { toast('Ingresa el email/usuario', 'warning'); return; }
    if (!password || password.length < 4) { toast('Ingresa una contraseña válida', 'warning'); return; }
    if (!curso) { toast('Selecciona o ingresa un área/curso', 'warning'); return; }

    const userKey = usuario.replace(/[.@]/g, '_');

    try {
        // Verificar si ya existe
        const existente = await getData(`padres/${userKey}`) || await getData(`profesores/${userKey}`);
        if (existente) { toast('Este usuario ya existe', 'error'); return; }

        const nuevoProfesor = {
            usuario: usuario,
            password: password,
            nombre: nombre,
            rol: 'profesor',
            curso: curso,
            emoji: emoji || '📚',
            activo: true
        };

        await setData(`profesores/${userKey}`, nuevoProfesor);
        toast('✅ Cuenta de profesor creada exitosamente', 'success');
        cerrarModalCrearUsuario();
        await cargarUsuarios();
    } catch (e) {
        toast('Error al crear usuario', 'error');
        console.error(e);
    }
}


/* ================================================================
   EXPONER FUNCIONES GLOBALES
   ================================================================ */
window.initCuenta = initCuenta;
window.initUsuariosAdmin = initUsuariosAdmin;
window.abrirSelectorFoto = abrirSelectorFoto;
window.subirFotoPerfil = subirFotoPerfil;
window.eliminarFotoPerfil = eliminarFotoPerfil;
window.mostrarFotoPerfil = mostrarFotoPerfil;
window.eliminarFotoPerfilOverlay = eliminarFotoPerfilOverlay;

// 🔐 Cambiar contraseña
window.abrirModalCambiarPassword = abrirModalCambiarPassword;
window.cerrarModalCambiarPassword = cerrarModalCambiarPassword;
window.toggleVerPassInput = toggleVerPassInput;
window.guardarNuevaPassword = guardarNuevaPassword;

// Usuarios Admin
window.cambiarFiltroUsuarios = cambiarFiltroUsuarios;
window.filtrarUsuariosTexto = filtrarUsuariosTexto;
window.limpiarBusquedaUsuarios = limpiarBusquedaUsuarios;
window.toggleUsuarioActivo = toggleUsuarioActivo;
window.verDetalleUsuario = verDetalleUsuario;
window.cerrarModalDetalleUsuario = cerrarModalDetalleUsuario;
window.toggleVerPassword = toggleVerPassword;
window.abrirFormularioCrearUsuario = abrirFormularioCrearUsuario;
window.cerrarModalCrearUsuario = cerrarModalCrearUsuario;
window.switchTabCrear = switchTabCrear;
window.onCursoSelectChange = onCursoSelectChange;
window.buscarHijosParaCrear = buscarHijosParaCrear;
window.agregarHijoCrear = agregarHijoCrear;
window.quitarHijoCrear = quitarHijoCrear;
window.crearUsuarioPadre = crearUsuarioPadre;
window.crearUsuarioProfesor = crearUsuarioProfesor;
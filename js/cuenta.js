// ================================================
// cuenta.js — Módulo Cuenta (Perfil + Hijos) con foto de perfil + eliminar foto
// ================================================

import { SESION, getHijosPadre, escapeHTML, quitarBtnRecargar, subirArchivoStorage, toast, confirmarEliminar } from './data.js';
import { getData, updateData } from './firebase-config.js';

function initCuenta(contenedor) {
    quitarBtnRecargar();
    const rol = SESION.get("rol");
    if (rol === "padre") {
        renderCuentaPadre(contenedor);
    } else {
        renderCuentaGenerica(contenedor);
    }
}

/* ==================== VISTA PADRE (Perfil + Hijos) ==================== */
async function renderCuentaPadre(cont) {
    const datos = getUsuarioActual();
    const hijos = SESION.getJSON("hijos") || [];

    if (!datos) { 
        cont.innerHTML = "<p class='vacio'>No se encontraron datos.</p>"; 
        return; 
    }

    // Cargar foto de perfil actualizada desde Firebase
    const userKey = datos.usuario.replace(/[.@]/g, '_');
    const padreData = await getData(`padres/${userKey}`);
    const fotoPerfil = padreData?.foto_perfil || "";

    const inicial = (datos.nombre || "").charAt(0).toUpperCase();

    cont.innerHTML = `
        <div class="cuenta-wrapper">
            <!-- PERFIL -->
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

            <!-- HIJOS ASIGNADOS -->
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

/* ==================== VISTA PROFESOR/ADMIN ==================== */
async function renderCuentaGenerica(cont) {
    const datos = getUsuarioActual();
    if (!datos) { 
        cont.innerHTML = "<p class='vacio'>No se encontraron datos.</p>"; 
        return; 
    }

    // Cargar foto de perfil actualizada desde Firebase
    const userKey = datos.usuario.replace(/[.@]/g, '_');
    const tabla = datos.rol === "admin" ? "profesores" : "profesores";
    const userData = await getData(`${tabla}/${userKey}`);
    const fotoPerfil = userData?.foto_perfil || "";

    const inicial = (datos.nombre || "").charAt(0).toUpperCase();
    const rolLabel = datos.rol === "profesor" ? "👨‍🏫 Profesor" : "⚙️ Administrador";

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
                ${datos.rol === "profesor" ? `<div class="cuenta-curso">${datos.emoji || "📚"} ${escapeHTML(datos.curso || "")}</div>` : ""}
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
                    ${datos.rol === "profesor" ? `
                    <div class="cuenta-fila">
                        <span class="cuenta-label">📖 Curso</span>
                        <span class="cuenta-valor">${escapeHTML(datos.curso || "—")}</span>
                    </div>` : ""}
                    <div class="cuenta-fila">
                        <span class="cuenta-label">🏫 Rol</span>
                        <span class="cuenta-valor">${escapeHTML(datos.rol)}</span>
                    </div>
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

/* ==================== SUBIR FOTO DE PERFIL ==================== */
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
    if (btn) {
        btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i>';
        btn.disabled = true;
    }

    try {
        const usuario = SESION.get("usuario");
        const userKey = usuario.replace(/[.@]/g, '_');
        const rol = SESION.get("rol");
        const tabla = rol === "padre" ? "padres" : "profesores";

        // Subir a Cloudinary
        const url = await subirArchivoStorage(file, `perfiles/${userKey}_${Date.now()}`);

        // Guardar URL en Firebase
        await updateData(`${tabla}/${userKey}`, { foto_perfil: url });

        // Actualizar sesión
        SESION.set("foto_perfil", url);

        toast("Foto de perfil actualizada", "success");

        // Recargar la vista
        const contenedor = document.getElementById("modulo-contenido");
        if (contenedor) {
            if (rol === "padre") renderCuentaPadre(contenedor);
            else renderCuentaGenerica(contenedor);
        }
    } catch (e) {
        toast("Error al subir foto", "error");
        console.error(e);
    } finally {
        if (btn) {
            btn.innerHTML = '<i class="bx bx-camera"></i>';
            btn.disabled = false;
        }
        input.value = "";
    }
}

/* ==================== ELIMINAR FOTO DE PERFIL ==================== */
async function eliminarFotoPerfil() {
    confirmarEliminar("tu foto de perfil", async () => {
        try {
            const usuario = SESION.get("usuario");
            const userKey = usuario.replace(/[.@]/g, '_');
            const rol = SESION.get("rol");
            const tabla = rol === "padre" ? "padres" : "profesores";

            // Eliminar foto_perfil de Firebase (poner null)
            await updateData(`${tabla}/${userKey}`, { foto_perfil: null });

            // Limpiar de sesión
            SESION.remove("foto_perfil");

            toast("Foto de perfil eliminada", "delete");

            // Recargar la vista
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

// Exponer funciones globales
window.initCuenta = initCuenta;
window.abrirSelectorFoto = abrirSelectorFoto;
window.subirFotoPerfil = subirFotoPerfil;
window.eliminarFotoPerfil = eliminarFotoPerfil;
window.mostrarFotoPerfil = mostrarFotoPerfil;
window.eliminarFotoPerfilOverlay = eliminarFotoPerfilOverlay;

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
        if (event.target === overlay) {
            eliminarFotoPerfilOverlay();
        }
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
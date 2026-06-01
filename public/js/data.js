// ================================================
// data.js — Conexión a Firebase Realtime Database
// ================================================

import { auth, db, storage, getData, setData, pushData, updateData, deleteData } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


// ================================================
// SESIÓN: localStorage para mantener sesión tras cerrar
// ================================================
const STORAGE = (typeof window !== "undefined" && window.localStorage) ? window.localStorage : sessionStorage;

const SESION = {
    set: (key, value) => STORAGE.setItem(key, value),
    get: (key) => STORAGE.getItem(key),
    remove: (key) => STORAGE.removeItem(key),
    clear: () => STORAGE.clear(),

    setJSON: (key, value) => STORAGE.setItem(key, JSON.stringify(value)),
    getJSON: (key) => {
        const data = STORAGE.getItem(key);
        return data ? JSON.parse(data) : null;
    }
};

function getSessionData() {
    return {
        usuario: SESION.get("usuario"),
        rol: SESION.get("rol"),
        nombre: SESION.get("nombre"),
        curso: SESION.get("curso"),
        emoji: SESION.get("emoji"),
        loginTime: parseInt(SESION.get("loginTime") || "0", 10)
    };
}

// ================================================
// DATOS: Firebase Realtime Database
// ================================================

// Cache local para estudiantes
let ESTUDIANTES_CACHE = [];

async function cargarEstudiantes() {
    try {
        const data = await getData('estudiantes');
        if (data) {
            ESTUDIANTES_CACHE = Object.values(data).sort((a, b) => {
                if (a.grado !== b.grado) return parseInt(a.grado) - parseInt(b.grado);
                if (a.seccion !== b.seccion) return a.seccion.localeCompare(b.seccion);
                return a.nombre.localeCompare(b.nombre);
            });
        }
        return ESTUDIANTES_CACHE;
    } catch (e) {
        console.error('Error cargando estudiantes:', e);
        return [];
    }
}

function getEstudiantes() {
    return ESTUDIANTES_CACHE;
}

// Obtener usuario actual desde sesión
function getUsuarioActual() {
    return {
        usuario: SESION.get("usuario"),
        rol: SESION.get("rol"),
        nombre: SESION.get("nombre"),
        curso: SESION.get("curso"),
        emoji: SESION.get("emoji")
    };
}

function getHijosPadre() {
    return SESION.getJSON("hijos") || [];
}

// ================================================
// FOTO DE PERFIL — Helpers globales
// ================================================

/**
 * Obtiene la foto de perfil de un usuario desde Firebase.
 * @param {string} usuario - Email/usuario del profesor o padre
 * @param {string} rol - "profesor", "padre" o "admin"
 * @returns {Promise<string|null>} URL de la foto o null
 */
async function getFotoPerfil(usuario, rol) {
    if (!usuario) return null;
    const userKey = usuario.replace(/[.@]/g, '_');
    const tabla = rol === "padre" ? "padres" : "profesores";
    try {
        const data = await getData(`${tabla}/${userKey}`);
        const foto = data?.foto_perfil || null;
        if (foto) return foto;
        // Si el usuario es el mismo que la sesión actual, usar la foto en sesión como respaldo.
        if (usuario === SESION.get("usuario")) {
            return SESION.get("foto_perfil") || null;
        }
        return null;
    } catch (e) {
        console.error('Error obteniendo foto de perfil:', e);
        if (usuario === SESION.get("usuario")) {
            return SESION.get("foto_perfil") || null;
        }
        return null;
    }
}

/**
 * Genera HTML para mostrar la foto de perfil miniatura (32px) junto al nombre.
 * Si no hay foto, muestra un círculo con la inicial.
 * @param {string|null} fotoUrl - URL de la foto
 * @param {string} nombre - Nombre para la inicial fallback
 * @param {string} claseExtra - Clases CSS adicionales
 * @returns {string} HTML de la foto miniatura alineada con el nombre
 */
function renderFotoPerfilMini(fotoUrl, nombre, claseExtra = "") {
    const inicial = (nombre || "?").charAt(0).toUpperCase();

    if (fotoUrl) {
        return `
            <div class="foto-perfil-wrapper ${claseExtra}">
                <img src="${fotoUrl}" class="foto-perfil-mini" alt="${escapeHTML(nombre)}">
            </div>`;
    }

    return `
        <div class="foto-perfil-wrapper ${claseExtra}">
            <div class="foto-perfil-mini-inicial">${inicial}</div>
        </div>`;
}

// Helpers
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
}

function toast(msg, tipo = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const validTypes = ["success", "error", "info", "warning", "delete"];
    const typeClass = validTypes.includes(tipo) ? tipo : "success";
    const icons = {
        success: '<i class="bx bx-check-circle"></i>',
        error: '<i class="bx bx-error"></i>',
        info: '<i class="bx bx-info-circle"></i>',
        warning: '<i class="bx bx-notification"></i>',
        delete: '<i class="bx bx-trash"></i>'
    };
    const titles = {
        success: '¡Éxito!',
        error: 'Error',
        info: 'Información',
        warning: 'Atención',
        delete: 'Eliminado'
    };

    const t = document.createElement("div");
    t.className = `toast toast-${typeClass}`;
    t.innerHTML = `
        <div class="toast-card">
            <div class="toast-icon">${icons[typeClass]}</div>
            <div class="toast-title">${titles[typeClass]}</div>
            <div class="toast-message">${escapeHTML(msg)}</div>
        </div>
    `;
    container.appendChild(t);

    setTimeout(() => {
        t.style.opacity = "0";
        setTimeout(() => t.remove(), 300);
    }, 1000);
}

function leerArchivo(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve({ base64: e.target.result, tipo: file.type, nombre: file.name });
        reader.readAsDataURL(file);
    });
}

// Subir archivo a Cloudinary
async function subirArchivoStorage(file, path) {
    const CLOUD_NAME = 'dlmifj0zp';
    const UPLOAD_PRESET = 'sistemacolegio';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'schoolduty');

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
        { method: 'POST', body: formData }
    );

    if (!response.ok) throw new Error('Error al subir archivo');

    const data = await response.json();
    return data.secure_url;
}
// Modal global (imágenes)
function abrirModal(src) {
    const modal = document.getElementById("modal-global");
    const img = document.getElementById("img-global");
    if (modal && img) {
        img.src = src;
        modal.style.display = "flex";
    }
}

function cerrarModalGlobal() {
    const modal = document.getElementById("modal-global");
    if (modal) modal.style.display = "none";
}

document.addEventListener("click", e => {
    const modal = document.getElementById("modal-global");
    if (modal && e.target === modal) modal.style.display = "none";
});

window.abrirModal = abrirModal;
window.cerrarModalGlobal = cerrarModalGlobal;

// Cargar estudiantes al iniciar
cargarEstudiantes();

// ================================================
// MODAL DE CONFIRMACIÓN PERSONALIZADO
// ================================================
function confirmarEliminar(nombre, callback) {
    if (!document.getElementById("mc-styles")) {
        const style = document.createElement("style");
        style.id = "mc-styles";
        style.textContent = `
            #modal-confirmar {
                position: fixed; inset: 0; z-index: 9999;
                background: rgba(0,0,0,0.45);
                backdrop-filter: blur(3px);
                display: flex; align-items: center; justify-content: center;
                animation: mcFadeIn 0.18s ease;
            }
            @keyframes mcFadeIn  { from { opacity: 0; } to { opacity: 1; } }
            @keyframes mcPopIn   { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }

            #modal-confirmar-box {
                background: white;
                border-radius: 20px;
                padding: 36px 32px 28px;
                max-width: 340px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                animation: mcPopIn 0.22s cubic-bezier(0.16,1,0.3,1);
            }

            #mc-icono {
                width: 62px; height: 62px;
                border-radius: 50%;
                border: 3px solid #f59e42;
                display: flex; align-items: center; justify-content: center;
                margin: 0 auto 18px;
                color: #f59e42;
                font-size: 1.8rem;
                font-weight: 900;
            }

            #mc-titulo {
                font-size: 1.35rem;
                font-weight: 800;
                color: #1a2340;
                margin-bottom: 8px;
            }

            #mc-desc {
                color: #6b7a99;
                font-size: 0.92rem;
                margin-bottom: 26px;
            }

            .mc-btns {
                display: flex;
                gap: 10px;
                justify-content: center;
            }

            #mc-confirmar, #mc-cancelar {
                padding: 11px 24px;
                border: none;
                border-radius: 10px;
                font-weight: 700;
                font-size: 0.95rem;
                cursor: pointer;
                font-family: inherit;
                transition: all 0.2s;
            }

            #mc-confirmar { background: #4e73df; color: white; }
            #mc-confirmar:hover { background: #2e59d9; transform: translateY(-1px); }

            #mc-cancelar { background: #e74a3b; color: white; }
            #mc-cancelar:hover { background: #c0392b; transform: translateY(-1px); }
        `;
        document.head.appendChild(style);
    }

    let overlay = document.getElementById("modal-confirmar");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "modal-confirmar";
        overlay.innerHTML = `
            <div id="modal-confirmar-box">
                <div id="mc-icono">!</div>
                <h3 id="mc-titulo">¿Eliminar?</h3>
                <p id="mc-desc"></p>
                <div class="mc-btns">
                    <button id="mc-confirmar">Sí, eliminar</button>
                    <button id="mc-cancelar">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    document.getElementById("mc-desc").textContent = nombre
        ? `¿Desea eliminar a "${nombre}"?`
        : "¿Desea eliminar este elemento?";

    overlay.style.display = "flex";

    const btnSi = document.getElementById("mc-confirmar");
    const btnNo = document.getElementById("mc-cancelar");
    const nuevoSi = btnSi.cloneNode(true);
    const nuevoNo = btnNo.cloneNode(true);
    btnSi.parentNode.replaceChild(nuevoSi, btnSi);
    btnNo.parentNode.replaceChild(nuevoNo, btnNo);

    const cerrar = () => { overlay.style.display = "none"; };

    document.getElementById("mc-confirmar").onclick = () => { cerrar(); callback(); };
    document.getElementById("mc-cancelar").onclick  = cerrar;
    overlay.onclick = e => { if (e.target === overlay) cerrar(); };
}

// Remover botón de recarga
function quitarBtnRecargar() {
    const btn = document.getElementById("btn-recargar");
    if (btn) btn.remove();
}

// Exportar funciones necesarias
export { SESION, getEstudiantes, getUsuarioActual, getHijosPadre, escapeHTML, toast, leerArchivo, subirArchivoStorage, confirmarEliminar, cargarEstudiantes, quitarBtnRecargar, getFotoPerfil, renderFotoPerfilMini };
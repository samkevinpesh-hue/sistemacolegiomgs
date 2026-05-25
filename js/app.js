// ================================================
// app.js — Login + Dashboard + Router (Firebase)
// ================================================

import { getData, setData, pushData } from './firebase-config.js';
import { SESION, cargarEstudiantes } from './data.js';

/* ==================== LOGIN ==================== */
if (document.getElementById("loginForm")) {
    document.getElementById("loginForm").addEventListener("submit", async function(e) {
        e.preventDefault();
        const usuarioInput = document.getElementById("usuario").value.trim().toLowerCase();
        const passwordInput = document.getElementById("password").value.trim();
        const error = document.getElementById("error");
        error.textContent = "";

        if (!usuarioInput || !passwordInput) {
            error.textContent = "Ingresa usuario y contraseña";
            return;
        }

        // Mostrar loading en botón
        const btnLogin = document.querySelector(".btn-login");
        if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = "Verificando..."; }

        try {
            // ✅ FIX 1: generar key reemplazando TODOS los caracteres especiales del email
            // 'dianaaguirre@gmail.com'  → 'dianaaguirre_gmail_com'
            // 'diana.aguirre@gmail.com' → 'diana_aguirre_gmail_com'
            const userKey = usuarioInput.replace(/[.@]/g, '_');

            // 1. Buscar en profesores / admin
            const profesores = await getData('profesores');
            let user = null;
            let rol  = null;

            if (profesores) {
                const prof = profesores[userKey];
                if (prof && prof.password === passwordInput && prof.activo !== false) {
                    user = prof;
                    rol  = prof.rol || 'profesor';
                }
            }

            // 2. Si no es profesor, buscar en padres
            let hijos = [];
            if (!user) {
                const padres = await getData('padres');
                if (padres) {
                    const padre = padres[userKey];
                    if (padre && padre.password === passwordInput && padre.activo !== false) {
                        user = padre;
                        rol  = 'padre';

                        // ✅ FIX 2: usar hijos_dni que ya están guardados en Firebase
                        // ANTES: buscaba por tokens del nombre del padre → nunca encontraba nada
                        // AHORA: lee directamente el array hijos_dni de cada padre
                        if (padre.hijos_dni && padre.hijos_dni.length > 0) {
                            for (const dni of padre.hijos_dni) {
                                const estudiante = await getData(`estudiantes/${dni}`);
                                if (estudiante) hijos.push(estudiante);
                            }
                        }
                    }
                }
            }

            if (user && rol) {
                SESION.clear();
                SESION.set("rol",       rol);
                SESION.set("usuario",   usuarioInput);
                SESION.set("nombre",    user.nombre || usuarioInput);
                SESION.set("curso",     user.curso  || '');
                SESION.set("emoji",     user.emoji  || '');
                SESION.set("loginTime", Date.now());

                if (rol === "padre") {
                    SESION.setJSON("hijos", hijos); // [] si aún no tiene hijos asignados
                }

                window.location.href = "dashboard.html";
            } else {
                error.textContent = "❌ Usuario o contraseña incorrectos";
            }

        } catch (err) {
            error.textContent = "❌ Error de conexión con el servidor";
            console.error(err);
        } finally {
            if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = "Ingresar al sistema"; }
        }
    });
}

/* ==================== DASHBOARD ==================== */
if (document.getElementById("menu")) {
    initDashboard();
}

function initDashboard() {
    const rol     = SESION.get("rol");
    const usuario = SESION.get("usuario");

    // Verificar sesión (expira en 8 horas)
    const loginTime = parseInt(SESION.get("loginTime") || "0");
    if (!rol || !usuario || (Date.now() - loginTime > 8 * 60 * 60 * 1000)) {
        cerrarSesion();
        return;
    }

    const nombreUsuario = SESION.get("nombre") || usuario;
    document.getElementById("bienvenida").textContent = "Bienvenido " + nombreUsuario;

    // Menús por rol
const menus = {
    padre:    ["Notas", "Comportamiento", "Inasistencia","Anuncios", "Cuenta"],
    profesor: ["Notas", "Comportamiento", "Inasistencia","Anuncios", "Cuenta"],
    admin:    ["Notas", "Comportamiento", "Inasistencia","Anuncios", "Cuenta"]
};

    const menuEl = document.getElementById("menu");
    const ICONS = {
        Anuncios:      'bx-bell',
        Notas:         'bx-book',
        Comportamiento:'bx-shield-quarter',
        Inasistencia:  'bx-user-x',
        Cuenta:        'bx-user-circle'
    };

    (menus[rol] || []).forEach((opcion, idx) => {
        const li = document.createElement("li");
        const iconClass = ICONS[opcion] || 'bx-circle';
        li.innerHTML = `<i class="bx ${iconClass}" aria-hidden="true" style="font-size:18px;width:28px;text-align:center;"></i><span>${opcion}</span>`;
        if (idx === 0) li.classList.add("active");
        li.onclick = () => {
            menuEl.querySelectorAll("li").forEach(el => el.classList.remove("active"));
            li.classList.add("active");
            cargarModulo(opcion);
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.querySelector('.sidebar-overlay');
                if (sidebar) sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        };
        menuEl.appendChild(li);
    });

    crearMenuHamburguesa();
    cargarModulo(menus[rol][0]);
}

function crearMenuHamburguesa() {
    if (document.querySelector('.menu-toggle')) return;

    const btn = document.createElement("button");
    btn.className = "menu-toggle";
    btn.innerHTML = "☰";
    btn.title = "Menú";
    btn.setAttribute("aria-label", "Abrir menú");
    document.body.appendChild(btn);

    const overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);

    btn.addEventListener("click", toggleSidebar);
    overlay.addEventListener("click", toggleSidebar);

    document.getElementById("menu").addEventListener("click", (e) => {
        if (window.innerWidth <= 768 && e.target.closest("li")) toggleSidebar();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const isActive = sidebar.classList.contains('active');
    if (isActive) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    } else {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function cargarModulo(opcion) {
    const content = document.getElementById("content-area");
    content.innerHTML = "";

    const cssId = "css-" + opcion.toLowerCase();
    if (!document.getElementById(cssId)) {
        const cssLink = document.createElement("link");
        cssLink.id   = cssId;
        cssLink.rel  = "stylesheet";
        cssLink.href = "css/" + opcion.toLowerCase() + ".css";
        document.head.appendChild(cssLink);
    }

    const cont = document.createElement("div");
    cont.id = "modulo-contenido";
    content.appendChild(cont);

switch(opcion) {
    case "Anuncios":       initAnuncios(cont);        break;
    case "Notas":          initNotas(cont);           break;
    case "Comportamiento": initComportamiento(cont);  break;
    case "Inasistencia": initInasistencia(cont);      break;
    case "Cuenta":         initCuenta(cont);          break;
}
}

function cerrarSesion() {
    SESION.clear();
    window.location.href = "index.html";
}

window.cerrarSesion = cerrarSesion;
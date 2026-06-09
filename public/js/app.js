

// app.js — Login + Dashboard + Router (Firebase) + Animaciones
// ================================================

import { getData } from './firebase-config.js';
import { SESION, cargarEstudiantes } from './data.js';

/* ==================== ANIMACIONES DE ENTRADA ==================== */

function animarEntrada(elementos, delayInicial = 0, delayEntre = 80) {
    if (!elementos || elementos.length === 0) return;
    
    elementos.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'none';
        
        setTimeout(() => {
            el.style.transition = 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, delayInicial + (index * delayEntre));
    });
}

function animarEntradaUnica(elemento, delay = 0) {
    if (!elemento) return;
    
    elemento.style.opacity = '0';
    elemento.style.transform = 'translateY(20px)';
    elemento.style.transition = 'none';
    
    setTimeout(() => {
        elemento.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        elemento.style.opacity = '1';
        elemento.style.transform = 'translateY(0)';
    }, delay);
}

/* ==================== LOGIN ==================== */
function redirectIfActiveSession() {
    const loginTime = parseInt(SESION.get("loginTime") || "0", 10);
    const usuario = SESION.get("usuario");
    if (usuario && Date.now() - loginTime <= 8 * 60 * 60 * 1000) {
        window.location.href = "dashboard.html";
    } else if (usuario) {
        SESION.clear();
    }
}

if (document.getElementById("loginForm")) {
    redirectIfActiveSession();
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

        const btnLogin = document.querySelector(".btn-login");
        if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = "Verificando..."; }

        try {
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
                    SESION.setJSON("hijos", hijos);
                }

                SESION.persistSession();
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

async function initDashboard() {
    if (!SESION.hasActiveSession()) {
        SESION.restorePersistedSession();
    }

    const rol     = SESION.get("rol");
    const usuario = SESION.get("usuario");

    const loginTime = parseInt(SESION.get("loginTime") || "0");
    if (!rol || !usuario || (Date.now() - loginTime > 8 * 60 * 60 * 1000)) {
        cerrarSesion();
        return;
    }

    const nombreUsuario = SESION.get("nombre") || usuario;
    document.getElementById("bienvenida").textContent = "Bienvenido " + nombreUsuario;

    // Menús por rol — ADMIN tiene "Usuarios"
    const menus = {
        padre:      ["Notas", "Incidencias", "Inasistencia", "Anuncios", "Cuenta"],
        profesor:   ["Notas", "Incidencias", "Inasistencia", "Anuncios", "Cuenta"],
        psicologo:  ["Notas", "Incidencias", "Inasistencia", "Anuncios", "Cuenta"],
        psicólogo:  ["Notas", "Incidencias", "Inasistencia", "Anuncios", "Cuenta"],
        admin:      ["Notas", "Incidencias", "Inasistencia", "Anuncios", "Usuarios", "Cuenta"]
    };

    const menuEl = document.getElementById("menu");
    const ICONS = {
        Anuncios:      'bx-bell',
        Notas:         'bx-book',
        Incidencias:   'bx-shield-quarter',
        Inasistencia:  'bx-user-x',
        Cuenta:        'bx-user-circle',
        Usuarios:      'bx-group'
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

    const cssMap = {
        "Incidencias": "comportamiento",
        "Usuarios": "cuenta"
    };
    const cssName = cssMap[opcion] || opcion.toLowerCase();
    const cssId = "css-" + cssName;
    if (!document.getElementById(cssId)) {
        const cssLink = document.createElement("link");
        cssLink.id   = cssId;
        cssLink.rel  = "stylesheet";
        cssLink.href = "css/" + cssName + ".css";
        document.head.appendChild(cssLink);
    }

    const cont = document.createElement("div");
    cont.id = "modulo-contenido";
    content.appendChild(cont);

    switch(opcion) {
        case "Anuncios":       initAnuncios(cont);        break;
        case "Notas":          initNotas(cont);           break;
        case "Incidencias":
        case "Comportamiento": initComportamiento(cont);  break;
        case "Inasistencia":   initInasistencia(cont);    break;
        case "Usuarios":       initUsuariosAdmin(cont);   break;
        case "Cuenta":         initCuenta(cont);          break;
    }
}

function cerrarSesion() {
    SESION.clear();
    window.location.href = "index.html";
}

window.cerrarSesion = cerrarSesion;
window.animarEntrada = animarEntrada;
window.animarEntradaUnica = animarEntradaUnica;




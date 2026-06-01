// ================================================
// service-worker.js — PWA Cache, Offline y Firebase Messaging
// ================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

const firebaseConfig = {
    apiKey: "AIzaSyAvsH4g0lbp15bOiNMc2ESw2Jg9xzwx4sY",
    authDomain: "sistemacolegio-ba332.firebaseapp.com",
    databaseURL: "https://sistemacolegio-ba332-default-rtdb.firebaseio.com",
    projectId: "sistemacolegio-ba332",
    storageBucket: "sistemacolegio-ba332.firebasestorage.app",
    messagingSenderId: "1056586021602",
    appId: "1:1056586021602:web:b78c4abb2eab7c7dfffcbb"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    const title = payload.notification?.title || 'SchoolDuty';
    const options = {
        body: payload.notification?.body || '',
        icon: '/img/logo.png',
        data: payload.data || {}
    };
    self.registration.showNotification(title, options);
});

const CACHE_NAME = 'schoolduty-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/css/styles.css',
    '/css/notas.css',
    '/css/comportamiento.css',
    '/css/anuncios.css',
    '/css/cuenta.css',
    '/js/app.js',
    '/js/data.js',
    '/js/firebase-config.js',
    '/js/notas.js',
    '/js/comportamiento.js',
    '/js/anuncios.js',
    '/js/cuenta.js',
    '/img/logo.png',
    '/img/logo1.png',
    '/img/fondo.jpg'
];

// Instalar — guardar archivos en cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activar — limpiar caches viejos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — servir desde cache si no hay internet
self.addEventListener('fetch', event => {
    // Solo cachear peticiones GET
    if (event.request.method !== 'GET') return;

    // No cachear peticiones a Firebase ni Cloudinary
    const url = event.request.url;
    if (url.includes('firebaseio.com') || 
        url.includes('googleapis.com') || 
        url.includes('cloudinary.com') ||
        url.includes('gstatic.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
            .catch(() => caches.match('/index.html'))
    );
});
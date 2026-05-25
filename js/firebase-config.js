// ================================================
// firebase-config.js — Configuración Firebase
// ================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, get, set, push, update, remove, child } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Tu configuración real de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAvsH4g0lbp15bOiNMc2ESw2Jg9xzwx4sY",
    authDomain: "sistemacolegio-ba332.firebaseapp.com",
    databaseURL: "https://sistemacolegio-ba332-default-rtdb.firebaseio.com",
    projectId: "sistemacolegio-ba332",
    storageBucket: "sistemacolegio-ba332.firebasestorage.app",
    messagingSenderId: "1056586021602",
    appId: "1:1056586021602:web:b78c4abb2eab7c7dfffcbb"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// ================================================
// Funciones helper para RTDB
// ================================================

async function getData(path) {
    const snapshot = await get(child(ref(db), path));
    return snapshot.exists() ? snapshot.val() : null;
}

async function setData(path, data) {
    await set(ref(db, path), data);
}

async function pushData(path, data) {
    const newRef = push(ref(db, path));
    await set(newRef, data);
    return newRef.key;
}

async function updateData(path, data) {
    await update(ref(db, path), data);
}

async function deleteData(path) {
    await remove(ref(db, path));
}

// ================================================
// Funciones helper para Storage
// ================================================

async function subirArchivoStorage(file, path) {
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file);
    return await getDownloadURL(sRef);
}

// Exportar todo lo necesario
export {
    app,
    auth,
    db,
    storage,
    getData,
    setData,
    pushData,
    updateData,
    deleteData,
    subirArchivoStorage
};
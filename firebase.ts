
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * 🔥 CONFIGURACIÓN ACTIVA - PROYECTO OSCAR
 * Conexión establecida con studio-9175956187-3b0eb
 */
const firebaseConfig = {
  apiKey: "AIzaSyB9GJPPbMEOAiiZH93jBbOk350wk-O12YA",
  authDomain: "studio-9175956187-3b0eb.firebaseapp.com",
  projectId: "studio-9175956187-3b0eb",
  storageBucket: "studio-9175956187-3b0eb.firebasestorage.app",
  messagingSenderId: "188968415185",
  appId: "1:188968415185:web:c6e4b04a5b7860559cbaf0"
};

// Inicialización de la App
const app = initializeApp(firebaseConfig);

// Exportación de servicios
export const db = getFirestore(app);
export const firebaseReady = true;

console.log("🚀 AhorroPro Perú: Conexión con Firebase establecida exitosamente.");

import * as firebaseApp from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- CONFIGURACIÓN DE FIREBASE ---
// PEGA TUS CREDENCIALES AQUÍ ABAJO
const firebaseConfig = {
  apiKey: "AIzaSyB8z8FUTngy5D_Qd2CE9SzthKUwPehQZFE",
  authDomain: "tempos-25da2.firebaseapp.com",
  projectId: "tempos-25da2",
  storageBucket: "tempos-25da2.firebasestorage.app",
  messagingSenderId: "1019521027037",
  appId: "1:1019521027037:web:8a9d9aad15ad6962a48434",
  measurementId: "G-R2NRDQPC6V"
};


// Initialize Firebase using modular function (matches index.html gstatic version)
// Using (firebaseApp as any).initializeApp to bypass "Module has no exported member 'initializeApp'" error
// which can occur due to version/type mismatches in some environments.
const app = (firebaseApp as any).initializeApp(firebaseConfig);

// Export services
export const db = getFirestore(app);
export const auth = getAuth(app);

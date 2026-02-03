import * as firebaseApp from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- CONFIGURACIÓN DE FIREBASE ---
// PEGA TUS CREDENCIALES AQUÍ ABAJO
const firebaseConfig = {
  apiKey: "AIzaSyCPV_aP2d62JlfwyAZdJxIlMSRc-rGDMpI",
  authDomain: "cafestore-ffbec.firebaseapp.com",
  projectId: "cafestore-ffbec",
  storageBucket: "cafestore-ffbec.firebasestorage.app",
  messagingSenderId: "1096912643765",
  appId: "1:1096912643765:web:16f929994f508002d300fc",
  measurementId: "G-HYK99RRJ2Q"
};

// Access initializeApp from the namespace object and cast to any to avoid type errors
// if the type definition is mismatching the installed version.
const app = (firebaseApp as any).initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
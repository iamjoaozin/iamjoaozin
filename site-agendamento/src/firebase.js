import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBykSlSr2OAlNd32JLlwkqE8MfWtCaOZQM",
  authDomain: "botao-bf7a4.firebaseapp.com",
  projectId: "botao-bf7a4",
  storageBucket: "botao-bf7a4.firebasestorage.app",
  messagingSenderId: "818236064251",
  appId: "1:818236064251:web:fde5d74abb47d9b238cb5e",
  measurementId: "G-HD4EQDM0DV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // Banco de dados em tempo real
export const provider = new GoogleAuthProvider();

export const entrarComGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Erro no login:", error);
    return null;
  }
};
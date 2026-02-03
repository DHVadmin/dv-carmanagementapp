import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    // TODO: Replace with your project's config object
    apiKey: "AIzaSyC0q0pcu5oosz_bF3KidKQB9T8QVoe7ETo",
    authDomain: "dv-carmanagementapp.firebaseapp.com",
    projectId: "dv-carmanagementapp",
    storageBucket: "dv-carmanagementapp.firebasestorage.app",
    messagingSenderId: "171367444260",
    appId: "1:171367444260:web:b99696a032b0b246cf4db1",
    measurementId: "G-1H4HFSLLPW"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

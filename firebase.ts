import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB9GJPPbMEOAiiZH93jBbOk350wk-O12YA",
  authDomain: "studio-9175956187-3b0eb.firebaseapp.com",
  projectId: "studio-9175956187-3b0eb",
  storageBucket: "studio-9175956187-3b0eb.firebasestorage.app",
  messagingSenderId: "188968415185",
  appId: "1:188968415185:web:c6e4b04a5b7860559cbaf0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const firebaseReady = true;

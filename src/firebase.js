import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDnBVI9Ue7eJSYoEW7BwixCqJ6E3vaYqtM",
  authDomain: "nourish-app-33b12.firebaseapp.com",
  projectId: "nourish-app-33b12",
  storageBucket: "nourish-app-33b12.firebasestorage.app",
  messagingSenderId: "877470748301",
  appId: "1:877470748301:web:4f7a991f0bd5bd8bc5dcc4",
  measurementId: "G-Y9RKLPTJGS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

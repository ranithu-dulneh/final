import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAs0cK6uXdpyZ42fPqlu1p74jrHcTeChBk",
  authDomain: "thusira-chemicals-pos.firebaseapp.com",
  databaseURL: "https://thusira-chemicals-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "thusira-chemicals-pos",
  storageBucket: "thusira-chemicals-pos.firebasestorage.app",
  messagingSenderId: "1067593949178",
  appId: "1:1067593949178:web:c3b50faa13ff5b10290e43"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };

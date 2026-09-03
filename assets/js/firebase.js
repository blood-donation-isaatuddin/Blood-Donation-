import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3NUCRDFUVOVcCcCrVRCYPEePmBFcrcfw",
  authDomain: "ibds-5fa75.firebaseapp.com",
  projectId: "ibds-5fa75",
  storageBucket: "ibds-5fa75.firebasestorage.app",
  messagingSenderId: "97426509689",
  appId: "1:97426509689:web:0b6b9396db56347bac69a8"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDqO6xtMcvUagDTZsKqITB8WTiFyQ3o-es",
  authDomain: "soundbuddy-74531.firebaseapp.com",
  databaseURL: "https://soundbuddy-74531-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "soundbuddy-74531",
  storageBucket: "soundbuddy-74531.firebasestorage.app",
  messagingSenderId: "628829685894",
  appId: "1:628829685894:web:969967d3a6ba142b722907",
  measurementId: "G-QRFBL2RB2N"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const database = db;
export const auth = getAuth(app);

export default app;
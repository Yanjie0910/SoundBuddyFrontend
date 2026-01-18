import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDqO6xtMcvUagDTZsKqITB8WTiFyQ3o-es",
  authDomain: "soundbuddy-74531.firebaseapp.com",
  databaseURL: "https://soundbuddy-74531-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "soundbuddy-74531",
  storageBucket: "soundbuddy-74531.firebasestorage.app",
  messagingSenderId: "628829685894",
  appId: "1:628829685894:web:969967d3a6ba142b722907"
};

// ✅ Initialize ONCE
const app = initializeApp(firebaseConfig);

// ✅ Services
export const database = getDatabase(app);
export const auth = getAuth(app);

// ✅ (important for consistency)
export default app;

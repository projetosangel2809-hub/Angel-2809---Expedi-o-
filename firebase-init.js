import { initializeApp }                   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics }                    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch, onSnapshot, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── CONFIGURAÇÃO — cole aqui os valores do seu projeto Firebase ──
const firebaseConfig = {
  apiKey:            "AIzaSyByubBfMguAn1XerT6it3ttfwHTQHma-_I",
  authDomain:        "expedicao-alfa.firebaseapp.com",
  projectId:         "expedicao-alfa",
  storageBucket:     "expedicao-alfa.firebasestorage.app",
  messagingSenderId: "243726532018",
  appId:             "1:243726532018:web:26e21eb3f11a2663a778ab",
  measurementId:     "G-CJFZFGD41J"
};
// ────────────────────────────────────────────────────────────────

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db        = getFirestore(app);

// Expõe o Firestore para o restante do script
window._db        = db;
window._fs        = { collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch, onSnapshot, serverTimestamp };
window._fbReady   = true;
window.dispatchEvent(new Event("fb-ready"));

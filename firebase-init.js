import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch, onSnapshot, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── CONFIGURAÇÃO — projeto expedicao---angel-proj-log ──
// Cole abaixo o bloco do console: Configurações do projeto → Seus apps → app Web.
const firebaseConfig = {
  apiKey:            "COLE_AQUI",
  authDomain:        "COLE_AQUI",
  projectId:         "COLE_AQUI",
  storageBucket:     "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId:             "COLE_AQUI"
};
// ───────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const overlay = $("login-overlay");
const msg     = $("login-msg");

function mostrarMsg(texto, ok = false) {
  if (!msg) return;
  msg.textContent = texto || "";
  msg.style.color = ok ? "var(--green, #3fb950)" : "var(--red, #f85149)";
}

const ERROS = {
  "auth/invalid-credential":     "E-mail ou senha incorretos.",
  "auth/wrong-password":         "E-mail ou senha incorretos.",
  "auth/user-not-found":         "E-mail ou senha incorretos.",
  "auth/invalid-email":          "E-mail inválido.",
  "auth/user-disabled":          "Usuário desativado.",
  "auth/too-many-requests":      "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet.",
  "auth/operation-not-allowed":  "Login por e-mail/senha não está ativado no Firebase.",
  "auth/unauthorized-domain":    "Domínio não autorizado no Firebase (Authentication → Configurações → Domínios autorizados).",
};
const traduzir = (e) => ERROS[e.code] || ("Erro: " + (e.code || e.message));

if (firebaseConfig.apiKey === "COLE_AQUI") {
  mostrarMsg("Firebase não configurado: preencha o firebaseConfig em firebase-init.js.");
  throw new Error("firebaseConfig não preenchido");
}

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Expõe para o app.js
window._db      = db;
window._auth    = auth;
window._fs      = { collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch, onSnapshot, serverTimestamp };
window._fbReady = false;

let iniciou = false;

onAuthStateChanged(auth, (user) => {
  if (user) {
    window._fbReady = true;
    if (overlay) overlay.style.display = "none";
    const who = $("user-email"); if (who) who.textContent = user.email || "";
    const out = $("btn-logout"); if (out) out.style.display = "";
    if (!iniciou) {
      iniciou = true;
      window.dispatchEvent(new Event("fb-ready"));
    }
  } else {
    window._fbReady = false;
    if (iniciou) { location.reload(); return; } // saiu: limpa dados da memória
    if (overlay) overlay.style.display = "flex";
  }
});

// Formulário de login
const form = $("login-form");
if (form) form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  mostrarMsg("");
  const btn = $("login-btn"); if (btn) btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-senha").value);
  } catch (e) {
    mostrarMsg(traduzir(e));
  } finally {
    if (btn) btn.disabled = false;
  }
});

// Esqueci a senha
const esq = $("login-reset");
if (esq) esq.addEventListener("click", async (ev) => {
  ev.preventDefault();
  const email = $("login-email").value.trim();
  if (!email) { mostrarMsg("Digite seu e-mail acima e clique novamente."); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    mostrarMsg("Enviamos um link de redefinição para o seu e-mail.", true);
  } catch (e) { mostrarMsg(traduzir(e)); }
});

// Sair
const sair = $("btn-logout");
if (sair) sair.addEventListener("click", () => signOut(auth));

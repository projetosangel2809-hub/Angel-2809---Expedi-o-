// PWA: registro do Service Worker (caminho relativo — funciona na raiz ou em subpasta do GitHub Pages)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(err => console.warn("Falha ao registrar Service Worker:", err));
  });
}

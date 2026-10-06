# Angel 2809 — Projetos Logísticos (PWA Expedição)

```
index.html            estrutura (HTML)
manifest.json         configuração do PWA
sw.js                 service worker (não enviado — manter o seu existente)
icons/                ícones 192/512 e maskable (não enviados — manter os seus)
css/styles.css        estilos originais, intactos
css/theme.css         repaginação visual (remova o <link> para reverter)
js/firebase-init.js   inicialização Firebase/Firestore (módulo)
js/emailjs-config.js  chaves do EmailJS
js/app.js             lógica da aplicação (idêntica ao original)
js/pwa.js             registro do service worker
```
A lógica (app.js) e o HTML do corpo não foram alterados; a mudança é só a separação em arquivos e o theme.css.

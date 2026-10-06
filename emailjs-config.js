// EmailJS — inicializado com Public Key (gratuito, 200 emails/mês)
// Para ativar: crie conta em https://www.emailjs.com, crie um Service + Template
// e preencha as constantes abaixo
window.EMAILJS_PUBLIC_KEY  = "";   // ← cole sua Public Key do EmailJS
window.EMAILJS_SERVICE_ID  = "";   // ← cole seu Service ID
window.EMAILJS_TEMPLATE_ID = "";   // ← cole seu Template ID
if (window.EMAILJS_PUBLIC_KEY) {
  emailjs.init({ publicKey: window.EMAILJS_PUBLIC_KEY });
}

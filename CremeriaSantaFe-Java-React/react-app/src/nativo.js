// Funciones propias del teléfono que la capa Java (WebAppInterface) expone al WebView.
// En el navegador (npm run dev) no existen; se usa una alternativa para poder probar.
const hayJava = typeof window !== 'undefined' && !!window.Android;

export const nativo = {
  disponible: hayJava,

  // Abre WhatsApp con el chat y el mensaje ya escritos (enlace https://wa.me/...)
  abrirWhatsApp(url) {
    if (hayJava) window.Android.abrirWhatsApp(url);
    else window.open(url, '_blank');
  },

  // Notificación del sistema: "Stock bajo". whatsappUrl es opcional (agrega el botón "Avisar por WhatsApp").
  notificarStockBajo(productos, whatsappUrl) {
    if (hayJava) window.Android.notificarStockBajo(JSON.stringify(productos), whatsappUrl || '');
  }
};

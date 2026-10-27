// Singleton de sesión: recuerda quién inició sesión (token + usuario) mientras la app está abierta.
// Es el equivalente al "carrito global" del proyecto Restaurant: una sola instancia compartida por todas
// las pantallas. Se respalda en sessionStorage para no perder la sesión si el WebView recarga la página.
const CLAVE = 'sf_sesion';
let actual = null;

try {
  const guardada = sessionStorage.getItem(CLAVE);
  if (guardada) actual = JSON.parse(guardada);
} catch (e) {
  actual = null;
}

export const sesion = {
  iniciar(token, usuario) {
    actual = { token, usuario };
    try { sessionStorage.setItem(CLAVE, JSON.stringify(actual)); } catch (e) { /* sin almacenamiento */ }
  },
  cerrar() {
    actual = null;
    try { sessionStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ }
  },
  token() { return actual ? actual.token : null; },
  usuario() { return actual ? actual.usuario : null; },
  activa() { return actual !== null; }
};

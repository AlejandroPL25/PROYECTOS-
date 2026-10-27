// Cliente de la API REST (Flask). Todas las pantallas hablan con el servidor a través de este archivo.
//
//  - Formato:   JSON  { ok: true, data } | { ok: false, error }
//  - Sesión:    token "Bearer" que entrega POST /api/login (se guarda en el Singleton ./sesion)
//  - Asincronía: todo es async/await; mientras hay peticiones en curso se muestra la barra/spinner de carga
//  - Errores:   sin red, tiempo agotado y sesión vencida se convierten en mensajes claros para el usuario
import { sesion } from './sesion';
import { nativo } from './nativo';

const CLAVE_SERVIDOR = 'sf_servidor';
const TIEMPO_ESPERA_MS = 10000;
const enAndroid = typeof window !== 'undefined' && !!window.Android;

// 10.0.2.2 es la computadora vista desde el emulador de Android. En un celular real se configura la IP en el login.
export const servidorPorDefecto = () => (enAndroid ? 'http://10.0.2.2:5000' : 'http://localhost:5000');

export function servidorConfigurado() {
  try { return !!localStorage.getItem(CLAVE_SERVIDOR); } catch (e) { return false; }
}

export function obtenerServidor() {
  try { return localStorage.getItem(CLAVE_SERVIDOR) || servidorPorDefecto(); } catch (e) { return servidorPorDefecto(); }
}

export function fijarServidor(url) {
  try { localStorage.setItem(CLAVE_SERVIDOR, url); } catch (e) { /* sin almacenamiento */ }
}

export function normalizarServidor(texto) {
  let url = (texto || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  if (!url) throw new Error('Escribe la dirección del servidor (ej. 192.168.1.20:5000).');
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  return url;
}

// ---- Estado de carga (para el spinner global) ----
let enCurso = 0;
const oyentesCarga = new Set();
const avisarCarga = () => oyentesCarga.forEach((f) => f());
export const carga = {
  suscribir(f) { oyentesCarga.add(f); return () => oyentesCarga.delete(f); },
  actual() { return enCurso; }
};

// ---- Errores globales (cargas que fallan sin que la pantalla tenga su propio aviso) ----
let errorGlobal = null;
const oyentesError = new Set();
const avisarError = () => oyentesError.forEach((f) => f());
export const errores = {
  suscribir(f) { oyentesError.add(f); return () => oyentesError.delete(f); },
  actual() { return errorGlobal; },
  limpiar() { errorGlobal = null; avisarError(); }
};
function mostrarError(e) {
  errorGlobal = e && e.message ? e.message : String(e);
  avisarError();
}

// ---- Sesión vencida (401): App.jsx registra qué hacer ----
let alExpirar = null;
export const alExpirarSesion = (funcion) => { alExpirar = funcion; };

// ---- Petición base ----
async function pedir(metodo, ruta, { cuerpo, consulta, silencioso = false, servidor } = {}) {
  const base = servidor || obtenerServidor();
  const parametros = consulta ? '?' + new URLSearchParams(consulta).toString() : '';
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (sesion.token()) cabeceras.Authorization = 'Bearer ' + sesion.token();

  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIEMPO_ESPERA_MS);
  if (!silencioso) { enCurso += 1; avisarCarga(); }

  try {
    const respuesta = await fetch(base + '/api' + ruta + parametros, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: controlador.signal
    });
    let json = null;
    try { json = await respuesta.json(); } catch (e) { json = null; }

    if (respuesta.status === 401 && sesion.activa() && ruta !== '/login') {
      sesion.cerrar();
      if (alExpirar) alExpirar((json && json.error) || 'Tu sesión expiró. Inicia sesión de nuevo.');
    }
    if (!respuesta.ok || !json || json.ok === false) {
      throw new Error((json && json.error) || `El servidor respondió con un error (${respuesta.status}).`);
    }
    return json.data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder. Intenta de nuevo.');
    if (e instanceof TypeError) {
      throw new Error('No se pudo conectar con el servidor. Revisa que estés en la misma red Wi-Fi y que la dirección del servidor sea correcta.');
    }
    throw e;
  } finally {
    clearTimeout(reloj);
    if (!silencioso) { enCurso -= 1; avisarCarga(); }
  }
}

// ---- Métodos que usan las pantallas ----
export const api = {
  mostrarError,

  async login(usuario, clave) {
    const datos = await pedir('POST', '/login', { cuerpo: { usuario, clave } });
    sesion.iniciar(datos.token, datos.usuario);
    return datos.usuario;
  },
  async cerrarSesion() { sesion.cerrar(); return true; },
  probarConexion: (servidor) => pedir('GET', '/salud', { servidor }),

  obtenerCategorias: () => pedir('GET', '/categorias'),
  categoriaSugerida: (nombre) => pedir('GET', '/categorias/sugerida', { consulta: { nombre }, silencioso: true }),

  obtenerProductos: () => pedir('GET', '/productos'),
  obtenerProductosFaltantes: (opciones = {}) => pedir('GET', '/productos/faltantes', opciones),
  obtenerMasVendidos: (limite = 8, periodo = 'mes') => pedir('GET', '/productos/mas-vendidos', { consulta: { limite, periodo } }),
  obtenerResumenDia: (opciones = {}) => pedir('GET', '/resumen', opciones),
  guardarProducto: (nombre, categoria, precio, unidad, cantidad, umbral) =>
    pedir('POST', '/productos', { cuerpo: { nombre, categoria, precio, unidad, cantidad, umbral } }),

  registrarVenta: (items) => pedir('POST', '/ventas', { cuerpo: { items } }),
  // (el nombre del producto ya no se manda: el servidor lo toma de su base de datos)
  registrarEntrada: (productoId, _nombre, cantidad, proveedor) =>
    pedir('POST', '/entradas', { cuerpo: { productoId, cantidad, proveedor: proveedor || '' } }),

  async avisarStockBajoWhatsApp() {
    const datos = await pedir('POST', '/alertas/whatsapp');
    nativo.abrirWhatsApp(datos.url);
    return true;
  },

  obtenerAjustes: () => pedir('GET', '/ajustes'),
  guardarAjustes: (whatsappNumero, notificaciones) => pedir('PUT', '/ajustes', { cuerpo: { whatsappNumero, notificaciones } }),
  listarUsuarios: () => pedir('GET', '/usuarios'),
  crearUsuario: (usuario, clave, rol) => pedir('POST', '/usuarios', { cuerpo: { usuario, clave, rol } }),
  eliminarUsuario: (id) => pedir('DELETE', '/usuarios/' + id),
  cambiarContrasena: (id, clave) => pedir('PUT', '/usuarios/' + id + '/contrasena', { cuerpo: { clave } })
};

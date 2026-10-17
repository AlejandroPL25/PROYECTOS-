// Envuelve window.Android (inyectado por MainActivity.java).
// Si no existe (por ejemplo corriendo "npm run dev" en el navegador), usa un simulador
// en memoria para poder trabajar la interfaz. La lógica REAL (permisos, categorías, stock)
// vive en Java; el simulador solo la imita para desarrollo.

const nativo = typeof window !== 'undefined' && !!window.Android;

function parsear(respuestaJson) {
  const respuesta = JSON.parse(respuestaJson);
  if (!respuesta.ok) {
    throw new Error(respuesta.error || 'Ocurrió un error inesperado.');
  }
  return respuesta.data;
}

const llamar = (metodo, ...args) => parsear(window.Android[metodo](...args));

// ---------------------------------------------------------------------------
// Simulador para el navegador (NO se usa dentro de la app Android)
// ---------------------------------------------------------------------------
const CATEGORIAS_MOCK = ['Lácteos y Quesos', 'Embutidos', 'Huevo', 'Abarrotes', 'Bebidas', 'Botanas y Dulces', 'Pan y Tortillas', 'Otros'];
const REGLAS_MOCK = {
  'Lácteos y Quesos': ['leche', 'queso', 'crema', 'yogur', 'yogurt', 'mantequilla', 'requeson', 'panela', 'oaxaca', 'cotija', 'manchego', 'asadero', 'quesillo', 'nata', 'jocoque', 'ricota'],
  'Embutidos': ['jamon', 'chorizo', 'salchicha', 'salchichon', 'tocino', 'salami', 'mortadela', 'longaniza', 'pepperoni', 'peperoni'],
  'Huevo': ['huevo', 'blanquillo'],
  'Abarrotes': ['arroz', 'frijol', 'aceite', 'azucar', 'sal', 'harina', 'lenteja', 'atun', 'pasta', 'cafe'],
  'Bebidas': ['refresco', 'jugo', 'agua', 'horchata', 'atole', 'cerveza'],
  'Botanas y Dulces': ['papa', 'frituras', 'cacahuate', 'dulce', 'chocolate', 'galleta', 'cajeta', 'gelatina', 'palomitas', 'chicharron'],
  'Pan y Tortillas': ['pan', 'tortilla', 'bolillo', 'telera', 'concha'],
  'Otros': []
};

const sinAcentos = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function sugeridasMock(nombre) {
  const palabras = sinAcentos(nombre || '').split(/[^a-z0-9]+/).filter(Boolean);
  return Object.entries(REGLAS_MOCK)
    .filter(([, claves]) => claves.some((k) => palabras.some((p) => p === k || p === k + 's' || p === k + 'es')))
    .map(([categoria]) => categoria);
}

let productosMock = [
  { id: 1, nombre: 'Queso Oaxaca Especial', categoria: 'Lácteos y Quesos', precio: 145, unidad: 'Kg', cantidad: 45, umbralMinimo: 5, vecesVendido: 245 },
  { id: 2, nombre: 'Crema de Rancho Natural', categoria: 'Lácteos y Quesos', precio: 95, unidad: 'Lt', cantidad: 6, umbralMinimo: 5, vecesVendido: 189 },
  { id: 3, nombre: 'Jamón Virginia de Pavo', categoria: 'Embutidos', precio: 120, unidad: 'Kg', cantidad: 1.5, umbralMinimo: 5, vecesVendido: 142 },
  { id: 4, nombre: 'Queso Cotija Añejo', categoria: 'Lácteos y Quesos', precio: 180, unidad: 'Kg', cantidad: 34, umbralMinimo: 5, vecesVendido: 98 },
  { id: 5, nombre: 'Queso Panela Familiar', categoria: 'Lácteos y Quesos', precio: 90, unidad: 'Kg', cantidad: 0, umbralMinimo: 5, vecesVendido: 75 },
  { id: 6, nombre: 'Chorizo Casero Especial', categoria: 'Embutidos', precio: 110, unidad: 'Kg', cantidad: 4, umbralMinimo: 5, vecesVendido: 75 },
  { id: 7, nombre: 'Queso Manchego Maduro', categoria: 'Lácteos y Quesos', precio: 160, unidad: 'Kg', cantidad: 24, umbralMinimo: 5, vecesVendido: 48 }
];
let siguienteIdProducto = 8;
let usuariosMock = [
  { id: 1, usuario: 'admin', clave: 'admin123', rol: 'admin' },
  { id: 2, usuario: 'empleado', clave: 'empleado123', rol: 'empleado' }
];
let siguienteIdUsuario = 3;
let ajustesMock = { whatsappNumero: '', notificaciones: true };
let sesionMock = null;

const requiereSesion = () => { if (!sesionMock) throw new Error('Inicia sesión para continuar.'); };
const requiereAdmin = () => {
  requiereSesion();
  if (sesionMock.rol !== 'admin') throw new Error('No tienes permiso para realizar esta acción.');
};

const mock = {
  login(usuario, clave) {
    const u = usuariosMock.find((x) => x.usuario.toLowerCase() === (usuario || '').trim().toLowerCase() && x.clave === clave);
    if (!u) throw new Error('Usuario o contraseña incorrectos.');
    sesionMock = { id: u.id, usuario: u.usuario, rol: u.rol };
    return { ...sesionMock };
  },
  cerrarSesion() { sesionMock = null; return true; },
  obtenerCategorias() { requiereSesion(); return [...CATEGORIAS_MOCK]; },
  categoriaSugerida(nombre) { requiereSesion(); return sugeridasMock(nombre)[0] || ''; },
  obtenerProductos() { requiereSesion(); return productosMock.map((p) => ({ ...p })); },
  obtenerProductosFaltantes() { requiereAdmin(); return productosMock.filter((p) => p.cantidad <= p.umbralMinimo); },
  obtenerMasVendidos(limite = 10) {
    requiereAdmin();
    return [...productosMock].filter((p) => p.vecesVendido > 0).sort((a, b) => b.vecesVendido - a.vecesVendido).slice(0, limite);
  },
  obtenerResumenDia() {
    requiereAdmin();
    return { productosActivos: productosMock.length, alertasStock: productosMock.filter((p) => p.cantidad <= p.umbralMinimo).length, ventasHoy: 8430 };
  },
  guardarProducto(nombre, categoria, precio, unidad, cantidad, umbral) {
    requiereAdmin();
    const limpio = (nombre || '').trim().replace(/\s+/g, ' ');
    if (!limpio) throw new Error('Escribe el nombre del producto (máximo 80 caracteres).');
    if (!(precio > 0)) throw new Error('El precio debe ser mayor a cero.');
    if (!(cantidad >= 0)) throw new Error('La cantidad disponible no puede ser negativa.');
    if (!(umbral >= 0)) throw new Error('El stock mínimo no puede ser negativo.');
    if (!CATEGORIAS_MOCK.includes(categoria)) throw new Error('Selecciona una categoría válida.');
    const sugeridas = sugeridasMock(limpio);
    if (sugeridas.length && !sugeridas.includes(categoria)) {
      throw new Error(`«${limpio}» pertenece a ${sugeridas.join(' o ')}, no a ${categoria}.`);
    }
    if (productosMock.some((p) => p.nombre.toLowerCase() === limpio.toLowerCase())) throw new Error('Ya existe un producto con ese nombre.');
    const id = siguienteIdProducto++;
    productosMock.push({ id, nombre: limpio, categoria, precio, unidad, cantidad, umbralMinimo: umbral, vecesVendido: 0 });
    return { id };
  },
  registrarVenta(items) {
    requiereSesion();
    if (!items.length) throw new Error('Agrega al menos un producto a la venta.');
    const pedidos = {};
    items.forEach((i) => { pedidos[i.productoId] = (pedidos[i.productoId] || 0) + i.cantidad; });
    Object.entries(pedidos).forEach(([id, cantidad]) => {
      const p = productosMock.find((x) => x.id === Number(id));
      if (!p) throw new Error('Uno de los productos ya no existe. Actualiza la lista.');
      if (cantidad > p.cantidad) throw new Error(`No hay suficiente existencia de ${p.nombre} (disponible: ${p.cantidad} ${p.unidad}).`);
    });
    const alertas = [];
    let total = 0;
    Object.entries(pedidos).forEach(([id, cantidad]) => {
      const p = productosMock.find((x) => x.id === Number(id));
      const antes = p.cantidad;
      p.cantidad = Math.round((p.cantidad - cantidad) * 1000) / 1000;
      p.vecesVendido += cantidad;
      total += p.precio * cantidad;
      if ((antes > p.umbralMinimo && p.cantidad <= p.umbralMinimo) || (antes > 0 && p.cantidad <= 0)) {
        alertas.push({ id: p.id, nombre: p.nombre, cantidad: p.cantidad, unidad: p.unidad });
      }
    });
    return { ventaId: Date.now(), total, alertas };
  },
  registrarEntrada(productoId, cantidad) {
    requiereAdmin();
    if (!(cantidad > 0)) throw new Error('La cantidad recibida debe ser mayor a cero.');
    const p = productosMock.find((x) => x.id === productoId);
    if (!p) throw new Error('Selecciona un producto.');
    p.cantidad = Math.round((p.cantidad + cantidad) * 1000) / 1000;
    return { id: Date.now() };
  },
  avisarStockBajoWhatsApp() {
    requiereSesion();
    if (!productosMock.some((p) => p.cantidad <= p.umbralMinimo)) throw new Error('No hay productos con stock bajo por ahora.');
    if (!ajustesMock.whatsappNumero) throw new Error('Aún no hay un número de WhatsApp configurado. Pídele al administrador que lo agregue en Ajustes.');
    console.log('[simulador] Se abriría WhatsApp hacia', ajustesMock.whatsappNumero);
    return true;
  },
  obtenerAjustes() {
    requiereAdmin();
    return { ...ajustesMock, claveAdminPorDefecto: usuariosMock.some((u) => u.rol === 'admin' && u.clave === 'admin123') };
  },
  guardarAjustes(whatsappNumero, notificaciones) {
    requiereAdmin();
    let d = (whatsappNumero || '').replace(/\D/g, '');
    if (d.length === 10) d = '52' + d;
    if (d && (d.length < 11 || d.length > 15)) throw new Error('Número de WhatsApp inválido. Escribe 10 dígitos (ej. 33 1234 5678) o el número con código de país.');
    ajustesMock = { whatsappNumero: d, notificaciones };
    return true;
  },
  listarUsuarios() { requiereAdmin(); return usuariosMock.map(({ id, usuario, rol }) => ({ id, usuario, rol })); },
  crearUsuario(usuario, clave, rol) {
    requiereAdmin();
    const nombre = (usuario || '').trim();
    if (!/^[A-Za-z0-9._@-]{3,30}$/.test(nombre)) throw new Error('El usuario debe tener de 3 a 30 caracteres (letras, números, punto, guion o @).');
    if (!clave || clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (usuariosMock.some((u) => u.usuario.toLowerCase() === nombre.toLowerCase())) throw new Error('Ese nombre de usuario ya existe.');
    usuariosMock.push({ id: siguienteIdUsuario++, usuario: nombre, clave, rol });
    return true;
  },
  eliminarUsuario(id) {
    requiereAdmin();
    if (id === sesionMock.id) throw new Error('No puedes eliminar tu propio usuario.');
    const objetivo = usuariosMock.find((u) => u.id === id);
    if (!objetivo) throw new Error('El usuario ya no existe.');
    if (objetivo.rol === 'admin' && usuariosMock.filter((u) => u.rol === 'admin').length <= 1) throw new Error('Debe quedar al menos un administrador.');
    usuariosMock = usuariosMock.filter((u) => u.id !== id);
    return true;
  },
  cambiarContrasena(id, nueva) {
    requiereAdmin();
    if (!nueva || nueva.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    const u = usuariosMock.find((x) => x.id === id);
    if (!u) throw new Error('El usuario ya no existe.');
    u.clave = nueva;
    return true;
  }
};

// ---------------------------------------------------------------------------
// API que usa la interfaz
// ---------------------------------------------------------------------------
const directos = [
  'login', 'cerrarSesion', 'obtenerCategorias', 'categoriaSugerida', 'obtenerProductos',
  'obtenerProductosFaltantes', 'obtenerMasVendidos', 'obtenerResumenDia', 'guardarProducto',
  'avisarStockBajoWhatsApp', 'obtenerAjustes', 'guardarAjustes', 'listarUsuarios',
  'crearUsuario', 'eliminarUsuario', 'cambiarContrasena'
];

export const bridge = {};
directos.forEach((metodo) => {
  bridge[metodo] = async (...args) => (nativo ? llamar(metodo, ...args) : mock[metodo](...args));
});

// Estos dos adaptan el formato de los argumentos
bridge.registrarVenta = async (items) =>
  nativo ? llamar('registrarVenta', JSON.stringify(items)) : mock.registrarVenta(items);

// (el nombre del producto ya no se manda: Java lo toma de la base de datos)
bridge.registrarEntrada = async (productoId, _nombre, cantidad, proveedor) =>
  nativo ? llamar('registrarEntrada', productoId ?? 0, cantidad, proveedor || '') : mock.registrarEntrada(productoId, cantidad);

# Pantallas

## ¿Dónde se construyeron las pantallas?

Las pantallas **no son archivos XML de Android**. Se construyeron con **React** y viven en:

```
react-app/src/screens/      ← una pantalla por archivo .jsx
react-app/src/components/   ← piezas compartidas (barra inferior y modales)
react-app/src/styles.css    ← estilos de toda la app
```

El camino que sigue lo que ves en el teléfono:

```
1. Escribes/editas  react-app/src/screens/*.jsx
2. npm run build   → react-app/dist/   (index.html + JS + CSS compilados)
3. Copias dist/*   → android/app/src/main/assets/www/
4. MainActivity.java abre un WebView con file:///android_asset/www/index.html
5. El WebView ejecuta React y dibuja las pantallas
```

Por eso, si abres `android/` en Android Studio, **no encontrarás layouts** (`res/layout/`):
solo hay una `MainActivity` con un `WebView`. Todo lo visual está en `react-app/`.

> Otra pista: en `android/app/src/main/assets/www/assets/` hay un `index-XXXX.js` ilegible. Es el
> resultado compilado de todas las pantallas juntas. **No se edita a mano**; se regenera con
> `npm run build`.

---

## Cómo funciona la navegación

No se usa `react-router`. La navegación es un `switch` en `react-app/src/App.jsx` controlado por
dos estados:

```jsx
const [sesion, setSesion]     = useState(null);        // { id, usuario, rol }
const [pantalla, setPantalla] = useState('dashboard'); // pantalla actual
```

1. Si **no hay sesión** → se muestra `Login`.
2. Al iniciar sesión: el **admin** va a `dashboard`; el **empleado** va a `ventas`.
3. Si hay sesión, un `switch (destino)` decide qué pantalla dibujar.
4. Cada pantalla recibe `onNavegar('nombreDePantalla')` (o `onVolver`) para cambiar de pantalla.
5. Un empleado siempre ve `ventas`, sin importar el valor de `pantalla`.

### Mapa de pantallas

```
Login
├── admin ──► Dashboard
│              ├── Productos ──► Nuevo producto
│              ├── Inventario ──► Entrada de mercancía
│              ├── Ventas
│              ├── Reportes (Productos más vendidos)
│              └── Ajustes
│
└── empleado ──► Ventas   (es la única pantalla que puede ver)
```

Claves de ruta usadas en `onNavegar`:

| Clave | Pantalla |
|---|---|
| `dashboard` | `Dashboard.jsx` |
| `productos` | `ProductList.jsx` |
| `nuevoProducto` | `ProductRegistration.jsx` |
| `inventario` | `InventoryControl.jsx` |
| `entradaMercancia` | `MerchandiseEntry.jsx` |
| `ventas` | `SalesRegistration.jsx` |
| `topProductos` | `TopProducts.jsx` |
| `ajustes` | `Settings.jsx` |

---

## Detalle de cada pantalla

### 1. Login — `screens/Login.jsx`
- **Qué muestra:** logo, formulario de usuario y contraseña, versión.
- **Puente:** `login(usuario, clave)`.
- **Comportamiento:** si falla, abre `ModalError` y limpia la contraseña. Si funciona, avisa a
  `App` con `onIngresar(sesion)`.
- **Acceso:** todos.

### 2. Dashboard — `screens/Dashboard.jsx`
- **Qué muestra:** saludo con la fecha, cuatro accesos rápidos (Productos, Inventario, Ventas,
  Reportes), tarjeta de alerta si hay stock bajo, **Resumen del Día** (productos activos, alertas
  y ventas de hoy) y acceso a Ajustes.
- **Puente:** `obtenerResumenDia`, `obtenerAjustes` (para saber si el admin aún usa `admin123`),
  `avisarStockBajoWhatsApp`.
- **Detalles:** botón *Salir* (cierra sesión). Muestra un aviso naranja si la contraseña del admin
  sigue siendo la de fábrica.
- **Acceso:** solo admin.

### 3. Productos — `screens/ProductList.jsx`
- **Qué muestra:** buscador, chips de categorías (`Todos` + las de Java), lista de productos con
  precio, categoría y existencia (punto verde o naranja según el stock mínimo).
- **Puente:** `obtenerProductos`, `obtenerCategorias`.
- **Detalles:** botón flotante **+** que lleva a `nuevoProducto`. El filtrado y la búsqueda se
  hacen en React sobre la lista ya cargada.
- **Acceso:** solo admin (el empleado no llega a esta pantalla).

### 4. Nuevo Producto — `screens/ProductRegistration.jsx`
- **Qué muestra:** formulario con nombre, precio, cantidad + unidad (`Kg`/`Lt`/`Pza`), stock
  mínimo (5 por defecto) y categoría.
- **Puente:** `obtenerCategorias`, `categoriaSugerida`, `guardarProducto`.
- **Detalles:** al escribir el nombre se llama a `categoriaSugerida` y la categoría se
  **selecciona sola**. Si el usuario elige otra, aparece un aviso. Java hace la validación final y
  puede rechazar el guardado (categoría incorrecta, nombre duplicado, datos inválidos).
- **Acceso:** solo admin.

### 5. Inventario — `screens/InventoryControl.jsx`
- **Qué muestra:** contador de productos críticos, botón de aviso por WhatsApp, lista **ordenada
  por urgencia** con insignia y barra de progreso (naranja = bajo, rojo = sin stock) y hasta tres
  productos saludables como referencia.
- **Puente:** `obtenerProductos`, `obtenerProductosFaltantes`, `avisarStockBajoWhatsApp`.
- **Detalles:** botón flotante **+** que lleva a `entradaMercancia`.
- **Acceso:** solo admin.

### 6. Entrada de Mercancía — `screens/MerchandiseEntry.jsx`
- **Qué muestra:** selector de producto, cantidad recibida (con la unidad del producto elegido),
  proveedor y fecha del día (solo lectura).
- **Puente:** `obtenerProductos`, `registrarEntrada`.
- **Detalles:** suma la cantidad al inventario y guarda la entrada. Al aceptar, regresa a
  Inventario.
- **Acceso:** solo admin.

### 7. Nueva Venta — `screens/SalesRegistration.jsx`
- **Qué muestra:** una o más **líneas de venta** (producto + cantidad con botones − / +), el
  disponible y el precio por unidad, subtotal y total estimado, botón para agregar otro producto
  y **Confirmar Venta**.
- **Puente:** `obtenerProductos`, `registrarVenta`, `avisarStockBajoWhatsApp`.
- **Detalles:**
  - Los productos agotados aparecen deshabilitados en el selector.
  - El paso de los botones es de 0.5 para `Kg`/`Lt` y de 1 para `Pza`.
  - Si la cantidad excede la existencia se avisa en pantalla, y Java vuelve a validar.
  - Resultado: `ModalExito`, o `ModalStockBajo` si la venta dejó productos en el mínimo.
  - El **empleado** ve esta pantalla sin barra inferior, con botón *Salir* y su nombre de sesión.
    El admin la ve con la barra inferior.
- **Acceso:** admin y empleado.

### 8. Productos Más Vendidos — `screens/TopProducts.jsx`
- **Qué muestra:** pestañas Hoy / Semana / Mes y un ranking con barras proporcionales al
  producto más vendido.
- **Puente:** `obtenerMasVendidos(8)`.
- **Nota:** las pestañas son solo visuales; el ranking usa el acumulado histórico (`vecesVendido`).
- **Acceso:** solo admin (desde *Reportes* en el Dashboard).

### 9. Ajustes — `screens/Settings.jsx`
- **Qué muestra:** aviso si el admin usa la clave por defecto, **Alertas de stock bajo** (WhatsApp
  del dueño e interruptor de notificaciones) y **Usuarios** (lista, cambiar contraseña, eliminar y
  agregar).
- **Puente:** `obtenerAjustes`, `guardarAjustes`, `listarUsuarios`, `crearUsuario`,
  `eliminarUsuario`, `cambiarContrasena`.
- **Detalles:** la acción de eliminar pide confirmación con `ModalConfirmar`. No se puede eliminar
  al usuario con sesión activa.
- **Acceso:** solo admin.

---

## Componentes compartidos (`react-app/src/components/`)

### `BottomNav.jsx`
Barra inferior con cuatro botones: **Inicio, Productos, Inventario, Ventas**. Recibe `activo` (para
resaltar el actual) y `onNavegar`. Los íconos son SVG dibujados en el propio componente. Se muestra
en Dashboard, Productos, Inventario y Ventas (cuando es admin).

### `Modal.jsx`
Cuatro modales reutilizables:

| Componente | Uso |
|---|---|
| `ModalError` | Muestra errores devueltos por Java (`e.message`). |
| `ModalExito` | Confirma una operación correcta. |
| `ModalStockBajo` | Lista los productos que se están acabando tras una venta y ofrece avisar por WhatsApp. |
| `ModalConfirmar` | Sustituye a `window.confirm()`, que **no funciona dentro del WebView**. |

---

## Estilos (`react-app/src/styles.css`)

- Los colores son variables CSS en `:root` (`--purple`, `--orange`, `--green`, `--red`, `--bg`…).
  Cambiar la paleta de la app es editar ese bloque.
- Clases principales: `.pantalla` (contenedor, máximo 480 px), `.encabezado`, `.contenido`,
  `.tarjeta`, `.campo`, `.boton-primario`, `.boton-secundario`, `.chip`, `.insignia`,
  `.barra-progreso`, `.modal`, `.barra-navegacion`.
- Las pantallas también usan estilos en línea (`style={{…}}`) para ajustes puntuales.

---

## Patrón que repiten las pantallas

```jsx
export default function MiPantalla({ onNavegar }) {
  const [datos, setDatos] = useState([]);
  const [error, setError] = useState(null);

  // 1) Cargar datos de Java al abrir la pantalla
  useEffect(() => {
    bridge.obtenerProductos().then(setDatos).catch((e) => setError(e.message));
  }, []);

  // 2) Acciones del usuario → llamar al puente
  const guardar = async () => {
    try { await bridge.guardarProducto(/* ... */); }
    catch (e) { setError(e.message); }   // 3) Errores → ModalError
  };

  return (
    <div className="pantalla">
      {/* encabezado, contenido, BottomNav, modales */}
    </div>
  );
}
```

## Cómo agregar una pantalla nueva

1. Crea `react-app/src/screens/MiPantalla.jsx` siguiendo el patrón anterior.
2. En `App.jsx`: importa el componente y agrega un `case 'miPantalla':` en el `switch`.
3. Desde otra pantalla, navega con `onNavegar('miPantalla')`.
4. Si necesita datos nuevos, agrega el método en `WebAppInterface.java` (con
   `@JavascriptInterface`, validando sesión/permisos), la lógica en `DatabaseHelper.java`, y
   declara el método en `bridge.js` (lista `directos` y simulador `mock`).
5. `npm run build`, copia `dist/*` a `android/app/src/main/assets/www/` y ejecuta la app.

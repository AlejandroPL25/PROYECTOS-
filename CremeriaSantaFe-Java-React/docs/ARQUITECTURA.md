# Arquitectura

Este documento explica cómo se conectan las piezas de la app: qué hace cada capa, cómo viaja una
petición desde un botón de React hasta SQLite y qué reglas de seguridad se aplican.

---

## 1. Visión general: app híbrida

Una app **híbrida** mezcla código nativo con una interfaz web. Aquí:

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| **Interfaz** | React 18 + Vite | Pantallas, formularios, navegación, modales. No guarda datos. |
| **Puente** | `WebView` + `@JavascriptInterface` | Permite que JavaScript llame a métodos de Java. |
| **Lógica y datos** | Java + SQLite | Sesión, permisos, validaciones, ventas, usuarios, notificaciones. |

La regla de oro del proyecto: **la interfaz propone, Java decide.** React puede validar para dar
una buena experiencia, pero la validación que cuenta está en Java.

---

## 2. Archivos Java (`android/app/src/main/java/com/cremeria/santafe/`)

### `MainActivity.java`
Única `Activity` de la app. Al abrir:

1. Crea el canal de notificaciones (`Notificador.crearCanal`).
2. Pide el permiso `POST_NOTIFICATIONS` en Android 13+.
3. Crea un `WebView` y lo pone como contenido de la pantalla.
4. Configura el `WebView` (JavaScript, DOM storage y acceso a archivos locales; ver §7).
5. Registra el puente: `webView.addJavascriptInterface(new WebAppInterface(this), "Android")`.
   Por eso en React existe `window.Android`.
6. Carga `file:///android_asset/www/index.html` (la app React compilada).

El botón *atrás* navega hacia atrás dentro del `WebView` si puede; si no, cierra la app.
La orientación está fija en vertical (`AndroidManifest.xml`).

### `WebAppInterface.java`
Es **el puente**. Cada método con `@JavascriptInterface` puede llamarse desde React. Responsabilidades:

- Mantener la **sesión** (`rolActual`, `idActual`) en memoria.
- Bloquear el login 30 s tras 5 intentos fallidos.
- Validar **permisos por rol** (`haySesion()`, `soloAdmin()`) antes de ejecutar cada acción.
- Validar datos de entrada (precio > 0, unidad válida, formato de usuario, etc.).
- Guardar los **ajustes** (número de WhatsApp y notificaciones) en `SharedPreferences`.
- Armar el mensaje y el `Intent` de WhatsApp (`https://wa.me/<numero>?text=...`).

Todos los métodos devuelven un **String JSON**:

```json
{ "ok": true,  "data": ... }
{ "ok": false, "error": "Mensaje listo para mostrar al usuario" }
```

### `DatabaseHelper.java`
Extiende `SQLiteOpenHelper`. Crea las tablas, ejecuta las consultas y contiene la lógica
transaccional de ventas y entradas. También guarda y verifica contraseñas (salt + SHA-256).

### `Categorias.java`
Catálogo de categorías y reglas por palabra clave. Detecta a qué categoría pertenece un nombre
(normaliza acentos y mayúsculas, reconoce plural `s`/`es`) y rechaza guardados inconsistentes.

### `Notificador.java`
Crea el canal `stock_bajo` y muestra una notificación `InboxStyle` con los productos que quedaron
en su mínimo. Incluye un botón **Avisar por WhatsApp**. Usa un ID fijo (`1001`): una notificación
nueva reemplaza a la anterior.

---

## 3. Base de datos (SQLite)

Archivo: `cremeria_santa_fe.db` · Versión: **2** (`DB_VERSION`).

**`productos`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INTEGER | PK, autoincremental |
| `nombre` | TEXT | Obligatorio |
| `categoria` | TEXT | Por defecto `'Otros'` |
| `precio` | REAL | Precio por unidad |
| `unidad` | TEXT | `Kg`, `Lt` o `Pza` (por defecto `'Kg'`) |
| `cantidad` | REAL | Existencia actual |
| `umbralMinimo` | REAL | Stock mínimo (por defecto 5) |
| `vecesVendido` | REAL | Acumulado vendido (base del reporte) |

**`ventas`** y **`venta_items`**

| Tabla | Columnas |
|---|---|
| `ventas` | `id` (PK), `fecha` (INTEGER, milisegundos), `total` (REAL) |
| `venta_items` | `id` (PK), `ventaId` (→ `ventas.id`), `productoId` (→ `productos.id`), `productoNombre` (TEXT), `cantidad` (REAL), `subtotal` (REAL) |

**`entradas`** y **`usuarios`**

| Tabla | Columnas |
|---|---|
| `entradas` | `id` (PK), `productoId` (→ `productos.id`), `productoNombre` (TEXT), `cantidad` (REAL), `proveedor` (TEXT), `fecha` (INTEGER, milisegundos) |
| `usuarios` | `id` (PK), `usuario` (TEXT, único, sin distinguir mayúsculas), `clave` (TEXT, formato `salt:sha256(salt+clave)`), `rol` (`'admin'` o `'empleado'`) |

Notas:

- Las relaciones (`ventaId`, `productoId`) **no** están declaradas como `FOREIGN KEY`; se mantienen
  desde el código. `venta_items` y `entradas` guardan también `productoNombre` para conservar el
  nombre aunque el producto cambie.
- `cantidad` y `vecesVendido` son `REAL` porque se vende por kilo/litro (decimales). Las
  operaciones usan `ROUND(..., 3)` para evitar errores de coma flotante.
- **Migración v1 → v2:** `onUpgrade` solo agrega la tabla `usuarios` (y siembra los usuarios
  iniciales). No se borra ningún dato.
- Los comentarios `RF01…RF08` en el código corresponden a los **requisitos funcionales** del
  proyecto (productos, alertas, ventas, entradas, etc.).

---

## 4. Ciclo de una llamada (ejemplo: confirmar una venta)

```
SalesRegistration.jsx
  └─ confirmarVenta()
       └─ bridge.registrarVenta(items)                     (bridge.js)
            └─ window.Android.registrarVenta(JSON.stringify(items))
                 └─ WebAppInterface.registrarVenta(String)       ← Java
                      ├─ ¿hay sesión?                            si no → {ok:false}
                      └─ DatabaseHelper.registrarVenta(JSONArray)
                           ├─ une líneas repetidas del mismo producto
                           ├─ BEGIN TRANSACTION
                           │    ├─ valida existencia (no vende más de lo que hay)
                           │    ├─ calcula total con precios DE LA BASE DE DATOS
                           │    ├─ INSERT ventas + venta_items
                           │    ├─ UPDATE productos (cantidad, vecesVendido)
                           │    └─ detecta alertas (cruzó el mínimo o se agotó)
                           └─ COMMIT   (si algo falla, se revierte todo)
                      ├─ si hay alertas y notificaciones activas → Notificador
                      └─ return {"ok":true,"data":{ventaId,total,alertas[]}}
            └─ bridge.js: parsea el JSON; si ok=false lanza Error(mensaje)
       └─ la pantalla muestra ModalExito, ModalStockBajo o ModalError
```

Detalles importantes:

- **No se confía en el precio que manda la pantalla.** Java lee el precio de la base de datos.
- Una alerta de stock se dispara solo cuando la venta **cruza** el mínimo
  (`antes > umbral && después <= umbral`) o **agota** el producto. Así no se repite la alerta en
  cada venta de un producto que ya estaba bajo.
- Todo es una **transacción**: o se registra la venta completa o no se registra nada.

---

## 5. El puente en detalle (`window.Android`)

`react-app/src/bridge.js` envuelve `window.Android`:

- Si `window.Android` existe (dentro de la app), llama a Java y convierte la respuesta JSON:
  `ok:true` → devuelve `data`; `ok:false` → lanza `Error(error)`.
- Si **no** existe (navegador con `npm run dev`), usa un **simulador** en memoria que imita las
  mismas reglas para poder desarrollar la interfaz.

Así las pantallas siempre usan el mismo código:

```js
try {
  const productos = await bridge.obtenerProductos();
} catch (e) {
  setError(e.message);   // → ModalError
}
```

### Métodos disponibles

| Método | Parámetros | Devuelve (`data`) | Permiso |
|---|---|---|---|
| `login` | `usuario, clave` | `{id, usuario, rol}` | Todos |
| `cerrarSesion` | — | `true` | Todos |
| `obtenerCategorias` | — | `["Lácteos y Quesos", …]` | Sesión |
| `categoriaSugerida` | `nombre` | `"Categoría"` o `""` | Sesión |
| `obtenerProductos` | — | `[producto]` | Sesión |
| `registrarVenta` | `itemsJson` (`[{productoId, cantidad}]`) | `{ventaId, total, alertas[]}` | Sesión |
| `avisarStockBajoWhatsApp` | — | `true` (abre WhatsApp) | Sesión |
| `guardarProducto` | `nombre, categoria, precio, unidad, cantidad, umbral` | `{id}` | Admin |
| `registrarEntrada` | `productoId, cantidad, proveedor` | `{id}` | Admin |
| `obtenerProductosFaltantes` | — | `[producto]` con `cantidad <= umbralMinimo` | Admin |
| `obtenerMasVendidos` | `limite` | `[producto]` por `vecesVendido` | Admin |
| `obtenerResumenDia` | — | `{productosActivos, alertasStock, ventasHoy}` | Admin |
| `obtenerAjustes` | — | `{whatsappNumero, notificaciones, claveAdminPorDefecto}` | Admin |
| `guardarAjustes` | `whatsappNumero, notificaciones` | `true` | Admin |
| `listarUsuarios` | — | `[{id, usuario, rol}]` | Admin |
| `crearUsuario` | `usuario, clave, rol` | `true` | Admin |
| `eliminarUsuario` | `id` | `true` | Admin |
| `cambiarContrasena` | `id, nueva` | `true` | Admin |

> `bridge.registrarEntrada(productoId, _nombre, cantidad, proveedor)` conserva el parámetro
> `_nombre` por compatibilidad con la pantalla, pero ya **no se envía a Java**: el nombre se toma
> de la base de datos.

---

## 6. Reglas de negocio

### Roles y permisos
- Se validan en `WebAppInterface` con `haySesion()` y `soloAdmin()`.
- En React, `App.jsx` fuerza a un empleado a ver siempre *Ventas*. Aunque alguien manipulara la
  interfaz, Java rechazaría cualquier acción de administrador con *"No tienes permiso…"*.
- Reglas de usuarios: no puedes eliminarte a ti mismo y siempre debe quedar al menos un admin.

### Categorías
- Definidas en el bloque `static` de `Categorias.java` (`LinkedHashMap<categoría, palabras>`).
- `sugeridas(nombre)` devuelve las categorías que coinciden; `validar(nombre, categoria)` rechaza
  si hay coincidencias y la elegida no está entre ellas. Si el nombre no coincide con nada, se
  acepta cualquier categoría.
- La categoría **Otros** no tiene palabras clave y acepta cualquier producto.
- El listado de ejemplo en `bridge.js` solo sirve para el simulador; **la regla real es la de Java**.
- Para agregar una categoría: añade una línea `REGLAS.put("Nombre", new String[]{...})`. Las
  palabras van en minúsculas, sin acentos y en singular.

### Stock bajo
- Cada producto tiene su propio `umbralMinimo` (por defecto 5).
- Al vender: si el producto cruza su mínimo o se agota → entra en `alertas[]`.
- Con `alertas` y las notificaciones activadas (`SharedPreferences`, clave `notificaciones`),
  se lanza la notificación del sistema.
- `avisarStockBajoWhatsApp` toma **todos** los productos con `cantidad <= umbralMinimo`.

### WhatsApp
- El número se guarda solo con dígitos. Si son 10 dígitos se antepone `52` (México).
- Se valida una longitud de 11 a 15 dígitos.
- Se abre `https://wa.me/<numero>?text=<mensaje codificado>` con `Intent.ACTION_VIEW`.

---

## 7. Seguridad

| Tema | Cómo está resuelto | Observación |
|---|---|---|
| Contraseñas | `salt` aleatorio de 16 bytes + SHA-256, guardado como `salt:hash`. Comparación con `MessageDigest.isEqual`. | Una sola pasada de hash; para más resistencia usar PBKDF2/bcrypt/Argon2. |
| Fuerza bruta | 5 intentos fallidos → bloqueo de 30 s. | El contador vive en memoria (se reinicia al cerrar la app). |
| Permisos | Validados en Java por rol. | — |
| Inyección SQL | Consultas con parámetros (`?`). | — |
| Precios | Se leen de la base, no de la pantalla. | — |
| Depuración del WebView | `setWebContentsDebuggingEnabled` solo si la app es *debuggable*. | — |
| Acceso a archivos del WebView | `AllowFileAccessFromFileURLs` y `AllowUniversalAccessFromFileURLs` habilitados. | Necesario para módulos Vite bajo `file://`. No cargar contenido externo en este `WebView`. |
| Datos en reposo | SQLite sin cifrar; `allowBackup="true"`. | Considerar SQLCipher o `allowBackup="false"` en producción. |
| Credenciales iniciales | `admin / admin123` y `empleado / empleado123`. | La app avisa mientras el admin conserve la clave por defecto. |

---

## 8. Compilación y empaquetado de la interfaz

- `vite.config.js` usa `base: './'` para que las rutas de los recursos sean **relativas** y
  funcionen desde `file:///android_asset/www/index.html`.
- `npm run build` genera `react-app/dist/` (`index.html` + `assets/index-<hash>.js|css`).
- Ese contenido se copia a `android/app/src/main/assets/www/`; Gradle lo empaqueta dentro del APK.
- Como el nombre del archivo lleva un hash, conviene **borrar `www` antes de copiar** para no
  acumular versiones viejas.

---

## 9. Configuración de Android

| Elemento | Valor |
|---|---|
| `applicationId` / `namespace` | `com.cremeria.santafe` |
| `compileSdk` / `targetSdk` | 34 |
| `minSdk` | 24 (Android 7.0) |
| Java | 17 |
| Android Gradle Plugin | 8.5.2 |
| Dependencias | `androidx.appcompat:appcompat:1.7.0`, `androidx.webkit:webkit:1.11.0`, `com.google.android.material:material:1.12.0` |
| Permisos | `POST_NOTIFICATIONS` (Android 13+) |
| Actividad | `MainActivity`, vertical, `windowSoftInputMode="adjustResize"` |

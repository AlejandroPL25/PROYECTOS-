# Cremería Santa Fe — App híbrida (Java + React)

Aplicación Android para el control de una cremería: catálogo de productos, inventario, ventas,
entradas de mercancía, reportes y alertas de stock bajo. Está hecha con **Android Studio (Java)**
para la parte nativa y **React (Vite)** para la interfaz, que corre dentro de un `WebView`.

Todo funciona **100 % local**: no hay servidor ni internet. Los datos viven en una base **SQLite**
en el teléfono.

> Versión actual: **2.0** (`versionCode 2`) · `minSdk 24` · `targetSdk 34` · Java 17

---

## Contenido

- [Qué hace la app](#qué-hace-la-app)
- [Cómo está construida (resumen)](#cómo-está-construida-resumen)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos](#requisitos)
- [Cómo ejecutarla](#cómo-ejecutarla)
- [Cómo modificar la interfaz (React)](#cómo-modificar-la-interfaz-react)
- [Usuarios y permisos](#usuarios-y-permisos)
- [Documentación detallada](#documentación-detallada)
- [Limitaciones conocidas y seguridad](#limitaciones-conocidas-y-seguridad)
- [Pendiente / ideas](#pendiente--ideas)

---

## Qué hace la app

| Función | Descripción | Quién la usa |
|---|---|---|
| **Login con roles** | Inicio de sesión con usuario y contraseña. Dos roles: administrador y empleado. | Todos |
| **Nueva venta** | Se arman líneas de venta (producto + cantidad), se calcula el total y se descuenta el inventario en una sola transacción. | Admin y empleado |
| **Catálogo de productos** | Lista con búsqueda y filtro por categoría. | Admin |
| **Alta de productos** | Con **validación de categoría por nombre** (ej. "leche" solo puede ir en *Lácteos y Quesos*) y nombres únicos. | Admin |
| **Inventario** | Muestra los productos por reponer ordenados por urgencia. | Admin |
| **Entrada de mercancía** | Suma existencias y guarda el proveedor. | Admin |
| **Reporte de más vendidos** | Ranking por volumen vendido. | Admin |
| **Alertas de stock bajo** | Aviso dentro de la app + notificación del teléfono cuando una venta deja un producto en su mínimo o lo agota. | Automático |
| **Aviso por WhatsApp** | Abre WhatsApp con el mensaje de stock bajo ya escrito para el dueño. | Admin y empleado |
| **Ajustes** | WhatsApp del dueño, activar/desactivar notificaciones y administración de usuarios. | Admin |

---

## Cómo está construida (resumen)

```
┌───────────────────────────────────────────────────────────────┐
│                      Teléfono Android                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ MainActivity (Java)                                     │  │
│  │   └── WebView ── carga file:///android_asset/www/       │  │
│  │         │         index.html  (la app React ya compilada)│  │
│  │         │                                               │  │
│  │   React (pantallas)                                     │  │
│  │         │  window.Android.metodo(...)  ← puente         │  │
│  │         ▼                                               │  │
│  │   WebAppInterface (Java)  ← valida sesión y permisos    │  │
│  │         │                                               │  │
│  │         ├── DatabaseHelper ──► SQLite (cremeria_santa_fe.db)
│  │         ├── Categorias   (reglas de categoría)          │  │
│  │         └── Notificador  (notificaciones del sistema)   │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

Puntos clave:

1. **Las pantallas están en React**, en `react-app/src/screens/`. No son layouts XML de Android.
2. React se compila con Vite a archivos estáticos (`index.html` + JS + CSS) y esos archivos se
   **copian** a `android/app/src/main/assets/www/`. Android los abre dentro de un `WebView`.
3. La **lógica real** (permisos, validaciones, base de datos, notificaciones) vive en **Java**.
   React solo pide cosas a través del puente `window.Android`.
4. Para trabajar la interfaz sin Android Studio, `react-app/src/bridge.js` incluye un **simulador**
   en memoria que imita al puente cuando se corre en el navegador.

Más detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y [`docs/PANTALLAS.md`](docs/PANTALLAS.md).

---

## Estructura del repositorio

```
CremeriaSantaFeHybrid/
├── README.md
├── docs/
│   ├── ARQUITECTURA.md          Capas, puente, base de datos, seguridad
│   └── PANTALLAS.md             Dónde y cómo se construyó cada pantalla
│
├── react-app/                   ← INTERFAZ (React + Vite)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js           base './' para cargar bajo file://
│   └── src/
│       ├── main.jsx             Punto de entrada de React
│       ├── App.jsx              Sesión + "router" por estado (switch)
│       ├── bridge.js            Puente window.Android + simulador de navegador
│       ├── styles.css           Estilos y variables de color (:root)
│       ├── components/
│       │   ├── BottomNav.jsx    Barra inferior (Inicio/Productos/Inventario/Ventas)
│       │   └── Modal.jsx        Modales de error, éxito, stock bajo y confirmación
│       └── screens/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── ProductList.jsx
│           ├── ProductRegistration.jsx
│           ├── InventoryControl.jsx
│           ├── MerchandiseEntry.jsx
│           ├── SalesRegistration.jsx
│           ├── TopProducts.jsx
│           └── Settings.jsx
│
└── android/                     ← APP NATIVA (Android Studio, Java)
    ├── build.gradle · settings.gradle · gradle.properties
    └── app/
        ├── build.gradle
        └── src/main/
            ├── AndroidManifest.xml
            ├── java/com/cremeria/santafe/
            │   ├── MainActivity.java       Crea el WebView y registra el puente
            │   ├── WebAppInterface.java    Métodos que React puede llamar
            │   ├── DatabaseHelper.java     SQLite: tablas, ventas, usuarios
            │   ├── Categorias.java         Categorías y reglas por palabra clave
            │   └── Notificador.java        Notificaciones de stock bajo
            ├── res/values/                 strings.xml, themes.xml
            └── assets/www/                 ← build de React copiado aquí
```

---

## Requisitos

- **Android Studio** reciente (con JDK 17 y Android SDK 34).
- **Node.js 18+** y **npm** (solo si vas a modificar la interfaz).
- Un teléfono Android (API 24+) o un emulador.

---

## Cómo ejecutarla

### Solo la app (sin tocar la interfaz)

1. Abre la carpeta `android/` en Android Studio.
2. Espera a que termine el **Gradle Sync**.
3. Pulsa **Run ▶** con un emulador o teléfono conectado.

La interfaz ya viene compilada en `android/app/src/main/assets/www/`.

> La app **arranca sin productos**. Dalos de alta desde *Productos → +* con el usuario `admin`.

### Solo la interfaz, en el navegador (simulador)

```bash
cd react-app
npm install      # solo la primera vez
npm run dev      # abre http://localhost:5173
```

En el navegador no existe `window.Android`, así que `bridge.js` usa datos de ejemplo en memoria.
Entra con `admin / admin123` (admin) o `empleado / empleado123` (empleado). Los datos se pierden
al recargar la página.

---

## Cómo modificar la interfaz (React)

Cada vez que cambies algo en `react-app/src/`, hay que recompilar y copiar el resultado a Android:

```bash
cd react-app
npm run build                                   # genera react-app/dist/

# Borra la interfaz anterior y copia la nueva
rm -rf ../android/app/src/main/assets/www
mkdir -p ../android/app/src/main/assets/www
cp -r dist/* ../android/app/src/main/assets/www/
```

En Windows (PowerShell):

```powershell
cd react-app
npm run build
Remove-Item -Recurse -Force ..\android\app\src\main\assets\www -ErrorAction SilentlyContinue
New-Item -ItemType Directory ..\android\app\src\main\assets\www | Out-Null
Copy-Item -Recurse dist\* ..\android\app\src\main\assets\www\
```

Luego vuelve a ejecutar la app desde Android Studio.

> Borrar `www` antes de copiar evita que queden archivos viejos con hash distinto
> (`index-XXXX.js`) dentro del APK.

- **Colores:** variables `:root` al inicio de `react-app/src/styles.css`.
- **Logo:** `Login.jsx` (círculo grande) y los `<div className="logo-sf">SF</div>` de cada encabezado.

---

## Usuarios y permisos

Usuarios iniciales (se crean la primera vez que se abre la app):

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `empleado` | `empleado123` | Empleado |

**Cambia la contraseña del admin de inmediato:** *Ajustes → Usuarios → Contraseña*. Mientras siga
siendo `admin123`, el dashboard muestra un aviso naranja.

| Rol | Qué puede hacer |
|---|---|
| **Administrador** | Todo: dashboard, productos, inventario, entradas, ventas, reportes y ajustes. |
| **Empleado** | Entra directo a *Nueva Venta* y solo puede vender y avisar por WhatsApp. |

Los permisos se validan **también en Java** (`WebAppInterface.java`), no solo ocultando botones.

---

## Documentación detallada

| Documento | Para qué sirve |
|---|---|
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Capas del sistema, ciclo de una llamada, tablas SQLite, tabla completa del puente, seguridad y notificaciones. |
| [`docs/PANTALLAS.md`](docs/PANTALLAS.md) | Dónde se construyen las pantallas, cómo funciona la navegación y qué hace cada una. |

---

## Limitaciones conocidas y seguridad

- **WhatsApp no se envía solo.** Android/WhatsApp no permiten que una app mande mensajes en
  automático; la app abre el chat con el texto listo y la persona toca *Enviar*. Un envío 100 %
  automático requeriría la API de WhatsApp Business y un servidor.
- **Categorías por palabra clave.** La validación busca palabras en el nombre del producto
  ("crema de cacahuate" se detecta como lácteo). Si un producto legítimo se bloquea, ajusta las
  palabras en `Categorias.java`.
- **Sesión en memoria.** Si el sistema cierra la app, hay que volver a iniciar sesión.
- **Hash de contraseñas:** `salt + SHA-256` de una sola pasada. Es mejor que texto plano, pero un
  algoritmo con costo (PBKDF2, bcrypt o Argon2) sería más resistente.
- **Base de datos sin cifrar** y `android:allowBackup="true"` en el manifiesto: para producción,
  considera cifrar la base (p. ej. SQLCipher) o desactivar el respaldo automático.
- **`WebView` con acceso a archivos habilitado** (`setAllowFileAccessFromFileURLs` y
  `setAllowUniversalAccessFromFileURLs`): se necesita para que los módulos de Vite carguen bajo
  `file://`. Es aceptable mientras la app **solo cargue su propio contenido local**; no la
  conviertas en un navegador ni cargues URLs externas dentro del mismo `WebView`.
- **Reporte "Hoy / Semana / Mes":** las pestañas son visuales; el ranking se calcula con el
  acumulado histórico (`vecesVendido`), no filtra por fecha.
- **Descuento** en *Nueva Venta* es solo ilustrativo (siempre `$0.00`).

---

## Pendiente / ideas

- Logo real.
- Editar y eliminar productos.
- Historial de ventas y de entradas de mercancía (las tablas `ventas`, `venta_items` y `entradas`
  ya guardan los datos).
- Respaldo y restauración de la base de datos.
- Reporte filtrado por día, semana y mes.
- Cambio de contraseña obligatorio en el primer inicio de sesión.

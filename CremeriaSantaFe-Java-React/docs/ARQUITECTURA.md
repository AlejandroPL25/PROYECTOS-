# Arquitectura — Cremería Santa Fe v3.0

## 1. Visión general

La app es **cliente-servidor**. El celular muestra la interfaz y el servidor guarda y valida los datos.

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| Contenedor Android | Java, `WebView` | Carga la interfaz y ofrece al teléfono dos funciones: notificar y abrir WhatsApp |
| Interfaz | React + Vite | Muestra las pantallas, valida lo básico y llama a la API con `fetch()` |
| Servidor | Flask + SQLite | Autenticación, permisos por rol, reglas de negocio y almacenamiento |

Los datos viajan entre la interfaz y el servidor por HTTP, en JSON. Java **no** interviene en los datos: solo en lo que
React no puede hacer por sí solo (mostrar una notificación del sistema y abrir WhatsApp).

**Por qué esta división:** en la versión 2 los datos vivían en una base SQLite dentro de cada celular, de modo que el
dueño y el empleado veían inventarios distintos. Al mover los datos y las reglas a un servidor, todos ven lo mismo y las
reglas de seguridad se aplican en un solo lugar.

## 2. Capas

| Capa | Archivos | Qué contiene |
|---|---|---|
| Presentación | `react-app/src/screens/*.jsx`, `components/` | Nueve pantallas, barra inferior, modales, indicador de carga |
| Acceso a la API | `react-app/src/api.js` | Peticiones, tiempo de espera, manejo de errores, sesión vencida |
| Estado de sesión | `react-app/src/sesion.js` | Token y usuario actuales (instancia única compartida) |
| Puente con el teléfono | `nativo.js` y `WebAppInterface.java` | Notificación de stock bajo y apertura de WhatsApp |
| API REST | `server/app.py` | 18 rutas, autenticación, roles, validación, transacciones |
| Reglas de categorías | `server/categorias.py` | Qué productos pertenecen a qué categoría |
| Datos | SQLite (`cremeria.db`) | Seis tablas, se crean al iniciar el servidor |

## 3. Ejemplo de flujo: registrar una venta

1. En **Ventas**, la persona elige productos y cantidades y toca *Confirmar Venta*.
2. `SalesRegistration.jsx` llama a `api.registrarVenta(items)`, que envía `POST /api/ventas` con el token en la cabecera
   `Authorization: Bearer ...`.
3. El servidor valida la sesión y consulta el usuario en la base de datos.
4. Abre una transacción (`BEGIN IMMEDIATE`), revisa que existan los productos y que haya existencia suficiente, y
   calcula el total con los **precios guardados en la base** (no con los que mande la app).
5. Registra la venta y sus líneas, descuenta las existencias y confirma la transacción (`COMMIT`). Si algo falla, hace
   `ROLLBACK` y no queda nada a medias.
6. Responde con `{ok, data}`: el total, la lista de alertas de stock bajo, si las notificaciones están activas y el
   enlace de WhatsApp ya preparado.
7. Si hay alertas, la interfaz las muestra y, si están activadas, llama a `nativo.notificarStockBajo(...)`, que a través
   de `window.Android` muestra la notificación del teléfono.

## 4. Base de datos

SQLite, con llaves foráneas activadas. Las tablas se crean al iniciar el servidor si no existen.

**usuarios**

| Columna | Tipo | Restricciones |
|---|---|---|
| id | entero | llave primaria |
| usuario | texto | único, sin distinguir mayúsculas |
| clave | texto | hash de la contraseña (nunca el texto) |
| rol | texto | solo `admin` o `empleado` |

**productos**

| Columna | Tipo | Restricciones |
|---|---|---|
| id | entero | llave primaria |
| nombre | texto | único, sin distinguir mayúsculas |
| categoria | texto | una de las categorías definidas |
| precio | decimal | mayor a 0 |
| unidad | texto | solo `Kg`, `Lt` o `Pza` |
| cantidad | decimal | mayor o igual a 0 |
| umbralMinimo | decimal | mayor o igual a 0 (por defecto 5) |

**ventas**

| Columna | Tipo | Restricciones |
|---|---|---|
| id | entero | llave primaria |
| fecha | entero | milisegundos desde 1970 |
| total | decimal | calculado por el servidor |
| usuarioId | entero | llave foránea a usuarios (queda vacío si se elimina el usuario) |

**venta_items**

| Columna | Tipo | Restricciones |
|---|---|---|
| id | entero | llave primaria |
| ventaId | entero | llave foránea a ventas (se borra junto con la venta) |
| productoId | entero | llave foránea a productos |
| productoNombre | texto | copia del nombre al momento de la venta |
| cantidad | decimal | cantidad vendida |
| subtotal | decimal | precio por cantidad |

**entradas**

| Columna | Tipo | Restricciones |
|---|---|---|
| id | entero | llave primaria |
| productoId | entero | llave foránea a productos |
| productoNombre | texto | copia del nombre |
| cantidad | decimal | cantidad recibida |
| proveedor | texto | opcional, hasta 80 caracteres |
| fecha | entero | milisegundos desde 1970 |
| usuarioId | entero | llave foránea a usuarios |

**ajustes**

| Columna | Tipo | Restricciones |
|---|---|---|
| clave | texto | llave primaria (`whatsappNumero`, `notificaciones`) |
| valor | texto | valor del ajuste |

**Relaciones:** una venta tiene muchas líneas (`venta_items`); cada línea y cada entrada apuntan a un producto; ventas y
entradas guardan qué usuario las registró.

## 5. API REST

Todas las respuestas son `{ "ok": true, "data": ... }` o `{ "ok": false, "error": "mensaje" }`. La sesión se envía en
`Authorization: Bearer <token>`.

| Código | Significado |
|---|---|
| 200 / 201 | Éxito / creado |
| 400 | Validación (dato inválido) |
| 401 | Sin sesión, sesión vencida o usuario inexistente |
| 403 | Sin permiso para el rol |
| 404 | No encontrado |
| 409 | Duplicado (producto o usuario ya existe) |
| 429 | Demasiados intentos de login |

| Ruta | Quién | Para qué |
|---|---|---|
| `GET /api/salud` | público | Probar la conexión |
| `POST /api/login` | público | Devuelve token y usuario |
| `GET /api/categorias` | sesión | Lista de categorías |
| `GET /api/categorias/sugerida?nombre=` | sesión | Categoría detectada por el nombre |
| `GET /api/productos` | sesión | Catálogo (el empleado lo necesita para vender) |
| `POST /api/productos` | admin | Alta de producto |
| `GET /api/productos/faltantes` | admin | Productos en o bajo el stock mínimo |
| `GET /api/productos/mas-vendidos?periodo=&limite=` | admin | Ranking por hoy, semana o mes |
| `GET /api/resumen` | admin | Productos activos, alertas y ventas de hoy |
| `POST /api/ventas` | sesión | Registra venta, descuenta existencias, devuelve alertas |
| `POST /api/entradas` | admin | Entrada de mercancía |
| `POST /api/alertas/whatsapp` | sesión | Enlace `wa.me` con el aviso de stock bajo |
| `GET /api/ajustes` | admin | Número de WhatsApp, notificaciones y aviso de clave predeterminada |
| `PUT /api/ajustes` | admin | Guarda los ajustes |
| `GET /api/usuarios` | admin | Lista de usuarios |
| `POST /api/usuarios` | admin | Crea usuario |
| `DELETE /api/usuarios/<id>` | admin | Elimina usuario |
| `PUT /api/usuarios/<id>/contrasena` | admin | Cambia contraseña |

## 6. Autenticación y roles

- **Login:** `POST /api/login` verifica la contraseña contra su hash (werkzeug) y devuelve un token firmado
  (`itsdangerous`, `URLSafeTimedSerializer`) que contiene solo el id del usuario.
- **Caducidad:** el token vale 12 horas.
- **Secreto de firma:** se genera una vez con `secrets.token_hex(32)` y se guarda en el archivo `.secret_key`, que está
  fuera del control de versiones; no viene escrito en el código.
- **Revisión en cada petición:** el servidor consulta el usuario en la base cada vez. Si lo eliminan o le cambian el rol,
  el cambio aplica de inmediato aunque su token siga vigente.
- **Roles:** dos decoradores protegen las rutas. `requiere_sesion` pide un token válido y `solo_admin` además exige rol de
  administrador. Los permisos se validan en el servidor; la interfaz solo oculta pantallas por comodidad.
- **Bloqueo de intentos:** tras 5 fallos seguidos con el mismo usuario desde la misma dirección, el login se bloquea 30
  segundos (código 429).
- **Contraseñas:** mínimo 6 caracteres, guardadas siempre con hash.

## 7. Reglas de negocio

| Regla | Dónde se aplica |
|---|---|
| El precio y el total salen de la base de datos, no de lo que envíe la app | `POST /api/ventas` |
| Una venta es todo o nada (transacción con `BEGIN IMMEDIATE`) | `POST /api/ventas`, `POST /api/entradas` |
| `BEGIN IMMEDIATE` bloquea escrituras simultáneas: dos celulares no pueden vender la misma existencia | `POST /api/ventas` |
| Las líneas repetidas del mismo producto se suman | `POST /api/ventas` |
| No se vende más de la existencia disponible | `POST /api/ventas` |
| Hay alerta cuando un producto **cruza** su stock mínimo o se agota con esa venta (no se repite en cada venta) | `POST /api/ventas` |
| Unidades permitidas: Kg, Lt, Pza; precio mayor a 0; cantidades no negativas | `POST /api/productos` y restricciones de la tabla |
| El nombre del producto es único; si ya existe responde 409 | `POST /api/productos` |
| Un producto no puede quedar en una categoría que no le corresponde (por ejemplo, "Queso Oaxaca" en Embutidos) | `categorias.py` |
| El número de WhatsApp se normaliza: 10 dígitos se completan con el código de México (52) | `PUT /api/ajustes` |
| Debe quedar siempre al menos un administrador | `DELETE /api/usuarios/<id>` |
| Nadie puede eliminar su propio usuario | `DELETE /api/usuarios/<id>` |
| Un empleado solo puede registrar ventas | roles del servidor |

**Categorías:** Lácteos y Quesos, Embutidos, Huevo, Abarrotes, Bebidas, Botanas y Dulces, Pan y Tortillas y Otros. Las
reglas viven en un diccionario de palabras clave por categoría (ignora acentos y reconoce plurales). Para agregar una
categoría o palabra solo se edita ese diccionario.

## 8. Cliente React

- **`api.js`:** una función base (`pedir`) arma la petición, agrega el token, aplica un tiempo máximo de 10 segundos y
  traduce los fallos a mensajes claros: sin conexión, servidor lento o sesión vencida. Sobre ella expone un método por
  cada ruta (`api.registrarVenta`, `api.obtenerProductos`, etc.).
- **Carga:** un contador de peticiones en curso alimenta una barra superior y, si tardan más de 350 ms, un spinner.
- **Errores globales:** una carga fallida muestra un aviso con opción de reintentar.
- **Sesión vencida:** ante un 401 la sesión se cierra y la app regresa al login con un aviso.
- **`sesion.js`:** instancia única con el token y el usuario, respaldada en `sessionStorage` para sobrevivir a una
  recarga del WebView.
- **Dirección del servidor:** se guarda en el teléfono y se cambia desde el login (con prueba de conexión).
- **`App.jsx`:** decide qué pantalla mostrar según el estado y el rol (ver [Pantallas](PANTALLAS.md)).
- **Actualización del Dashboard:** cada 30 segundos consulta el resumen y, si aumentaron las alertas, pide los productos
  faltantes y lanza la notificación del teléfono.

## 9. Capa Java (Android)

- **`MainActivity`:** crea el canal de notificaciones, pide el permiso de notificaciones en Android 13 o superior, configura
  el `WebView` y carga `file:///android_asset/www/index.html`. Habilita la inspección remota solo en compilaciones de
  depuración.
- **`WebAppInterface`:** se expone a React como `window.Android` con solo dos métodos:
  - `abrirWhatsApp(url)`: abre el chat con el mensaje ya escrito. Solo acepta enlaces que empiecen con
    `https://wa.me/`, así que la página no puede lanzar otras acciones.
  - `notificarStockBajo(alertasJson, whatsappUrl)`: muestra la notificación con la lista de productos y, si hay enlace,
    el botón "Avisar por WhatsApp".
- **`Notificador`:** crea el canal "Alertas de stock bajo" y construye la notificación; una nueva reemplaza a la anterior.
- **`AndroidManifest`:** permisos de Internet y de notificaciones; la actividad queda en vertical.

## 10. Pruebas

`server/test_api.py` tiene **49 pruebas** que usan una base temporal y recorren la API completa:

| Grupo | Qué verifica |
|---|---|
| Sesión | Login correcto, incorrecto y vacío, bloqueo tras 5 fallos, token ausente o alterado, token de un usuario eliminado |
| Roles | Qué puede y qué no puede hacer cada rol |
| Categorías | Detección por nombre (por ejemplo, "panela" no se confunde con "pan"), rechazo de categorías incorrectas o inventadas |
| Productos | Alta, validaciones y duplicados |
| Ventas | Totales, descuento de existencias, existencia insuficiente, venta atómica, precio tomado de la base, líneas repetidas y alertas al cruzar el mínimo o agotarse |
| Alertas | Enlace de WhatsApp con número y mensaje, errores sin stock bajo o sin número, número inválido |
| Entradas | Suma de existencias y validaciones |
| Reportes | Ranking por periodo y resumen |
| Usuarios | Alta, validaciones, no eliminarse a sí mismo ni al último administrador, cambio de contraseña y contraseña nunca en texto plano |
| Protocolo | Formato `{ok, data}`, CORS y errores en JSON |

Se ejecutan con `python -m unittest -v test_api`.

## 11. Seguridad y límites

| Tema | Estado |
|---|---|
| Contraseñas | Con hash; las de demostración (`admin123`, `empleado123`) deben cambiarse, y el Dashboard avisa mientras no se haga |
| Token | Firmado, caduca a las 12 h y se revalida contra la base en cada petición |
| Permisos | Validados en el servidor |
| Precios | Calculados en el servidor |
| Tráfico | Va por `http` en la red local (`usesCleartextTraffic` activo); en producción debe usarse HTTPS |
| CORS | Abierto (`*`), pensado para el uso en red local |
| Servidor | SQLite y servidor de desarrollo de Flask; en producción, un servidor WSGI como gunicorn o waitress |
| Notificaciones | Solo con la app abierta en el Dashboard; con la app cerrada haría falta Firebase Cloud Messaging |
| WhatsApp | Abre el chat con el mensaje listo; el envío automático requiere la API de empresa |

## 12. Cambios respecto a la versión 2

| Aspecto | Versión 2 | Versión 3 |
|---|---|---|
| Datos | SQLite en cada celular | SQLite en el servidor, compartida |
| Qué hace Java | Base de datos, reglas y usuarios | Solo contenedor, notificaciones y WhatsApp |
| Comunicación con React | Puente `window.Android` con muchos métodos | API REST con `fetch()` |
| Autenticación | Sesión local | Token firmado con caducidad y roles en el servidor |
| Pruebas | — | 49 pruebas de la API |

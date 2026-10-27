# Pantallas — Cremería Santa Fe v3.0

## Dónde están las pantallas

Las pantallas **no son archivos XML de Android**: están hechas en **React** y viven en `react-app/src/screens/*.jsx`.
La app Android solo abre un `WebView` que las muestra.

Para ver un cambio en el celular:

1. Edita el archivo de la pantalla en `react-app/src/screens/`.
2. Genera la interfaz con `npm run build` dentro de `react-app/`.
3. Copia el contenido de `react-app/dist/` a `android/app/src/main/assets/www/`.
4. Vuelve a ejecutar la app desde Android Studio.

Para probar sin el celular, `npm run dev` abre la interfaz en el navegador y usa la API en `http://localhost:5000`.

## Navegación

`App.jsx` decide qué pantalla mostrar según la sesión y el rol. No usa una librería de rutas: guarda en un estado cuál
es la pantalla actual y muestra la que corresponde.

| Rol | Al iniciar sesión | Pantallas disponibles |
|---|---|---|
| Administrador | Dashboard | Las nueve |
| Empleado | Nueva Venta | Solo Nueva Venta |

Aunque un empleado lograra abrir otra pantalla, el servidor rechazaría la acción con un 403.

| Desde | Se llega a |
|---|---|
| Login | Dashboard (administrador) o Nueva Venta (empleado) |
| Dashboard | Productos, Inventario, Nueva Venta, Reportes, Ajustes |
| Barra inferior (administrador) | Inicio, Productos, Inventario, Ventas |
| Productos | Nuevo Producto |
| Inventario | Entrada de Mercancía |
| Reportes | Regresa al Dashboard |
| Ajustes | Regresa al Dashboard |

Si el servidor responde que la sesión venció, la app regresa al login con un aviso.

## Elementos comunes

- **Barra inferior** (`BottomNav`): Inicio, Productos, Inventario y Ventas. Solo la ven los administradores.
- **Encabezado**: título de la pantalla y el sello "SF"; las pantallas internas llevan botón de regreso.
- **Indicador de carga**: una barra arriba mientras hay peticiones y un spinner si tardan más de 350 ms.
- **Modales** (`Modal.jsx`): error con opción de reintentar, éxito, confirmación y aviso de stock bajo.

## Las nueve pantallas

### 1. Login (`Login.jsx`)

| | |
|---|---|
| Quién | Todos |
| Qué muestra | Logo, formulario de usuario y contraseña, dirección del servidor, versión |
| Acciones | Iniciar sesión; cambiar la dirección del servidor; probar la conexión |
| API | `POST /api/login`, `GET /api/salud` |

- Muestra un aviso si la sesión anterior venció.
- Con la contraseña mal, limpia el campo y muestra el motivo (incluido el bloqueo de 30 segundos tras 5 intentos).
- La primera vez en un celular real pide escribir la dirección del servidor y la prueba antes de guardarla.

### 2. Dashboard (`Dashboard.jsx`)

| | |
|---|---|
| Quién | Administrador |
| Qué muestra | Saludo, accesos rápidos, tarjeta de alertas, resumen del día y acceso a Ajustes |
| Acciones | Ir a Productos, Inventario, Ventas, Reportes o Ajustes; avisar por WhatsApp; cerrar sesión |
| API | `GET /api/resumen`, `GET /api/ajustes`, `GET /api/productos/faltantes`, `POST /api/alertas/whatsapp` |

- **Resumen del día:** productos activos, alertas de stock bajo y ventas de hoy en pesos.
- **Tarjeta de alerta:** aparece solo si hay productos por reponer, con botones *Ver inventario* y *Avisar por WhatsApp*.
- **Aviso de contraseña:** una franja naranja mientras el administrador siga con la contraseña predeterminada.
- **Actualización automática:** cada 30 segundos revisa el servidor sin spinner y, si las alertas aumentaron (por ejemplo,
  por una venta del empleado), lanza la notificación del teléfono.

### 3. Productos (`ProductList.jsx`)

| | |
|---|---|
| Quién | Administrador |
| Qué muestra | Catálogo con nombre, precio por unidad, categoría y existencia |
| Acciones | Buscar por nombre; filtrar por categoría; botón "+" para agregar un producto |
| API | `GET /api/productos`, `GET /api/categorias` |

Cada producto lleva un punto verde si está sobre el stock mínimo y naranja si está en el mínimo o por debajo.

### 4. Nuevo Producto (`ProductRegistration.jsx`)

| | |
|---|---|
| Quién | Administrador |
| Qué muestra | Formulario: nombre, precio, cantidad con unidad (Kg, Lt, Pza), stock mínimo y categoría |
| Acciones | Guardar producto |
| API | `GET /api/categorias`, `GET /api/categorias/sugerida`, `POST /api/productos` |

- Al escribir el nombre, la app consulta al servidor y **selecciona sola la categoría** (por ejemplo, "leche" va a Lácteos
  y Quesos).
- Si la persona elige otra categoría, muestra un aviso; la validación definitiva la hace el servidor.
- El stock mínimo viene en 5 y se puede cambiar.
- Errores posibles: nombre repetido, precio menor o igual a cero, cantidad negativa, categoría que no corresponde.

### 5. Inventario (`InventoryControl.jsx`)

| | |
|---|---|
| Quién | Administrador |
| Qué muestra | Cuántos productos hay por reponer, lista ordenada por urgencia y algunos productos saludables |
| Acciones | Avisar por WhatsApp; botón "+" para registrar una entrada de mercancía |
| API | `GET /api/productos`, `GET /api/productos/faltantes`, `POST /api/alertas/whatsapp` |

Cada producto muestra su estado con color y una barra de progreso:

| Estado | Condición | Color |
|---|---|---|
| Sin stock disponible | Cantidad en cero | Rojo |
| Stock bajo | Cantidad igual o menor al mínimo | Naranja |
| Stock óptimo | Cantidad sobre el mínimo | Verde |

### 6. Entrada de Mercancía (`MerchandiseEntry.jsx`)

| | |
|---|---|
| Quién | Administrador |
| Qué muestra | Producto, cantidad recibida (en la unidad del producto), proveedor y fecha del día |
| Acciones | Registrar entrada |
| API | `GET /api/productos`, `POST /api/entradas` |

El servidor suma la cantidad a las existencias y guarda quién la registró. El proveedor es opcional.

### 7. Nueva Venta (`SalesRegistration.jsx`)

| | |
|---|---|
| Quién | Administrador y empleado |
| Qué muestra | Líneas de venta (producto y cantidad), subtotal y total estimado |
| Acciones | Agregar o quitar líneas; ajustar cantidades con − y +; confirmar la venta |
| API | `GET /api/productos`, `POST /api/ventas`, `POST /api/alertas/whatsapp` |

- Los productos agotados aparecen deshabilitados; si la cantidad pedida excede la existencia, se avisa en rojo.
- Las cantidades suben de 0.5 en 0.5 para Kg y Lt, y de 1 en 1 para piezas.
- El total que se ve es una estimación: el definitivo lo calcula el servidor con los precios guardados.
- Al confirmar, si la venta deja algún producto en stock bajo, aparece el **aviso de stock bajo** con el botón *Avisar por
  WhatsApp* y, si están activadas, se muestra la notificación del teléfono.
- El empleado ve el título con su usuario y el botón *Salir*, sin barra inferior, y se queda en esta pantalla.

### 8. Productos Más Vendidos (`TopProducts.jsx`)

| | |
|---|---|
| Quién | Administrador |
| Qué muestra | Ranking de hasta 8 productos con barras proporcionales al volumen vendido |
| Acciones | Cambiar entre *Hoy*, *Semana* (últimos 7 días) y *Mes* |
| API | `GET /api/productos/mas-vendidos` |

Se abre desde la tarjeta *Reportes* del Dashboard. Si aún no hay ventas, lo indica.

### 9. Ajustes (`Settings.jsx`)

| | |
|---|---|
| Quién | Administrador |
| Qué muestra | Alertas de stock bajo y gestión de usuarios |
| Acciones | Guardar número de WhatsApp y notificaciones; cambiar contraseña; eliminar usuario; agregar usuario |
| API | `GET` y `PUT /api/ajustes`, `GET` y `POST /api/usuarios`, `DELETE /api/usuarios/<id>`, `PUT /api/usuarios/<id>/contrasena` |

- **Alertas:** número de WhatsApp del dueño (acepta 10 dígitos o el número con código de país) y un interruptor para las
  notificaciones del teléfono.
- **Usuarios:** lista con su rol (Administrador o Empleado), botón para cambiar la contraseña y para eliminar (con
  confirmación). Un formulario permite agregar usuarios con contraseña de al menos 6 caracteres.
- El servidor impide eliminar el propio usuario o al último administrador.

## Capturas

Las capturas de cada pantalla pueden guardarse en `docs/capturas/` y enlazarse desde este documento.

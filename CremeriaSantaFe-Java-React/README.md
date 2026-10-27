# Cremería Santa Fe — App Android de ventas e inventario

App para administrar una cremería: catálogo de productos, inventario con alertas de stock bajo, ventas, entradas de
mercancía y reportes, con dos roles de usuario (administrador y empleado).

Está hecha con tres piezas que trabajan juntas:

| Pieza | Tecnología | Carpeta | Qué hace |
|---|---|---|---|
| App Android | Java (Android Studio) + WebView | `android/` | Contenedor de la app. Solo hace lo que el teléfono sabe hacer: notificaciones y abrir WhatsApp |
| Interfaz | React + Vite | `react-app/` | Las 9 pantallas. Pide y envía datos al servidor con `fetch()` |
| Servidor | Python (Flask) + SQLite | `server/` | API REST: datos, usuarios, permisos por rol y reglas de negocio |

> Proyecto desarrollado en pareja para el negocio familiar de una de las integrantes.
> Versión actual: **3.0**. La versión 2 guardaba los datos en el celular; la 3 los centraliza en un servidor, de modo que
> el dueño y el empleado, aunque usen celulares distintos, ven la misma información.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md): capas, base de datos, API, seguridad, reglas de negocio.
- [Pantallas](docs/PANTALLAS.md): las 9 pantallas, a quién se muestra cada una y qué llama de la API.
- PDF combinado de ambas: `docs/Cremeria-Santa-Fe_Arquitectura-y-Pantallas.pdf`.

## Estructura del repositorio

```
CremeriaSantaFe-Java-React/
├── android/                     Proyecto de Android Studio (Java)
│   └── app/src/main/
│       ├── java/com/cremeria/santafe/
│       │   ├── MainActivity.java        WebView + puente con React
│       │   ├── WebAppInterface.java     Funciones del teléfono que React puede llamar
│       │   └── Notificador.java         Notificación de stock bajo
│       └── assets/www/                  Interfaz React ya compilada
├── react-app/                   Código fuente de la interfaz (Vite)
│   └── src/
│       ├── api.js                       Cliente de la API
│       ├── sesion.js                    Sesión (token y usuario)
│       ├── nativo.js                    Llamadas al teléfono (WhatsApp, notificaciones)
│       ├── App.jsx                      Navegación entre pantallas
│       ├── components/                  Barra inferior, modales, indicador de carga
│       └── screens/                     Las 9 pantallas
├── server/                      API REST en Flask
│   ├── app.py                           Rutas, autenticación, base de datos
│   ├── categorias.py                    Reglas de categorías
│   ├── test_api.py                      49 pruebas automáticas
│   └── seed_demo.py                     Datos de ejemplo
└── docs/                        Documentación
```

## Cómo ejecutarlo

### 1) Servidor (requiere Python 3.9 o superior)

```bash
cd server
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
python app.py
```

En Windows también basta con hacer doble clic en `server/iniciar_servidor.bat`. Al iniciar, el servidor imprime la
dirección que se usa en el celular, por ejemplo `http://192.168.1.20:5000`.

- Datos de ejemplo para demos y capturas: `python seed_demo.py`
- Simular una red lenta (para ver el indicador de carga): `LATENCIA_MS=1500 python app.py`
- En Windows, la primera vez acepta "Permitir acceso en redes privadas" para Python; si no, el celular no conecta.

### 2) App Android

1. Abre la carpeta `android/` con Android Studio, espera el *Sync* y presiona *Run*.
2. El celular y la computadora deben estar en la **misma red Wi-Fi**.
3. En la app, debajo del login toca **Cambiar**, escribe la dirección del servidor y **Probar y guardar**.
   En el emulador, la dirección por defecto (`10.0.2.2:5000`) ya apunta a tu computadora.

### 3) Si modificas la interfaz (React)

```bash
cd react-app
npm install
npm run dev       # vista previa en el navegador (usa la API en http://localhost:5000)
npm run build     # genera react-app/dist/
```

Copia el contenido de `react-app/dist/` a `android/app/src/main/assets/www/` y vuelve a ejecutar la app.
Los colores se cambian en `react-app/src/styles.css` (variables en `:root`).

## Usuarios iniciales

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador: todo |
| `empleado` | `empleado123` | Empleado: solo registrar ventas |

Son contraseñas de demostración. Cámbialas desde **Ajustes → Usuarios** antes de usar la app con datos reales; el
Dashboard muestra un aviso mientras el administrador conserve la contraseña predeterminada.

## Funciones principales

- Catálogo de productos con búsqueda y filtro por categoría.
- Alta de productos con detección de categoría por el nombre y validación en el servidor.
- Inventario ordenado por urgencia, con estados *Saludable*, *Stock bajo* y *Sin stock*.
- Ventas con varias líneas; el servidor calcula el total y descuenta existencias.
- Alertas de stock bajo: notificación del teléfono y aviso por WhatsApp.
- Entradas de mercancía con proveedor.
- Reporte de productos más vendidos (hoy, semana, mes).
- Gestión de usuarios y ajustes (solo administrador).

## Pruebas

```bash
cd server
python -m unittest -v test_api
```

49 pruebas de la API: sesión, roles, categorías, productos, ventas, alertas, entradas, reportes, usuarios y protocolo.

## Capturas

Las capturas de pantalla de la app van en `docs/capturas/` (agrégalas y enlázalas aquí).

## Límites conocidos

- El servidor usa SQLite y el servidor de desarrollo de Flask: suficiente para una cremería y para demostraciones.
  En producción convendría HTTPS y un servidor WSGI (gunicorn o waitress).
- La app permite tráfico `http://` para funcionar en la red local; con un servidor HTTPS puede desactivarse.
- La notificación con la app cerrada requeriría Firebase Cloud Messaging; hoy el celular del dueño revisa el servidor
  cada 30 segundos mientras la app está abierta en el Dashboard.
- WhatsApp no permite el envío automático sin su API de empresa: la app abre el chat con el mensaje escrito y solo falta
  tocar *Enviar*.
- Pendiente: editar y eliminar productos, historial de ventas y entradas, ícono de la app.

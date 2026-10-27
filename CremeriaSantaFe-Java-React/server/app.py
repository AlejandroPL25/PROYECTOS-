"""API REST de Cremería Santa Fe (Flask + SQLite).

La app Android (Java + WebView + React) consume esta API con fetch():
  - Datos en JSON:  { "ok": true, "data": ... }  /  { "ok": false, "error": "mensaje" }
  - Autenticación:  POST /api/login devuelve un token; después se manda "Authorization: Bearer <token>".
  - Roles:          "admin" (todo) y "empleado" (solo registrar ventas). Se validan AQUÍ, en el servidor.

Ejecutar:   python app.py          (escucha en 0.0.0.0:5000 para que el celular lo alcance por Wi-Fi)
Latencia de prueba (para demostrar los spinners):   LATENCIA_MS=1500 python app.py
"""
import os
import re
import secrets
import socket
import sqlite3
import time
from datetime import datetime, timedelta
from functools import wraps
from urllib.parse import quote
from zoneinfo import ZoneInfo

from flask import Flask, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

import categorias

BASE = os.path.dirname(os.path.abspath(__file__))
ZONA = ZoneInfo(os.environ.get("CREMERIA_TZ", "America/Mexico_City"))
LATENCIA_MS = int(os.environ.get("LATENCIA_MS", "0"))
TOKEN_HORAS = 12
CLAVE_ADMIN_POR_DEFECTO = "admin123"
VERSION = "3.0"

app = Flask(__name__)
app.json.ensure_ascii = False
app.config["DB_PATH"] = os.environ.get("CREMERIA_DB", os.path.join(BASE, "cremeria.db"))


def _cargar_secreto():
    """El secreto que firma los tokens se genera una vez y se guarda; no viene fijo en el código."""
    ruta = os.environ.get("CREMERIA_SECRET_FILE", os.path.join(BASE, ".secret_key"))
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as f:
            return f.read().strip()
    secreto = secrets.token_hex(32)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(secreto)
    return secreto


serializador = URLSafeTimedSerializer(_cargar_secreto(), salt="cremeria-sesion")

# ---------------------------------------------------------------------------
# Base de datos
# ---------------------------------------------------------------------------
ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
    clave TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'empleado'))
);
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
    categoria TEXT NOT NULL,
    precio REAL NOT NULL CHECK (precio > 0),
    unidad TEXT NOT NULL CHECK (unidad IN ('Kg', 'Lt', 'Pza')),
    cantidad REAL NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    umbralMinimo REAL NOT NULL DEFAULT 5 CHECK (umbralMinimo >= 0)
);
CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha INTEGER NOT NULL,
    total REAL NOT NULL,
    usuarioId INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS venta_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ventaId INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    productoId INTEGER NOT NULL REFERENCES productos(id),
    productoNombre TEXT NOT NULL,
    cantidad REAL NOT NULL,
    subtotal REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS entradas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productoId INTEGER NOT NULL REFERENCES productos(id),
    productoNombre TEXT NOT NULL,
    cantidad REAL NOT NULL,
    proveedor TEXT,
    fecha INTEGER NOT NULL,
    usuarioId INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS ajustes (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);
"""


def _conectar():
    con = sqlite3.connect(app.config["DB_PATH"], isolation_level=None, timeout=10)  # autocommit; transacciones manuales
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def db():
    if "db" not in g:
        g.db = _conectar()
    return g.db


@app.teardown_appcontext
def _cerrar_db(_error):
    con = g.pop("db", None)
    if con is not None:
        con.close()


def inicializar_db():
    """Crea las tablas y los dos usuarios iniciales (admin y empleado) si todavía no existen."""
    con = _conectar()
    try:
        con.executescript(ESQUEMA)
        if con.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0] == 0:
            con.execute("INSERT INTO usuarios (usuario, clave, rol) VALUES (?, ?, 'admin')",
                        ("admin", generate_password_hash(CLAVE_ADMIN_POR_DEFECTO)))
            con.execute("INSERT INTO usuarios (usuario, clave, rol) VALUES (?, ?, 'empleado')",
                        ("empleado", generate_password_hash("empleado123")))
    finally:
        con.close()


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
class ErrorNegocio(Exception):
    """Error de validación con un mensaje listo para mostrarse al usuario."""


def ok(data=None, estado=200):
    return jsonify({"ok": True, "data": data}), estado


def fallo(mensaje, estado=400):
    return jsonify({"ok": False, "error": mensaje}), estado


def num(valor):
    """Convierte a número; None si no es un número válido (incluye NaN e infinito)."""
    if isinstance(valor, bool):
        return None
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return n if n == n and abs(n) != float("inf") else None


def fmt(valor):
    return str(int(valor)) if float(valor).is_integer() else str(round(valor, 2))


def ahora_ms():
    return int(time.time() * 1000)


def inicio_dia_ms(dias_atras=0):
    hoy = datetime.now(ZONA).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((hoy - timedelta(days=dias_atras)).timestamp() * 1000)


def inicio_mes_ms():
    return int(datetime.now(ZONA).replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)


def ajuste(clave, defecto=""):
    fila = db().execute("SELECT valor FROM ajustes WHERE clave = ?", (clave,)).fetchone()
    return fila["valor"] if fila else defecto


def guardar_ajuste(clave, valor):
    db().execute("INSERT INTO ajustes (clave, valor) VALUES (?, ?) "
                 "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor", (clave, str(valor)))


def mensaje_stock_bajo(productos):
    lineas = ["Cremería Santa Fe - Aviso de stock bajo:"]
    lineas += [f"- {p['nombre']}: quedan {fmt(p['cantidad'])} {p['unidad']}" for p in productos]
    lineas.append("Favor de reponer.")
    return "\n".join(lineas)


def url_whatsapp(mensaje):
    """Enlace wa.me hacia el número del dueño con el mensaje ya escrito; None si no hay número configurado."""
    numero = ajuste("whatsappNumero")
    return f"https://wa.me/{numero}?text={quote(mensaje)}" if numero else None


# ---------------------------------------------------------------------------
# Autenticación y roles
# ---------------------------------------------------------------------------
def requiere_sesion(f):
    @wraps(f)
    def interno(*args, **kwargs):
        cabecera = request.headers.get("Authorization", "")
        if not cabecera.startswith("Bearer "):
            return fallo("Inicia sesión para continuar.", 401)
        try:
            datos = serializador.loads(cabecera[7:], max_age=TOKEN_HORAS * 3600)
        except SignatureExpired:
            return fallo("Tu sesión expiró. Inicia sesión de nuevo.", 401)
        except BadSignature:
            return fallo("Sesión no válida. Inicia sesión de nuevo.", 401)
        # Se consulta el usuario en cada petición: si lo eliminan o le cambian el rol, aplica de inmediato.
        u = db().execute("SELECT id, usuario, rol FROM usuarios WHERE id = ?", (datos.get("id"),)).fetchone()
        if u is None:
            return fallo("Tu usuario ya no existe. Inicia sesión de nuevo.", 401)
        g.usuario = dict(u)
        return f(*args, **kwargs)
    return interno


def solo_admin(f):
    @requiere_sesion
    @wraps(f)
    def interno(*args, **kwargs):
        if g.usuario["rol"] != "admin":
            return fallo("No tienes permiso para realizar esta acción.", 403)
        return f(*args, **kwargs)
    return interno


_intentos = {}  # "usuario|ip" -> (fallos seguidos, bloqueado hasta)


@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    usuario = (d.get("usuario") or "").strip()
    clave = d.get("clave") or ""
    if not usuario or not clave:
        return fallo("Escribe tu usuario y contraseña.")

    llave = f"{usuario.lower()}|{request.remote_addr}"
    fallos, hasta = _intentos.get(llave, (0, 0))
    ahora = time.time()
    if ahora < hasta:
        return fallo(f"Demasiados intentos. Espera {int(hasta - ahora) + 1} segundos.", 429)

    u = db().execute("SELECT * FROM usuarios WHERE usuario = ?", (usuario,)).fetchone()
    if u is None or not check_password_hash(u["clave"], clave):
        fallos += 1
        _intentos[llave] = (0, ahora + 30) if fallos >= 5 else (fallos, 0)
        return fallo("Usuario o contraseña incorrectos.", 401)

    _intentos.pop(llave, None)
    token = serializador.dumps({"id": u["id"]})
    return ok({"token": token, "usuario": {"id": u["id"], "usuario": u["usuario"], "rol": u["rol"]}})


@app.get("/api/salud")
def salud():
    return ok({"estado": "ok", "version": VERSION})


# ---------------------------------------------------------------------------
# Categorías
# ---------------------------------------------------------------------------
@app.get("/api/categorias")
@requiere_sesion
def listar_categorias():
    return ok(categorias.CATEGORIAS)


@app.get("/api/categorias/sugerida")
@requiere_sesion
def categoria_sugerida():
    return ok(categorias.sugerida(request.args.get("nombre", "")))


# ---------------------------------------------------------------------------
# Productos
# ---------------------------------------------------------------------------
@app.get("/api/productos")
@requiere_sesion
def listar_productos():
    filas = db().execute("SELECT * FROM productos ORDER BY nombre COLLATE NOCASE").fetchall()
    return ok([dict(f) for f in filas])


@app.post("/api/productos")
@solo_admin
def crear_producto():
    d = request.get_json(silent=True) or {}
    nombre = re.sub(r"\s+", " ", (d.get("nombre") or "").strip())
    categoria = d.get("categoria")
    unidad = d.get("unidad")
    precio, cantidad, umbral = num(d.get("precio")), num(d.get("cantidad")), num(d.get("umbral"))

    if not nombre or len(nombre) > 80:
        return fallo("Escribe el nombre del producto (máximo 80 caracteres).")
    if precio is None or not precio > 0:
        return fallo("El precio debe ser mayor a cero.")
    if cantidad is None or not cantidad >= 0:
        return fallo("La cantidad disponible no puede ser negativa.")
    if umbral is None or not umbral >= 0:
        return fallo("El stock mínimo no puede ser negativo.")
    if unidad not in ("Kg", "Lt", "Pza"):
        return fallo("Unidad no válida.")
    error_categoria = categorias.validar(nombre, categoria)
    if error_categoria:
        return fallo(error_categoria)

    try:
        cur = db().execute(
            "INSERT INTO productos (nombre, categoria, precio, unidad, cantidad, umbralMinimo) VALUES (?,?,?,?,?,?)",
            (nombre, categoria, precio, unidad, cantidad, umbral))
    except sqlite3.IntegrityError:
        return fallo("Ya existe un producto con ese nombre.", 409)
    return ok({"id": cur.lastrowid}, 201)


@app.get("/api/productos/faltantes")
@solo_admin
def productos_faltantes():
    filas = db().execute("SELECT * FROM productos WHERE cantidad <= umbralMinimo ORDER BY cantidad ASC").fetchall()
    return ok([dict(f) for f in filas])


@app.get("/api/productos/mas-vendidos")
@solo_admin
def mas_vendidos():
    periodo = request.args.get("periodo", "mes")
    desde = {"hoy": inicio_dia_ms(), "semana": inicio_dia_ms(6), "mes": inicio_mes_ms()}.get(periodo)
    if desde is None:
        return fallo("Periodo no válido (hoy, semana o mes).")
    limite = max(1, min(int(num(request.args.get("limite")) or 8), 50))
    filas = db().execute(
        "SELECT p.id, p.nombre, p.unidad, ROUND(SUM(vi.cantidad), 3) AS vecesVendido "
        "FROM venta_items vi JOIN ventas v ON v.id = vi.ventaId JOIN productos p ON p.id = vi.productoId "
        "WHERE v.fecha >= ? GROUP BY p.id ORDER BY vecesVendido DESC LIMIT ?", (desde, limite)).fetchall()
    return ok([dict(f) for f in filas])


@app.get("/api/resumen")
@solo_admin
def resumen():
    con = db()
    return ok({
        "productosActivos": con.execute("SELECT COUNT(*) FROM productos").fetchone()[0],
        "alertasStock": con.execute("SELECT COUNT(*) FROM productos WHERE cantidad <= umbralMinimo").fetchone()[0],
        "ventasHoy": con.execute("SELECT IFNULL(SUM(total), 0) FROM ventas WHERE fecha >= ?",
                                 (inicio_dia_ms(),)).fetchone()[0],
    })


# ---------------------------------------------------------------------------
# Ventas (admin y empleado)
# ---------------------------------------------------------------------------
@app.post("/api/ventas")
@requiere_sesion
def registrar_venta():
    d = request.get_json(silent=True) or {}
    items = d.get("items")
    if not isinstance(items, list) or not items:
        return fallo("Agrega al menos un producto a la venta.")

    pedidos = {}  # une las líneas repetidas del mismo producto
    for item in items:
        try:
            producto_id = int(item.get("productoId"))
        except (TypeError, ValueError, AttributeError):
            return fallo("Selecciona un producto en cada línea de la venta.")
        cantidad = num(item.get("cantidad"))
        if cantidad is None or not cantidad > 0:
            return fallo("La cantidad debe ser mayor a cero.")
        pedidos[producto_id] = round(pedidos.get(producto_id, 0) + cantidad, 3)

    con = db()
    con.execute("BEGIN IMMEDIATE")  # bloquea escrituras simultáneas: dos celulares no pueden vender la misma existencia
    try:
        filas, total = {}, 0.0
        for producto_id, cantidad in pedidos.items():
            p = con.execute("SELECT * FROM productos WHERE id = ?", (producto_id,)).fetchone()
            if p is None:
                raise ErrorNegocio("Uno de los productos ya no existe. Actualiza la lista.")
            if cantidad > p["cantidad"] + 1e-9:
                raise ErrorNegocio(f"No hay suficiente existencia de {p['nombre']} "
                                   f"(disponible: {fmt(p['cantidad'])} {p['unidad']}).")
            filas[producto_id] = p
            total += p["precio"] * cantidad  # el precio sale de la base de datos, no de lo que mande la app

        venta_id = con.execute("INSERT INTO ventas (fecha, total, usuarioId) VALUES (?,?,?)",
                               (ahora_ms(), total, g.usuario["id"])).lastrowid
        alertas = []
        for producto_id, cantidad in pedidos.items():
            p = filas[producto_id]
            despues = round(p["cantidad"] - cantidad, 3)
            con.execute("INSERT INTO venta_items (ventaId, productoId, productoNombre, cantidad, subtotal) "
                        "VALUES (?,?,?,?,?)", (venta_id, producto_id, p["nombre"], cantidad, p["precio"] * cantidad))
            con.execute("UPDATE productos SET cantidad = ? WHERE id = ?", (despues, producto_id))
            cruzo_minimo = p["cantidad"] > p["umbralMinimo"] and despues <= p["umbralMinimo"]
            se_agoto = p["cantidad"] > 0 and despues <= 1e-9
            if cruzo_minimo or se_agoto:
                alertas.append({"id": producto_id, "nombre": p["nombre"], "cantidad": despues, "unidad": p["unidad"]})
        con.execute("COMMIT")
    except ErrorNegocio as e:
        con.execute("ROLLBACK")
        return fallo(str(e))
    except Exception:
        con.execute("ROLLBACK")
        raise

    return ok({
        "ventaId": venta_id,
        "total": total,
        "alertas": alertas,
        "notificaciones": ajuste("notificaciones", "1") == "1",
        "whatsappUrl": url_whatsapp(mensaje_stock_bajo(alertas)) if alertas else None,
    }, 201)


# ---------------------------------------------------------------------------
# Entradas de mercancía (admin)
# ---------------------------------------------------------------------------
@app.post("/api/entradas")
@solo_admin
def registrar_entrada():
    d = request.get_json(silent=True) or {}
    try:
        producto_id = int(d.get("productoId"))
    except (TypeError, ValueError):
        return fallo("Selecciona un producto.")
    cantidad = num(d.get("cantidad"))
    if cantidad is None or not cantidad > 0:
        return fallo("La cantidad recibida debe ser mayor a cero.")
    proveedor = (d.get("proveedor") or "").strip()[:80]

    con = db()
    con.execute("BEGIN IMMEDIATE")
    try:
        p = con.execute("SELECT * FROM productos WHERE id = ?", (producto_id,)).fetchone()
        if p is None:
            con.execute("ROLLBACK")
            return fallo("Selecciona un producto.")
        entrada_id = con.execute(
            "INSERT INTO entradas (productoId, productoNombre, cantidad, proveedor, fecha, usuarioId) VALUES (?,?,?,?,?,?)",
            (producto_id, p["nombre"], cantidad, proveedor, ahora_ms(), g.usuario["id"])).lastrowid
        con.execute("UPDATE productos SET cantidad = ? WHERE id = ?", (round(p["cantidad"] + cantidad, 3), producto_id))
        con.execute("COMMIT")
    except Exception:
        con.execute("ROLLBACK")
        raise
    return ok({"id": entrada_id}, 201)


# ---------------------------------------------------------------------------
# Alertas por WhatsApp
# ---------------------------------------------------------------------------
@app.post("/api/alertas/whatsapp")
@requiere_sesion
def alerta_whatsapp():
    """Devuelve el enlace wa.me con el aviso de stock bajo ya escrito. La app lo abre; solo falta tocar Enviar."""
    faltantes = db().execute("SELECT * FROM productos WHERE cantidad <= umbralMinimo ORDER BY cantidad ASC").fetchall()
    if not faltantes:
        return fallo("No hay productos con stock bajo por ahora.")
    url = url_whatsapp(mensaje_stock_bajo([dict(f) for f in faltantes]))
    if url is None:
        return fallo("Aún no hay un número de WhatsApp configurado. Pídele al administrador que lo agregue en Ajustes.")
    return ok({"url": url})


# ---------------------------------------------------------------------------
# Ajustes (admin)
# ---------------------------------------------------------------------------
@app.get("/api/ajustes")
@solo_admin
def obtener_ajustes():
    admins = db().execute("SELECT clave FROM usuarios WHERE rol = 'admin'").fetchall()
    return ok({
        "whatsappNumero": ajuste("whatsappNumero"),
        "notificaciones": ajuste("notificaciones", "1") == "1",
        "claveAdminPorDefecto": any(check_password_hash(a["clave"], CLAVE_ADMIN_POR_DEFECTO) for a in admins),
    })


@app.put("/api/ajustes")
@solo_admin
def guardar_ajustes():
    d = request.get_json(silent=True) or {}
    digitos = re.sub(r"\D", "", str(d.get("whatsappNumero") or ""))
    if len(digitos) == 10:
        digitos = "52" + digitos  # número de México sin lada de país
    if digitos and not 11 <= len(digitos) <= 15:
        return fallo("Número de WhatsApp inválido. Escribe 10 dígitos (ej. 33 1234 5678) o el número con código de país.")
    guardar_ajuste("whatsappNumero", digitos)
    guardar_ajuste("notificaciones", "1" if d.get("notificaciones", True) else "0")
    return ok(True)


# ---------------------------------------------------------------------------
# Usuarios (admin)
# ---------------------------------------------------------------------------
@app.get("/api/usuarios")
@solo_admin
def listar_usuarios():
    filas = db().execute("SELECT id, usuario, rol FROM usuarios ORDER BY rol ASC, usuario COLLATE NOCASE").fetchall()
    return ok([dict(f) for f in filas])


@app.post("/api/usuarios")
@solo_admin
def crear_usuario():
    d = request.get_json(silent=True) or {}
    usuario = (d.get("usuario") or "").strip()
    clave = d.get("clave") or ""
    rol = d.get("rol")
    if not re.fullmatch(r"[A-Za-z0-9._@-]{3,30}", usuario):
        return fallo("El usuario debe tener de 3 a 30 caracteres (letras, números, punto, guion o @).")
    if len(clave) < 6:
        return fallo("La contraseña debe tener al menos 6 caracteres.")
    if rol not in ("admin", "empleado"):
        return fallo("Rol no válido.")
    try:
        db().execute("INSERT INTO usuarios (usuario, clave, rol) VALUES (?,?,?)",
                     (usuario, generate_password_hash(clave), rol))
    except sqlite3.IntegrityError:
        return fallo("Ese nombre de usuario ya existe.", 409)
    return ok(True, 201)


@app.delete("/api/usuarios/<int:usuario_id>")
@solo_admin
def eliminar_usuario(usuario_id):
    if usuario_id == g.usuario["id"]:
        return fallo("No puedes eliminar tu propio usuario.")
    objetivo = db().execute("SELECT rol FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
    if objetivo is None:
        return fallo("El usuario ya no existe.", 404)
    if objetivo["rol"] == "admin" and db().execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'").fetchone()[0] <= 1:
        return fallo("Debe quedar al menos un administrador.")
    db().execute("DELETE FROM usuarios WHERE id = ?", (usuario_id,))
    return ok(True)


@app.put("/api/usuarios/<int:usuario_id>/contrasena")
@solo_admin
def cambiar_contrasena(usuario_id):
    clave = (request.get_json(silent=True) or {}).get("clave") or ""
    if len(clave) < 6:
        return fallo("La contraseña debe tener al menos 6 caracteres.")
    cur = db().execute("UPDATE usuarios SET clave = ? WHERE id = ?", (generate_password_hash(clave), usuario_id))
    if cur.rowcount == 0:
        return fallo("El usuario ya no existe.", 404)
    return ok(True)


# ---------------------------------------------------------------------------
# CORS, latencia de prueba y errores en JSON
# ---------------------------------------------------------------------------
@app.before_request
def simular_latencia():
    if LATENCIA_MS and request.method != "OPTIONS":
        time.sleep(LATENCIA_MS / 1000)


@app.after_request
def cabeceras_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return resp


@app.errorhandler(404)
def no_encontrado(_e):
    return fallo("Ruta no encontrada.", 404)


@app.errorhandler(405)
def metodo_no_permitido(_e):
    return fallo("Método no permitido.", 405)


@app.errorhandler(500)
def error_interno(_e):
    return fallo("Error interno del servidor. Intenta de nuevo.", 500)


def ip_local():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no envía nada; solo averigua qué interfaz usa la red
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


inicializar_db()

if __name__ == "__main__":
    puerto = int(os.environ.get("PORT", "5000"))
    print("=" * 60)
    print(f" API Cremería Santa Fe v{VERSION}")
    print(f" En el celular, en la app, usa:  http://{ip_local()}:{puerto}")
    print(" Usuarios iniciales:  admin / admin123   y   empleado / empleado123")
    print("=" * 60)
    app.run(host="0.0.0.0", port=puerto, debug=False, threaded=True)

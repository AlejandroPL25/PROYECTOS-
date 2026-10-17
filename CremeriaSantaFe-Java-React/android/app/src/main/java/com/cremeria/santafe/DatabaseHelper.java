package com.cremeria.santafe;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Map;

public class DatabaseHelper extends SQLiteOpenHelper {

    private static final String DB_NAME = "cremeria_santa_fe.db";
    private static final int DB_VERSION = 2;

    public static final String ROL_ADMIN = "admin";
    public static final String ROL_EMPLEADO = "empleado";
    public static final String CLAVE_ADMIN_POR_DEFECTO = "admin123";

    public DatabaseHelper(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        // RF01 / RF03 / RF04 / RF06
        db.execSQL("CREATE TABLE productos (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "nombre TEXT NOT NULL," +
                "categoria TEXT NOT NULL DEFAULT 'Otros'," +
                "precio REAL NOT NULL," +
                "unidad TEXT NOT NULL DEFAULT 'Kg'," +
                "cantidad REAL NOT NULL DEFAULT 0," +
                "umbralMinimo REAL NOT NULL DEFAULT 5," +
                "vecesVendido REAL NOT NULL DEFAULT 0)");

        // RF05
        db.execSQL("CREATE TABLE ventas (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "fecha INTEGER NOT NULL," +
                "total REAL NOT NULL)");

        db.execSQL("CREATE TABLE venta_items (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "ventaId INTEGER NOT NULL," +
                "productoId INTEGER NOT NULL," +
                "productoNombre TEXT NOT NULL," +
                "cantidad REAL NOT NULL," +
                "subtotal REAL NOT NULL)");

        // RF08
        db.execSQL("CREATE TABLE entradas (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "productoId INTEGER NOT NULL," +
                "productoNombre TEXT NOT NULL," +
                "cantidad REAL NOT NULL," +
                "proveedor TEXT," +
                "fecha INTEGER NOT NULL)");

        crearTablaUsuarios(db);
        sembrarUsuarios(db);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Migración sin borrar datos: la versión 2 solo agrega la tabla de usuarios.
        if (oldVersion < 2) {
            crearTablaUsuarios(db);
            sembrarUsuarios(db);
        }
    }

    // =====================================================================
    // Usuarios y sesión (versión 2)
    // =====================================================================

    private void crearTablaUsuarios(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS usuarios (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "usuario TEXT NOT NULL UNIQUE COLLATE NOCASE," +
                "clave TEXT NOT NULL," +
                "rol TEXT NOT NULL)");
    }

    /** Usuarios iniciales. El administrador debe cambiar su contraseña desde Ajustes. */
    private void sembrarUsuarios(SQLiteDatabase db) {
        insertarUsuario(db, "admin", CLAVE_ADMIN_POR_DEFECTO, ROL_ADMIN);
        insertarUsuario(db, "empleado", "empleado123", ROL_EMPLEADO);
    }

    private long insertarUsuario(SQLiteDatabase db, String usuario, String clave, String rol) {
        ContentValues cv = new ContentValues();
        cv.put("usuario", usuario);
        cv.put("clave", hashearConSalt(clave));
        cv.put("rol", rol);
        return db.insert("usuarios", null, cv);
    }

    /** Regresa {id, usuario, rol} si las credenciales son correctas; null si no. */
    public JSONObject autenticar(String usuario, String clave) throws JSONException {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT id, usuario, clave, rol FROM usuarios WHERE usuario = ?",
                new String[]{usuario.trim()});
        try {
            if (c.moveToFirst() && claveCoincide(clave, c.getString(2))) {
                JSONObject u = new JSONObject();
                u.put("id", c.getLong(0));
                u.put("usuario", c.getString(1));
                u.put("rol", c.getString(3));
                return u;
            }
            return null;
        } finally {
            c.close();
        }
    }

    public boolean adminUsaClavePorDefecto() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT clave FROM usuarios WHERE rol = ?", new String[]{ROL_ADMIN});
        try {
            while (c.moveToNext()) {
                if (claveCoincide(CLAVE_ADMIN_POR_DEFECTO, c.getString(0))) return true;
            }
            return false;
        } finally {
            c.close();
        }
    }

    public JSONArray listarUsuarios() throws JSONException {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT id, usuario, rol FROM usuarios ORDER BY rol ASC, usuario ASC", null);
        JSONArray resultado = new JSONArray();
        try {
            while (c.moveToNext()) {
                JSONObject u = new JSONObject();
                u.put("id", c.getLong(0));
                u.put("usuario", c.getString(1));
                u.put("rol", c.getString(2));
                resultado.put(u);
            }
        } finally {
            c.close();
        }
        return resultado;
    }

    /** Regresa el id nuevo, o -1 si el nombre de usuario ya existe. */
    public long crearUsuario(String usuario, String clave, String rol) {
        return insertarUsuario(getWritableDatabase(), usuario, clave, rol);
    }

    public int eliminarUsuario(long id) {
        return getWritableDatabase().delete("usuarios", "id = ?", new String[]{String.valueOf(id)});
    }

    public int cambiarContrasena(long id, String nueva) {
        ContentValues cv = new ContentValues();
        cv.put("clave", hashearConSalt(nueva));
        return getWritableDatabase().update("usuarios", cv, "id = ?", new String[]{String.valueOf(id)});
    }

    public int contarAdmins() {
        Cursor c = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM usuarios WHERE rol = ?", new String[]{ROL_ADMIN});
        try {
            c.moveToFirst();
            return c.getInt(0);
        } finally {
            c.close();
        }
    }

    public String rolDe(long id) {
        Cursor c = getReadableDatabase().rawQuery("SELECT rol FROM usuarios WHERE id = ?", new String[]{String.valueOf(id)});
        try {
            return c.moveToFirst() ? c.getString(0) : null;
        } finally {
            c.close();
        }
    }

    // La contraseña nunca se guarda en texto plano: se guarda "salt:sha256(salt+clave)".
    private static String hashearConSalt(String clave) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        String saltHex = aHex(salt);
        return saltHex + ":" + sha256Hex(saltHex + clave);
    }

    private static boolean claveCoincide(String clave, String almacenada) {
        int separador = almacenada.indexOf(':');
        if (separador < 0) return false;
        String saltHex = almacenada.substring(0, separador);
        String esperado = almacenada.substring(separador + 1);
        String calculado = sha256Hex(saltHex + clave);
        return MessageDigest.isEqual(
                esperado.getBytes(StandardCharsets.UTF_8),
                calculado.getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256Hex(String texto) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return aHex(md.digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String aHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    // =====================================================================
    // Productos (RF01 / RF02)
    // =====================================================================

    public boolean existeProductoConNombre(String nombre) {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT 1 FROM productos WHERE nombre = ? COLLATE NOCASE", new String[]{nombre});
        try {
            return c.moveToFirst();
        } finally {
            c.close();
        }
    }

    public long insertarProducto(String nombre, String categoria, double precio, String unidad,
                                 double cantidad, double umbralMinimo) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("nombre", nombre);
        cv.put("categoria", categoria);
        cv.put("precio", precio);
        cv.put("unidad", unidad);
        cv.put("cantidad", cantidad);
        cv.put("umbralMinimo", umbralMinimo);
        return db.insert("productos", null, cv);
    }

    public JSONArray obtenerProductos() {
        Cursor c = getReadableDatabase().rawQuery("SELECT * FROM productos ORDER BY nombre ASC", null);
        JSONArray resultado = cursorAJson(c);
        c.close();
        return resultado;
    }

    // RF04: productos por reponer
    public JSONArray obtenerProductosFaltantes() {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT * FROM productos WHERE cantidad <= umbralMinimo ORDER BY cantidad ASC", null);
        JSONArray resultado = cursorAJson(c);
        c.close();
        return resultado;
    }

    // RF06: más vendidos
    public JSONArray obtenerMasVendidos(int limite) {
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT * FROM productos WHERE vecesVendido > 0 ORDER BY vecesVendido DESC LIMIT ?",
                new String[]{String.valueOf(limite)});
        JSONArray resultado = cursorAJson(c);
        c.close();
        return resultado;
    }

    // =====================================================================
    // Ventas (RF05 / RF07)
    // =====================================================================

    /**
     * Registra la venta y descuenta existencias en una sola transacción.
     * Los precios se leen de la base de datos (no se confía en lo que manda la pantalla).
     * Lanza IllegalArgumentException con un mensaje listo para mostrar si algo no es válido.
     *
     * Regresa {ventaId, total, alertas[]}; "alertas" trae los productos que con esta venta
     * quedaron en stock bajo (cruzaron su mínimo) o se agotaron.
     */
    public JSONObject registrarVenta(JSONArray items) throws JSONException {
        // Une las líneas repetidas del mismo producto.
        LinkedHashMap<Long, Double> pedidos = new LinkedHashMap<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            long id = item.getLong("productoId");
            double cantidad = item.getDouble("cantidad");
            if (!(cantidad > 0)) {
                throw new IllegalArgumentException("La cantidad debe ser mayor a cero.");
            }
            Double previa = pedidos.get(id);
            pedidos.put(id, previa == null ? cantidad : previa + cantidad);
        }
        if (pedidos.isEmpty()) {
            throw new IllegalArgumentException("Agrega al menos un producto a la venta.");
        }

        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            double total = 0;
            for (Map.Entry<Long, Double> pedido : pedidos.entrySet()) {
                FilaProducto p = leerProducto(db, pedido.getKey());
                if (p == null) {
                    throw new IllegalArgumentException("Uno de los productos ya no existe. Actualiza la lista.");
                }
                if (pedido.getValue() > p.cantidad + 1e-9) {
                    throw new IllegalArgumentException("No hay suficiente existencia de " + p.nombre +
                            " (disponible: " + formato(p.cantidad) + " " + p.unidad + ").");
                }
                total += p.precio * pedido.getValue();
            }

            ContentValues ventaCv = new ContentValues();
            ventaCv.put("fecha", System.currentTimeMillis());
            ventaCv.put("total", total);
            long ventaId = db.insert("ventas", null, ventaCv);

            JSONArray alertas = new JSONArray();
            for (Map.Entry<Long, Double> pedido : pedidos.entrySet()) {
                long productoId = pedido.getKey();
                double cantidad = pedido.getValue();
                FilaProducto p = leerProducto(db, productoId);
                double despues = Math.round((p.cantidad - cantidad) * 1000.0) / 1000.0;

                ContentValues itemCv = new ContentValues();
                itemCv.put("ventaId", ventaId);
                itemCv.put("productoId", productoId);
                itemCv.put("productoNombre", p.nombre);
                itemCv.put("cantidad", cantidad);
                itemCv.put("subtotal", p.precio * cantidad);
                db.insert("venta_items", null, itemCv);

                // RF07: actualizar existencias y contador de ventas
                db.execSQL("UPDATE productos SET cantidad = ROUND(cantidad - ?, 3), " +
                                "vecesVendido = ROUND(vecesVendido + ?, 3) WHERE id = ?",
                        new Object[]{cantidad, cantidad, productoId});

                boolean cruzoElMinimo = p.cantidad > p.umbral && despues <= p.umbral;
                boolean seAgoto = p.cantidad > 0 && despues <= 1e-9;
                if (cruzoElMinimo || seAgoto) {
                    JSONObject alerta = new JSONObject();
                    alerta.put("id", productoId);
                    alerta.put("nombre", p.nombre);
                    alerta.put("cantidad", despues);
                    alerta.put("unidad", p.unidad);
                    alertas.put(alerta);
                }
            }

            db.setTransactionSuccessful();

            JSONObject resultado = new JSONObject();
            resultado.put("ventaId", ventaId);
            resultado.put("total", total);
            resultado.put("alertas", alertas);
            return resultado;
        } finally {
            db.endTransaction();
        }
    }

    // =====================================================================
    // Entradas de mercancía (RF08)
    // =====================================================================

    /** Regresa el id de la entrada, -2 si el producto no existe o -1 si no se pudo guardar. */
    public long registrarEntrada(long productoId, double cantidad, String proveedor) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            FilaProducto p = leerProducto(db, productoId);
            if (p == null) return -2;

            ContentValues cv = new ContentValues();
            cv.put("productoId", productoId);
            cv.put("productoNombre", p.nombre);
            cv.put("cantidad", cantidad);
            cv.put("proveedor", proveedor);
            cv.put("fecha", System.currentTimeMillis());
            long id = db.insert("entradas", null, cv);

            db.execSQL("UPDATE productos SET cantidad = ROUND(cantidad + ?, 3) WHERE id = ?",
                    new Object[]{cantidad, productoId});

            db.setTransactionSuccessful();
            return id;
        } finally {
            db.endTransaction();
        }
    }

    // =====================================================================
    // Resumen para el dashboard
    // =====================================================================

    public JSONObject obtenerResumenDia() throws JSONException {
        SQLiteDatabase db = getReadableDatabase();
        JSONObject resumen = new JSONObject();

        Cursor cProductos = db.rawQuery("SELECT COUNT(*) FROM productos", null);
        cProductos.moveToFirst();
        resumen.put("productosActivos", cProductos.getInt(0));
        cProductos.close();

        Cursor cFaltantes = db.rawQuery("SELECT COUNT(*) FROM productos WHERE cantidad <= umbralMinimo", null);
        cFaltantes.moveToFirst();
        resumen.put("alertasStock", cFaltantes.getInt(0));
        cFaltantes.close();

        Cursor cVentas = db.rawQuery("SELECT IFNULL(SUM(total), 0) FROM ventas WHERE fecha >= ?",
                new String[]{String.valueOf(inicioDeHoy())});
        cVentas.moveToFirst();
        resumen.put("ventasHoy", cVentas.getDouble(0));
        cVentas.close();

        return resumen;
    }

    private long inicioDeHoy() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        cal.set(java.util.Calendar.MINUTE, 0);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /** 3.0 -> "3", 2.5 -> "2.5" */
    public static String formato(double valor) {
        if (valor == Math.rint(valor)) return String.valueOf((long) valor);
        return String.valueOf(Math.round(valor * 100.0) / 100.0);
    }

    private static class FilaProducto {
        long id;
        String nombre;
        String unidad;
        double precio;
        double cantidad;
        double umbral;
    }

    private FilaProducto leerProducto(SQLiteDatabase db, long id) {
        Cursor c = db.rawQuery(
                "SELECT nombre, unidad, precio, cantidad, umbralMinimo FROM productos WHERE id = ?",
                new String[]{String.valueOf(id)});
        try {
            if (!c.moveToFirst()) return null;
            FilaProducto p = new FilaProducto();
            p.id = id;
            p.nombre = c.getString(0);
            p.unidad = c.getString(1);
            p.precio = c.getDouble(2);
            p.cantidad = c.getDouble(3);
            p.umbral = c.getDouble(4);
            return p;
        } finally {
            c.close();
        }
    }

    private JSONArray cursorAJson(Cursor c) {
        JSONArray resultado = new JSONArray();
        while (c.moveToNext()) {
            try {
                JSONObject fila = new JSONObject();
                fila.put("id", c.getLong(c.getColumnIndexOrThrow("id")));
                fila.put("nombre", c.getString(c.getColumnIndexOrThrow("nombre")));
                fila.put("categoria", c.getString(c.getColumnIndexOrThrow("categoria")));
                fila.put("precio", c.getDouble(c.getColumnIndexOrThrow("precio")));
                fila.put("unidad", c.getString(c.getColumnIndexOrThrow("unidad")));
                fila.put("cantidad", c.getDouble(c.getColumnIndexOrThrow("cantidad")));
                fila.put("umbralMinimo", c.getDouble(c.getColumnIndexOrThrow("umbralMinimo")));
                fila.put("vecesVendido", c.getDouble(c.getColumnIndexOrThrow("vecesVendido")));
                resultado.put(fila);
            } catch (JSONException e) {
                // fila inválida: se omite
            }
        }
        return resultado;
    }
}

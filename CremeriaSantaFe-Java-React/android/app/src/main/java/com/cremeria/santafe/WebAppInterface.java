package com.cremeria.santafe;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Puente entre el WebView (React) y la base de datos nativa (Java/SQLite).
 * Cada método con @JavascriptInterface se llama desde React como window.Android.metodo(...)
 * y siempre regresa un String JSON: { "ok": true, "data": ... } o { "ok": false, "error": "..." }.
 *
 * Los permisos por rol se validan AQUÍ (no solo en la pantalla): aunque alguien manipule la
 * interfaz, un empleado no puede ejecutar acciones de administrador.
 */
public class WebAppInterface {

    private static final String ERR_SESION = "Inicia sesión para continuar.";
    private static final String ERR_PERMISO = "No tienes permiso para realizar esta acción.";

    private final Activity activity;
    private final DatabaseHelper db;
    private final SharedPreferences ajustes;

    // Sesión actual (vive mientras la app esté abierta)
    private String rolActual = null;
    private long idActual = -1;

    // Protección contra adivinar contraseñas
    private int intentosFallidos = 0;
    private long bloqueadoHasta = 0;

    public WebAppInterface(Activity activity) {
        this.activity = activity;
        this.db = new DatabaseHelper(activity);
        this.ajustes = activity.getSharedPreferences("ajustes", Context.MODE_PRIVATE);
    }

    // =====================================================================
    // Sesión
    // =====================================================================

    @JavascriptInterface
    public String login(String usuario, String clave) {
        long ahora = System.currentTimeMillis();
        if (ahora < bloqueadoHasta) {
            return error("Demasiados intentos. Espera " + ((bloqueadoHasta - ahora) / 1000 + 1) + " segundos.");
        }
        if (usuario == null || usuario.trim().isEmpty() || clave == null || clave.isEmpty()) {
            return error("Escribe tu usuario y contraseña.");
        }
        try {
            JSONObject u = db.autenticar(usuario, clave);
            if (u == null) {
                intentosFallidos++;
                if (intentosFallidos >= 5) {
                    bloqueadoHasta = ahora + 30000;
                    intentosFallidos = 0;
                }
                return error("Usuario o contraseña incorrectos.");
            }
            intentosFallidos = 0;
            rolActual = u.getString("rol");
            idActual = u.getLong("id");
            return exito(u);
        } catch (JSONException e) {
            return error("No se pudo iniciar sesión. Intenta de nuevo.");
        }
    }

    @JavascriptInterface
    public String cerrarSesion() {
        rolActual = null;
        idActual = -1;
        return exito(Boolean.TRUE);
    }

    private boolean haySesion() {
        return rolActual != null;
    }

    private boolean esAdmin() {
        return DatabaseHelper.ROL_ADMIN.equals(rolActual);
    }

    /** Regresa un error listo para devolver si NO es administrador; null si puede continuar. */
    private String soloAdmin() {
        if (!haySesion()) return error(ERR_SESION);
        if (!esAdmin()) return error(ERR_PERMISO);
        return null;
    }

    // =====================================================================
    // Categorías
    // =====================================================================

    @JavascriptInterface
    public String obtenerCategorias() {
        if (!haySesion()) return error(ERR_SESION);
        return exito(Categorias.comoJson());
    }

    @JavascriptInterface
    public String categoriaSugerida(String nombre) {
        if (!haySesion()) return error(ERR_SESION);
        return exito(Categorias.sugerida(nombre));
    }

    // =====================================================================
    // Productos / inventario
    // =====================================================================

    /** Lo necesitan tanto el admin como el empleado (para poder vender). */
    @JavascriptInterface
    public String obtenerProductos() {
        if (!haySesion()) return error(ERR_SESION);
        return exito(db.obtenerProductos());
    }

    @JavascriptInterface
    public String obtenerProductosFaltantes() {
        String d = soloAdmin();
        if (d != null) return d;
        return exito(db.obtenerProductosFaltantes());
    }

    @JavascriptInterface
    public String obtenerMasVendidos(int limite) {
        String d = soloAdmin();
        if (d != null) return d;
        return exito(db.obtenerMasVendidos(limite));
    }

    @JavascriptInterface
    public String obtenerResumenDia() {
        String d = soloAdmin();
        if (d != null) return d;
        try {
            return exito(db.obtenerResumenDia());
        } catch (JSONException e) {
            return error("No se pudo calcular el resumen del día.");
        }
    }

    // RF01 / RD06 / RD07 / RD08 — con validación de categoría
    @JavascriptInterface
    public String guardarProducto(String nombre, String categoria, double precio, String unidad,
                                  double cantidad, double umbral) {
        String d = soloAdmin();
        if (d != null) return d;

        String limpio = nombre == null ? "" : nombre.trim().replaceAll("\\s+", " ");
        if (limpio.isEmpty() || limpio.length() > 80) return error("Escribe el nombre del producto (máximo 80 caracteres).");
        if (!(precio > 0)) return error("El precio debe ser mayor a cero.");
        if (!(cantidad >= 0)) return error("La cantidad disponible no puede ser negativa.");
        if (!(umbral >= 0)) return error("El stock mínimo no puede ser negativo.");
        if (!"Kg".equals(unidad) && !"Lt".equals(unidad) && !"Pza".equals(unidad)) return error("Unidad no válida.");

        String errorCategoria = Categorias.validar(limpio, categoria);
        if (errorCategoria != null) return error(errorCategoria);

        if (db.existeProductoConNombre(limpio)) return error("Ya existe un producto con ese nombre.");

        long id = db.insertarProducto(limpio, categoria, precio, unidad, cantidad, umbral);
        if (id == -1) return error("No se pudo guardar el producto. Intenta de nuevo.");
        try {
            JSONObject resultado = new JSONObject();
            resultado.put("id", id);
            return exito(resultado);
        } catch (JSONException e) {
            return error("No se pudo guardar el producto. Intenta de nuevo.");
        }
    }

    // RF08
    @JavascriptInterface
    public String registrarEntrada(long productoId, double cantidad, String proveedor) {
        String d = soloAdmin();
        if (d != null) return d;
        if (!(cantidad > 0)) return error("La cantidad recibida debe ser mayor a cero.");

        long id = db.registrarEntrada(productoId, cantidad, proveedor == null ? "" : proveedor.trim());
        if (id == -2) return error("Selecciona un producto.");
        if (id == -1) return error("No se pudo registrar la entrada de mercancía.");
        try {
            JSONObject resultado = new JSONObject();
            resultado.put("id", id);
            return exito(resultado);
        } catch (JSONException e) {
            return error("No se pudo registrar la entrada de mercancía.");
        }
    }

    // =====================================================================
    // Ventas (admin y empleado)
    // =====================================================================

    // RF05 / RF07 — si la venta deja un producto en stock bajo, se lanza la notificación
    @JavascriptInterface
    public String registrarVenta(String itemsJson) {
        if (!haySesion()) return error(ERR_SESION);
        try {
            JSONObject resultado = db.registrarVenta(new JSONArray(itemsJson));
            JSONArray alertas = resultado.getJSONArray("alertas");
            if (alertas.length() > 0 && ajustes.getBoolean("notificaciones", true)) {
                Notificador.notificarStockBajo(activity, alertas, intentWhatsApp(mensajeStockBajo(alertas)));
            }
            return exito(resultado);
        } catch (IllegalArgumentException e) {
            return error(e.getMessage());
        } catch (JSONException e) {
            return error("No se pudo completar la operación. Verifica los campos marcados e intenta de nuevo.");
        }
    }

    // =====================================================================
    // Alertas por WhatsApp
    // =====================================================================

    /**
     * Abre WhatsApp con el aviso de stock bajo ya escrito, dirigido al número del dueño.
     * WhatsApp no permite enviar mensajes en automático desde una app: la persona solo
     * tiene que tocar "Enviar".
     */
    @JavascriptInterface
    public String avisarStockBajoWhatsApp() {
        if (!haySesion()) return error(ERR_SESION);
        JSONArray faltantes = db.obtenerProductosFaltantes();
        if (faltantes.length() == 0) return error("No hay productos con stock bajo por ahora.");

        Intent intent = intentWhatsApp(mensajeStockBajo(faltantes));
        if (intent == null) {
            return error("Aún no hay un número de WhatsApp configurado. Pídele al administrador que lo agregue en Ajustes.");
        }
        abrir(intent);
        return exito(Boolean.TRUE);
    }

    private String mensajeStockBajo(JSONArray productos) {
        StringBuilder sb = new StringBuilder("Cremería Santa Fe - Aviso de stock bajo:\n");
        for (int i = 0; i < productos.length(); i++) {
            JSONObject p = productos.optJSONObject(i);
            if (p == null) continue;
            sb.append("- ").append(p.optString("nombre"))
                    .append(": quedan ").append(DatabaseHelper.formato(p.optDouble("cantidad")))
                    .append(" ").append(p.optString("unidad")).append("\n");
        }
        sb.append("Favor de reponer.");
        return sb.toString();
    }

    /** null si todavía no hay número configurado. */
    private Intent intentWhatsApp(String mensaje) {
        String numero = ajustes.getString("whatsappNumero", "");
        if (numero.isEmpty()) return null;
        Uri uri = Uri.parse("https://wa.me/" + numero + "?text=" + Uri.encode(mensaje));
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return intent;
    }

    private void abrir(final Intent intent) {
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(activity, "No se pudo abrir WhatsApp en este teléfono.", Toast.LENGTH_LONG).show();
            }
        });
    }

    // =====================================================================
    // Ajustes (solo administrador)
    // =====================================================================

    @JavascriptInterface
    public String obtenerAjustes() {
        String d = soloAdmin();
        if (d != null) return d;
        try {
            JSONObject a = new JSONObject();
            a.put("whatsappNumero", ajustes.getString("whatsappNumero", ""));
            a.put("notificaciones", ajustes.getBoolean("notificaciones", true));
            a.put("claveAdminPorDefecto", db.adminUsaClavePorDefecto());
            return exito(a);
        } catch (JSONException e) {
            return error("No se pudieron cargar los ajustes.");
        }
    }

    @JavascriptInterface
    public String guardarAjustes(String whatsappNumero, boolean notificaciones) {
        String d = soloAdmin();
        if (d != null) return d;

        String digitos = whatsappNumero == null ? "" : whatsappNumero.replaceAll("[^0-9]", "");
        if (digitos.length() == 10) digitos = "52" + digitos; // número de México sin lada de país
        if (!digitos.isEmpty() && (digitos.length() < 11 || digitos.length() > 15)) {
            return error("Número de WhatsApp inválido. Escribe 10 dígitos (ej. 33 1234 5678) o el número con código de país.");
        }
        ajustes.edit()
                .putString("whatsappNumero", digitos)
                .putBoolean("notificaciones", notificaciones)
                .apply();
        return exito(Boolean.TRUE);
    }

    // =====================================================================
    // Usuarios (solo administrador)
    // =====================================================================

    @JavascriptInterface
    public String listarUsuarios() {
        String d = soloAdmin();
        if (d != null) return d;
        try {
            return exito(db.listarUsuarios());
        } catch (JSONException e) {
            return error("No se pudieron cargar los usuarios.");
        }
    }

    @JavascriptInterface
    public String crearUsuario(String usuario, String clave, String rol) {
        String d = soloAdmin();
        if (d != null) return d;

        String nombre = usuario == null ? "" : usuario.trim();
        if (!nombre.matches("[A-Za-z0-9._@-]{3,30}")) {
            return error("El usuario debe tener de 3 a 30 caracteres (letras, números, punto, guion o @).");
        }
        if (clave == null || clave.length() < 6) return error("La contraseña debe tener al menos 6 caracteres.");
        if (!DatabaseHelper.ROL_ADMIN.equals(rol) && !DatabaseHelper.ROL_EMPLEADO.equals(rol)) return error("Rol no válido.");

        long id = db.crearUsuario(nombre, clave, rol);
        if (id == -1) return error("Ese nombre de usuario ya existe.");
        return exito(Boolean.TRUE);
    }

    @JavascriptInterface
    public String eliminarUsuario(long id) {
        String d = soloAdmin();
        if (d != null) return d;
        if (id == idActual) return error("No puedes eliminar tu propio usuario.");
        if (DatabaseHelper.ROL_ADMIN.equals(db.rolDe(id)) && db.contarAdmins() <= 1) {
            return error("Debe quedar al menos un administrador.");
        }
        if (db.eliminarUsuario(id) == 0) return error("El usuario ya no existe.");
        return exito(Boolean.TRUE);
    }

    @JavascriptInterface
    public String cambiarContrasena(long id, String nueva) {
        String d = soloAdmin();
        if (d != null) return d;
        if (nueva == null || nueva.length() < 6) return error("La contraseña debe tener al menos 6 caracteres.");
        if (db.cambiarContrasena(id, nueva) == 0) return error("El usuario ya no existe.");
        return exito(Boolean.TRUE);
    }

    // =====================================================================
    // Respuestas JSON
    // =====================================================================

    private String exito(Object data) {
        try {
            JSONObject respuesta = new JSONObject();
            respuesta.put("ok", true);
            respuesta.put("data", data);
            return respuesta.toString();
        } catch (JSONException e) {
            return error("Error inesperado.");
        }
    }

    private String error(String mensaje) {
        try {
            JSONObject respuesta = new JSONObject();
            respuesta.put("ok", false);
            respuesta.put("error", mensaje);
            return respuesta.toString();
        } catch (JSONException e) {
            return "{\"ok\":false,\"error\":\"Error inesperado.\"}";
        }
    }
}

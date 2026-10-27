package com.cremeria.santafe;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;

/**
 * Puente Java <-> React para lo que SOLO el teléfono puede hacer.
 *
 * Los datos (productos, ventas, usuarios...) ya NO pasan por aquí: React los pide a la API REST
 * (Flask) con fetch(). Desde React se llama como window.Android.metodo(...).
 */
public class WebAppInterface {

    // Solo se permite abrir enlaces de WhatsApp; la página no puede lanzar otros intents.
    private static final String PREFIJO_WHATSAPP = "https://wa.me/";

    private final Activity activity;

    public WebAppInterface(Activity activity) {
        this.activity = activity;
    }

    /** Abre WhatsApp con el chat y el mensaje ya escritos; la persona solo toca "Enviar". */
    @JavascriptInterface
    public void abrirWhatsApp(String url) {
        final Intent intent = intentWhatsApp(url);
        if (intent == null) return;
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(activity, "No se pudo abrir WhatsApp en este teléfono.", Toast.LENGTH_LONG).show();
            }
        });
    }

    /**
     * Muestra la notificación "Stock bajo".
     *
     * @param alertasJson arreglo JSON con {nombre, cantidad, unidad} por producto
     * @param whatsappUrl enlace wa.me opcional: agrega el botón "Avisar por WhatsApp" a la notificación
     */
    @JavascriptInterface
    public void notificarStockBajo(String alertasJson, String whatsappUrl) {
        try {
            JSONArray alertas = new JSONArray(alertasJson);
            Notificador.notificarStockBajo(activity, alertas, intentWhatsApp(whatsappUrl));
        } catch (JSONException e) {
            // datos inválidos: simplemente no se notifica
        }
    }

    /** null si el enlace no es de WhatsApp. */
    private Intent intentWhatsApp(String url) {
        if (url == null || !url.startsWith(PREFIJO_WHATSAPP)) return null;
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return intent;
    }
}

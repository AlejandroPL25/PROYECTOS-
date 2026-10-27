package com.cremeria.santafe;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/** Notificaciones del sistema para avisar de productos con stock bajo. */
public final class Notificador {

    private static final String CANAL_ID = "stock_bajo";
    private static final int NOTIFICACION_ID = 1001; // fija: una nueva reemplaza a la anterior

    private Notificador() {}

    /** 3.0 -> "3", 2.5 -> "2.5" */
    private static String formato(double valor) {
        if (valor == Math.rint(valor)) return String.valueOf((long) valor);
        return String.valueOf(Math.round(valor * 100.0) / 100.0);
    }

    public static void crearCanal(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel canal = new NotificationChannel(
                    CANAL_ID, "Alertas de stock bajo", NotificationManager.IMPORTANCE_HIGH);
            canal.setDescription("Avisa cuando un producto se está acabando");
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(canal);
        }
    }

    /**
     * @param alertas  productos con {nombre, cantidad, unidad}
     * @param whatsapp intent opcional que abre WhatsApp con el aviso ya escrito (botón de la notificación)
     */
    public static void notificarStockBajo(Context ctx, JSONArray alertas, Intent whatsapp) {
        if (alertas.length() == 0) return;
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(
                ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return; // el usuario no concedió el permiso de notificaciones
        }

        NotificationCompat.InboxStyle estilo = new NotificationCompat.InboxStyle();
        for (int i = 0; i < alertas.length(); i++) {
            JSONObject a = alertas.optJSONObject(i);
            if (a == null) continue;
            estilo.addLine(a.optString("nombre") + ": quedan " +
                    formato(a.optDouble("cantidad")) + " " + a.optString("unidad"));
        }

        String titulo = alertas.length() == 1
                ? "Stock bajo: 1 producto"
                : "Stock bajo: " + alertas.length() + " productos";

        Intent abrirApp = new Intent(ctx, MainActivity.class);
        abrirApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CANAL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle(titulo)
                .setContentText("Toca para abrir la app")
                .setStyle(estilo)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(ctx, 0, abrirApp, flags));

        if (whatsapp != null) {
            builder.addAction(0, "Avisar por WhatsApp", PendingIntent.getActivity(ctx, 1, whatsapp, flags));
        }

        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICACION_ID, builder.build());
        } catch (SecurityException ignorada) {
            // sin permiso de notificaciones: la alerta igual se muestra dentro de la app
        }
    }
}

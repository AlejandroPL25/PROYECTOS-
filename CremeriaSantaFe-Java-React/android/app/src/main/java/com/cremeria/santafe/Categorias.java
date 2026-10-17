package com.cremeria.santafe;

import org.json.JSONArray;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Categorías de productos y reglas para que un producto no quede en la categoría equivocada.
 *
 * Para agregar una categoría o palabra clave, edita SOLO el bloque static de abajo.
 * Las palabras clave van en minúsculas, sin acentos y en singular
 * (se reconocen automáticamente el plural "s" y "es": queso -> quesos, pan -> panes).
 */
public final class Categorias {

    private static final LinkedHashMap<String, String[]> REGLAS = new LinkedHashMap<>();

    static {
        REGLAS.put("Lácteos y Quesos", new String[]{
                "leche", "queso", "crema", "yogur", "yogurt", "mantequilla", "requeson", "panela",
                "oaxaca", "cotija", "manchego", "asadero", "quesillo", "nata", "jocoque", "ricota"});
        REGLAS.put("Embutidos", new String[]{
                "jamon", "chorizo", "salchicha", "salchichon", "tocino", "salami", "mortadela",
                "longaniza", "pepperoni", "peperoni"});
        REGLAS.put("Huevo", new String[]{"huevo", "blanquillo"});
        REGLAS.put("Abarrotes", new String[]{
                "arroz", "frijol", "aceite", "azucar", "sal", "harina", "lenteja", "atun", "pasta", "cafe"});
        REGLAS.put("Bebidas", new String[]{"refresco", "jugo", "agua", "horchata", "atole", "cerveza"});
        REGLAS.put("Botanas y Dulces", new String[]{
                "papa", "frituras", "cacahuate", "dulce", "chocolate", "galleta", "cajeta",
                "gelatina", "palomitas", "chicharron"});
        REGLAS.put("Pan y Tortillas", new String[]{"pan", "tortilla", "bolillo", "telera", "concha"});
        // Sin palabras clave: acepta cualquier producto que no coincida con otra categoría.
        REGLAS.put("Otros", new String[]{});
    }

    private Categorias() {}

    public static List<String> lista() {
        return new ArrayList<>(REGLAS.keySet());
    }

    public static JSONArray comoJson() {
        JSONArray arreglo = new JSONArray();
        for (String categoria : REGLAS.keySet()) arreglo.put(categoria);
        return arreglo;
    }

    /** Categorías a las que, por su nombre, podría pertenecer el producto (puede ser más de una o ninguna). */
    public static List<String> sugeridas(String nombre) {
        List<String> resultado = new ArrayList<>();
        if (nombre == null) return resultado;
        String[] palabras = normalizar(nombre).split("[^a-z0-9]+");
        for (Map.Entry<String, String[]> regla : REGLAS.entrySet()) {
            if (coincide(palabras, regla.getValue())) resultado.add(regla.getKey());
        }
        return resultado;
    }

    /** Primera categoría sugerida, o cadena vacía si el nombre no coincide con ninguna regla. */
    public static String sugerida(String nombre) {
        List<String> sugeridas = sugeridas(nombre);
        return sugeridas.isEmpty() ? "" : sugeridas.get(0);
    }

    /** Regresa un mensaje de error si la categoría no corresponde al producto; null si todo está bien. */
    public static String validar(String nombre, String categoria) {
        if (categoria == null || !REGLAS.containsKey(categoria)) {
            return "Selecciona una categoría válida.";
        }
        List<String> sugeridas = sugeridas(nombre);
        if (!sugeridas.isEmpty() && !sugeridas.contains(categoria)) {
            return "«" + nombre.trim() + "» pertenece a " + unir(sugeridas) + ", no a " + categoria + ".";
        }
        return null;
    }

    private static boolean coincide(String[] palabras, String[] claves) {
        for (String clave : claves) {
            for (String palabra : palabras) {
                if (palabra.equals(clave) || palabra.equals(clave + "s") || palabra.equals(clave + "es")) {
                    return true;
                }
            }
        }
        return false;
    }

    private static String normalizar(String texto) {
        String sinAcentos = Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return sinAcentos.toLowerCase(Locale.ROOT);
    }

    private static String unir(List<String> categorias) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < categorias.size(); i++) {
            if (i > 0) sb.append(" o ");
            sb.append(categorias.get(i));
        }
        return sb.toString();
    }
}

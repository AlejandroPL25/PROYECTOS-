"""Categorías de productos y reglas para que un producto no quede en la categoría equivocada.

Para agregar una categoría o palabra clave edita SOLO el diccionario REGLAS.
Las palabras clave van en minúsculas, sin acentos y en singular
(se reconocen también el plural "s" y "es": queso -> quesos, pan -> panes).
"""
import re
import unicodedata

REGLAS = {
    "Lácteos y Quesos": [
        "leche", "queso", "crema", "yogur", "yogurt", "mantequilla", "requeson", "panela",
        "oaxaca", "cotija", "manchego", "asadero", "quesillo", "nata", "jocoque", "ricota"],
    "Embutidos": [
        "jamon", "chorizo", "salchicha", "salchichon", "tocino", "salami", "mortadela",
        "longaniza", "pepperoni", "peperoni"],
    "Huevo": ["huevo", "blanquillo"],
    "Abarrotes": ["arroz", "frijol", "aceite", "azucar", "sal", "harina", "lenteja", "atun", "pasta", "cafe"],
    "Bebidas": ["refresco", "jugo", "agua", "horchata", "atole", "cerveza"],
    "Botanas y Dulces": [
        "papa", "frituras", "cacahuate", "dulce", "chocolate", "galleta", "cajeta",
        "gelatina", "palomitas", "chicharron"],
    "Pan y Tortillas": ["pan", "tortilla", "bolillo", "telera", "concha"],
    # Sin palabras clave: acepta cualquier producto que no coincida con otra categoría.
    "Otros": [],
}

CATEGORIAS = list(REGLAS)


def _normalizar(texto):
    sin_acentos = "".join(c for c in unicodedata.normalize("NFD", texto or "") if unicodedata.category(c) != "Mn")
    return sin_acentos.lower()


def sugeridas(nombre):
    """Categorías a las que, por su nombre, podría pertenecer el producto (0, 1 o varias)."""
    palabras = [p for p in re.split(r"[^a-z0-9]+", _normalizar(nombre)) if p]
    resultado = []
    for categoria, claves in REGLAS.items():
        if any(p in (k, k + "s", k + "es") for k in claves for p in palabras):
            resultado.append(categoria)
    return resultado


def sugerida(nombre):
    s = sugeridas(nombre)
    return s[0] if s else ""


def validar(nombre, categoria):
    """Mensaje de error si la categoría no corresponde al producto; None si todo está bien."""
    if categoria not in REGLAS:
        return "Selecciona una categoría válida."
    s = sugeridas(nombre)
    if s and categoria not in s:
        return f"«{(nombre or '').strip()}» pertenece a {' o '.join(s)}, no a {categoria}."
    return None

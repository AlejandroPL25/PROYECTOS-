"""Carga productos de ejemplo (los del mockup) para demos y capturas. Solo si no hay productos."""
import app

PRODUCTOS = [
    ("Queso Oaxaca Especial", "Lácteos y Quesos", 145, "Kg", 45, 5),
    ("Crema de Rancho Natural", "Lácteos y Quesos", 95, "Lt", 6, 5),
    ("Jamón Virginia de Pavo", "Embutidos", 120, "Kg", 1.5, 5),
    ("Queso Cotija Añejo", "Lácteos y Quesos", 180, "Kg", 34, 5),
    ("Queso Panela Familiar", "Lácteos y Quesos", 90, "Kg", 0, 5),
    ("Chorizo Casero Especial", "Embutidos", 110, "Kg", 4, 5),
    ("Queso Manchego Maduro", "Lácteos y Quesos", 160, "Kg", 24, 5),
    ("Huevo Blanco (cartón)", "Huevo", 62, "Pza", 30, 6),
    ("Yogurt Natural de la Casa", "Lácteos y Quesos", 38, "Pza", 48, 8),
]

if __name__ == "__main__":
    con = app._conectar()
    if con.execute("SELECT COUNT(*) FROM productos").fetchone()[0] == 0:
        con.executemany("INSERT INTO productos (nombre, categoria, precio, unidad, cantidad, umbralMinimo) "
                        "VALUES (?,?,?,?,?,?)", PRODUCTOS)
        print(f"Se cargaron {len(PRODUCTOS)} productos de ejemplo.")
    else:
        print("Ya hay productos; no se cargó nada.")
    con.close()

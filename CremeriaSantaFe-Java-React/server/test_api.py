"""Pruebas automáticas de la API.  Ejecutar:  python -m unittest -v test_api"""
import os
import tempfile
import time
import unittest

_TMP = tempfile.mkdtemp()
os.environ["CREMERIA_DB"] = os.path.join(_TMP, "base.db")
os.environ["CREMERIA_SECRET_FILE"] = os.path.join(_TMP, "secreto")
import app as servidor  # noqa: E402


class Base(unittest.TestCase):
    def setUp(self):
        servidor.app.config["DB_PATH"] = os.path.join(_TMP, self.id().split(".")[-1] + ".db")
        servidor.inicializar_db()
        servidor._intentos.clear()
        self.c = servidor.app.test_client()
        self.admin = self.cabecera("admin", "admin123")
        self.empleado = self.cabecera("empleado", "empleado123")

    def cabecera(self, usuario, clave):
        r = self.c.post("/api/login", json={"usuario": usuario, "clave": clave})
        return {"Authorization": "Bearer " + r.get_json()["data"]["token"]}

    def producto(self, nombre="Queso Oaxaca", categoria="Lácteos y Quesos", precio=100, unidad="Kg", cantidad=10, umbral=5):
        r = self.c.post("/api/productos", headers=self.admin, json=dict(
            nombre=nombre, categoria=categoria, precio=precio, unidad=unidad, cantidad=cantidad, umbral=umbral))
        self.assertEqual(r.status_code, 201, r.get_json())
        return r.get_json()["data"]["id"]

    def vender(self, items, headers=None):
        return self.c.post("/api/ventas", headers=headers or self.empleado, json={"items": items})

    def existencia(self, pid):
        return next(p["cantidad"] for p in self.c.get("/api/productos", headers=self.admin).get_json()["data"] if p["id"] == pid)


class Sesion(Base):
    def test_salud_no_requiere_sesion(self):
        r = self.c.get("/api/salud")
        self.assertEqual((r.status_code, r.get_json()["data"]["estado"]), (200, "ok"))

    def test_login_correcto_devuelve_token_y_rol(self):
        d = self.c.post("/api/login", json={"usuario": "empleado", "clave": "empleado123"}).get_json()["data"]
        self.assertEqual(d["usuario"]["rol"], "empleado")
        self.assertTrue(d["token"])

    def test_login_incorrecto_da_401(self):
        r = self.c.post("/api/login", json={"usuario": "admin", "clave": "mal"})
        self.assertEqual((r.status_code, r.get_json()["error"]), (401, "Usuario o contraseña incorrectos."))

    def test_login_vacio_da_400(self):
        self.assertEqual(self.c.post("/api/login", json={}).status_code, 400)

    def test_login_se_bloquea_tras_5_fallos(self):
        for _ in range(5):
            self.c.post("/api/login", json={"usuario": "admin", "clave": "mal"})
        r = self.c.post("/api/login", json={"usuario": "admin", "clave": "admin123"})
        self.assertEqual(r.status_code, 429)

    def test_sin_token_da_401(self):
        self.assertEqual(self.c.get("/api/productos").status_code, 401)

    def test_token_alterado_da_401(self):
        r = self.c.get("/api/productos", headers={"Authorization": "Bearer abc.def.ghi"})
        self.assertEqual(r.status_code, 401)

    def test_token_de_usuario_eliminado_deja_de_servir(self):
        self.c.post("/api/usuarios", headers=self.admin, json={"usuario": "maria", "clave": "secreto1", "rol": "empleado"})
        h = self.cabecera("maria", "secreto1")
        self.assertEqual(self.c.get("/api/productos", headers=h).status_code, 200)
        mid = next(u["id"] for u in self.c.get("/api/usuarios", headers=self.admin).get_json()["data"] if u["usuario"] == "maria")
        self.c.delete(f"/api/usuarios/{mid}", headers=self.admin)
        self.assertEqual(self.c.get("/api/productos", headers=h).status_code, 401)


class Roles(Base):
    def test_empleado_no_puede_crear_productos(self):
        r = self.c.post("/api/productos", headers=self.empleado, json=dict(
            nombre="Leche", categoria="Lácteos y Quesos", precio=20, unidad="Lt", cantidad=5, umbral=2))
        self.assertEqual(r.status_code, 403)

    def test_empleado_no_accede_a_nada_de_administracion(self):
        for metodo, ruta in [("get", "/api/ajustes"), ("put", "/api/ajustes"), ("get", "/api/usuarios"),
                             ("post", "/api/usuarios"), ("get", "/api/resumen"), ("get", "/api/productos/faltantes"),
                             ("get", "/api/productos/mas-vendidos"), ("post", "/api/entradas")]:
            r = getattr(self.c, metodo)(ruta, headers=self.empleado, json={})
            self.assertEqual(r.status_code, 403, f"{metodo.upper()} {ruta}")

    def test_empleado_si_lista_productos_y_vende(self):
        pid = self.producto()
        self.assertEqual(self.c.get("/api/productos", headers=self.empleado).status_code, 200)
        self.assertEqual(self.vender([{"productoId": pid, "cantidad": 1}]).status_code, 201)

    def test_admin_accede_a_todo(self):
        for ruta in ["/api/ajustes", "/api/usuarios", "/api/resumen", "/api/productos/faltantes", "/api/productos/mas-vendidos"]:
            self.assertEqual(self.c.get(ruta, headers=self.admin).status_code, 200, ruta)


class Categorias(Base):
    def test_leche_en_embutidos_se_rechaza(self):
        r = self.c.post("/api/productos", headers=self.admin, json=dict(
            nombre="Leche entera", categoria="Embutidos", precio=20, unidad="Lt", cantidad=5, umbral=2))
        self.assertEqual(r.status_code, 400)
        self.assertIn("pertenece a Lácteos y Quesos", r.get_json()["error"])

    def test_leche_en_lacteos_se_acepta(self):
        self.producto("Leche entera", "Lácteos y Quesos", 20, "Lt")

    def test_panela_no_se_confunde_con_pan(self):
        r = self.c.post("/api/productos", headers=self.admin, json=dict(
            nombre="Panela", categoria="Pan y Tortillas", precio=20, unidad="Kg", cantidad=5, umbral=2))
        self.assertEqual(r.status_code, 400)

    def test_nombre_sin_regla_acepta_otros(self):
        self.producto("Servilletas", "Otros", 15, "Pza")

    def test_categoria_inventada_se_rechaza(self):
        r = self.c.post("/api/productos", headers=self.admin, json=dict(
            nombre="Servilletas", categoria="Inventada", precio=15, unidad="Pza", cantidad=5, umbral=2))
        self.assertEqual(r.status_code, 400)

    def test_endpoint_de_categoria_sugerida(self):
        d = self.c.get("/api/categorias/sugerida?nombre=Jamón de pavo", headers=self.admin).get_json()["data"]
        self.assertEqual(d, "Embutidos")

    def test_hay_8_categorias(self):
        self.assertEqual(len(self.c.get("/api/categorias", headers=self.admin).get_json()["data"]), 8)


class Productos(Base):
    def test_nombre_duplicado_da_409_sin_importar_mayusculas(self):
        self.producto("Queso Oaxaca")
        r = self.c.post("/api/productos", headers=self.admin, json=dict(
            nombre="queso oaxaca", categoria="Lácteos y Quesos", precio=10, unidad="Kg", cantidad=1, umbral=1))
        self.assertEqual(r.status_code, 409)

    def test_validaciones_numericas(self):
        base = dict(nombre="Crema", categoria="Lácteos y Quesos", precio=10, unidad="Lt", cantidad=1, umbral=1)
        for cambio in [{"precio": 0}, {"precio": None}, {"precio": "abc"}, {"cantidad": -1}, {"umbral": -1}, {"unidad": "Ton"}, {"nombre": "  "}]:
            r = self.c.post("/api/productos", headers=self.admin, json={**base, **cambio})
            self.assertEqual(r.status_code, 400, cambio)

    def test_resumen_cuenta_alertas(self):
        self.producto("Queso A", cantidad=10)
        self.producto("Queso B", cantidad=2)
        d = self.c.get("/api/resumen", headers=self.admin).get_json()["data"]
        self.assertEqual((d["productosActivos"], d["alertasStock"]), (2, 1))


class Ventas(Base):
    def test_venta_descuenta_existencias_y_calcula_total(self):
        pid = self.producto(precio=100, cantidad=10)
        d = self.vender([{"productoId": pid, "cantidad": 2.5}]).get_json()["data"]
        self.assertEqual((d["total"], self.existencia(pid)), (250, 7.5))

    def test_venta_mayor_a_la_existencia_se_rechaza_sin_cambiar_nada(self):
        pid = self.producto(cantidad=3)
        r = self.vender([{"productoId": pid, "cantidad": 4}])
        self.assertEqual(r.status_code, 400)
        self.assertIn("No hay suficiente existencia", r.get_json()["error"])
        self.assertEqual(self.existencia(pid), 3)

    def test_venta_es_atomica_si_una_linea_falla(self):
        a, b = self.producto("Queso A", cantidad=10), self.producto("Queso B", cantidad=1)
        r = self.vender([{"productoId": a, "cantidad": 2}, {"productoId": b, "cantidad": 5}])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.existencia(a), 10)

    def test_el_precio_lo_toma_la_base_no_la_app(self):
        pid = self.producto(precio=100, cantidad=10)
        d = self.vender([{"productoId": pid, "cantidad": 1, "precio": 1}]).get_json()["data"]
        self.assertEqual(d["total"], 100)

    def test_lineas_repetidas_se_unen(self):
        pid = self.producto(cantidad=10)
        self.vender([{"productoId": pid, "cantidad": 2}, {"productoId": pid, "cantidad": 3}])
        self.assertEqual(self.existencia(pid), 5)

    def test_venta_sin_items_o_cantidad_cero_se_rechaza(self):
        pid = self.producto()
        self.assertEqual(self.vender([]).status_code, 400)
        self.assertEqual(self.vender([{"productoId": pid, "cantidad": 0}]).status_code, 400)
        self.assertEqual(self.vender([{"productoId": 9999, "cantidad": 1}]).status_code, 400)

    def test_alerta_cuando_la_venta_cruza_el_minimo(self):
        pid = self.producto(cantidad=6, umbral=5)
        d = self.vender([{"productoId": pid, "cantidad": 2}]).get_json()["data"]
        self.assertEqual([a["id"] for a in d["alertas"]], [pid])
        self.assertEqual(d["alertas"][0]["cantidad"], 4)

    def test_no_hay_alerta_si_sigue_arriba_del_minimo(self):
        pid = self.producto(cantidad=20, umbral=5)
        self.assertEqual(self.vender([{"productoId": pid, "cantidad": 1}]).get_json()["data"]["alertas"], [])

    def test_no_repite_alerta_si_ya_estaba_bajo_pero_si_al_agotarse(self):
        pid = self.producto(cantidad=4, umbral=5)
        self.assertEqual(self.vender([{"productoId": pid, "cantidad": 1}]).get_json()["data"]["alertas"], [])
        d = self.vender([{"productoId": pid, "cantidad": 3}]).get_json()["data"]
        self.assertEqual(len(d["alertas"]), 1)  # se agotó
        self.assertEqual(d["alertas"][0]["cantidad"], 0)


class Alertas(Base):
    def _configurar(self, numero="33 1234 5678", notif=True):
        return self.c.put("/api/ajustes", headers=self.admin, json={"whatsappNumero": numero, "notificaciones": notif})

    def test_whatsapp_sin_stock_bajo_da_error(self):
        self.producto(cantidad=50)
        self._configurar()
        self.assertEqual(self.c.post("/api/alertas/whatsapp", headers=self.empleado).status_code, 400)

    def test_whatsapp_sin_numero_configurado_da_error(self):
        self.producto(cantidad=1)
        r = self.c.post("/api/alertas/whatsapp", headers=self.empleado)
        self.assertIn("número de WhatsApp", r.get_json()["error"])

    def test_whatsapp_devuelve_enlace_con_numero_y_mensaje(self):
        self.producto("Crema Rancho", "Lácteos y Quesos", cantidad=2)
        self._configurar()
        url = self.c.post("/api/alertas/whatsapp", headers=self.empleado).get_json()["data"]["url"]
        self.assertTrue(url.startswith("https://wa.me/523312345678?text="))
        self.assertIn("Crema%20Rancho", url)

    def test_la_venta_trae_enlace_y_bandera_de_notificaciones(self):
        pid = self.producto(cantidad=6, umbral=5)
        self._configurar(notif=False)
        d = self.vender([{"productoId": pid, "cantidad": 2}]).get_json()["data"]
        self.assertTrue(d["whatsappUrl"].startswith("https://wa.me/52"))
        self.assertFalse(d["notificaciones"])

    def test_numero_invalido_se_rechaza(self):
        self.assertEqual(self._configurar("123").status_code, 400)

    def test_numero_vacio_desactiva_whatsapp(self):
        self.assertEqual(self._configurar("").status_code, 200)
        self.assertEqual(self.c.get("/api/ajustes", headers=self.admin).get_json()["data"]["whatsappNumero"], "")


class Entradas(Base):
    def test_entrada_suma_existencias(self):
        pid = self.producto(cantidad=2)
        r = self.c.post("/api/entradas", headers=self.admin, json={"productoId": pid, "cantidad": 50, "proveedor": "Lácteos del Valle"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.existencia(pid), 52)

    def test_entrada_valida_producto_y_cantidad(self):
        pid = self.producto()
        self.assertEqual(self.c.post("/api/entradas", headers=self.admin, json={"productoId": pid, "cantidad": 0}).status_code, 400)
        self.assertEqual(self.c.post("/api/entradas", headers=self.admin, json={"productoId": 999, "cantidad": 5}).status_code, 400)
        self.assertEqual(self.c.post("/api/entradas", headers=self.admin, json={"cantidad": 5}).status_code, 400)


class Reportes(Base):
    def test_mas_vendidos_filtra_por_periodo(self):
        pid = self.producto("Queso Reporte", cantidad=100)
        self.vender([{"productoId": pid, "cantidad": 2}])  # ahora
        con = servidor._conectar()
        for dias, cant in [(3, 10), (40, 99)]:  # hace 3 días y hace 40 días
            fecha = int((time.time() - dias * 86400) * 1000)
            vid = con.execute("INSERT INTO ventas (fecha, total) VALUES (?, 0)", (fecha,)).lastrowid
            con.execute("INSERT INTO venta_items (ventaId, productoId, productoNombre, cantidad, subtotal) VALUES (?,?,?,?,0)",
                        (vid, pid, "Queso Reporte", cant))
        con.close()

        def vendido(periodo):
            filas = self.c.get(f"/api/productos/mas-vendidos?periodo={periodo}", headers=self.admin).get_json()["data"]
            return filas[0]["vecesVendido"] if filas else 0

        self.assertEqual(vendido("hoy"), 2)
        self.assertEqual(vendido("semana"), 12)   # hoy + hace 3 días; la de hace 40 días no entra
        self.assertEqual(self.c.get("/api/productos/mas-vendidos?periodo=siglo", headers=self.admin).status_code, 400)

    def test_ranking_ordenado_de_mayor_a_menor(self):
        a, b = self.producto("Queso A", cantidad=50), self.producto("Queso B", cantidad=50)
        self.vender([{"productoId": a, "cantidad": 1}, {"productoId": b, "cantidad": 5}])
        nombres = [p["nombre"] for p in self.c.get("/api/productos/mas-vendidos?periodo=hoy", headers=self.admin).get_json()["data"]]
        self.assertEqual(nombres, ["Queso B", "Queso A"])

    def test_ventas_de_hoy_en_el_resumen(self):
        pid = self.producto(precio=50, cantidad=10)
        self.vender([{"productoId": pid, "cantidad": 2}])
        self.assertEqual(self.c.get("/api/resumen", headers=self.admin).get_json()["data"]["ventasHoy"], 100)


class Usuarios(Base):
    def test_crear_y_usar_un_usuario_nuevo(self):
        r = self.c.post("/api/usuarios", headers=self.admin, json={"usuario": "maria", "clave": "secreto1", "rol": "empleado"})
        self.assertEqual(r.status_code, 201)
        self.assertTrue(self.cabecera("maria", "secreto1"))

    def test_validaciones_de_usuario(self):
        for cuerpo in [{"usuario": "ab", "clave": "secreto1", "rol": "empleado"},
                       {"usuario": "maria", "clave": "123", "rol": "empleado"},
                       {"usuario": "maria", "clave": "secreto1", "rol": "dueño"}]:
            self.assertEqual(self.c.post("/api/usuarios", headers=self.admin, json=cuerpo).status_code, 400, cuerpo)
        self.assertEqual(self.c.post("/api/usuarios", headers=self.admin,
                                     json={"usuario": "EMPLEADO", "clave": "secreto1", "rol": "empleado"}).status_code, 409)

    def test_no_puede_eliminarse_a_si_mismo_ni_al_ultimo_admin(self):
        usuarios = self.c.get("/api/usuarios", headers=self.admin).get_json()["data"]
        admin_id = next(u["id"] for u in usuarios if u["usuario"] == "admin")
        self.assertEqual(self.c.delete(f"/api/usuarios/{admin_id}", headers=self.admin).status_code, 400)

    def test_cambiar_contrasena_y_bandera_de_clave_por_defecto(self):
        self.assertTrue(self.c.get("/api/ajustes", headers=self.admin).get_json()["data"]["claveAdminPorDefecto"])
        admin_id = next(u["id"] for u in self.c.get("/api/usuarios", headers=self.admin).get_json()["data"] if u["usuario"] == "admin")
        self.assertEqual(self.c.put(f"/api/usuarios/{admin_id}/contrasena", headers=self.admin, json={"clave": "123"}).status_code, 400)
        self.assertEqual(self.c.put(f"/api/usuarios/{admin_id}/contrasena", headers=self.admin, json={"clave": "NuevaClave9"}).status_code, 200)
        self.assertEqual(self.c.post("/api/login", json={"usuario": "admin", "clave": "admin123"}).status_code, 401)
        h = self.cabecera("admin", "NuevaClave9")
        self.assertFalse(self.c.get("/api/ajustes", headers=h).get_json()["data"]["claveAdminPorDefecto"])

    def test_la_contrasena_no_se_guarda_en_texto_plano(self):
        con = servidor._conectar()
        claves = [f["clave"] for f in con.execute("SELECT clave FROM usuarios")]
        con.close()
        self.assertTrue(all("admin123" not in c and "empleado123" not in c for c in claves))


class Protocolo(Base):
    def test_cors_y_preflight(self):
        r = self.c.options("/api/ventas", headers={"Origin": "null", "Access-Control-Request-Method": "POST",
                                                    "Access-Control-Request-Headers": "authorization,content-type"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["Access-Control-Allow-Origin"], "*")
        self.assertIn("Authorization", r.headers["Access-Control-Allow-Headers"])

    def test_rutas_inexistentes_responden_json(self):
        r = self.c.get("/api/no-existe")
        self.assertEqual((r.status_code, r.get_json()["ok"]), (404, False))


if __name__ == "__main__":
    unittest.main(verbosity=2)

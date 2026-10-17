import { useEffect, useState } from 'react';
import { bridge } from '../bridge';
import { ModalError, ModalExito, ModalStockBajo } from '../components/Modal';
import BottomNav from '../components/BottomNav';

let siguienteLineaId = 1;
const lineaVacia = () => ({ lineaId: siguienteLineaId++, productoId: '', cantidadTexto: '1' });
const aNumero = (texto) => parseFloat(texto) || 0;

export default function SalesRegistration({ sesion, onNavegar, onSalir }) {
  const esEmpleado = sesion.rol === 'empleado';

  const [productos, setProductos] = useState([]);
  const [lineas, setLineas] = useState([lineaVacia()]);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);
  const [alertas, setAlertas] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargarProductos = () => bridge.obtenerProductos().then(setProductos).catch((e) => setError(e.message));
  useEffect(() => { cargarProductos(); }, []);

  const productoDe = (id) => productos.find((p) => String(p.id) === String(id));

  const actualizarLinea = (lineaId, cambios) => {
    setLineas((prev) => prev.map((l) => (l.lineaId === lineaId ? { ...l, ...cambios } : l)));
  };

  const mover = (linea, direccion) => {
    const paso = productoDe(linea.productoId)?.unidad === 'Pza' ? 1 : 0.5;
    const nuevo = Math.max(paso, aNumero(linea.cantidadTexto) + direccion * paso);
    actualizarLinea(linea.lineaId, { cantidadTexto: String(+nuevo.toFixed(3)) });
  };

  const subtotalDe = (linea) => {
    const producto = productoDe(linea.productoId);
    return producto ? producto.precio * aNumero(linea.cantidadTexto) : 0;
  };

  const total = lineas.reduce((acc, l) => acc + subtotalDe(l), 0);

  const confirmarVenta = async () => {
    const items = lineas
      .filter((l) => l.productoId && aNumero(l.cantidadTexto) > 0)
      .map((l) => ({ productoId: Number(l.productoId), cantidad: aNumero(l.cantidadTexto) }));
    setEnviando(true);
    try {
      const resultado = await bridge.registrarVenta(items);
      if (resultado.alertas && resultado.alertas.length > 0) setAlertas(resultado.alertas);
      else setExito(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const terminar = () => {
    setExito(false);
    setAlertas(null);
    setLineas([lineaVacia()]);
    cargarProductos();
    if (!esEmpleado) onNavegar('dashboard'); // el empleado se queda en Ventas
  };

  const avisarPorWhatsApp = async () => {
    try {
      await bridge.avisarStockBajoWhatsApp();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="pantalla">
      <div className="encabezado">
        <div className="encabezado-titulos">
          <h1>Nueva Venta</h1>
          {esEmpleado && <p style={{ textTransform: 'none' }}>Sesión: {sesion.usuario}</p>}
        </div>
        <div className="encabezado-acciones">
          {esEmpleado && <button className="btn-texto gris" onClick={onSalir}>Salir</button>}
          <div className="logo-sf">SF</div>
        </div>
      </div>

      <div className="contenido">
        {lineas.map((linea, i) => {
          const producto = productoDe(linea.productoId);
          const excede = producto && aNumero(linea.cantidadTexto) > producto.cantidad;
          return (
            <div key={linea.lineaId} className="tarjeta">
              <div className="fila" style={{ marginBottom: 12 }}>
                <span className="texto-secundario" style={{ fontWeight: 700 }}>Línea de Venta {i + 1}</span>
                {lineas.length > 1 && (
                  <button className="btn-texto rojo" onClick={() => setLineas((prev) => prev.filter((l) => l.lineaId !== linea.lineaId))}>Quitar</button>
                )}
              </div>

              <div className="campo">
                <label>Producto</label>
                <select value={linea.productoId} onChange={(e) => actualizarLinea(linea.lineaId, { productoId: e.target.value })}>
                  <option value="">Selecciona un producto</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.cantidad <= 0}>
                      {p.nombre}{p.cantidad <= 0 ? ' (agotado)' : ''}
                    </option>
                  ))}
                </select>
                {producto && (
                  <span className={`pista ${excede ? 'pista-error' : ''}`}>
                    {excede ? 'Excede la existencia. ' : ''}Disponible: {producto.cantidad} {producto.unidad} · ${producto.precio.toFixed(2)} / {producto.unidad}
                  </span>
                )}
              </div>

              <div className="campo" style={{ marginBottom: 0 }}>
                <label>Cantidad ({producto?.unidad || 'Kg'})</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="boton-secundario" style={{ width: 44 }} onClick={() => mover(linea, -1)}>−</button>
                  <input
                    style={{ textAlign: 'center' }}
                    value={linea.cantidadTexto}
                    inputMode="decimal"
                    onChange={(e) => actualizarLinea(linea.lineaId, { cantidadTexto: e.target.value })}
                  />
                  <button className="boton-secundario" style={{ width: 44 }} onClick={() => mover(linea, 1)}>+</button>
                </div>
              </div>
            </div>
          );
        })}

        <div className="tarjeta">
          <div className="fila texto-secundario"><span>Subtotal</span><span>${total.toFixed(2)} MXN</span></div>
          <div className="fila texto-secundario" style={{ margin: '6px 0' }}><span>Descuento</span><span style={{ color: 'var(--green)' }}>-$0.00 MXN</span></div>
          <div className="fila" style={{ fontWeight: 700, fontSize: 16 }}><span>Total Estimado</span><span style={{ color: 'var(--orange)' }}>${total.toFixed(2)} MXN</span></div>
        </div>

        <button className="boton-secundario" onClick={() => setLineas((prev) => [...prev, lineaVacia()])}>+ Agregar otro producto</button>
        <button className="boton-primario" onClick={confirmarVenta} disabled={enviando}>
          {enviando ? 'Registrando...' : 'Confirmar Venta'}
        </button>
      </div>

      {!esEmpleado && <BottomNav activo="ventas" onNavegar={onNavegar} />}

      {exito && (
        <ModalExito
          mensaje="La venta se registró correctamente y el inventario fue actualizado."
          onAceptar={terminar}
        />
      )}
      {alertas && <ModalStockBajo productos={alertas} onWhatsApp={avisarPorWhatsApp} onCerrar={terminar} />}
      {error && <ModalError titulo="No se pudo completar" mensaje={error} onReintentar={() => setError(null)} textoReintentar="Entendido" />}
    </div>
  );
}

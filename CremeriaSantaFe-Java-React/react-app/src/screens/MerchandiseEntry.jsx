import { useEffect, useState } from 'react';
import { api } from '../api';
import { ModalError, ModalExito } from '../components/Modal';

const HOY = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function MerchandiseEntry({ onVolver }) {
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    api.obtenerProductos().then(setProductos).catch(api.mostrarError);
  }, []);

  const guardar = async () => {
    const producto = productos.find((p) => String(p.id) === String(productoId));
    try {
      await api.registrarEntrada(producto?.id, producto?.nombre, parseFloat(cantidad), proveedor);
      setExito(true);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="pantalla">
      <div className="encabezado">
        <button className="volver" onClick={onVolver}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="encabezado-titulos" style={{ textAlign: 'center', flex: 1 }}>
          <h1 style={{ fontSize: 17 }}>Entrada de Mercancía</h1>
        </div>
        <div className="logo-sf">SF</div>
      </div>

      <div className="contenido">
        <div className="tarjeta">
          <p className="texto-secundario" style={{ margin: '0 0 14px', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
            Registro de Adquisición
          </p>

          <div className="campo">
            <label>Producto a Ingresar</label>
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
              <option value="">Selecciona un producto</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <div className="campo">
            <label>Cantidad Recibida ({productos.find((p) => String(p.id) === String(productoId))?.unidad || 'Kg / Pzs'})</label>
            <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" placeholder="50.0" />
          </div>

          <div className="campo">
            <label>Proveedor</label>
            <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Lácteos del Valle S.A." />
          </div>

          <div className="campo" style={{ marginBottom: 0 }}>
            <label>Fecha de Entrada</label>
            <input value={HOY} readOnly style={{ textTransform: 'capitalize', background: '#F6F4F8' }} />
          </div>
        </div>

        <button className="boton-primario" onClick={guardar}>Registrar Entrada</button>
      </div>

      {error && <ModalError mensaje={error} onReintentar={() => setError(null)} onCancelar={() => setError(null)} />}
      {exito && (
        <ModalExito
          mensaje="El producto se ha guardado y el inventario fue actualizado correctamente."
          onAceptar={() => { setExito(false); setCantidad(''); setProveedor(''); setProductoId(''); onVolver(); }}
        />
      )}
    </div>
  );
}

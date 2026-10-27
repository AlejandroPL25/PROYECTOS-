import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ModalError, ModalExito } from '../components/Modal';

const UNIDADES = ['Kg', 'Lt', 'Pza'];

export default function ProductRegistration({ onVolver }) {
  const [categorias, setCategorias] = useState([]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [minimo, setMinimo] = useState('5');
  const [categoria, setCategoria] = useState('');
  const [unidad, setUnidad] = useState(UNIDADES[0]);
  const [detectada, setDetectada] = useState('');
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    api.obtenerCategorias()
      .then((lista) => { setCategorias(lista); setCategoria((c) => c || lista[0]); })
      .catch((e) => setError(e.message));
  }, []);

  // Al escribir el nombre se detecta la categoría y se selecciona sola (leche -> Lácteos y Quesos)
  const temporizador = useRef(null);
  const cambiarNombre = (valor) => {
    setNombre(valor);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      try {
        const sugerida = await api.categoriaSugerida(valor);
        setDetectada(sugerida);
        if (sugerida) setCategoria(sugerida);
      } catch (e) { /* la validación final la hace el servidor al guardar */ }
    }, 300);
  };

  const limpiar = () => { setNombre(''); setPrecio(''); setCantidad(''); setMinimo('5'); setDetectada(''); };

  const guardar = async () => {
    try {
      await api.guardarProducto(nombre, categoria, parseFloat(precio), unidad, parseFloat(cantidad), parseFloat(minimo));
      setExito(true);
    } catch (e) {
      setError(e.message);
    }
  };

  const conflicto = detectada && categoria && detectada !== categoria;

  return (
    <div className="pantalla">
      <div className="encabezado">
        <button className="volver" onClick={onVolver}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="encabezado-titulos" style={{ textAlign: 'center', flex: 1 }}>
          <h1 style={{ fontSize: 17 }}>Nuevo Producto</h1>
        </div>
        <div className="logo-sf">SF</div>
      </div>

      <div className="contenido">
        <div className="tarjeta">
          <p className="titulo-seccion">Detalles del Producto</p>

          <div className="campo">
            <label>Nombre del producto</label>
            <input value={nombre} onChange={(e) => cambiarNombre(e.target.value)} placeholder="Queso Oaxaca Especial" />
            {detectada && <span className="pista pista-ok">Categoría detectada: {detectada}</span>}
          </div>

          <div className="campo">
            <label>Precio de Venta ($ MXN)</label>
            <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" placeholder="145.00" />
          </div>

          <div className="campo">
            <label>Cantidad disponible</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" placeholder="45" style={{ flex: 1 }} />
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)} style={{ width: 90 }}>
                {UNIDADES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="campo">
            <label>Stock mínimo (avisar cuando quede igual o menos)</label>
            <input value={minimo} onChange={(e) => setMinimo(e.target.value)} inputMode="decimal" placeholder="5" />
          </div>

          <div className="campo" style={{ marginBottom: 0 }}>
            <label>Categoría</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => <option key={c}>{c}</option>)}
            </select>
            {conflicto && <span className="pista pista-error">Por su nombre, este producto va en {detectada}.</span>}
          </div>
        </div>

        <button className="boton-primario" onClick={guardar}>Guardar Producto</button>
      </div>

      {error && (
        <ModalError mensaje={error} onReintentar={() => setError(null)} onCancelar={() => { setError(null); onVolver(); }} />
      )}
      {exito && (
        <ModalExito
          mensaje="El producto se ha guardado y el inventario fue actualizado correctamente."
          onAceptar={() => { setExito(false); limpiar(); onVolver(); }}
        />
      )}
    </div>
  );
}

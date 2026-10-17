import { useEffect, useState } from 'react';
import { bridge } from '../bridge';
import BottomNav from '../components/BottomNav';

function BotonFlotante({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute', right: 20, bottom: 86, width: 52, height: 52, borderRadius: '50%',
        background: 'var(--purple)', color: '#fff', border: 'none', fontSize: 26, lineHeight: '52px',
        boxShadow: '0 4px 10px rgba(60,19,97,.35)', cursor: 'pointer'
      }}
    >+</button>
  );
}

export default function ProductList({ onNavegar }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('Todos');

  useEffect(() => {
    bridge.obtenerProductos().then(setProductos).catch(() => {});
    bridge.obtenerCategorias().then(setCategorias).catch(() => {});
  }, []);

  const filtrados = productos
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .filter((p) => filtro === 'Todos' || p.categoria === filtro);

  return (
    <div className="pantalla" style={{ position: 'relative' }}>
      <div className="encabezado">
        <div className="encabezado-titulos"><h1>Productos</h1></div>
        <div className="logo-sf">SF</div>
      </div>
      <BotonFlotante onClick={() => onNavegar('nuevoProducto')} />

      <div className="contenido">
        <div className="buscador">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input placeholder="Buscar productos..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {['Todos', ...categorias].map((f) => (
            <button key={f} className={`chip ${filtro === f ? 'activo' : ''}`} onClick={() => setFiltro(f)}>{f}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map((p) => (
            <div key={p.id} className="tarjeta fila">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nombre}</div>
                <div className="texto-secundario">${p.precio.toFixed(2)} / {p.unidad} · {p.categoria}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: p.cantidad <= p.umbralMinimo ? 'var(--orange)' : 'var(--green)'
                }} />
                <span className="texto-secundario">{p.cantidad} {p.unidad}</span>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && <p className="texto-secundario" style={{ textAlign: 'center', marginTop: 20 }}>No se encontraron productos.</p>}
        </div>
      </div>

      <BottomNav activo="productos" onNavegar={onNavegar} />
    </div>
  );
}

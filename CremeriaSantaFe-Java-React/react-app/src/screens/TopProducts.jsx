import { useEffect, useState } from 'react';
import { bridge } from '../bridge';

const TABS = ['Hoy', 'Semana', 'Mes'];
const MES_ACTUAL = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

export default function TopProducts({ onVolver }) {
  const [productos, setProductos] = useState([]);
  const [tab, setTab] = useState('Mes');

  useEffect(() => {
    bridge.obtenerMasVendidos(8).then(setProductos).catch(() => {});
  }, []);

  const maximo = productos[0]?.vecesVendido || 1;

  return (
    <div className="pantalla">
      <div className="encabezado">
        <button className="volver" onClick={onVolver}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="encabezado-titulos" style={{ textAlign: 'center', flex: 1 }}>
          <h1 style={{ fontSize: 17 }}>Productos Más Vendidos</h1>
        </div>
        <div className="logo-sf">SF</div>
      </div>

      <div className="contenido">
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map((t) => (
            <button key={t} className={`chip ${tab === t ? 'activo' : ''}`} onClick={() => setTab(t)} style={{ flex: 1 }}>{t}</button>
          ))}
        </div>

        <div className="tarjeta">
          <div className="fila" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Reporte de Ventas (Volumen)</span>
            <span className="texto-secundario" style={{ textTransform: 'capitalize' }}>{MES_ACTUAL}</span>
          </div>

          {productos.map((p, i) => {
            const porcentaje = Math.round((p.vecesVendido / maximo) * 100);
            return (
              <div key={p.id} style={{ marginBottom: i === productos.length - 1 ? 0 : 14 }}>
                <div className="fila" style={{ fontSize: 13 }}>
                  <span><strong>{i + 1}</strong> &nbsp; {p.nombre}</span>
                  <span className="texto-secundario">{p.vecesVendido} {p.unidad}</span>
                </div>
                <div className="barra-progreso">
                  <i style={{ width: `${porcentaje}%`, background: i === 0 ? 'var(--orange)' : '#E7A890' }} />
                </div>
              </div>
            );
          })}
          {productos.length === 0 && <p className="texto-secundario">Aún no hay ventas registradas.</p>}
        </div>
      </div>
    </div>
  );
}

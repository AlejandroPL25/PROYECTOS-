import { useEffect, useState } from 'react';
import { api } from '../api';
import BottomNav from '../components/BottomNav';
import { ModalError } from '../components/Modal';

function estadoDe(p) {
  if (p.cantidad <= 0) return { texto: 'Sin stock disponible', insignia: 'Reponer', color: 'var(--red)' };
  if (p.cantidad <= p.umbralMinimo) return { texto: `Stock Bajo • ${p.cantidad} ${p.unidad}`, insignia: 'Reponer', color: 'var(--orange)' };
  return { texto: `Stock Óptimo • ${p.cantidad} ${p.unidad}`, insignia: 'Saludable', color: 'var(--green)' };
}

export default function InventoryControl({ onNavegar }) {
  const [productos, setProductos] = useState([]);
  const [faltantes, setFaltantes] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.obtenerProductos().then(setProductos).catch(api.mostrarError);
    api.obtenerProductosFaltantes().then(setFaltantes).catch(api.mostrarError);
  }, []);

  const avisarPorWhatsApp = async () => {
    try {
      await api.avisarStockBajoWhatsApp();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="pantalla" style={{ position: 'relative' }}>
      <div className="encabezado">
        <div className="encabezado-titulos"><h1>Inventario</h1></div>
        <div className="logo-sf">SF</div>
      </div>
      <button
        onClick={() => onNavegar('entradaMercancia')}
        style={{
          position: 'absolute', right: 20, bottom: 86, width: 52, height: 52, borderRadius: '50%',
          background: 'var(--purple)', color: '#fff', border: 'none', fontSize: 26, lineHeight: '52px',
          boxShadow: '0 4px 10px rgba(60,19,97,.35)', cursor: 'pointer'
        }}
      >+</button>

      <div className="contenido">
        <div className="tarjeta">
          <div className="fila">
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Productos por reponer</div>
              <div className="texto-secundario">Se requieren reabastecimientos críticos hoy.</div>
            </div>
            <span className="insignia insignia-naranja">{faltantes.length} Críticos</span>
          </div>
          {faltantes.length > 0 && (
            <button className="boton-secundario" style={{ marginTop: 12, padding: 10, fontSize: 13 }} onClick={avisarPorWhatsApp}>
              Avisar por WhatsApp
            </button>
          )}
        </div>

        <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: 'var(--text-secondary)' }}>
          ORDEN DE URGENCIA
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faltantes.map((p) => {
            const estado = estadoDe(p);
            const porcentaje = Math.min(100, Math.round((p.cantidad / (p.umbralMinimo || 1)) * 100));
            return (
              <div key={p.id} className="tarjeta">
                <div className="fila">
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nombre}</div>
                  <span className="insignia insignia-naranja">{estado.insignia}</span>
                </div>
                <div className="texto-secundario" style={{ color: estado.color, marginTop: 2 }}>{estado.texto}</div>
                <div className="barra-progreso"><i style={{ width: `${porcentaje}%`, background: estado.color }} /></div>
              </div>
            );
          })}
          {faltantes.length === 0 && <p className="texto-secundario">No hay productos por reponer por ahora.</p>}
        </div>

        {productos.filter((p) => p.cantidad > p.umbralMinimo).slice(0, 3).map((p) => (
          <div key={p.id} className="tarjeta">
            <div className="fila">
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nombre}</div>
              <span className="insignia insignia-verde">Saludable</span>
            </div>
            <div className="texto-secundario" style={{ marginTop: 2 }}>Stock Óptimo • {p.cantidad} {p.unidad}</div>
            <div className="barra-progreso"><i style={{ width: '90%', background: 'var(--green)' }} /></div>
          </div>
        ))}
      </div>

      <BottomNav activo="inventario" onNavegar={onNavegar} />

      {error && <ModalError titulo="No se pudo enviar el aviso" mensaje={error} onReintentar={() => setError(null)} textoReintentar="Entendido" />}
    </div>
  );
}

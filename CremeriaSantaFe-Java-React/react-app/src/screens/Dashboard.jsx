import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import BottomNav from '../components/BottomNav';
import { nativo } from '../nativo';
import { ModalError } from '../components/Modal';

const HOY = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

const ACCESOS = [
  { ruta: 'productos', titulo: 'Productos', sub: 'Ver catálogo', icono: 'box' },
  { ruta: 'inventario', titulo: 'Inventario', sub: 'Control de stock', icono: 'warehouse' },
  { ruta: 'ventas', titulo: 'Ventas', sub: 'Nueva venta', icono: 'cart' },
  { ruta: 'topProductos', titulo: 'Reportes', sub: 'Análisis diario', icono: 'chart' }
];

function Icono({ tipo }) {
  const props = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--purple)', strokeWidth: 2 };
  if (tipo === 'box') return <svg {...props}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" /></svg>;
  if (tipo === 'warehouse') return <svg {...props}><path d="M3 7h18v13H3zM3 7l2-4h14l2 4" /></svg>;
  if (tipo === 'cart') return <svg {...props}><path d="M2 3h2l2.6 12.6a2 2 0 002 1.4h8.8a2 2 0 002-1.6L21 7H6" /></svg>;
  if (tipo === 'gear') return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
  return <svg {...props}><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg>;
}

export default function Dashboard({ sesion, onNavegar, onSalir }) {
  const [resumen, setResumen] = useState(null);
  const [claveDefecto, setClaveDefecto] = useState(false);
  const [error, setError] = useState(null);

  const alertasPrevias = useRef(null); // para notificar solo cuando las alertas AUMENTAN
  const notificar = useRef(true);

  useEffect(() => {
    api.obtenerResumenDia().then((r) => { setResumen(r); alertasPrevias.current = r.alertasStock; }).catch(api.mostrarError);
    api.obtenerAjustes().then((a) => { setClaveDefecto(!!a.claveAdminPorDefecto); notificar.current = !!a.notificaciones; }).catch(() => {});

    // Cada 30 s revisa (sin spinner) si otro celular -por ejemplo el del empleado- dejó productos en stock bajo.
    const revisar = async () => {
      try {
        const r = await api.obtenerResumenDia({ silencioso: true });
        setResumen(r);
        if (alertasPrevias.current !== null && r.alertasStock > alertasPrevias.current && notificar.current) {
          const faltantes = await api.obtenerProductosFaltantes({ silencioso: true });
          nativo.notificarStockBajo(faltantes, '');
        }
        alertasPrevias.current = r.alertasStock;
      } catch (e) { /* sin conexión: se vuelve a intentar en el siguiente ciclo */ }
    };
    const temporizador = setInterval(revisar, 30000);
    return () => clearInterval(temporizador);
  }, []);

  const avisarPorWhatsApp = async () => {
    try {
      await api.avisarStockBajoWhatsApp();
    } catch (e) {
      setError(e.message);
    }
  };

  const nombre = (sesion.usuario || '').split('@')[0];
  const nombreBonito = nombre.charAt(0).toUpperCase() + nombre.slice(1);

  return (
    <div className="pantalla">
      <div className="encabezado">
        <div className="encabezado-titulos">
          <h1>Cremería Santa Fe</h1>
          <p>Productos Lácteos</p>
        </div>
        <div className="encabezado-acciones">
          <button className="btn-texto gris" onClick={onSalir}>Salir</button>
          <div className="logo-sf">SF</div>
        </div>
      </div>

      <div className="contenido">
        <div>
          <h2 style={{ margin: 0, fontSize: 19 }}>¡Buen día, {nombreBonito}!</h2>
          <p className="texto-secundario" style={{ textTransform: 'capitalize' }}>{HOY}</p>
        </div>

        {claveDefecto && (
          <div className="aviso aviso-naranja">
            Sigues usando la contraseña predeterminada del administrador. Cámbiala para proteger la app.
            <br />
            <button className="btn-texto" onClick={() => onNavegar('ajustes')}>Ir a Ajustes</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {ACCESOS.map((a) => (
            <div key={a.ruta} className="tarjeta" style={{ cursor: 'pointer' }} onClick={() => onNavegar(a.ruta)}>
              <Icono tipo={a.icono} />
              <h3 style={{ margin: '10px 0 2px', fontSize: 14 }}>{a.titulo}</h3>
              <p className="texto-secundario" style={{ margin: 0 }}>{a.sub}</p>
            </div>
          ))}
        </div>

        {resumen?.alertasStock > 0 && (
          <div className="tarjeta" style={{ border: '1.5px solid var(--orange)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--orange)' }}>
              {resumen.alertasStock} {resumen.alertasStock === 1 ? 'producto por reponer' : 'productos por reponer'}
            </div>
            <div className="texto-secundario" style={{ margin: '2px 0 12px' }}>Hay existencias por debajo del mínimo.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="boton-secundario" style={{ padding: 10, fontSize: 13 }} onClick={() => onNavegar('inventario')}>Ver inventario</button>
              <button className="boton-primario" style={{ padding: 10, fontSize: 13 }} onClick={avisarPorWhatsApp}>Avisar por WhatsApp</button>
            </div>
          </div>
        )}

        <div className="tarjeta">
          <p className="texto-secundario" style={{ margin: '0 0 10px', textTransform: 'uppercase', fontSize: 11, letterSpacing: '.04em' }}>
            Resumen del Día
          </p>
          <div className="fila">
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{resumen?.productosActivos ?? '—'}</div>
              <div className="texto-secundario">Productos Activos</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>{resumen?.alertasStock ?? 0} alertas</div>
              <div className="texto-secundario">Stock Bajo</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--purple)' }}>
                ${(resumen?.ventasHoy ?? 0).toLocaleString('es-MX')} MXN
              </div>
              <div className="texto-secundario">Ventas de Hoy</div>
            </div>
          </div>
        </div>

        <div className="tarjeta fila" style={{ cursor: 'pointer' }} onClick={() => onNavegar('ajustes')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icono tipo="gear" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Ajustes</div>
              <div className="texto-secundario">Alertas de stock y usuarios</div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav activo="dashboard" onNavegar={onNavegar} />

      {error && <ModalError titulo="No se pudo enviar el aviso" mensaje={error} onReintentar={() => setError(null)} textoReintentar="Entendido" />}
    </div>
  );
}

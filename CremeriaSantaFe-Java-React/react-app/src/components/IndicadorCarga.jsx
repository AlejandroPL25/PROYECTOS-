import { useEffect, useState, useSyncExternalStore } from 'react';
import { carga, errores } from '../api';
import { ModalError } from './Modal';

// Barra de progreso arriba mientras hay peticiones; si tardan más de 350 ms aparece además el spinner.
export function IndicadorCarga() {
  const pendientes = useSyncExternalStore(carga.suscribir, carga.actual);
  const [lento, setLento] = useState(false);
  const activo = pendientes > 0;

  useEffect(() => {
    if (!activo) { setLento(false); return undefined; }
    const temporizador = setTimeout(() => setLento(true), 350);
    return () => clearTimeout(temporizador);
  }, [activo]);

  if (!activo) return null;
  return (
    <>
      <div className="barra-carga" />
      {lento && (
        <div className="superposicion-carga" role="status">
          <div className="spinner" />
          <span>Cargando…</span>
        </div>
      )}
    </>
  );
}

// Aviso para cargas que fallaron (sin conexión, servidor caído, tiempo agotado...)
export function ErrorGlobal() {
  const mensaje = useSyncExternalStore(errores.suscribir, errores.actual);
  if (!mensaje) return null;
  return (
    <ModalError
      titulo="No se pudo completar"
      mensaje={mensaje}
      textoReintentar="Reintentar"
      onReintentar={() => { errores.limpiar(); window.location.reload(); }}
      onCancelar={errores.limpiar}
    />
  );
}

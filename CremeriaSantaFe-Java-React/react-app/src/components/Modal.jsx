export function ModalError({ titulo, mensaje, textoReintentar, onReintentar, onCancelar }) {
  return (
    <div className="superposicion">
      <div className="modal">
        <div className="icono icono-error">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>
        <h2>{titulo || 'Error de Registro'}</h2>
        <p>{mensaje || 'No se pudo completar la operación. Por favor, verifica los campos marcados e intenta de nuevo.'}</p>
        <button className="boton-primario" onClick={onReintentar}>{textoReintentar || 'Reintentar'}</button>
        {onCancelar && (
          <button className="btn-texto gris" style={{ marginTop: 10 }} onClick={onCancelar}>Cancelar</button>
        )}
      </div>
    </div>
  );
}

export function ModalExito({ titulo, mensaje, onAceptar }) {
  return (
    <div className="superposicion">
      <div className="modal">
        <div className="icono icono-exito">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9" />
          </svg>
        </div>
        <h2>{titulo || 'Operación Exitosa'}</h2>
        <p>{mensaje}</p>
        <button className="boton-primario" onClick={onAceptar}>Aceptar</button>
      </div>
    </div>
  );
}

// Aviso después de una venta que dejó productos con stock bajo
export function ModalStockBajo({ productos, onWhatsApp, onCerrar }) {
  return (
    <div className="superposicion">
      <div className="modal">
        <div className="icono icono-alerta">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.2">
            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </div>
        <h2>Venta registrada</h2>
        <p style={{ marginBottom: 10 }}>Estos productos se están acabando:</p>
        <ul className="lista-alerta">
          {productos.map((p) => (
            <li key={p.id}>
              <strong>{p.nombre}</strong>
              <span>quedan {p.cantidad} {p.unidad}</span>
            </li>
          ))}
        </ul>
        <button className="boton-primario" onClick={onWhatsApp}>Avisar por WhatsApp</button>
        <button className="btn-texto gris" style={{ marginTop: 10 }} onClick={onCerrar}>Ahora no</button>
      </div>
    </div>
  );
}

// Reemplaza a window.confirm(), que no funciona dentro del WebView
export function ModalConfirmar({ titulo, mensaje, textoConfirmar, onConfirmar, onCancelar }) {
  return (
    <div className="superposicion">
      <div className="modal">
        <h2>{titulo}</h2>
        <p>{mensaje}</p>
        <button className="boton-primario" onClick={onConfirmar}>{textoConfirmar || 'Confirmar'}</button>
        <button className="btn-texto gris" style={{ marginTop: 10 }} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

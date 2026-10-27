import { useEffect, useState } from 'react';
import { api } from '../api';
import { ModalConfirmar, ModalError, ModalExito } from '../components/Modal';

export default function Settings({ sesion, onVolver }) {
  const [claveDefecto, setClaveDefecto] = useState(false);
  const [numero, setNumero] = useState('');
  const [notificaciones, setNotificaciones] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [nuevo, setNuevo] = useState({ usuario: '', clave: '', rol: 'empleado' });
  const [cambiando, setCambiando] = useState(null); // { id, usuario, clave }
  const [aEliminar, setAEliminar] = useState(null);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  const cargar = async () => {
    try {
      const a = await api.obtenerAjustes();
      setClaveDefecto(!!a.claveAdminPorDefecto);
      setNumero(a.whatsappNumero || '');
      setNotificaciones(!!a.notificaciones);
      setUsuarios(await api.listarUsuarios());
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { cargar(); }, []);

  const ejecutar = async (accion, mensajeExito) => {
    try {
      await accion();
      setExito(mensajeExito);
      await cargar();
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
          <h1 style={{ fontSize: 17 }}>Ajustes</h1>
        </div>
        <div className="logo-sf">SF</div>
      </div>

      <div className="contenido">
        {claveDefecto && (
          <div className="aviso aviso-naranja">
            Sigues usando la contraseña predeterminada del administrador (<strong>admin123</strong>). Cámbiala abajo, en Usuarios.
          </div>
        )}

        {/* ---------------- Alertas de stock ---------------- */}
        <div className="tarjeta">
          <p className="titulo-seccion">Alertas de stock bajo</p>

          <div className="campo">
            <label>WhatsApp del dueño (recibe los avisos)</label>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" placeholder="33 1234 5678" />
            <span className="pista">
              Al tocar “Avisar por WhatsApp” se abre el chat con este número y el mensaje ya escrito; solo falta tocar Enviar.
            </span>
          </div>

          <div className="fila" style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Notificaciones en el teléfono</div>
              <div className="texto-secundario">Aviso cuando una venta deja un producto en stock bajo.</div>
            </div>
            <button
              className={`interruptor ${notificaciones ? 'on' : ''}`}
              role="switch"
              aria-checked={notificaciones}
              onClick={() => setNotificaciones(!notificaciones)}
            />
          </div>

          <button className="boton-primario" onClick={() => ejecutar(() => api.guardarAjustes(numero, notificaciones), 'Los ajustes de alertas se guardaron correctamente.')}>
            Guardar ajustes
          </button>
        </div>

        {/* ---------------- Usuarios ---------------- */}
        <div className="tarjeta">
          <p className="titulo-seccion">Usuarios</p>

          {usuarios.map((u) => (
            <div key={u.id} className="fila-usuario">
              <div className="fila">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{u.usuario}</span>
                  <span className={`insignia ${u.rol === 'admin' ? 'insignia-morada' : 'insignia-verde'}`}>
                    {u.rol === 'admin' ? 'Administrador' : 'Empleado'}
                  </span>
                </div>
                <div>
                  <button className="btn-texto" onClick={() => setCambiando({ id: u.id, usuario: u.usuario, clave: '' })}>Contraseña</button>
                  {u.id !== sesion.id && (
                    <button className="btn-texto rojo" onClick={() => setAEliminar(u)}>Eliminar</button>
                  )}
                </div>
              </div>

              {cambiando?.id === u.id && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    type="password"
                    placeholder="Nueva contraseña (mín. 6)"
                    value={cambiando.clave}
                    onChange={(e) => setCambiando({ ...cambiando, clave: e.target.value })}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                  <button
                    className="boton-primario"
                    style={{ width: 'auto', padding: '10px 14px', fontSize: 13 }}
                    onClick={() => ejecutar(async () => { await api.cambiarContrasena(cambiando.id, cambiando.clave); setCambiando(null); }, `Se actualizó la contraseña de ${cambiando.usuario}.`)}
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>
          ))}

          <p className="titulo-seccion" style={{ marginTop: 18 }}>Agregar usuario</p>
          <div className="campo">
            <label>Usuario</label>
            <input value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} placeholder="maria" autoCapitalize="none" autoCorrect="off" />
          </div>
          <div className="campo">
            <label>Contraseña (mínimo 6 caracteres)</label>
            <input type="password" value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} />
          </div>
          <div className="campo">
            <label>Rol</label>
            <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
              <option value="empleado">Empleado (solo vende)</option>
              <option value="admin">Administrador (acceso completo)</option>
            </select>
          </div>
          <button
            className="boton-secundario"
            onClick={() => ejecutar(async () => { await api.crearUsuario(nuevo.usuario, nuevo.clave, nuevo.rol); setNuevo({ usuario: '', clave: '', rol: 'empleado' }); }, 'El usuario se creó correctamente.')}
          >
            + Agregar usuario
          </button>
        </div>
      </div>

      {aEliminar && (
        <ModalConfirmar
          titulo="¿Eliminar usuario?"
          mensaje={`Se eliminará el acceso de “${aEliminar.usuario}”. Esta acción no se puede deshacer.`}
          textoConfirmar="Eliminar"
          onConfirmar={() => { const u = aEliminar; setAEliminar(null); ejecutar(() => api.eliminarUsuario(u.id), 'El usuario se eliminó.'); }}
          onCancelar={() => setAEliminar(null)}
        />
      )}
      {error && <ModalError titulo="No se pudo completar" mensaje={error} onReintentar={() => setError(null)} textoReintentar="Entendido" />}
      {exito && <ModalExito mensaje={exito} onAceptar={() => setExito(null)} />}
    </div>
  );
}

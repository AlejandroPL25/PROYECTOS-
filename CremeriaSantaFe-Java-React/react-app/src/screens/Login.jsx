import { useState } from 'react';
import { api, fijarServidor, normalizarServidor, obtenerServidor, servidorConfigurado } from '../api';
import { ModalError } from '../components/Modal';
import logo from '../assets/logo.png';

export default function Login({ onIngresar, aviso, onAvisoLeido }) {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [servidor, setServidor] = useState(obtenerServidor());
  const [editando, setEditando] = useState(!servidorConfigurado() && !!window.Android);
  const [borrador, setBorrador] = useState(servidor);
  const [conexion, setConexion] = useState(null); // { ok, texto }

  const entrar = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const sesion = await api.login(usuario, contrasena);
      onIngresar(sesion);
    } catch (err) {
      setError(err.message);
      setContrasena('');
      setCargando(false);
    }
  };

  const probarYGuardar = async () => {
    try {
      const url = normalizarServidor(borrador);
      await api.probarConexion(url);
      fijarServidor(url);
      setServidor(url);
      setEditando(false);
      setConexion({ ok: true, texto: 'Conexión exitosa con el servidor.' });
    } catch (err) {
      setConexion({ ok: false, texto: err.message });
    }
  };

  const probarActual = async () => {
    try {
      await api.probarConexion(servidor);
      setConexion({ ok: true, texto: 'Conexión exitosa con el servidor.' });
    } catch (err) {
      setConexion({ ok: false, texto: err.message });
    }
  };

  return (
    <div className="pantalla" style={{ justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img
          src={logo}
          alt="Cremería Santa Fe - Productos lácteos artesanales desde 1983"
          style={{ width: 'min(210px, 56vw)', height: 'auto', display: 'block', margin: '0 auto' }}
        />
      </div>

      <div className="tarjeta">
        <h2 style={{ fontSize: 16, margin: '0 0 2px' }}>Iniciar Sesión</h2>
        <p className="texto-secundario" style={{ marginBottom: 16 }}>Acceso exclusivo para personal de tienda</p>

        <form onSubmit={entrar}>
          <div className="campo">
            <label>Usuario o Correo</label>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="admin@santafe.com"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />
          </div>
          <div className="campo" style={{ marginBottom: 20 }}>
            <label>Contraseña</label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button className="boton-primario" type="submit" disabled={cargando}>
            {cargando ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>

      <div className="servidor">
        {!editando ? (
          <>
            Servidor: <strong>{servidor}</strong>
            <div>
              <button className="btn-texto" onClick={() => { setBorrador(servidor); setConexion(null); setEditando(true); }}>Cambiar</button>
              <button className="btn-texto" onClick={probarActual}>Probar conexión</button>
            </div>
          </>
        ) : (
          <>
            {!servidorConfigurado() && <div className="pista">Escribe la dirección que muestra el servidor al iniciar (ej. 192.168.1.20:5000).</div>}
            <input
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="192.168.1.20:5000"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div>
              <button className="btn-texto" onClick={probarYGuardar}>Probar y guardar</button>
              {servidorConfigurado() && <button className="btn-texto gris" onClick={() => { setEditando(false); setConexion(null); }}>Cancelar</button>}
            </div>
          </>
        )}
        {conexion && <div className={`pista ${conexion.ok ? 'pista-ok' : 'pista-error'}`}>{conexion.texto}</div>}
      </div>

      <p className="texto-secundario" style={{ textAlign: 'center', marginTop: 16 }}>
        v3.0 — Cremería Santa Fe S.A. de C.V.
      </p>

      {error && (
        <ModalError
          titulo="No se pudo iniciar sesión"
          mensaje={error}
          textoReintentar="Intentar de nuevo"
          onReintentar={() => setError(null)}
        />
      )}
      {aviso && (
        <ModalError
          titulo="Sesión finalizada"
          mensaje={aviso}
          textoReintentar="Entendido"
          onReintentar={onAvisoLeido}
        />
      )}
    </div>
  );
}

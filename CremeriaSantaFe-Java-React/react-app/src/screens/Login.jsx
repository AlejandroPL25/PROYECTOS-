import { useState } from 'react';
import { bridge } from '../bridge';
import { ModalError } from '../components/Modal';

export default function Login({ onIngresar }) {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const sesion = await bridge.login(usuario, contrasena);
      onIngresar(sesion);
    } catch (err) {
      setError(err.message);
      setContrasena('');
      setCargando(false);
    }
  };

  return (
    <div className="pantalla" style={{ justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%', background: 'var(--purple)',
          margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* el logo real se agregará aquí más adelante */}
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Cremería Santa Fe</h1>
        <p style={{ margin: '4px 0 0', fontSize: 11, letterSpacing: '.06em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          Calidad y Tradición Diaria
        </p>
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

      <p className="texto-secundario" style={{ textAlign: 'center', marginTop: 24 }}>
        v2.0 — Cremería Santa Fe S.A. de C.V.
      </p>

      {error && (
        <ModalError
          titulo="No se pudo iniciar sesión"
          mensaje={error}
          textoReintentar="Intentar de nuevo"
          onReintentar={() => setError(null)}
        />
      )}
    </div>
  );
}

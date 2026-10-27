import { useEffect, useState } from 'react';
import { api, alExpirarSesion } from './api';
import { sesion as almacenSesion } from './sesion';
import { IndicadorCarga, ErrorGlobal } from './components/IndicadorCarga';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import ProductRegistration from './screens/ProductRegistration';
import ProductList from './screens/ProductList';
import InventoryControl from './screens/InventoryControl';
import SalesRegistration from './screens/SalesRegistration';
import TopProducts from './screens/TopProducts';
import MerchandiseEntry from './screens/MerchandiseEntry';
import Settings from './screens/Settings';

export default function App() {
  // La sesión vive en el Singleton ./sesion: así, si el WebView recarga la página, la app sigue sabiendo quién es.
  const [sesion, setSesion] = useState(almacenSesion.usuario()); // { id, usuario, rol } | null
  const [pantalla, setPantalla] = useState(sesion && sesion.rol !== 'admin' ? 'ventas' : 'dashboard');
  const [aviso, setAviso] = useState(null);

  // Si el servidor responde 401 (token vencido o usuario eliminado) se regresa al login con un aviso.
  useEffect(() => {
    alExpirarSesion((mensaje) => { setSesion(null); setAviso(mensaje); });
  }, []);

  const salir = async () => {
    await api.cerrarSesion();
    setSesion(null);
  };

  let contenido;
  if (!sesion) {
    contenido = (
      <Login
        aviso={aviso}
        onAvisoLeido={() => setAviso(null)}
        onIngresar={(s) => {
          setSesion(s);
          // el empleado entra directo a vender; el admin al dashboard
          setPantalla(s.rol === 'admin' ? 'dashboard' : 'ventas');
        }}
      />
    );
  } else {
    // Un empleado solo puede ver Ventas (el servidor además rechaza cualquier otra acción)
    const destino = sesion.rol === 'admin' ? pantalla : 'ventas';
    switch (destino) {
      case 'productos':
        contenido = <ProductList onNavegar={setPantalla} />;
        break;
      case 'nuevoProducto':
        contenido = <ProductRegistration onVolver={() => setPantalla('productos')} />;
        break;
      case 'inventario':
        contenido = <InventoryControl onNavegar={setPantalla} />;
        break;
      case 'ventas':
        contenido = <SalesRegistration sesion={sesion} onNavegar={setPantalla} onSalir={salir} />;
        break;
      case 'topProductos':
        contenido = <TopProducts onVolver={() => setPantalla('dashboard')} />;
        break;
      case 'entradaMercancia':
        contenido = <MerchandiseEntry onVolver={() => setPantalla('inventario')} />;
        break;
      case 'ajustes':
        contenido = <Settings sesion={sesion} onVolver={() => setPantalla('dashboard')} />;
        break;
      default:
        contenido = <Dashboard sesion={sesion} onNavegar={setPantalla} onSalir={salir} />;
    }
  }

  return (
    <>
      {contenido}
      <IndicadorCarga />
      <ErrorGlobal />
    </>
  );
}

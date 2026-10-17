import { useState } from 'react';
import { bridge } from './bridge';
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
  const [sesion, setSesion] = useState(null); // { id, usuario, rol }
  const [pantalla, setPantalla] = useState('dashboard');

  if (!sesion) {
    return (
      <Login
        onIngresar={(s) => {
          setSesion(s);
          // el empleado entra directo a vender; el admin al dashboard
          setPantalla(s.rol === 'admin' ? 'dashboard' : 'ventas');
        }}
      />
    );
  }

  const salir = async () => {
    try { await bridge.cerrarSesion(); } catch (e) { /* se cierra igual */ }
    setSesion(null);
  };

  // Un empleado solo puede ver Ventas (Java además rechaza cualquier otra acción)
  const esAdmin = sesion.rol === 'admin';
  const destino = esAdmin ? pantalla : 'ventas';

  switch (destino) {
    case 'dashboard':
      return <Dashboard sesion={sesion} onNavegar={setPantalla} onSalir={salir} />;
    case 'productos':
      return <ProductList onNavegar={setPantalla} />;
    case 'nuevoProducto':
      return <ProductRegistration onVolver={() => setPantalla('productos')} />;
    case 'inventario':
      return <InventoryControl onNavegar={setPantalla} />;
    case 'ventas':
      return <SalesRegistration sesion={sesion} onNavegar={setPantalla} onSalir={salir} />;
    case 'topProductos':
      return <TopProducts onVolver={() => setPantalla('dashboard')} />;
    case 'entradaMercancia':
      return <MerchandiseEntry onVolver={() => setPantalla('inventario')} />;
    case 'ajustes':
      return <Settings sesion={sesion} onVolver={() => setPantalla('dashboard')} />;
    default:
      return <Dashboard sesion={sesion} onNavegar={setPantalla} onSalir={salir} />;
  }
}

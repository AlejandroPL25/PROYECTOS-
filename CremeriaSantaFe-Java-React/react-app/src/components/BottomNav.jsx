const ITEMS = [
  { ruta: 'dashboard', etiqueta: 'Inicio', icono: (c) => <path d="M3 11l9-8 9 8M5 10v10h14V10" stroke={c} strokeWidth="2" fill="none" /> },
  { ruta: 'productos', etiqueta: 'Productos', icono: (c) => <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" stroke={c} strokeWidth="2" fill="none" /> },
  { ruta: 'inventario', etiqueta: 'Inventario', icono: (c) => <path d="M3 7h18v13H3zM3 7l2-4h14l2 4" stroke={c} strokeWidth="2" fill="none" /> },
  { ruta: 'ventas', etiqueta: 'Ventas', icono: (c) => <path d="M2 3h2l2.6 12.6a2 2 0 002 1.4h8.8a2 2 0 002-1.6L21 7H6" stroke={c} strokeWidth="2" fill="none" /> }
];

export default function BottomNav({ activo, onNavegar }) {
  return (
    <div className="barra-navegacion">
      {ITEMS.map((item) => {
        const estaActivo = activo === item.ruta;
        const color = estaActivo ? 'var(--purple)' : '#6E6478';
        return (
          <button key={item.ruta} className={`item-nav ${estaActivo ? 'activo' : ''}`} onClick={() => onNavegar(item.ruta)}>
            <svg width="18" height="18" viewBox="0 0 24 24">{item.icono(color)}</svg>
            {item.etiqueta}
          </button>
        );
      })}
    </div>
  );
}

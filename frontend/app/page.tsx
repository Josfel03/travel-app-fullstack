"use client"; // Muy importante: le dice a Next.js que esto es un componente de cliente

import { useState, useEffect } from 'react';

// --- Definición de Tipos (¡Gracias, TypeScript!) ---
// La "forma" de los datos que esperamos de la API
interface Corrida {
  id: number;
  hora_salida: string;
  precio: string;
  capacidad: number;
}

interface AsientosInfo {
  capacidad_total: number;
  asientos_ocupados: number[];
}

interface ReservaConfirmada {
  message: string;
  reserva_id: number;
  codigo_reserva: string;
}

// --- Estado de la Reserva ---
// Un solo objeto para guardar todas las selecciones del usuario
interface ReservaState {
  ruta_id: number | null; // 1 para CH->CDMX, 2 para CDMX->CH
  ruta_nombre: string;
  fecha: string;
  corrida: Corrida | null;
  asientos: number[];
  nombre: string;
  telefono: string;
  email: string;
}

// --- Estado Inicial ---
const estadoInicialReserva: ReservaState = {
  ruta_id: null,
  ruta_nombre: '',
  fecha: new Date().toISOString().split('T')[0], // Pone la fecha de hoy por defecto
  corrida: null,
  asientos: [],
  nombre: '',
  telefono: '',
  email: '',
};

// --- Componente Principal ---
export default function Home() {
  // --- Estados de React ---
  const [pantalla, setPantalla] = useState('inicio'); // 'inicio', 'horarios', 'asientos', 'formulario', 'confirmacion'
  const [reserva, setReserva] = useState<ReservaState>(estadoInicialReserva);
  const [reservaConfirmada, setReservaConfirmada] = useState<ReservaConfirmada | null>(null);

  // Función para manejar la selección de ruta
  const handleSelectRuta = (id: number, nombre: string) => {
    setReserva(prev => ({ ...prev, ruta_id: id, ruta_nombre: nombre }));
    setPantalla('horarios');
  };

  // Función para volver al inicio y reiniciar todo
  const irAlInicio = () => {
    setReserva(estadoInicialReserva);
    setReservaConfirmada(null);
    setPantalla('inicio');
  };

  // --- Renderizado Condicional ---
  // Muestra un componente u otro basado en el estado 'pantalla'
  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-lg p-4 min-h-screen flex flex-col">
        
        <header className="text-center my-6">
          <h1 className="text-3xl font-bold text-brand-primary">Pacífico Tour</h1>
          <p className="text-gray-600">Viajes Turísticos Chilpancingo ↔ CDMX</p>
        </header>

        <main className="flex-grow">
          {pantalla === 'inicio' && (
            <PantallaInicio onSelectRuta={handleSelectRuta} />
          )}
          
          {pantalla === 'horarios' && (
            <PantallaHorarios
              reserva={reserva}
              setReserva={setReserva}
              setPantalla={setPantalla}
            />
          )}

          {pantalla === 'asientos' && (
            <PantallaAsientos
              reserva={reserva}
              setReserva={setReserva}
              setPantalla={setPantalla}
            />
          )}

          {pantalla === 'formulario' && (
            <PantallaFormulario
              reserva={reserva}
              setReserva={setReserva}
              setPantalla={setPantalla}
              setReservaConfirmada={setReservaConfirmada}
            />
          )}

          {pantalla === 'confirmacion' && (
            <PantallaConfirmacion
              reserva={reserva}
              reservaConfirmada={reservaConfirmada}
              onNuevaReserva={irAlInicio}
            />
          )}
        </main>
        
        <footer className="text-center mt-8 text-gray-400 text-sm">
          © 2025 Pacífico Tour. Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}

// ===========================================
// --- PANTALLA 1: INICIO ---
// ===========================================
function PantallaInicio({ onSelectRuta }: { onSelectRuta: (id: number, nombre: string) => void }) {
  return (
    <section className="pantalla space-y-4">
      <h2 className="text-xl font-semibold text-center text-gray-800">¿A dónde viajas hoy?</h2>
      
      {/* TODO: Estos IDs de ruta (1 y 2) deben venir de tu API de Rutas en el futuro */}
      <button 
        onClick={() => onSelectRuta(1, 'Chilpancingo → CDMX')}
        className="btn-ruta w-full text-left p-4 bg-white rounded-xl shadow-md flex items-center justify-between transition duration-300 hover:shadow-lg hover:bg-blue-50"
      >
        <div>
          <span className="text-lg font-bold text-brand-primary">Chilpancingo → CDMX</span>
          <span className="block text-sm text-gray-500">Salida desde Chilpancingo</span>
        </div>
        <i className="fas fa-chevron-right text-brand-primary text-xl"></i>
      </button>
      
      <button 
        onClick={() => onSelectRuta(2, 'CDMX → Chilpancingo')}
        className="btn-ruta w-full text-left p-4 bg-white rounded-xl shadow-md flex items-center justify-between transition duration-300 hover:shadow-lg hover:bg-blue-50"
      >
        <div>
          <span className="text-lg font-bold text-brand-primary">CDMX → Chilpancingo</span>
          <span className="block text-sm text-gray-500">Salida desde CDMX</span>
        </div>
        <i className="fas fa-chevron-right text-brand-primary text-xl"></i>
      </button>
    </section>
  );
}

// ===========================================
// --- PANTALLA 2: HORARIOS ---
// ===========================================
function PantallaHorarios({ reserva, setReserva, setPantalla }: any) {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- useEffect: Se ejecuta cuando el componente carga o la fecha/ruta cambia ---
  useEffect(() => {
    const fetchCorridas = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`http://localhost:5000/api/corridas?ruta_id=${reserva.ruta_id}&fecha=${reserva.fecha}`);
        if (!res.ok) {
          throw new Error('No se pudieron cargar las corridas');
        }
        const data: Corrida[] = await res.json();
        setCorridas(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCorridas();
  }, [reserva.ruta_id, reserva.fecha]); // Se vuelve a ejecutar si la ruta o fecha cambian

  const handleSelectCorrida = (corrida: Corrida) => {
    setReserva((prev: ReservaState) => ({ ...prev, corrida: corrida }));
    setPantalla('asientos');
  };

  return (
    <section className="pantalla space-y-3">
      <button onClick={() => setPantalla('inicio')} className="text-brand-secondary">
        <i className="fas fa-arrow-left"></i> Regresar
      </button>
      <h2 className="text-xl font-semibold text-center text-gray-800">Elige un horario</h2>
      <p className="text-center text-gray-600">{reserva.ruta_nombre}</p>

      {/* --- EL CALENDARIO QUE FALTABA --- */}
      <div className="py-2">
        <label htmlFor="fecha" className="block text-sm font-medium text-gray-700">Selecciona una fecha</label>
        <input 
          type="date" 
          id="fecha"
          value={reserva.fecha}
          onChange={e => setReserva((prev: ReservaState) => ({ ...prev, fecha: e.target.value }))}
          className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
        />
      </div>

      <div className="space-y-3">
        {loading && <p className="text-center">Cargando horarios...</p>}
        {error && <p className="text-center text-brand-alert">{error}</p>}
        {!loading && !error && corridas.length === 0 && (
          <p className="text-center text-gray-500">No hay corridas disponibles para esta fecha.</p>
        )}
        
        {corridas.map(corrida => (
          <button 
            key={corrida.id}
            onClick={() => handleSelectCorrida(corrida)}
            className="w-full p-4 bg-white rounded-xl shadow-md flex justify-between items-center transition hover:bg-blue-50"
          >
            <span className="text-lg font-bold text-brand-primary">{corrida.hora_salida}</span>
            <span className="text-lg font-semibold">${corrida.precio}</span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-brand-success text-white">Disponible</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ===========================================
// --- PANTALLA 3: ASIENTOS ---
// ===========================================
function PantallaAsientos({ reserva, setReserva, setPantalla }: any) {
  const [asientosInfo, setAsientosInfo] = useState<AsientosInfo>({ capacidad_total: 0, asientos_ocupados: [] });
  const [loading, setLoading] = useState(true);

  // --- useEffect: Carga los asientos de la corrida seleccionada ---
  useEffect(() => {
    const fetchAsientos = async () => {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/asientos?corrida_id=${reserva.corrida.id}`);
      const data: AsientosInfo = await res.json();
      setAsientosInfo(data);
      setLoading(false);
    };

    if (reserva.corrida) {
      fetchAsientos();
    }
  }, [reserva.corrida]);

  // --- Lógica de selección múltiple ---
  const handleSelectAsiento = (numAsiento: number) => {
    setReserva((prev: ReservaState) => {
      const asientos = prev.asientos;
      if (asientos.includes(numAsiento)) {
        // Si ya está, quitarlo
        return { ...prev, asientos: asientos.filter(a => a !== numAsiento) };
      } else {
        // Si no está, añadirlo
        return { ...prev, asientos: [...asientos, numAsiento] };
      }
    });
  };

  const renderAsientos = () => {
    if (loading) return <p className="text-center">Cargando asientos...</p>;

    let asientosLayout = [];
    for (let i = 1; i <= asientosInfo.capacidad_total; i++) {
      const isOcupado = asientosInfo.asientos_ocupados.includes(i);
      const isSeleccionado = reserva.asientos.includes(i);

      let clasesBoton = `asiento h-12 rounded-lg font-bold text-sm shadow-sm
                         transition-all duration-150 ease-in-out flex items-center justify-center`;
      
      if (isOcupado) {
        clasesBoton += ' bg-gray-200 text-gray-400 cursor-not-allowed';
      } else if (isSeleccionado) {
        clasesBoton += ' bg-brand-secondary text-white border-2 border-brand-primary scale-105';
      } else {
        clasesBoton += ' bg-white border-2 border-gray-400 cursor-pointer hover:scale-105 hover:border-brand-secondary';
      }

      asientosLayout.push(
        <button
          key={i}
          disabled={isOcupado}
          onClick={() => !isOcupado && handleSelectAsiento(i)}
          className={clasesBoton}
        >
          {i}
        </button>
      );
    }
    return asientosLayout;
  };

  return (
    <section className="pantalla">
      <button onClick={() => setPantalla('horarios')} className="text-brand-secondary">
        <i className="fas fa-arrow-left"></i> Regresar
      </button>
      <h2 className="text-xl font-semibold text-center text-gray-800">Selecciona tu(s) asiento(s)</h2>
      <p className="text-center text-gray-600 mb-4">
        {reserva.ruta_nombre} - {reserva.corrida?.hora_salida}
      </p>

      <div className="bg-white p-4 rounded-xl shadow-md max-w-xs mx-auto">
        <div className="text-center font-medium text-gray-500 mb-2">FRENTE (Conductor)</div>
        
        {/* Usamos grid-cols-4 para el layout simple, ¡puedes mejorarlo! */}
        <div className="grid grid-cols-4 gap-2 p-4">
          {renderAsientos()}
        </div>

        <div className="flex justify-center space-x-4 mt-4 text-sm">
          <span className="flex items-center"><div className="w-4 h-4 bg-gray-200 rounded mr-1"></div>Ocupado</span>
          <span className="flex items-center"><div className="w-4 h-4 bg-brand-secondary text-white rounded mr-1"></div>Seleccionado</span>
          <span className="flex items-center"><div className="w-4 h-4 border border-gray-400 rounded mr-1"></div>Disponible</span>
        </div>
      </div>

      <button 
        id="btn-confirmar-asiento" 
        onClick={() => setPantalla('formulario')}
        className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-xl shadow-lg transition hover:bg-opacity-90 disabled:opacity-50"
        disabled={reserva.asientos.length === 0} // Deshabilitado si no hay asientos
      >
        Confirmar {reserva.asientos.length} Asiento(s)
      </button>
    </section>
  );
}

// ===========================================
// --- PANTALLA 4: FORMULARIO ---
// ===========================================
function PantallaFormulario({ reserva, setReserva, setPantalla, setReservaConfirmada }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setReserva((prev: ReservaState) => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // TODO: Falta un sistema de login. Por ahora, asumimos que el usuario_id=1
    // (el que creamos en la base de datos)
    const payload = {
      corrida_id: reserva.corrida.id,
      usuario_id: 1, // REQUERIRÁ AUTENTICACIÓN EN EL FUTURO
      asientos: reserva.asientos,
      // Aquí también irían los datos de nombre, telefono, etc.
      // para crear el usuario si no existe.
    };

    try {
      const res = await fetch(`http://localhost:5000/api/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (res.status === 409) {
          const errData = await res.json();
          alert(`Error: Asientos ${errData.asientos_ocupados.join(', ')} ya no están disponibles.`);
          setPantalla('asientos'); // Manda al usuario de regreso
        } else {
          throw new Error('No se pudo crear la reserva');
        }
      } else {
        const data: ReservaConfirmada = await res.json();
        setReservaConfirmada(data);
        setPantalla('confirmacion');
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="pantalla">
      <button onClick={() => setPantalla('asientos')} className="text-brand-secondary">
        <i className="fas fa-arrow-left"></i> Regresar
      </button>
      <h2 className="text-xl font-semibold text-center text-gray-800">Datos del Pasajero</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="bg-white p-3 rounded-xl shadow">
          <p className="text-sm text-gray-600">Ruta: <strong className="text-brand-primary">{reserva.ruta_nombre}</strong></p>
          <p className="text-sm text-gray-600">Horario: <strong className="text-brand-primary">{reserva.corrida?.hora_salida}</strong></p>
          <p className="text-sm text-gray-600">Asientos: <strong className="text-brand-primary">{reserva.asientos.join(', ')}</strong></p>
        </div>

        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre Completo*</label>
          <input type="text" id="nombre" value={reserva.nombre} onChange={handleChange} className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm" required />
        </div>
        <div>
          <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono / WhatsApp (10 dígitos)*</label>
          <input type="tel" id="telefono" value={reserva.telefono} onChange={handleChange} maxLength={10} className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm" required />
          {/* TODO: Añadir validación de errores */}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Opcional)</label>
          <input type="email" id="email" value={reserva.email} onChange={handleChange} className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm" />
        </div>

        {error && <p className="text-center text-brand-alert">{error}</p>}

        <button 
          type="submit" 
          className="w-full bg-brand-success text-white font-bold py-3 rounded-xl shadow-lg transition hover:bg-opacity-90 disabled:bg-gray-400"
          disabled={loading}
        >
          {loading ? 'Reservando...' : 'Finalizar Reserva'}
        </button>
      </form>
    </section>
  );
}

// ===========================================
// --- PANTALLA 5: CONFIRMACIÓN ---
// ===========================================
function PantallaConfirmacion({ reserva, reservaConfirmada, onNuevaReserva }: any) {
  return (
    <section className="pantalla text-center">
      <i className="fas fa-check-circle text-brand-success text-6xl mb-4"></i>
      <h2 className="text-2xl font-bold text-gray-800">¡Reserva Confirmada!</h2>
      
      <div className="bg-white p-4 rounded-xl shadow-md my-6 text-left space-y-2">
        <p><strong>Código de Reserva:</strong></p>
        <p className="text-2xl font-bold text-brand-primary text-center bg-brand-light-gray py-2 rounded-lg">
          {reservaConfirmada?.codigo_reserva}
        </p>
        
        <p><strong>Pasajero:</strong> {reserva.nombre}</p>
        <p><strong>Ruta:</strong> {reserva.ruta_nombre}</p>
        <p><strong>Horario:</strong> {reserva.corrida?.hora_salida}</p>
        <p><strong>Asientos:</strong> {reserva.asientos.join(', ')}</p>
      </div>
      
      <p className="text-gray-600">Recibirás los detalles de pago por WhatsApp.</p>
      
      {/* TODO: Generar el mensaje de WhatsApp dinámicamente */}
      <a id="btn-whatsapp" href="#" target="_blank" className="mt-6 w-full bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg transition hover:bg-opacity-90 flex items-center justify-center">
        <i className="fab fa-whatsapp text-2xl mr-2"></i> Compartir por WhatsApp
      </a>

      <button onClick={onNuevaReserva} className="mt-4 w-full text-brand-secondary font-medium py-2">
        Hacer una nueva reserva
      </button>
    </section>
  );
}
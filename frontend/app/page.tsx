"use client"; 

import { useState, useEffect } from 'react';

// --- Definición de Tipos (¡Gracias, TypeScript!) ---
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

// --- NUEVA ESTRUCTURA PARA CADA PASAJERO ---
interface Pasajero {
  nombre: string;
  telefono: string;
  email: string;
}

// --- Estado de la Reserva (Actualizado) ---
interface ReservaState {
  ruta_id: number | null; 
  ruta_nombre: string;
  fecha: string;
  corrida: Corrida | null;
  asientos: number[]; // Sigue siendo la lista de números [5, 6]
  pasajeros: Map<number, Pasajero>; // Un "mapa" que liga un Asiento (ej. 5) a un Pasajero
}

// --- Estado Inicial (Actualizado) ---
const estadoInicialPasajero: Pasajero = {
  nombre: '',
  telefono: '',
  email: '',
};

const estadoInicialReserva: ReservaState = {
  ruta_id: null,
  ruta_nombre: '',
  fecha: new Date().toISOString().split('T')[0],
  corrida: null,
  asientos: [],
  pasajeros: new Map(), // Inicia como un mapa vacío
};

// --- Componente Principal ---
export default function Home() {
  const [pantalla, setPantalla] = useState('inicio');
  const [reserva, setReserva] = useState<ReservaState>(estadoInicialReserva);
  const [reservaConfirmada, setReservaConfirmada] = useState<ReservaConfirmada | null>(null);

  const handleSelectRuta = (id: number, nombre: string) => {
    setReserva(prev => ({ ...prev, ruta_id: id, ruta_nombre: nombre }));
    setPantalla('horarios');
  };

  const irAlInicio = () => {
    setReserva(estadoInicialReserva);
    setReservaConfirmada(null);
    setPantalla('inicio');
  };

  // --- Renderizado Condicional ---
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
// --- PANTALLA 1: INICIO (Sin cambios) ---
// ===========================================
function PantallaInicio({ onSelectRuta }: { onSelectRuta: (id: number, nombre: string) => void }) {
  return (
    <section className="pantalla space-y-4">
      <h2 className="text-xl font-semibold text-center text-gray-800">¿A dónde viajas hoy?</h2>
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
// --- PANTALLA 2: HORARIOS (Sin cambios) ---
// ===========================================
function PantallaHorarios({ reserva, setReserva, setPantalla }: any) {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCorridas = async () => {
      setLoading(true);
      setError('');
      try {
        // Asegúrate que tu backend (Flask) esté corriendo en el puerto 5000
        const res = await fetch(`http://localhost:5000/api/corridas?ruta_id=${reserva.ruta_id}&fecha=${reserva.fecha}`);
        if (!res.ok) throw new Error('No se pudieron cargar las corridas');
        const data: Corrida[] = await res.json();
        setCorridas(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (reserva.ruta_id) {
      fetchCorridas();
    }
  }, [reserva.ruta_id, reserva.fecha]); 

  const handleSelectCorrida = (corrida: Corrida) => {
    setReserva((prev: ReservaState) => ({ ...prev, corrida: corrida, asientos: [], pasajeros: new Map() })); // Resetea asientos y pasajeros
    setPantalla('asientos');
  };

  return (
    <section className="pantalla space-y-3">
      <button onClick={() => setPantalla('inicio')} className="text-brand-secondary">
        <i className="fas fa-arrow-left"></i> Regresar
      </button>
      <h2 className="text-xl font-semibold text-center text-gray-800">Elige un horario</h2>
      <p className="text-center text-gray-600">{reserva.ruta_nombre}</p>

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
// --- PANTALLA 3: ASIENTOS (ACTUALIZADO) ---
// ===========================================
function PantallaAsientos({ reserva, setReserva, setPantalla }: any) {
  const [asientosInfo, setAsientosInfo] = useState<AsientosInfo>({ capacidad_total: 0, asientos_ocupados: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAsientos = async () => {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/asientos?corrida_id=${reserva.corrida.id}`);
      const data: AsientosInfo = await res.json();
      setAsientosInfo(data);
      setLoading(false);
    };
    if (reserva.corrida) fetchAsientos();
  }, [reserva.corrida]);

  // --- Lógica de selección múltiple (ACTUALIZADA) ---
  const handleSelectAsiento = (numAsiento: number) => {
    setReserva((prev: ReservaState) => {
      const nuevosAsientos = [...prev.asientos];
      const nuevosPasajeros = new Map(prev.pasajeros);

      if (nuevosAsientos.includes(numAsiento)) {
        // Si ya está, quitarlo
        const index = nuevosAsientos.indexOf(numAsiento);
        nuevosAsientos.splice(index, 1);
        nuevosPasajeros.delete(numAsiento); // Elimina el pasajero del mapa
      } else {
        // Si no está, añadirlo
        nuevosAsientos.push(numAsiento);
        nuevosPasajeros.set(numAsiento, { ...estadoInicialPasajero }); // Añade un pasajero vacío
      }

      return { ...prev, asientos: nuevosAsientos, pasajeros: nuevosPasajeros };
    });
  };

  const renderAsientos = () => {
    if (loading) return <p className="text-center">Cargando asientos...</p>;
    let asientosLayout = [];
    for (let i = 1; i <= asientosInfo.capacidad_total; i++) {
      const isOcupado = asientosInfo.asientos_ocupados.includes(i);
      const isSeleccionado = reserva.asientos.includes(i);
      let clasesBoton = `asiento h-12 rounded-lg font-bold text-sm shadow-sm transition-all duration-150 ease-in-out flex items-center justify-center`;
      if (isOcupado) clasesBoton += ' bg-gray-200 text-gray-400 cursor-not-allowed';
      else if (isSeleccionado) clasesBoton += ' bg-brand-secondary text-white border-2 border-brand-primary scale-105';
      else clasesBoton += ' bg-white border-2 border-gray-400 cursor-pointer hover:scale-105 hover:border-brand-secondary';
      asientosLayout.push(
        <button key={i} disabled={isOcupado} onClick={() => !isOcupado && handleSelectAsiento(i)} className={clasesBoton}>
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
        <div className="grid grid-cols-4 gap-2 p-4">{renderAsientos()}</div>
        <div className="flex justify-center space-x-4 mt-4 text-sm">
          <span className="flex items-center"><div className="w-4 h-4 bg-gray-200 rounded mr-1"></div>Ocupado</span>
          <span className="flex items-center"><div className="w-4 h-4 bg-brand-secondary text-white rounded mr-1"></div>Seleccionado</span>
          <span className="flex items-center"><div className="w-4 h-4 border border-gray-400 rounded mr-1"></div>Disponible</span>
        </div>
      </div>
      <button 
        onClick={() => setPantalla('formulario')}
        className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-xl shadow-lg transition hover:bg-opacity-90 disabled:opacity-50"
        disabled={reserva.asientos.length === 0}
      >
        Confirmar {reserva.asientos.length} Asiento(s)
      </button>
    </section>
  );
}

// ===========================================
// --- PANTALLA 4: FORMULARIO (ACTUALIZADO) ---
// ===========================================
function PantallaFormulario({ reserva, setReserva, setPantalla, setReservaConfirmada }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- NUEVA LÓGICA: Maneja el cambio en un formulario de pasajero específico ---
  const handlePasajeroChange = (asientoNum: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setReserva((prev: ReservaState) => {
      const nuevosPasajeros = new Map(prev.pasajeros);
      const pasajero = nuevosPasajeros.get(asientoNum);
      if (pasajero) {
        nuevosPasajeros.set(asientoNum, { ...pasajero, [id]: value });
      }
      return { ...prev, pasajeros: nuevosPasajeros };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // --- NUEVO PAYLOAD: Convierte el Mapa a una lista que el backend entienda ---
    const pasajerosArray = [...reserva.pasajeros.entries()].map(([asiento, data]) => ({
      asiento: asiento,
      nombre: data.nombre,
      telefono: data.telefono,
      email: data.email
    }));

    const payload = {
      corrida_id: reserva.corrida.id,
      pasajeros: pasajerosArray,
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
          setPantalla('asientos'); 
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
      <h2 className="text-xl font-semibold text-center text-gray-800">Datos de los Pasajeros</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        {/* --- BUCLE: Renderiza un formulario por cada asiento --- */}
        {[...reserva.pasajeros.entries()].map(([asientoNum, pasajero]) => (
          <div key={asientoNum} className="bg-white p-4 rounded-xl shadow-md">
            <h3 className="text-lg font-bold text-brand-primary mb-3">
              Pasajero - Asiento #{asientoNum}
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre Completo*</label>
                <input 
                  type="text" 
                  id="nombre" 
                  value={pasajero.nombre}
                  onChange={(e) => handlePasajeroChange(asientoNum, e)}
                  className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm" required 
                />
              </div>
              <div>
                <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono / WhatsApp (10 dígitos)*</label>
                <input 
                  type="tel" 
                  id="telefono" 
                  value={pasajero.telefono}
                  onChange={(e) => handlePasajeroChange(asientoNum, e)}
                  maxLength={10} 
                  className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm" required 
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Opcional)</label>
                <input 
                  type="email" 
                  id="email" 
                  value={pasajero.email}
                  onChange={(e) => handlePasajeroChange(asientoNum, e)}
                  className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm" 
                />
              </div>
            </div>
          </div>
        ))}
        
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

/// ===========================================
// --- PANTALLA 5: CONFIRMACIÓN (ACTUALIZADO CON QR) ---
// ===========================================
function PantallaConfirmacion({ reserva, reservaConfirmada, onNuevaReserva }: any) {
  // Obtenemos el nombre del primer pasajero para mostrar
  const primerPasajero = reserva.pasajeros.values().next().value?.nombre || "N/A";

  return (
    <section className="pantalla text-center">
      <i className="fas fa-check-circle text-brand-success text-6xl mb-4"></i>
      <h2 className="text-2xl font-bold text-gray-800">¡Reserva Confirmada!</h2>
      
      <div className="bg-white p-4 rounded-xl shadow-md my-6 text-left space-y-2">
        
        <p className="text-center font-medium">Escanea tu código para abordar:</p>
        
        {/* --- AQUÍ ESTÁ LA MAGIA --- */}
        {/* Si existe un código de reserva, crea una etiqueta de imagen.
          El 'src' de la imagen es la URL de tu API de Flask.
        */}
        {reservaConfirmada?.codigo_reserva && (
          <img 
            src={`http://localhost:5000/api/ticket/qr/${reservaConfirmada.codigo_reserva}`}
            alt={`Código QR para ${reservaConfirmada.codigo_reserva}`}
            className="w-full max-w-xs mx-auto rounded-lg shadow-md"
          />
        )}
        {/* --- FIN DE LA MAGIA --- */}

        <p className="text-center text-sm text-gray-500 pt-2">
          Código: {reservaConfirmada?.codigo_reserva}
        </p>
        
        <hr className="my-4"/>

        <p><strong>Pasajero(s):</strong> {primerPasajero} {reserva.asientos.length > 1 ? `y ${reserva.asientos.length - 1} más` : ''}</p>
        <p><strong>Ruta:</strong> {reserva.ruta_nombre}</p>
        <p><strong>Horario:</strong> {reserva.corrida?.hora_salida}</p>
        <p><strong>Asientos:</strong> {reserva.asientos.join(', ')}</p>
      </div>
      
      <p className="text-gray-600">Recibirás los detalles de pago por WhatsApp.</p>
      
      <a id="btn-whatsapp" href="#" target="_blank" className="mt-6 w-full bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg transition hover:bg-opacity-90 flex items-center justify-center">
        <i className="fab fa-whatsapp text-2xl mr-2"></i> Compartir por WhatsApp
      </a>

      <button onClick={onNuevaReserva} className="mt-4 w-full text-brand-secondary font-medium py-2">
        Hacer una nueva reserva
      </button>
    </section>
  );
}
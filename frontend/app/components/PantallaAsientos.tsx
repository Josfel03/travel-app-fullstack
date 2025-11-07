"use client";
import React, { useEffect, useState } from 'react';
import { AsientosInfo, ReservaState, Pasajero } from '../types'; // Importamos los tipos
import { useRouter } from 'next/navigation'; // Necesario para useRouter

// --- Props ---
interface Props {
  reserva: ReservaState;
  setReserva: React.Dispatch<React.SetStateAction<ReservaState>>;
  setPantalla: React.Dispatch<React.SetStateAction<string>>;
}

const estadoInicialPasajero: Pasajero = {
  nombre: '',
  telefono: '',
  email: '',
};

export default function PantallaAsientos({ reserva, setReserva, setPantalla }: Props) {
  const [asientosInfo, setAsientosInfo] = useState<AsientosInfo>({ capacidad_total: 0, asientos_ocupados: [], error: undefined }); // CORRECCIÓN
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBlocking, setIsBlocking] = useState(false); // Estado para el bloqueo

  // --- Cargar el estado de los asientos ---
  useEffect(() => {
    const fetchAsientos = async () => {
      setLoading(true);
      setError(null);
      try {
        // La API ahora devuelve asientos OCUPADOS Y BLOQUEADOS
        const res = await fetch(`http://localhost:5000/api/asientos?corrida_id=${reserva.corrida!.id}`);
        const data: AsientosInfo = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'No se pudieron cargar los asientos');
        }

        setAsientosInfo(data);
      } catch (err: any) {
        setError(err.message || "Error al cargar el mapa de asientos.");
      } finally {
        setLoading(false);
      }
    };
    if (reserva.corrida) fetchAsientos();
  }, [reserva.corrida]);

  // --- Manejador de Clic en Asiento (Tu Lógica Antigua) ---
  // --- Manejador de Clic en Asiento (Versión Final Definitiva) ---
  const handleSelectAsiento = (numAsiento: number) => {
    if (asientosInfo.asientos_ocupados.includes(numAsiento)) {
      return; 
    }
    
    // Bandera local para saber si el cambio es válido
    let esCambioValido = false; 
    
    setReserva((prev) => {
      const nuevosAsientos = [...prev.asientos];
      const nuevosPasajeros = new Map(prev.pasajeros);
      
      if (nuevosAsientos.includes(numAsiento)) {
        // Quitar asiento
        const index = nuevosAsientos.indexOf(numAsiento);
        nuevosAsientos.splice(index, 1);
        nuevosPasajeros.delete(numAsiento);
        esCambioValido = true;
      } else if (nuevosAsientos.length < 5) {
        // Añadir asiento
        nuevosAsientos.push(numAsiento);
        nuevosPasajeros.set(numAsiento, { ...estadoInicialPasajero });
        esCambioValido = true;
      } else {
        // Límite de 5 alcanzado: Mostramos el error *después* del return
        setError('Solo puedes seleccionar hasta 5 asientos por reserva.');
        return prev; 
      }
      
      // La limpieza de error ahora se hace en el siguiente bloque.
      
      return { ...prev, asientos: nuevosAsientos, pasajeros: nuevosPasajeros };
    });

    // 2. CORRECCIÓN: Si el cambio fue válido, limpiamos el error AQUÍ,
    //    fuera de la actualización del estado SetReserva, evitando el conflicto.
    if (esCambioValido) {
        setError(null);
    }
  };

  // --- Manejador para BLOQUEAR Asientos e Ir al Formulario (Lógica Nueva) ---
  const handleConfirmar = async () => {
    if (reserva.asientos.length === 0) {
      setError("Por favor, selecciona al menos un asiento.");
      return;
    }

    setIsBlocking(true);
    setError(null);

    try {
      // 1. Llamar al endpoint para BLOQUEAR los asientos seleccionados
      const res = await fetch('http://localhost:5000/api/bloquear-asientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrida_id: reserva.corrida!.id,
          asientos: reserva.asientos,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Si el backend da 409 (Conflicto), alguien más los tomó o están reservados
        throw new Error(data.error || 'Error al reservar asientos. Intenta de nuevo.');
      }

      // 2. Éxito: Pasar al formulario
      setPantalla('formulario');

   } catch (err: any) {
      console.error(err);
      
      // Si el error incluye 'bloqueados' (viene del backend 409), actualizamos el mapa
      if (err.message.includes("bloqueados") || err.message.includes("colisión") || err.message.includes("tomados")) {
        setError("Lo sentimos, uno o más asientos han sido tomados. Actualiza el mapa para ver el nuevo estado.");
      } else {
        setError(err.message || "Error al confirmar los asientos.");
      }
      
      // CORRECCIÓN CRÍTICA: Forzamos la recarga del mapa de asientos
      // para que el cliente vea que sus asientos han sido ocupados.
      setLoading(true); 
      setReserva(prev => ({ ...prev, asientos: [] })); // Limpiamos la selección fallida
      
    } finally {
      setIsBlocking(false);
    }
  };


  // --- Renderizado de Asientos (Tu Lógica Anterior Simple) ---
  // --- Renderizado de Asientos tipo Combi ---
const renderAsientos = () => {
  if (loading) return <p className="text-center">Cargando asientos...</p>;
  if (asientosInfo.capacidad_total === 0)
    return <p className="text-center text-brand-alert">No hay asientos disponibles.</p>;

  const filas = [
    [1, 3, 6, 9, 12, 15],
    [2, 4, 7, 10, 13, 16],
    [5, 8, 11, 14, 18],
    [20, 19],       // Fila 1 (atrás)
   
    
    
  ];

  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Icono del Conductor */}
      <div className="flex items-center justify-center text-gray-400 opacity-60 mb-2">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 14m-8 0a8 8 0 1 0 16 0 8 8 0 1 0 -16 0"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 14m-3 0a3 3 0 1 0 6 0 3 3 0 1 0 -6 0"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 2v3m0 14v3"></path>
        </svg>
      </div>

      {/* Asientos por filas */}
      {filas.map((fila, idx) => (
        <div key={idx} className="flex justify-center space-x-2">
          {fila.map((num) => {
            const isOcupado = asientosInfo.asientos_ocupados.includes(num);
            const isSeleccionado = reserva.asientos.includes(num);
            let clases =
              "w-10 h-10 rounded-md flex items-center justify-center text-sm font-semibold shadow transition-all";

            if (isOcupado) clases += " bg-gray-300 text-gray-500 cursor-not-allowed";
            else if (isSeleccionado)
              clases += " bg-brand-secondary text-white border-2 border-brand-primary scale-105";
            else
              clases +=
                " bg-white border-2 border-gray-400 hover:scale-105 hover:border-brand-secondary cursor-pointer";

            return (
              <button
                key={num}
                disabled={isOcupado}
                onClick={() => handleSelectAsiento(num)}
                className={clases}
              >
                {num}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
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
      {/* Mapa Visual de la Combi */}
        <div className="bg-white p-4 rounded-xl shadow-md max-w-md mx-auto">
          <div className="text-center font-medium text-gray-500 mb-2">FRENTE (Conductor)</div>
          {renderAsientos()}

          {/* Leyenda */}
          <div className="flex justify-center space-x-4 mt-6 text-sm">
            <span className="flex items-center"><div className="w-4 h-4 bg-gray-300 rounded mr-1"></div>Ocupado</span>
            <span className="flex items-center"><div className="w-4 h-4 bg-brand-secondary rounded mr-1"></div>Seleccionado</span>
            <span className="flex items-center"><div className="w-4 h-4 border border-gray-400 rounded mr-1"></div>Disponible</span>
          </div>
        </div>

      
      {/* Resumen y Botón de Confirmar */}
      <div className="mt-6 p-4 bg-white rounded-xl shadow-md">
          <p className="text-lg font-bold">
            Asientos Seleccionados: <span className="text-brand-primary">{reserva.asientos.join(', ') || 'Ninguno'}</span>
          </p>
          <p className="text-sm text-gray-600">Total: {reserva.asientos.length} asiento(s)</p>
          
          {error && <p className="text-brand-alert text-sm mt-2">{error}</p>}

          <button 
            onClick={handleConfirmar}
            disabled={reserva.asientos.length === 0 || isBlocking}
            className="w-full mt-4 bg-brand-primary text-white font-bold py-3 rounded-xl shadow-lg transition hover:bg-opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isBlocking ? 'Confirmando...' : `Confirmar ${reserva.asientos.length} Asiento(s)`}
          </button>
      </div>

    </section>
  );
}
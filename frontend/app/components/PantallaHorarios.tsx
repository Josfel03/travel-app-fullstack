"use client";
import React, { useState, useEffect } from 'react';
import { Corrida, ReservaState } from '../types'; // Importamos los tipos

interface Props {
  reserva: ReservaState;
  setReserva: React.Dispatch<React.SetStateAction<ReservaState>>;
  setPantalla: React.Dispatch<React.SetStateAction<string>>;
}

export default function PantallaHorarios({ reserva, setReserva, setPantalla }: Props) {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // useEffect se queda aquí, ya que es lógica de ESTA pantalla
  useEffect(() => {
    const fetchCorridas = async () => {
      setLoading(true);
      setError('');
      try {
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
  }, [reserva.ruta_id, reserva.fecha]); // Se vuelve a ejecutar si la ruta o fecha cambian

  const handleSelectCorrida = (corrida: Corrida) => {
    setReserva((prev) => ({ ...prev, corrida: corrida, asientos: [], pasajeros: new Map() })); // Resetea asientos y pasajeros
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
          onChange={e => setReserva((prev) => ({ ...prev, fecha: e.target.value }))}
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
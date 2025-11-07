"use client";
import React, { useState, useEffect } from 'react';
import { ReservaState, AsientosInfo, Pasajero } from '../types';

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
  const [asientosInfo, setAsientosInfo] = useState<AsientosInfo>({ capacidad_total: 0, asientos_ocupados: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAsientos = async () => {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/asientos?corrida_id=${reserva.corrida!.id}`); // ! asume que corrida no es null
      const data: AsientosInfo = await res.json();
      setAsientosInfo(data);
      setLoading(false);
    };
    if (reserva.corrida) fetchAsientos();
  }, [reserva.corrida]);

  const handleSelectAsiento = (numAsiento: number) => {
    setReserva((prev) => {
      const nuevosAsientos = [...prev.asientos];
      const nuevosPasajeros = new Map(prev.pasajeros);

      if (nuevosAsientos.includes(numAsiento)) {
        const index = nuevosAsientos.indexOf(numAsiento);
        nuevosAsientos.splice(index, 1);
        nuevosPasajeros.delete(numAsiento);
      } else {
        nuevosAsientos.push(numAsiento);
        nuevosPasajeros.set(numAsiento, { ...estadoInicialPasajero });
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
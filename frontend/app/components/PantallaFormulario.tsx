"use client";
import React, { useState } from 'react';
import { ReservaState, ReservaConfirmada } from '../types';

interface Props {
  reserva: ReservaState;
  setReserva: React.Dispatch<React.SetStateAction<ReservaState>>;
  setPantalla: React.Dispatch<React.SetStateAction<string>>;
  setReservaConfirmada: React.Dispatch<React.SetStateAction<ReservaConfirmada | null>>;
}

export default function PantallaFormulario({ reserva, setReserva, setPantalla, setReservaConfirmada }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasajeroChange = (asientoNum: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setReserva((prev) => {
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

    const pasajerosArray = [...reserva.pasajeros.entries()].map(([asiento, data]) => ({
      asiento: asiento,
      nombre: data.nombre,
      telefono: data.telefono,
      email: data.email
    }));

    const payload = {
      corrida_id: reserva.corrida!.id, // ! asume que corrida no es null
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
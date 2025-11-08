"use client";
import React from 'react';
// CORRECCIÓN: Usamos rutas absolutas con '@/' que apunta a 'src/'
import { ReservaState, ReservaConfirmada } from '@/app/types';

interface Props {
  reserva: ReservaState;
  reservaConfirmada: ReservaConfirmada | null;
  onNuevaReserva: () => void;
}

export default function PantallaConfirmacion({ reserva, reservaConfirmada, onNuevaReserva }: Props) {
  const primerPasajero = reserva.pasajeros.values().next().value?.nombre || "N/A";

  return (
    <section className="pantalla text-center">
      <i className="fas fa-check-circle text-brand-success text-6xl mb-4"></i>
      <h2 className="text-2xl font-bold text-gray-800">¡Reserva Confirmada!</h2>
      
      <div className="bg-white p-4 rounded-xl shadow-md my-6 text-left space-y-2">
        
        <p className="text-center font-medium">Escanea tu código para abordar:</p>
        
        {reservaConfirmada?.codigo_reserva && (
          <img 
            src={`${process.env.NEXT_PUBLIC_API_URL}/api/ticket/qr/${reservaConfirmada.codigo_reserva}`}
            alt={`Código QR para ${reservaConfirmada.codigo_reserva}`}
            className="w-full max-w-xs mx-auto rounded-lg shadow-md"
          />
        )}

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
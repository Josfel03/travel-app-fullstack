"use client";
import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation'; // Importa el hook

// Esta página se muestra cuando Stripe redirige al usuario de vuelta
export default function PagoExitosoPage() {
  
  // --- ¡AQUÍ ESTÁ LA MAGIA! ---
  // 1. Usamos 'useSearchParams' para leer los parámetros de la URL
  const searchParams = useSearchParams();
  
  // 2. Obtenemos nuestro código de reserva que pasamos a través de Stripe
  const codigoReserva = searchParams.get('reserva_code');
  
  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-lg p-4 min-h-screen flex flex-col items-center justify-center text-center">
        <i className="fas fa-check-circle text-brand-success text-8xl mb-6"></i>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">¡Pago Exitoso!</h1>
        <p className="text-gray-600 text-lg mb-8">
          Tu reserva ha sido confirmada.
        </p>
        
        {/* 3. Mostramos el QR solo si tenemos el 'codigoReserva' */}
        {codigoReserva ? (
          <div className="bg-white p-4 rounded-xl shadow-md my-6 w-full max-w-xs">
            <p className="text-center font-medium mb-4">Escanea tu código para abordar:</p>
            <img 
              src={`http://localhost:5000/api/ticket/qr/${codigoReserva}`}
              alt={`Código QR para ${codigoReserva}`}
              className="w-full mx-auto rounded-lg"
            />
            <p className="text-center text-sm text-gray-500 pt-4">
              Código: <strong>{codigoReserva}</strong>
            </p>
          </div>
        ) : (
          <p className="text-brand-alert">No se pudo encontrar el código de reserva.</p>
        )}
        
        <Link href="/" className="mt-8 bg-brand-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg transition hover:bg-opacity-90">
            Hacer otra reserva
        </Link>
      </div>
    </div>
  );
}
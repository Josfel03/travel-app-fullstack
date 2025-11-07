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
      {/* 3. Mostramos el BOTÓN DE PDF solo si tenemos el 'codigoReserva' */}
      {codigoReserva ? (
        <div className="bg-white p-6 rounded-xl shadow-md my-6 w-full max-w-xs">
          <p className="text-center font-medium mb-4">¡Tu boleto está listo!</p>

          {/* --- ¡AQUÍ ESTÁ EL CAMBIO! --- */}
          {/* Reemplazamos el <img> por un <a> (enlace) estilizado como botón */}
          <a 
            href={`http://localhost:5000/api/ticket/pdf/${codigoReserva}`}
            target="_blank" // Abre el PDF en una nueva pestaña
            rel="noopener noreferrer"
            className="w-full p-4 bg-brand-alert text-white font-bold rounded-xl shadow-lg transition hover:bg-opacity-90 flex items-center justify-center text-lg"
          >
            <i className="fas fa-file-pdf mr-3"></i>
            Descargar mi Boleto (PDF)
          </a>
          {/* --- FIN DEL CAMBIO --- */}

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
"use client"; // ¡Importante! Esto lo marca como componente de cliente
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function PagoExitosoCliente() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  const [estado, setEstado] = useState<'cargando' | 'pagado' | 'error'>('cargando');
  const [codigoReserva, setCodigoReserva] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Lógica de "Sondeo" (Polling) ---
  useEffect(() => {
    if (!sessionId) {
      setError("No se proporcionó una ID de sesión de pago.");
      setEstado('error');
      return;
    }

    const fetchEstadoReserva = async () => {
      try {
        // Usamos la variable de entorno para la URL de la API
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_URL}/api/estado-reserva-por-session?session_id=${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "No se pudo encontrar la reserva.");
        }

        if (data.estado_pago === 'pagado') {
          setCodigoReserva(data.codigo_reserva);
          setEstado('pagado');
          if (intervalRef.current) {
            clearInterval(intervalRef.current); 
          }
        } else {
          console.log("Estado aún pendiente, volviendo a intentar en 2s...");
        }

      } catch (err: any) {
        setError(err.message);
        setEstado('error');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    };

    fetchEstadoReserva();
    intervalRef.current = setInterval(fetchEstadoReserva, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionId]);

  // --- Renderizado Condicional ---
  const renderContent = () => {
    switch (estado) {
      case 'cargando':
        return (
          <>
            <i className="fas fa-spinner fa-spin text-brand-primary text-6xl mb-6"></i>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Confirmando pago...</h1>
            <p className="text-gray-500">Esto puede tardar unos segundos.</p>
          </>
        );

      case 'error':
        return (
          <>
            <i className="fas fa-times-circle text-brand-alert text-8xl mb-6"></i>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Error en la Reserva</h1>
            <p className="text-gray-600 text-lg mb-8">{error}</p>
          </>
        );

      case 'pagado':
        // Usamos la variable de entorno para la URL de la API
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        return (
          <>
            <i className="fas fa-check-circle text-brand-success text-8xl mb-6"></i>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">¡Pago Exitoso!</h1>
            <p className="text-gray-600 text-lg mb-8">
              Tu reserva ha sido confirmada.
            </p>
            
            <div className="bg-white p-6 rounded-xl shadow-md my-6 w-full max-w-xs">
              <p className="text-center font-medium mb-4">¡Tu boleto está listo!</p>
              <a 
                href={`${API_URL}/api/ticket/pdf/${codigoReserva}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-4 bg-brand-alert text-white font-bold rounded-xl shadow-lg transition hover:bg-opacity-90 flex items-center justify-center text-lg"
              >
                <i className="fas fa-file-pdf mr-3"></i>
                Descargar mi Boleto (PDF)
              </a>
              <p className="text-center text-sm text-gray-500 pt-4">
                Código: <strong>{codigoReserva}</strong>
              </p>
            </div>
          </>
        );
    }
  };

  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-lg p-4 min-h-screen flex flex-col items-center justify-center text-center">
        {renderContent()}
        <Link href="/" className="mt-8 bg-brand-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg transition hover:bg-opacity-90">
            Hacer otra reserva
        </Link>
      </div>
    </div>
  );
}
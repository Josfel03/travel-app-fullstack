"use client";
import React from 'react';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default function PagoCanceladoPage() {
  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-lg p-4 min-h-screen flex flex-col items-center justify-center text-center">
        <i className="fas fa-times-circle text-brand-alert text-8xl mb-6"></i>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Pago Cancelado</h1>
        <p className="text-gray-600 text-lg mb-8">
          Tu reserva fue cancelada porque el pago no se completó. 
          Los asientos han sido liberados (o lo serán en 10 minutos).
        </p>
        
        <Link href="/" className="mt-8 bg-brand-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg transition hover:bg-opacity-90">
            Volver a Intentar
        </Link>
      </div>
    </div>
  );
}
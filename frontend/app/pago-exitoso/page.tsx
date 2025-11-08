import React, { Suspense } from 'react';
import PagoExitosoCliente from './PagoExitosoCliente'; // Importamos el componente que acabamos de crear

// --- Componente de Carga (Fallback) ---
// Esto es lo que se muestra MIENTRAS se carga el componente de cliente
function LoadingFallback() {
  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-lg p-4 min-h-screen flex flex-col items-center justify-center text-center">
        <i className="fas fa-spinner fa-spin text-brand-primary text-6xl mb-6"></i>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Cargando página de confirmación...</h1>
      </div>
    </div>
  );
}

// --- Página Principal (Componente de Servidor) ---
export default function PagoExitosoPage() {
  // Esta página ahora solo envuelve el componente de cliente
  // en un Límite de Suspenso (Suspense boundary)
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PagoExitosoCliente />
    </Suspense>
  );
}
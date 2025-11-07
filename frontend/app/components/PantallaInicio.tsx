
import React from 'react';

// Este componente solo recibe una función (onSelectRuta) como prop
interface Props {
  onSelectRuta: (id: number, nombre: string) => void;
}

export default function PantallaInicio({ onSelectRuta }: Props) {
  return (
    <section className="pantalla space-y-4">
      <h2 className="text-xl font-semibold text-center text-gray-800">¿A dónde viajas hoy?</h2>
      
      <button 
        onClick={() => onSelectRuta(1, 'Chilpancingo → CDMX')}
        className="btn-ruta w-full text-left p-4 bg-white rounded-xl shadow-md flex items-center justify-between transition duration-300 hover:shadow-lg hover:bg-blue-50"
      >
        <div>
          <span className="text-lg font-bold text-brand-primary">Chilpancingo → CDMX</span>
          <span className="block text-sm text-gray-500">Salida desde Chilpancingo</span>
        </div>
        <i className="fas fa-chevron-right text-brand-primary text-xl"></i>
      </button>
      
      <button 
        onClick={() => onSelectRuta(2, 'CDMX → Chilpancingo')}
        className="btn-ruta w-full text-left p-4 bg-white rounded-xl shadow-md flex items-center justify-between transition duration-300 hover:shadow-lg hover:bg-blue-50"
      >
        <div>
          <span className="text-lg font-bold text-brand-primary">CDMX → Chilpancingo</span>
          <span className="block text-sm text-gray-500">Salida desde CDMX</span>
        </div>
        <i className="fas fa-chevron-right text-brand-primary text-xl"></i>
      </button>
    </section>
  );
}
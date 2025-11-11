"use client"; 

import { useState } from 'react';
export const dynamic = 'force-dynamic';
// --- Importamos nuestros Tipos y Componentes ---
// CORRECCIÓN: Las rutas ahora apuntan a la raíz (sin /src)
import { ReservaState, ReservaConfirmada, Pasajero } from './types'; // '@/' apunta a 'frontend/'
import PantallaInicio from './components/PantallaInicio'; // '@/' apunta a 'frontend/'
import PantallaHorarios from './components/PantallaHorarios';
import PantallaAsientos from './components/PantallaAsientos';
import PantallaFormulario from './components/PantallaFormulario';
import PantallaConfirmacion from './components/PantallaConfirmacion';

// --- Estado Inicial ---
const estadoInicialPasajero: Pasajero = {
  nombre: '',
  telefono: '',
  email: '',
};

const estadoInicialReserva: ReservaState = {
  ruta_id: null,
  ruta_nombre: '',
  fecha: new Date().toISOString().split('T')[0],
  corrida: null,
  asientos: [],
  pasajeros: new Map(),
};

// --- Componente Principal ---
export default function Home() {
  // --- Estados de React ---
  const [pantalla, setPantalla] = useState('inicio');
  const [reserva, setReserva] = useState<ReservaState>(estadoInicialReserva);
  const [reservaConfirmada, setReservaConfirmada] = useState<ReservaConfirmada | null>(null);

  // --- Funciones de Navegación ---
  const handleSelectRuta = (id: number, nombre: string) => {
    setReserva(prev => ({ ...prev, ruta_id: id, ruta_nombre: nombre }));
    setPantalla('horarios');
  };

  const irAlInicio = () => {
    setReserva(estadoInicialReserva);
    setReservaConfirmada(null);
    setPantalla('inicio');
  };
// --- (¡¡¡AÑADE ESTA FUNCIÓN!!!) ---
  // Esta es la función que SÍ sabe cómo actualizar el estado
  // de forma inmutable (y arregla el bug de "no poder escribir")
  const handleFormChange = (asiento: number, campo: keyof Pasajero, valor: string) => {
    setReserva(prevState => {
      const nuevosPasajeros = new Map(prevState.pasajeros);
      const pasajeroActual = nuevosPasajeros.get(asiento);

      const pasajeroActualizado = {
        ...(pasajeroActual || { nombre: '', telefono: '', email: '' }), // Copia lo viejo
        [campo]: valor // Sobrescribe el campo que cambió
      };
      
      nuevosPasajeros.set(asiento, pasajeroActualizado as Pasajero);

      return { ...prevState, pasajeros: nuevosPasajeros };
    });
  };
  // --- Renderizado Condicional ---
  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-lg p-4 min-h-screen flex flex-col">
        
        <header className="text-center my-6">
          <h1 className="text-3xl font-bold text-brand-primary">TRAVEL APP</h1>
          <p className="text-gray-600">Viajes Turísticos Chilpancingo ↔ CDMX</p>
        </header>

        <main className="flex-grow">
          {pantalla === 'inicio' && (
            <PantallaInicio onSelectRuta={handleSelectRuta} />
          )}
          
          {pantalla === 'horarios' && (
            <PantallaHorarios
              reserva={reserva}
              setReserva={setReserva}
              setPantalla={setPantalla}
            />
          )}

          {pantalla === 'asientos' && (
            <PantallaAsientos
              reserva={reserva}
              setReserva={setReserva}
              setPantalla={setPantalla}
            />
          )}

         {pantalla === 'formulario' && (
            <PantallaFormulario
              reserva={reserva}
              // ¡¡CORRECCIÓN!! Pasamos la nueva función en la prop correcta
              onFormChange={handleFormChange} 
              onRegresar={() => setPantalla('asientos')}
              // (El resto de props ya no son necesarias en el hijo)
            />
          )}

          {pantalla === 'confirmacion' && (
            <PantallaConfirmacion
              reserva={reserva}
              reservaConfirmada={reservaConfirmada}
              onNuevaReserva={irAlInicio}
            />
          )}
        </main>
        
        <footer className="text-center mt-8 text-gray-400 text-sm">
          © 2025 JFML Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}
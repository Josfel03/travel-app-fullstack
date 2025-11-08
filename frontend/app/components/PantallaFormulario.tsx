"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; 
import { ReservaState, Pasajero } from '../types'; // Ruta relativa

// --- Props ---
interface Props {
  reserva: ReservaState;
  onFormChange: (asiento: number, campo: keyof Pasajero, valor: string) => void;
  onRegresar: () => void;
}

export default function PantallaFormulario({ reserva, onFormChange, onRegresar }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Manejador de Envío (¡ACTUALIZADO PARA STRIPE!) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 1. Validar que todos los formularios estén llenos
    for (const pasajero of reserva.pasajeros.values()) {
      if (!pasajero.nombre || !pasajero.telefono) {
        setError('Por favor, llena el nombre y teléfono de todos los pasajeros.');
        setIsLoading(false);
        return;
      }
    }

    // 2. Convertir el Map de pasajeros a un array simple para el JSON
    const pasajerosArray = Array.from(reserva.pasajeros.entries()).map(([asiento, datos]) => ({
      asiento: asiento,
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email || '', // Enviar email aunque esté vacío
    }));

    try {
      // 3. Llamar al endpoint /api/reservar (que ahora devuelve una URL de pago)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrida_id: reserva.corrida!.id, // '!' afirma que corrida no es null
          pasajeros: pasajerosArray,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Si el backend da un error (ej. asientos ocupados), lo mostramos
        throw new Error(data.error || 'No se pudo crear la sesión de pago.');
      }

      // 4. ¡ÉXITO! Redirigir al usuario a la página de pago de Stripe
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        throw new Error('No se recibió la URL de pago del servidor.');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <section className="pantalla space-y-4">
      <button onClick={onRegresar} className="btn-regresar text-brand-secondary mb-4">
        <i className="fas fa-arrow-left"></i> Regresar
      </button>
      
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-xl font-semibold text-center text-gray-800 mb-4">Datos de los Pasajeros</h2>
        <p className="text-sm text-gray-600">Ruta: <strong className="text-brand-primary">{reserva.ruta_nombre}</strong></p>
        <p className="text-sm text-gray-600">Horario: <strong className="text-brand-primary">{reserva.corrida?.hora_salida}</strong></p>
      </div>

      <form id="form-reserva" onSubmit={handleSubmit} className="space-y-6">
        {/* Iteramos sobre los asientos seleccionados y generamos un formulario para cada uno
        */}
        {reserva.asientos.map((asientoNum) => {
          const pasajero = reserva.pasajeros.get(asientoNum);
          return (
            <div key={asientoNum} className="bg-white p-5 rounded-xl shadow-md border border-gray-200">
              <h3 className="text-lg font-bold text-brand-primary mb-3">Pasajero - Asiento #{asientoNum}</h3>
              
              {/* Campo Nombre */}
              <div>
                <label htmlFor={`nombre-${asientoNum}`} className="block text-sm font-medium text-gray-700">Nombre Completo*</label>
                <input
                  type="text"
                  id={`nombre-${asientoNum}`}
                  value={pasajero?.nombre || ''}
                  onChange={(e) => onFormChange(asientoNum, 'nombre', e.target.value)}
                  className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                  required
                />
              </div>
              
              {/* Campo Teléfono */}
              <div className="mt-4">
                <label htmlFor={`telefono-${asientoNum}`} className="block text-sm font-medium text-gray-700">Teléfono / WhatsApp (10 dígitos)*</label>
                <input
                  type="tel"
                  id={`telefono-${asientoNum}`}
                  value={pasajero?.telefono || ''}
                  onChange={(e) => onFormChange(asientoNum, 'telefono', e.target.value)}
                  maxLength={10}
                  className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                  required
                />
                {/* Aquí puedes añadir validación de teléfono si lo deseas */}
              </div>

              {/* Campo Email (Opcional) */}
              <div className="mt-4">
                <label htmlFor={`email-${asientoNum}`} className="block text-sm font-medium text-gray-700">Email (Opcional)</label>
                <input
                  type="email"
                  id={`email-${asientoNum}`}
                  value={pasajero?.email || ''}
                  onChange={(e) => onFormChange(asientoNum, 'email', e.target.value)}
                  className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                />
              </div>
            </div>
          );
        })}

        {error && (
          <p className="text-center text-brand-alert text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand-success text-white font-bold py-4 rounded-xl shadow-lg transition hover:bg-opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Procesando pago...' : 'Ir a Pagar'}
        </button>
      </form>
    </section>
  );
}
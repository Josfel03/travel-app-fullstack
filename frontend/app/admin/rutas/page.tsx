"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export const dynamic = 'force-dynamic';
// Definimos el tipo de dato para una Ruta
type Ruta = {
  error: string;
  id: number;
  origen: string;
  destino: string;
  duracion_estimada_min?: number; // Añadido opcional
};

export default function AdminRutasPage() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // --- (NUEVO) Estados para el formulario ---
  const [nuevoOrigen, setNuevoOrigen] = useState('');
  const [nuevoDestino, setNuevoDestino] = useState('');
  const [nuevaDuracion, setNuevaDuracion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Cargar las rutas existentes (sin cambios) ---
  useEffect(() => {
    const fetchRutas = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError("Acceso denegado. Redirigiendo al login...");
        router.push('/admin/login');
        return;
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/rutas`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
          if (res.status === 401) {
            setError("Tu sesión ha expirado. Redirigiendo al login...");
            localStorage.removeItem('access_token');
            router.push('/admin/login');
          } else {
            throw new Error('No se pudo obtener la lista de rutas');
          }
          return;
        }

        const data: Ruta[] = await res.json();
        setRutas(data);

      } catch (err) {
        console.error(err);
        setError("Error de conexión con el servidor.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRutas();
  }, [router]);

  // --- (NUEVO) Manejador para crear la ruta ---
  const handleSubmitNuevaRuta = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = localStorage.getItem('access_token');
    if (!token) {
      setError("Sesión expirada. Por favor, inicia sesión de nuevo.");
      router.push('/admin/login');
      return;
    }

    try {
      // 1. Llamar al nuevo endpoint POST
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/rutas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          origen: nuevoOrigen,
          destino: nuevoDestino,
          duracion: nuevaDuracion ? parseInt(nuevaDuracion) : null
        })
      });

      const nuevaRuta: Ruta = await res.json();

      if (!res.ok) {
        throw new Error(nuevaRuta.error || 'No se pudo crear la ruta');
      }

      // 2. ¡ÉXITO! Actualizar la lista de rutas en el estado (sin recargar la página)
      setRutas([...rutas, nuevaRuta]);

      // 3. Limpiar el formulario
      setNuevoOrigen('');
      setNuevoDestino('');
      setNuevaDuracion('');

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al crear la ruta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Renderizado ---

  if (isLoading) {
    return <div className="text-center p-10">Cargando rutas...</div>;
  }

  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-4xl p-4 min-h-screen">
        <header className="text-center my-6">
          <h1 className="text-3xl font-bold text-brand-primary">Gestión de Rutas</h1>
        </header>

        {/* --- (NUEVO) FORMULARIO DE CREACIÓN --- */}
        <form onSubmit={handleSubmitNuevaRuta} className="bg-white p-6 rounded-xl shadow-lg mb-8 space-y-4">
          <h2 className="text-xl font-semibold">Crear Nueva Ruta</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="origen" className="block text-sm font-medium text-gray-700">Origen</label>
              <input
                type="text"
                id="origen"
                value={nuevoOrigen}
                onChange={(e) => setNuevoOrigen(e.target.value)}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="destino" className="block text-sm font-medium text-gray-700">Destino</label>
              <input
                type="text"
                id="destino"
                value={nuevoDestino}
                onChange={(e) => setNuevoDestino(e.target.value)}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="duracion" className="block text-sm font-medium text-gray-700">Duración (min)</label>
              <input
                type="number"
                id="duracion"
                value={nuevaDuracion}
                onChange={(e) => setNuevaDuracion(e.target.value)}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                placeholder="Ej. 180"
              />
            </div>
          </div>
          
          {error && <p className="text-brand-alert text-sm">{error}</p>}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full md:w-auto bg-brand-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg transition hover:bg-opacity-90 disabled:bg-gray-400"
          >
            {isSubmitting ? 'Creando...' : 'Crear Ruta'}
          </button>
        </form>

        {/* --- LISTA DE RUTAS (EXISTENTE) --- */}
        <main className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Rutas Actuales</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destino</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rutas.map((ruta) => (
                  <tr key={ruta.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ruta.id}</td>
                    <td className="px-6 py-4 whitespace-nowraws text-sm text-gray-700">{ruta.origen}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{ruta.destino}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rutas.length === 0 && (
            <p className="text-center text-gray-500 mt-4">No se encontraron rutas.</p>
          )}
        </main>
      </div>
    </div>
  );
}
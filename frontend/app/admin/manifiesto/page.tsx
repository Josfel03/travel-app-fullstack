"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export const dynamic = 'force-dynamic';
// Tipos
interface Corrida {
  id: number;
  ruta_nombre: string;
  fecha_hora_salida: string;
}

interface Pasajero {
  asiento: number;
  nombre: string;
  telefono?: string;
  reserva_codigo?: string;
}

export default function AdminManifiestoPage() {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [selectedCorrida, setSelectedCorrida] = useState<number | ''>('');
  const [manifiesto, setManifiesto] = useState<Pasajero[]>([]);
  const [isLoadingCorridas, setIsLoadingCorridas] = useState(true);
  const [isLoadingManifiesto, setIsLoadingManifiesto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // --- Helper para formatear fecha/hora ---
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('es-MX', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  // --- Cargar corridas ---
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/admin/login'); return; }

    const fetchCorridas = async () => {
      setIsLoadingCorridas(true);
      setError(null);

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/corridas`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
          localStorage.removeItem('access_token');
          router.push('/admin/login');
          return;
        }

        if (!res.ok) throw new Error('Error al cargar las corridas');

        const data: Corrida[] = await res.json();
        setCorridas(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error de conexión con el servidor');
      } finally {
        setIsLoadingCorridas(false);
      }
    };

    fetchCorridas();
  }, [router]);

  // --- Obtener manifiesto ---
  const fetchManifiesto = async (corridaId: number) => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/admin/login'); return; }

    setIsLoadingManifiesto(true);
    setError(null);
    setManifiesto([]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/manifiesto/${corridaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('access_token');
        router.push('/admin/login');
        return;
      }

      if (!res.ok) throw new Error('Error al obtener el manifiesto');

      const data = await res.json();

      // Esperamos estructura { manifiesto: [...] }
      const listaPasajeros: Pasajero[] = Array.isArray(data.manifiesto)
        ? data.manifiesto
        : [];

      // Ordenar por asiento
      listaPasajeros.sort((a, b) => a.asiento - b.asiento);

      setManifiesto(listaPasajeros);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar el manifiesto');
    } finally {
      setIsLoadingManifiesto(false);
    }
  };

  // --- Cambio en selección ---
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value === '' ? '' : Number(e.target.value);
    setSelectedCorrida(id);
    if (id !== '') fetchManifiesto(id);
  };

  // --- Recargar corridas ---
  const handleRecargar = () => {
    window.location.reload();
  };

  // --- Render ---
  return (
    <div className="bg-brand-light-gray font-sans min-h-screen">
      <div className="container mx-auto max-w-6xl p-4">
        <header className="text-center my-6">
          <h1 className="text-3xl font-bold text-brand-primary">Manifiesto de Pasajeros</h1>
        </header>

        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Seleccionar Corrida</h2>
            <button
              onClick={handleRecargar}
              className="bg-brand-secondary text-white px-4 py-2 rounded-xl hover:bg-opacity-90 transition"
            >
              Recargar 🔄
            </button>
          </div>

          {error && (
            <p className="text-brand-alert text-center text-sm">{error}</p>
          )}

          {isLoadingCorridas ? (
            <p className="text-center text-gray-600">Cargando corridas...</p>
          ) : (
            <select
              value={selectedCorrida}
              onChange={handleSelectChange}
              className="mt-2 w-full border border-gray-300 rounded-xl p-3 bg-white shadow-sm"
            >
              <option value="">-- Selecciona una corrida --</option>
              {corridas.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatDateTime(c.fecha_hora_salida)} — {c.ruta_nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          {isLoadingManifiesto ? (
            <p className="text-center text-gray-600">Cargando manifiesto...</p>
          ) : selectedCorrida === '' ? (
            <p className="text-center text-gray-500">Selecciona una corrida para ver su manifiesto.</p>
          ) : manifiesto.length === 0 ? (
            <p className="text-center text-gray-500 italic">No hay pasajeros pagados para esta corrida.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asiento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código Reserva</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {manifiesto.map((p) => (
                    <tr key={p.asiento}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.asiento}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{p.nombre}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{p.telefono || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{p.reserva_codigo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

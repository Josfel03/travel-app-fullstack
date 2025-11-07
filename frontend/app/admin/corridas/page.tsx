"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; 
import { Ruta, Corrida } from '../../types'; // Usamos rutas relativas

// --- Tipos de datos locales ---
type NuevaCorridaForm = {
  ruta_id: string;
  fecha_hora: string;
  precio: string;
  capacidad: string;
};

// --- Helper para formatear la fecha ---
const formatDateTime = (isoString: string) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) { return "Fecha inválida"; }
};

// --- Componente Principal ---
export default function AdminCorridasPage() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // --- (NUEVO) Estado para saber qué corrida estamos editando ---
  const [editingCorridaId, setEditingCorridaId] = useState<number | null>(null);

  // --- Estados para el formulario ---
  const [formState, setFormState] = useState<NuevaCorridaForm>({
    ruta_id: '',
    fecha_hora: '',
    precio: '',
    capacidad: '19'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Cargar datos iniciales (Rutas y Corridas) ---
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/admin/login'); return; }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [rutasRes, corridasRes] = await Promise.all([
          fetch('http://localhost:5000/api/admin/rutas', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('http://localhost:5000/api/admin/corridas', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (rutasRes.status === 401 || corridasRes.status === 401) {
          setError("Tu sesión ha expirado. Redirigiendo al login...");
          localStorage.removeItem('access_token');
          router.push('/admin/login');
          return;
        }

        if (!rutasRes.ok || !corridasRes.ok) {
          throw new Error("Error al cargar los datos del servidor.");
        }

        const rutasData: Ruta[] = await rutasRes.json();
        const corridasData: Corrida[] = await corridasRes.json();
        setRutas(rutasData);
        setCorridas(corridasData);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error de conexión con el servidor.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [router]);

  // --- Manejador para el formulario ---
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  // --- (NUEVO) Helper para limpiar el formulario ---
  const resetForm = () => {
    setFormState({ ruta_id: '', fecha_hora: '', precio: '', capacidad: '19' });
    setEditingCorridaId(null);
    setError(null);
  };

  // --- (NUEVO) Manejador para INICIAR la edición ---
  const handleStartEdit = (corrida: Corrida) => {
    setEditingCorridaId(corrida.id);
    // Rellenamos el formulario con los datos de la corrida
    setFormState({
      ruta_id: String(rutas.find(r => r.origen === corrida.ruta_nombre.split(' → ')[0])?.id || ''),
      // El input 'datetime-local' necesita 'YYYY-MM-DDTHH:mm'
      fecha_hora: corrida.fecha_hora_salida.slice(0, 16),
      precio: corrida.precio,
      capacidad: String(corrida.capacidad)
    });
    // Lleva al usuario arriba al formulario
    window.scrollTo(0, 0);
  };

  // --- Manejador para ENVIAR (Crear o Actualizar) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/admin/login'); return; }

    const fechaISO = new Date(formState.fecha_hora).toISOString();
    
    // Define la URL y el Método (Crear o Actualizar)
    const isEditing = editingCorridaId !== null;
    const url = isEditing
      ? `http://localhost:5000/api/admin/corridas/${editingCorridaId}`
      : 'http://localhost:5000/api/admin/corridas';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formState,
          fecha_hora: fechaISO,
          precio: parseFloat(formState.precio),
          capacidad: parseInt(formState.capacidad)
        })
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || `No se pudo ${isEditing ? 'actualizar' : 'crear'} la corrida`);
      }

      // Actualizar la lista en el frontend
      if (isEditing) {
        // Reemplazar la corrida editada
        setCorridas(corridas.map(c => 
          c.id === editingCorridaId ? responseData : c
        ));
      } else {
        // Añadir la nueva corrida
        setCorridas([responseData, ...corridas]);
      }
      
      resetForm(); // Limpiar el formulario

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al guardar la corrida.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Manejador para CANCELAR (DELETE) ---
  const handleCancelarCorrida = async (corridaId: number) => {
    // (sin cambios)
    if (!window.confirm("¿Estás seguro de que quieres cancelar esta corrida?")) { return; }
    setError(null);
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/admin/login'); return; }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/corridas/${corridaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { throw new Error(data.error || 'No se pudo cancelar la corrida'); }
      setCorridas(corridas.filter(corrida => corrida.id !== corridaId));
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  // --- Renderizado ---
  if (isLoading) {
    return <div className="text-center p-10">Cargando datos del administrador...</div>;
  }

  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-6xl p-4 min-h-screen">
        <header className="text-center my-6">
          <h1 className="text-3xl font-bold text-brand-primary">Gestión de Corridas</h1>
        </header>

        {/* --- FORMULARIO DE CREACIÓN / EDICIÓN --- */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg mb-8 space-y-4">
          
          {/* Título dinámico */}
          <h2 className="text-xl font-semibold">
            {editingCorridaId ? `Editando Corrida ID: ${editingCorridaId}` : 'Crear Nueva Corrida'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ... (los 4 inputs: Ruta, Fecha/Hora, Precio, Capacidad - sin cambios) ... */}
            <div>
              <label htmlFor="ruta_id" className="block text-sm font-medium text-gray-700">Ruta</label>
              <select
                name="ruta_id"
                id="ruta_id"
                value={formState.ruta_id}
                onChange={handleFormChange}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm bg-white"
                required
              >
                <option value="">Selecciona una ruta</option>
                {rutas.map(ruta => (
                  <option key={ruta.id} value={ruta.id}>
                    {ruta.origen} → {ruta.destino}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fecha_hora" className="block text-sm font-medium text-gray-700">Fecha y Hora de Salida</label>
              <input
                type="datetime-local"
                name="fecha_hora"
                id="fecha_hora"
                value={formState.fecha_hora}
                onChange={handleFormChange}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="precio" className="block text-sm font-medium text-gray-700">Precio (MXN)</label>
              <input
                type="number"
                name="precio"
                id="precio"
                value={formState.precio}
                onChange={handleFormChange}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                placeholder="Ej. 350.00"
                step="0.01"
                required
              />
            </div>

            <div>
              <label htmlFor="capacidad" className="block text-sm font-medium text-gray-700">Capacidad</label>
              <input
                type="number"
                name="capacidad"
                id="capacidad"
                value={formState.capacidad}
                onChange={handleFormChange}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm"
                required
              />
            </div>
          </div>
          
          {error && <p className="text-brand-alert text-sm text-center">{error}</p>}

          <div className="flex items-center space-x-4">
            {/* Botón dinámico */}
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full md:w-auto bg-brand-success text-white font-bold py-3 px-6 rounded-xl shadow-lg transition hover:bg-opacity-90 disabled:bg-gray-400"
            >
              {isSubmitting ? 'Guardando...' : (editingCorridaId ? 'Actualizar Corrida' : 'Crear Corrida')}
            </button>
            
            {/* (NUEVO) Botón para cancelar la edición */}
            {editingCorridaId && (
              <button 
                type="button"
                onClick={resetForm}
                className="w-full md:w-auto bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition hover:bg-gray-300"
              >
                Cancelar Edición
              </button>
            )}
          </div>
        </form>

        {/* --- LISTA DE CORRIDAS (ACTUALIZADA CON BOTÓN EDITAR) --- */}
        <main className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Próximas Corridas Programadas</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ruta</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha y Hora Salida</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cap.</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {corridas.map((corrida) => (
                  <tr key={corrida.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{corrida.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{corrida.ruta_nombre}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(corrida.fecha_hora_salida)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${corrida.precio}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{corrida.capacidad}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-4">
                      {/* --- (NUEVO) Botón de Editar --- */}
                      <button 
                        onClick={() => handleStartEdit(corrida)}
                        className="text-brand-secondary font-medium transition hover:text-blue-700"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => handleCancelarCorrida(corrida.id)}
                        className="text-brand-alert font-medium transition hover:text-red-700"
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {corridas.length === 0 && (
            <p className="text-center text-gray-500 mt-4">No se encontraron corridas programadas.</p>
          )}
        </main>
      </div>
    </div>
  );
}
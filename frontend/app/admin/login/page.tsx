"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Importa el 'router' para redirigir
export const dynamic = 'force-dynamic';
export default function AdminLoginPage() {
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter(); // Inicializa el router

  // 1. Esta función se llama cuando envías el formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita que la página se recargue
    setError(null);
    setIsLoading(true);

    try {
      // 2. Llama a tu API de Flask (la que probaste con curl)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 3. Si las credenciales son incorrectas, muestra el error del backend
        setError(data.error || 'Credenciales inválidas');
        setIsLoading(false);
        return;
      }

      // 4. ¡ÉXITO! Guarda el "pase de acceso" (token) en el navegador
      if (data.access_token) {
        // Usamos localStorage para "recordar" el login
        localStorage.setItem('access_token', data.access_token);
        
        // 5. Redirige al administrador a la página de "Rutas"
        //    (Esta página aún no existe, nos dará 404, ¡es normal!)
        router.push('/admin/rutas');
      } else {
        setError('Error inesperado: no se recibió token.');
      }

    } catch (err) {
      console.error(err);
      setError('No se pudo conectar al servidor. Intenta más tarde.');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-lg p-4 min-h-screen flex flex-col justify-center">
        
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-primary">Pacífico Tour</h1>
          <p className="text-gray-600">Panel de Administración</p>
        </header>

        <main className="bg-white p-6 rounded-xl shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor="telefono" 
                className="block text-sm font-medium text-gray-700"
              >
                Teléfono (10 dígitos)
              </label>
              <input
                type="tel"
                id="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-brand-primary focus:border-brand-primary"
                required
              />
            </div>
            
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700"
              >
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-brand-primary focus:border-brand-primary"
                required
              />
            </div>

            {/* Muestra de errores */}
            {error && (
              <p className="text-center text-brand-alert text-sm">
                {error}
              </p>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-brand-primary text-white font-bold py-3 rounded-xl shadow-lg transition hover:bg-opacity-90 disabled:bg-gray-400"
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
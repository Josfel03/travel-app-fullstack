"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

// --- Componente Interno: La Barra Lateral (Sidebar) ---
function Sidebar({ activePath, onLogout }: { activePath: string, onLogout: () => void }) {
  
  // Función para resaltar el enlace activo
  const linkClass = (path: string) => {
    return activePath === path
      ? 'bg-brand-primary text-white' // Activo
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'; // Inactivo
  };

  return (
    <div className="w-64 h-screen bg-gray-800 text-white flex flex-col fixed top-0 left-0">
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold">Pacífico Tour</h2>
        <span className="text-sm text-gray-400">Panel de Admin</span>
      </div>
      
      <nav className="flex-grow p-2 space-y-2">
        {/* Enlace 1: Rutas */}
        <Link href="/admin/rutas" className={`block w-full text-left p-3 rounded-lg ${linkClass('/admin/rutas')}`}>
          <i className="fas fa-route mr-2 w-5 text-center"></i>
          Gestión de Rutas
        </Link>
        
        {/* Enlace 2: Corridas */}
        <Link href="/admin/corridas" className={`block w-full text-left p-3 rounded-lg ${linkClass('/admin/corridas')}`}>
          <i className="fas fa-bus mr-2 w-5 text-center"></i>
          Gestión de Corridas
        </Link>
        
        {/* Enlace 3: Validar QR */}
        <Link href="/admin/validar" className={`block w-full text-left p-3 rounded-lg ${linkClass('/admin/validar')}`}>
          <i className="fas fa-qrcode mr-2 w-5 text-center"></i>
          Validar Ticket
        </Link>
      </nav>
      
      {/* Botón de Cerrar Sesión */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onLogout}
          className="w-full text-left p-3 rounded-lg text-gray-300 hover:bg-brand-alert hover:text-white"
        >
          <i className="fas fa-sign-out-alt mr-2 w-5 text-center"></i>
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

// --- Componente Principal: El Layout del Admin ---
export default function AdminLayout({
  children, // 'children' será la página actual (ej. rutas/page.tsx)
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname(); // Hook para saber en qué URL estamos
  const [isLoading, setIsLoading] = useState(true);

  // --- LÓGICA DE SEGURIDAD ---
  // Esto se ejecuta en CADA página del admin
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    
    // 1. Si NO hay token Y NO estamos en el login -> PATEARLO al login
    if (!token && pathname !== '/admin/login') {
      router.push('/admin/login');
    } 
    // 2. Si SÍ hay token Y estamos en el login -> PATEARLO al dashboard (rutas)
    else if (token && pathname === '/admin/login') {
      router.push('/admin/rutas');
    } 
    // 3. Si hay token y no estamos en el login -> Dejarlo pasar
    else {
      setIsLoading(false);
    }
  }, [pathname, router]); // Se re-ejecuta cada vez que cambia la URL

  // --- Función de Logout ---
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/admin/login');
  };

  // --- Renderizado ---

  // 1. Si estamos en la página de login, no mostramos la sidebar
  if (pathname === '/admin/login') {
    return (
      <div className="bg-brand-light-gray font-sans">
        {isLoading ? <div className="h-screen w-full" /> : children}
      </div>
    );
  }

  // 2. Si estamos cargando la seguridad, mostramos un loader
  if (isLoading) {
    return (
      <div className="bg-brand-light-gray font-sans h-screen flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-brand-primary text-4xl"></i>
      </div>
    );
  }

  // 3. Si SÍ hay sesión, mostramos la sidebar y el contenido de la página
  return (
    <div className="bg-brand-light-gray font-sans flex">
      {/* La Barra Lateral Fija */}
      <Sidebar activePath={pathname} onLogout={handleLogout} />
      
      {/* El contenido principal (con un 'margin-left' para dejar espacio a la sidebar) */}
      <main className="flex-grow p-8 ml-64">
        {children}
      </main>
    </div>
  );
}
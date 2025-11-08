"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Importamos useRouter para la redirección
// Importamos el *tipo* pero no el *código* todavía
import type { Html5QrcodeScanner } from 'html5-qrcode';

// Definimos los tipos para la respuesta de validación
interface ValidationResponse {
  status: 'valido' | 'invalido';
  error?: string;
  ruta?: string;
  salida?: string;
  codigo_reserva?: string;
  pasajeros?: { nombre: string; asiento: number }[];
}

// ID del div que usará el escáner
const QR_READER_ID = "qr-reader";

export default function ValidarTicketPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [validationResponse, setValidationResponse] = useState<ValidationResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const scannerRef = useRef<any | null>(null);
  const router = useRouter(); // Hook para redirigir si el token falla

  // --- (NUEVO) Guardamos el Token en el estado ---
  const [token, setToken] = useState<string | null>(null);

  // 1. Efecto para (A) Obtener el Token y (B) Inicializar el escáner
  useEffect(() => {
    
    // --- (A) LÓGICA DE AUTENTICACIÓN (AÑADIDA) ---
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      // Si no hay token, no podemos hacer nada.
      // El layout.tsx ya debería habernos pateado al login.
      setValidationError("No estás autenticado. Redirigiendo al login...");
      setIsScanning(false);
      // Forzar redirección
      router.push('/admin/login');
      return;
    }
    setToken(accessToken); // Guardamos el token para usarlo después

    // --- (B) LÓGICA DEL ESCÁNER (RESTAURADA) ---
    if (isScanning && !scannerRef.current) {
      import('html5-qrcode')
        .then(Html5Qrcode => {
          if (scannerRef.current) return; // Evita doble inicialización

          const scanner = new Html5Qrcode.Html5QrcodeScanner(
            QR_READER_ID,
            { qrbox: { width: 250, height: 250 }, fps: 10 },
            false
          );

          const onScanSuccess = (decodedText: string) => {
            console.log(`QR Escaneado: ${decodedText}`);
            setIsScanning(false);
            setScanResult(decodedText);
            scanner.clear().catch(err => console.error("Error al limpiar el escáner", err));
            scannerRef.current = null;
          };

          const onScanFailure = (error: string) => { /* Ignorar */ };
          scanner.render(onScanSuccess, onScanFailure);
          scannerRef.current = scanner;
        })
        .catch(err => {
          console.error("Error al cargar la biblioteca html5-qrcode:", err);
          setValidationError("No se pudo cargar el escáner QR.");
          setIsScanning(false);
        });
    }

    // Función de limpieza
    return () => {
      if (scannerRef.current && typeof scannerRef.current.clear === 'function') {
        scannerRef.current.clear().catch((err: any) => console.error("Error al limpiar el escáner al salir", err));
        scannerRef.current = null;
      }
    };
  }, [isScanning, router]); // Se ejecuta solo cuando 'isScanning' cambia

  // 2. Efecto para validar el resultado con el Backend
  useEffect(() => {
    // No hacer nada si no hay resultado o si no hemos cargado el token
    if (!scanResult || !token) return; 

    const validarCodigo = async () => {
      setValidationError(null);
      setValidationResponse(null);
      console.log(`Enviando código ${scanResult} al backend con token...`); // DEPDEBUG

      try {
        // Leemos la URL de la API desde las variables de entorno
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        const res = await fetch(`${API_URL}/api/validar-ticket`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // <-- ¡LA CORRECCIÓN CRÍTICA!
          },
          body: JSON.stringify({ codigo_reserva: scanResult }),
        });
        
        const data: ValidationResponse = await res.json();
        
        // --- (NUEVO) MEJOR MANEJO DE ERRORES (DEPURACIÓN) ---
        if (res.status === 401) {
          // Si el token expiró o es inválido
          setValidationError("Sesión expirada. Por favor, inicia sesión de nuevo.");
          localStorage.removeItem('access_token');
          router.push('/admin/login'); // Patearlo al login
        } else if (!res.ok) {
          console.error("Respuesta de error del backend:", data); // DEBUG
          setValidationResponse(data); // Muestra el error (ej. "Boleto inválido")
        } else {
          console.log("Respuesta de éxito del backend:", data); // DEBUG
          setValidationResponse(data); // Muestra el éxito (ej. "Boleto válido")
        }

      } catch (err: any) {
        console.error("Error de Fetch:", err); // DEBUG
        setValidationError("Error de red. No se pudo conectar al servidor de validación.");
      }
    };

    validarCodigo();
  }, [scanResult, token, router]); // Se re-ejecuta si el 'scanResult' o el 'token' cambian

  // Función para el botón "Escanear de Nuevo"
  const handleScanAgain = () => {
    setScanResult(null);
    setValidationResponse(null);
    setValidationError(null);
    setIsScanning(true); 
  };

  // --- Renderizado de la UI ---
  return (
    <div className="bg-brand-light-gray font-sans">
      <div className="container mx-auto max-w-lg p-4 min-h-screen flex flex-col">
        <header className="text-center my-6">
          <h1 className="text-3xl font-bold text-brand-primary">Pacífico Tour</h1>
          <p className="text-gray-600">Panel de Validación</p>
        </header>

        <main className="flex-grow bg-white p-6 rounded-xl shadow-lg">
          {isScanning && (
            <div className="flex flex-col items-center">
              <h2 className="text-xl font-semibold mb-4">Apunte la cámara al Código QR</h2>
              <div id={QR_READER_ID} className="w-full max-w-sm"></div>
              {validationError && (
                 <p className="text-lg text-red-800 mt-4">{validationError}</p>
              )}
            </div>
          )}

          {/* --- Pantalla de Resultado --- */}
          {!isScanning && (validationResponse || validationError) && (
            <div className="flex flex-col items-center">
              
              {/* --- RESULTADO VÁLIDO (VERDE) --- */}
              {validationResponse && validationResponse.status === 'valido' && (
                <div className="w-full text-center p-6 rounded-lg bg-green-100 border-2 border-green-600">
                  <i className="fas fa-check-circle text-6xl text-brand-success mb-4"></i>
                  <h2 className="text-3xl font-bold text-green-800">BOLETO VÁLIDO</h2>
                  <hr className="my-4"/>
                  <div className="text-left space-y-2 text-gray-800">
                    <p><strong>Ruta:</strong> {validationResponse.ruta}</p>
                    <p><strong>Salida:</strong> {validationResponse.salida}</p>
                    <p><strong>Código:</strong> {validationResponse.codigo_reserva}</p>
                    <p><strong>Pasajeros:</strong></p>
                    <ul className="list-disc list-inside pl-4">
                      {validationResponse.pasajeros?.map(p => (
                        <li key={p.asiento}><strong>Asiento {p.asiento}:</strong> {p.nombre}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {/* --- RESULTADO INVÁLIDO (ROJO) --- */}
              {validationResponse && validationResponse.status === 'invalido' && (
                <div className="w-full text-center p-6 rounded-lg bg-red-100 border-2 border-red-600">
                  <i className="fas fa-times-circle text-6xl text-brand-alert mb-4"></i>
                  <h2 className="text-3xl font-bold text-red-800">BOLETO INVÁLIDO</h2>
                  <p className="text-lg text-gray-800 mt-4">{validationResponse.error}</p>
                </div>
              )}
              
              {/* --- ERROR DE RED O AUTENTICACIÓN (ROJO) --- */}
              {validationError && (
                <div className="w-full text-center p-6 rounded-lg bg-red-100 border-2 border-red-600">
                  <i className="fas fa-exclamation-triangle text-6xl text-brand-alert mb-4"></i>
                  <h2 className="text-3xl font-bold text-red-800">ERROR</h2>
                  <p className="text-lg text-gray-800 mt-4">{validationError}</p>
                </div>
              )}

              <button
                onClick={handleScanAgain}
                className="w-full mt-6 bg-brand-primary text-white font-bold py-3 rounded-xl shadow-lg transition hover:bg-opacity-90"
              >
                Escanear Otro Boleto
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
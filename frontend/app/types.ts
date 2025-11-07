import { ReactNode } from "react";


// --- (NUEVO) TIPO PARA EL ADMIN ---
export interface Ruta {
  id: number;
  origen: string;
  destino: string;
  duracion_estimada_min?: number; // Opcional
}

// --- TIPO DE CORRIDA (ACTUALIZADO) ---
// Sirve tanto para el cliente (con hora_salida)
// como para el admin (con todos los campos)
export interface Corrida {
  id: number;
  hora_salida?: string; // Para el cliente
  precio: string;
  capacidad: number;
  
  // Campos extra para el admin
  ruta_nombre: string; 
  fecha_hora_salida: string;
  error?: string; // Para manejar errores
}


export interface AsientosInfo {
  error?: string;
  capacidad_total: number;
  asientos_ocupados: number[];
}

export interface ReservaConfirmada {
  message: string;
  reserva_id: number;
  codigo_reserva: string;
}

export interface Pasajero {
  nombre: string;
  telefono: string;
  email: string;
}

export interface ReservaState {
  ruta_id: number | null; 
  ruta_nombre: string;
  fecha: string;
  corrida: Corrida | null;
  asientos: number[]; 
  pasajeros: Map<number, Pasajero>; 
}
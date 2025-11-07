
export interface Corrida {
  id: number;
  hora_salida: string;
  precio: string;
  capacidad: number;
}

export interface AsientosInfo {
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
from app import db
from datetime import datetime

# db.Model es la clase base de SQLAlchemy

class Usuarios(db.Model):
    __tablename__ = 'usuarios'  # Nombre explícito de la tabla
    id = db.Column(db.Integer, primary_key=True)
    nombre_completo = db.Column(db.String(100), nullable=False)
    telefono = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=True) # Opcional
    password_hash = db.Column(db.String(128), nullable=True) # Solo para admins
    rol = db.Column(db.String(20), nullable=False, default='cliente') # 'cliente' o 'admin'

    # Relación: Un usuario puede tener muchas reservas
    reservas = db.relationship('Reservas', backref='usuario', lazy=True)

    def __repr__(self):
        return f'<Usuario {self.telefono}>'

# --- TABLAS NUEVAS ---

class Rutas(db.Model):
    __tablename__ = 'rutas'
    id = db.Column(db.Integer, primary_key=True)
    origen = db.Column(db.String(100), nullable=False)
    destino = db.Column(db.String(100), nullable=False)
    duracion_estimada_min = db.Column(db.Integer, nullable=True)

    # Relación: Una ruta puede tener muchas corridas
    corridas = db.relationship('Corridas', backref='ruta', lazy=True)

    def __repr__(self):
        return f'<Ruta {self.id}: {self.origen} -> {self.destino}>'


class Corridas(db.Model):
    __tablename__ = 'corridas'
    id = db.Column(db.Integer, primary_key=True)
    # Llave Foránea: Conecta esta corrida con una ruta
    ruta_id = db.Column(db.Integer, db.ForeignKey('rutas.id'), nullable=False)
    
    fecha_hora_salida = db.Column(db.DateTime, nullable=False)
    precio = db.Column(db.Numeric(10, 2), nullable=False) # ej. 9999.99
    capacidad_total = db.Column(db.Integer, default=19)

    # Relación: Una corrida puede tener muchas reservas
    reservas = db.relationship('Reservas', backref='corrida', lazy=True)

    def __repr__(self):
        return f'<Corrida {self.id} en Ruta {self.ruta_id} @ {self.fecha_hora_salida}>'


class Reservas(db.Model):
    __tablename__ = 'reservas'
    id = db.Column(db.Integer, primary_key=True)
    codigo_reserva = db.Column(db.String(50), unique=True, nullable=False) # Para el QR
    
    # Llave Foránea: Conecta la reserva a una corrida específica
    corrida_id = db.Column(db.Integer, db.ForeignKey('corridas.id'), nullable=False)
    # Llave Foránea: Conecta la reserva a un usuario
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    estado_pago = db.Column(db.String(20), nullable=False, default='pendiente') # 'pendiente', 'pagado', 'cancelado'
    total_pagado = db.Column(db.Numeric(10, 2), nullable=True)

    # Relación: Una reserva tiene muchos asientos
    asientos = db.relationship('AsientosReservados', backref='reserva', lazy=True)

    def __repr__(self):
        return f'<Reserva {self.codigo_reserva}>'


class AsientosReservados(db.Model):
    __tablename__ = 'asientos_reservados'
    id = db.Column(db.Integer, primary_key=True)
    
    # Llave Foránea: Conecta este asiento a una reserva
    reserva_id = db.Column(db.Integer, db.ForeignKey('reservas.id'), nullable=False)
    numero_asiento = db.Column(db.Integer, nullable=False)

    # --- CAMPOS NUEVOS ---
    # Aquí es donde guardamos los datos del formulario de cada pasajero
    nombre_pasajero = db.Column(db.String(100), nullable=False)
    telefono_pasajero = db.Column(db.String(20), nullable=True) # Puede ser opcional, asumiendo que el del comprador es el principal

    def __repr__(self):
        # Actualizamos esto para que sea más útil al depurar
        return f'<Asiento {self.numero_asiento} - {self.nombre_pasajero}>'
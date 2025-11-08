from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# --- (¡CAMBIO IMPORTANTE!) ---
# Inicializamos la extensión 'db' aquí, VACÍA.
# Se conectará a la app en app.py
db = SQLAlchemy()

# --- Tus modelos (sin cambios, solo importando 'db') ---

class Usuarios(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    nombre_completo = db.Column(db.String(100), nullable=False)
    telefono = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=True)
    password_hash = db.Column(db.String(128), nullable=True)
    rol = db.Column(db.String(20), nullable=False, default='cliente')
    
    reservas = db.relationship('Reservas', backref='usuario', lazy=True)

    def __repr__(self):
        return f'<Usuario {self.telefono}>'

class Rutas(db.Model):
    __tablename__ = 'rutas'
    id = db.Column(db.Integer, primary_key=True)
    origen = db.Column(db.String(100), nullable=False)
    destino = db.Column(db.String(100), nullable=False)
    duracion_estimada_min = db.Column(db.Integer, nullable=True)
    
    corridas = db.relationship('Corridas', backref='ruta', lazy=True)

    def __repr__(self):
        return f'<Ruta {self.id}: {self.origen} -> {self.destino}>'

class Corridas(db.Model):
    __tablename__ = 'corridas'
    id = db.Column(db.Integer, primary_key=True)
    ruta_id = db.Column(db.Integer, db.ForeignKey('rutas.id'), nullable=False)
    fecha_hora_salida = db.Column(db.DateTime, nullable=False)
    precio = db.Column(db.Numeric(10, 2), nullable=False)
    capacidad_total = db.Column(db.Integer, default=19)
    
    reservas = db.relationship('Reservas', backref='corrida', lazy=True)

    def __repr__(self):
        return f'<Corrida {self.id} en Ruta {self.ruta_id} @ {self.fecha_hora_salida}>'

class Reservas(db.Model):
    __tablename__ = 'reservas'
    id = db.Column(db.Integer, primary_key=True)
    codigo_reserva = db.Column(db.String(50), unique=True, nullable=False)
    corrida_id = db.Column(db.Integer, db.ForeignKey('corridas.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    estado_pago = db.Column(db.String(20), nullable=False, default='pendiente')
    total_pagado = db.Column(db.Numeric(10, 2), nullable=True)
    stripe_session_id = db.Column(db.String(255), unique=True, nullable=True) # Para el polling de pago
    
    asientos = db.relationship('AsientosReservados', backref='reserva', lazy=True)

    def __repr__(self):
        return f'<Reserva {self.codigo_reserva}>'

class AsientosReservados(db.Model):
    __tablename__ = 'asientos_reservados'
    id = db.Column(db.Integer, primary_key=True)
    reserva_id = db.Column(db.Integer, db.ForeignKey('reservas.id'), nullable=False)
    numero_asiento = db.Column(db.Integer, nullable=False)
    nombre_pasajero = db.Column(db.String(100), nullable=False)
    telefono_pasajero = db.Column(db.String(20), nullable=True)

    def __repr__(self):
        return f'<Asiento {self.numero_asiento} - {self.nombre_pasajero}>'

class AsientosBloqueados(db.Model):
    __tablename__ = 'asientos_bloqueados'
    id = db.Column(db.Integer, primary_key=True)
    corrida_id = db.Column(db.Integer, db.ForeignKey('corridas.id'), nullable=False)
    numero_asiento = db.Column(db.Integer, nullable=False)
    expira_en = db.Column(db.DateTime, nullable=False) 
    
    __table_args__ = (
        db.UniqueConstraint('corrida_id', 'numero_asiento', name='_corrida_asiento_uc'),
    )

    def __repr__(self):
        return f'<Bloqueo Asiento {self.numero_asiento} @ Corrida {self.corrida_id}>'
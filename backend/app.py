from flask import Flask, jsonify, request # <-- ASEGÚRATE DE IMPORTAR jsonify y request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from datetime import datetime # 
from flask_cors import CORS  # <-- 1. IMPORTA ESTO
# 1. Crea la instancia de Flask
app = Flask(__name__)
# Permite que 'http://localhost:3000' (tu React) haga peticiones a tu API
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})
# 2. Configura la "Cadena de Conexión"
DB_URL = 'postgresql://travel_admin:123456@localhost/travel_tour_db'
app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 3. Inicializa SQLAlchemy (¡PERO SIN LA APP!)
#    Esto nos permite importar 'db' en otros archivos
db = SQLAlchemy() 

# 4. Ruta de prueba (Sigue igual)
@app.route('/api/test')
def hello_world():
    try:
        db.session.execute(text('SELECT 1')) 
        return {'message': 'El backend de Python está CONECTADO a PostgreSQL!'}
    except Exception as e:
        return {'message': f'Error de conexión: {str(e)}'}

# 5. IMPORTANTE: Importa los modelos DESPUÉS de crear 'db'
from models import * # Importa todas las clases de models.py
db.init_app(app)      # Conecta la 'db' con la 'app'
# 5. NUEVA RUTA: para crear las tablas en la BD
@app.route('/api/create_tables')
def create_tables():
    try:
        # Esto le dice a SQLAlchemy: "mira todos los modelos
        # que importaste y créalos en la BD si no existen"
        with app.app_context():
            db.create_all()
        return {'message': 'Tablas creadas exitosamente!'}
    except Exception as e:
        return {'message': f'Error al crear tablas: {str(e)}'}
# --- NUEVO ENDPOINT: OBTENER CORRIDAS ---
@app.route('/api/corridas', methods=['GET'])
def get_corridas():
    # 1. Obtener los parámetros de la URL (ej. ?ruta_id=1&fecha=2025-11-10)
    ruta_id = request.args.get('ruta_id')
    fecha_str = request.args.get('fecha') # Recibe la fecha como texto

    # --- Validación básica (en un futuro la harás más robusta) ---
    if not ruta_id or not fecha_str:
        return jsonify({'error': 'Faltan parámetros: se requiere ruta_id y fecha'}), 400

    try:
        # 2. Convertir la fecha de texto a un objeto 'date' de Python
        fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()

        # 3. Construir la consulta a la base de datos
        #    Busca en la tabla 'Corridas'
        #    - que coincida con la ruta_id
        #    - donde la fecha_hora_salida sea EN la fecha que nos dieron
        corridas = Corridas.query.filter(
            Corridas.ruta_id == ruta_id,
            db.func.date(Corridas.fecha_hora_salida) == fecha
        ).all()

        # 4. Convertir los resultados a un formato JSON que React entienda
        lista_corridas = []
        for corrida in corridas:
            lista_corridas.append({
                'id': corrida.id,
                'hora_salida': corrida.fecha_hora_salida.strftime('%I:%M %p'), # ej. "06:00 AM"
                'precio': str(corrida.precio), # Convertir de Decimal a string
                'capacidad': corrida.capacidad_total
            })
        
        return jsonify(lista_corridas)

    except Exception as e:
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
# --- NUEVO ENDPOINT: OBTENER ASIENTOS OCUPADOS ---
@app.route('/api/asientos', methods=['GET'])
def get_asientos():
    # 1. Obtener el ID de la corrida de la URL (ej. ?corrida_id=1)
    corrida_id = request.args.get('corrida_id')

    if not corrida_id:
        return jsonify({'error': 'Falta parámetro: se requiere corrida_id'}), 400

    try:
        # 2. Buscar la corrida para saber su capacidad total
        corrida = Corridas.query.get(corrida_id)
        if not corrida:
            return jsonify({'error': 'Corrida no encontrada'}), 404
        
        capacidad_total = corrida.capacidad_total

        # 3. Buscar todos los asientos YA RESERVADOS para esta corrida
        #    Esto une las tablas Reservas y AsientosReservados
        asientos_ocupados_query = db.session.query(AsientosReservados.numero_asiento)\
            .join(Reservas)\
            .filter(Reservas.corrida_id == corrida_id)\
            .all() # Obtiene todos los resultados

        # 4. 'asientos_ocupados_query' es una lista de tuplas, ej: [(5,), (8,)]
        #    La convertimos a una lista simple de números: [5, 8]
        lista_ocupados = [asiento[0] for asiento in asientos_ocupados_query]

        # 5. Devolver la lista completa de asientos (del 1 al total)
        #    y la lista de los que están ocupados.
        return jsonify({
            'capacidad_total': capacidad_total,
            'asientos_ocupados': lista_ocupados
        })

    except Exception as e:
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
# --- NUEVO ENDPOINT: CREAR RESERVA ---
@app.route('/api/reservar', methods=['POST'])
def crear_reserva():
    # 1. Obtener los datos JSON que envía el frontend
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No se enviaron datos JSON'}), 400

    corrida_id = data.get('corrida_id')
    usuario_id = data.get('usuario_id') # Por ahora lo pasamos directo
    asientos_solicitados = data.get('asientos') # ej. [5, 6, 7]

    if not corrida_id or not usuario_id or not asientos_solicitados:
        return jsonify({'error': 'Faltan datos: corrida_id, usuario_id, asientos'}), 400

    try:
        # --- Lógica de Robustez ---
        # 2. Verificar que NINGUNO de los asientos solicitados esté ya ocupado
        asientos_ocupados = db.session.query(AsientosReservados.numero_asiento)\
            .join(Reservas)\
            .filter(
                Reservas.corrida_id == corrida_id,
                AsientosReservados.numero_asiento.in_(asientos_solicitados)
            ).all()

        if asientos_ocupados:
            # asientos_ocupados será [(5,), (6,)]
            asientos_ya_tomados = [asiento[0] for asiento in asientos_ocupados]
            return jsonify({'error': 'Asientos no disponibles', 'asientos_ocupados': asientos_ya_tomados}), 409 # 409 Conflict

        # --- Si todo está libre, creamos la reserva ---
        
        # 3. Generar un código de reserva único (para el QR)
        #    (Versión simple, en un futuro lo harás más robusto)
        codigo_reserva_nuevo = f"PT-{corrida_id}-{usuario_id}-{asientos_solicitados[0]}"

        # 4. Crear el registro de la Reserva "padre"
        nueva_reserva = Reservas(
            codigo_reserva=codigo_reserva_nuevo,
            corrida_id=corrida_id,
            usuario_id=usuario_id,
            estado_pago='pendiente' # El pago se maneja después
        )
        db.session.add(nueva_reserva)
        # Es crucial hacer 'flush' para obtener el ID de la nueva reserva
        db.session.flush()

        # 5. Crear los registros de "AsientosReservados" (hijos)
        for asiento_num in asientos_solicitados:
            nuevo_asiento = AsientosReservados(
                reserva_id=nueva_reserva.id,
                numero_asiento=asiento_num
            )
            db.session.add(nuevo_asiento)

        # 6. Confirmar todos los cambios en la base de datos
        db.session.commit()

        return jsonify({
            'message': 'Reserva creada exitosamente',
            'reserva_id': nueva_reserva.id,
            'codigo_reserva': nueva_reserva.codigo_reserva
        }), 201 # 201 Created

    except Exception as e:
        db.session.rollback() # Revertir cambios si algo falla
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
        
# 6. Esto es para correrlo en modo desarrollo
if __name__ == '__main__':
    app.run(debug=True)
from flask import Flask, jsonify, request, send_file # <-- ASEGÚRATE DE IMPORTAR jsonify y request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from datetime import datetime # 
from flask_cors import CORS  # <-- 1. IMPORTA ESTO
import traceback # Para imprimir errores detallados
import qrcode
import io 
# 1. Crea la instancia de Flask
app = Flask(__name__)
# Permite que 'http://localhost:3000' (tu React) haga peticiones a tu API
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})
# 2. Configura la "Cadena de Conexión"
DB_URL = 'postgresql://travel_admin:123456@localhost/travel_tour_db'
app.config['SQLALCHEMY_DATABASE_URI'] = DB_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 3. Inicializa SQLAlchemy
#    Esto nos permite importar 'db' en otros archivos
db = db = SQLAlchemy()

# Ruta de prueba de conexion a la db
@app.route('/api/test')
def hello_world():
    try:
        db.session.execute(text('SELECT 1')) 
        return {'message': 'El backend de Python está CONECTADO a PostgreSQL!'}
    except Exception as e:
        return {'message': f'Error de conexión: {str(e)}'}

# IMPORTANTE: Importa los modelos DESPUÉS de crear 'db'
from models import * # Importa todas las clases de models.py
db.init_app(app)      # Conecta la 'db' con la 'app'

# RUTA: para crear las tablas en la BD
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
    
# ---ENDPOINT: OBTENER CORRIDAS ---
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
    
# --- ENDPOINT: OBTENER ASIENTOS OCUPADOS ---
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


# --- ENDPOINT DE RESERVA  ---
@app.route('/api/reservar', methods=['POST'])
def crear_reserva():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No se enviaron datos JSON'}), 400

    corrida_id = data.get('corrida_id')
    pasajeros_data = data.get('pasajeros') # ej. [{"asiento": 5, "nombre": "Josfel"}, ...]

    if not corrida_id or not pasajeros_data:
        return jsonify({'error': 'Faltan datos: corrida_id, pasajeros'}), 400

    try:
        asientos_solicitados = [p['asiento'] for p in pasajeros_data]

        # --- Lógica de Robustez ---
        asientos_ocupados = db.session.query(AsientosReservados.numero_asiento)\
            .join(Reservas)\
            .filter(
                Reservas.corrida_id == corrida_id,
                AsientosReservados.numero_asiento.in_(asientos_solicitados)
            ).all()

        if asientos_ocupados:
            asientos_ya_tomados = [asiento[0] for asiento in asientos_ocupados]
            return jsonify({'error': 'Asientos no disponibles', 'asientos_ocupados': asientos_ya_tomados}), 409

        # --- Si todo está libre, creamos la reserva ---
        
        # 1. Encontrar o crear al Usuario "comprador" (el primer pasajero)
        #    Esta lógica es simple, en el futuro la mejorarás con un login
       # 1. Encontrar o crear al Usuario "comprador"...
        primer_pasajero = pasajeros_data[0]
        usuario = Usuarios.query.filter_by(telefono=primer_pasajero['telefono']).first()
        if not usuario:

            # --- INICIO DE LA CORRECCIÓN ---
            # Obtenemos el email
            email_pasajero = primer_pasajero.get('email')
            # Si es una cadena vacía, lo convertimos a None (NULL)
            if email_pasajero == '':
                email_pasajero = None
            # --- FIN DE LA CORRECCIÓN ---

            usuario = Usuarios(
                nombre_completo=primer_pasajero['nombre'],
                telefono=primer_pasajero['telefono'],
                email=email_pasajero # <-- Usamos la variable corregida
            )
            db.session.add(usuario)
            db.session.flush() # Obtiene el ID del nuevo usuari
        # 2. Generar un código de reserva único
        codigo_reserva_nuevo = f"PT-{corrida_id}-{usuario.id}-{datetime.now().timestamp()}"

        # 3. Crear el registro de la Reserva "padre"
        nueva_reserva = Reservas(
            codigo_reserva=codigo_reserva_nuevo,
            corrida_id=corrida_id,
            usuario_id=usuario.id, # El ID del comprador
            estado_pago='pendiente'
        )
        db.session.add(nueva_reserva)
        db.session.flush() # Obtiene el ID de la nueva reserva

        # 4. Crear los registros de "AsientosReservados" (hijos)
        for pasajero in pasajeros_data:
            nuevo_asiento = AsientosReservados(
                reserva_id=nueva_reserva.id,
                numero_asiento=pasajero['asiento'],
                nombre_pasajero=pasajero['nombre'],
                telefono_pasajero=pasajero['telefono']
            )
            db.session.add(nuevo_asiento)

        # 5. Confirmar todos los cambios en la base de datos
        db.session.commit()

        return jsonify({
            'message': 'Reserva creada exitosamente',
            'reserva_id': nueva_reserva.id,
            'codigo_reserva': nueva_reserva.codigo_reserva
        }), 201
    except Exception as e:
        db.session.rollback() # Revierte los cambios
        
        # --- AÑADE ESTAS LÍNEAS PARA VER EL ERROR ---
        print("\n---ERROR DETALLADO EN /api/reservar---")
        traceback.print_exc() # Imprime el traceback completo en tu terminal
        print("--------------------------------------------------\n")
        
        # Devuelve el error 500
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

# --- ENDPOINT: GENERADOR DE QR ---
@app.route('/api/ticket/qr/<codigo_reserva>', methods=['GET'])
def get_ticket_qr(codigo_reserva):
    try:
        # Genera la imagen del QR en memoria
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(codigo_reserva) # El QR solo contendrá el código
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        
        # Crea un "buffer" en memoria para guardar la imagen
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0) # Regresa al inicio del buffer
        
        # Envía el buffer como un archivo de imagen
        return send_file(buf, mimetype='image/png')

    except Exception as e:
        print(f"Error generando QR: {e}")
        return jsonify({'error': 'Error al generar el código QR'}), 500

# --- ENDPOINT: VALIDAR TICKET (PARA EL ADMIN) ---
@app.route('/api/validar-ticket', methods=['POST'])
def validar_ticket():
    data = request.get_json()
    if not data or 'codigo_reserva' not in data:
        return jsonify({'error': 'Falta el codigo_reserva'}), 400

    codigo = data['codigo_reserva']

    try:
        # 1. Buscar la reserva en la base de datos
        reserva = Reservas.query.filter_by(codigo_reserva=codigo).first()

        # 2. Si no existe, es un boleto falso
        if not reserva:
            return jsonify({
                'status': 'invalido',
                'error': 'Boleto no encontrado. Código inválido.'
            }), 404 # 404 Not Found

        # 3. (A FUTURO) Aquí es donde checaríamos el pago
        if reserva.estado_pago != 'pagado':
             # Por ahora, solo lo marcamos como 'pendiente', pero no lo invalidamos
             pass # En un futuro, esto podría ser un error.

        # 4. (A FUTURO) Aquí checaríamos si ya se usó
        #    Necesitaríamos una nueva columna en 'Reservas' ej. 'estado_viaje'
        # if reserva.estado_viaje == 'abordado':
        #     return jsonify({
        #         'status': 'invalido',
        #         'error': f'Este boleto ya fue escaneado.'
        #     }), 409 # 409 Conflict

        
        # 5. Si existe y (por ahora) es válido, buscamos los detalles
        corrida = Corridas.query.get(reserva.corrida_id)
        
        # Obtenemos todos los pasajeros de esta reserva
        pasajeros_db = AsientosReservados.query.filter_by(reserva_id=reserva.id).all()
        
        pasajeros_lista = []
        for p in pasajeros_db:
            pasajeros_lista.append({
                'nombre': p.nombre_pasajero,
                'asiento': p.numero_asiento
            })

        # ¡Éxito! Devolvemos los detalles del boleto
        return jsonify({
            'status': 'valido',
            'ruta': f"{corrida.ruta.origen} → {corrida.ruta.destino}",
            'salida': corrida.fecha_hora_salida.strftime('%Y-%m-%d a las %I:%M %p'),
            'codigo_reserva': reserva.codigo_reserva,
            'pasajeros': pasajeros_lista
        })

    except Exception as e:
        print("\n---ERROR DETALLADO EN /api/validar-ticket---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

# Correrlo en modo desarrollo
if __name__ == '__main__':
    app.run(debug=True)
from flask import Flask, jsonify, request, send_file
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
import sqlalchemy.exc
from datetime import datetime, timedelta, timezone
from flask_cors import CORS
import traceback
import qrcode
import io
import stripe
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from fpdf import FPDF
from flask import Response
import os

app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:3000",
    "https://TU_DOMINIO_FRONTEND.vercel.app"
]}})

# Configuración
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'postgresql://postgres:LEHFoOWFTAGsrAwGoFteTHCUjCBrwmyy@postgres.railway.internal:5432/railway'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['STRIPE_SECRET_KEY'] = os.getenv('STRIPE_SECRET_KEY')
app.config['STRIPE_WEBHOOK_SECRET'] = os.getenv('STRIPE_WEBHOOK_SECRET')
stripe.api_key = app.config['STRIPE_SECRET_KEY']
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'clave-fallback-muy-larga')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

# Extensiones
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)


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

        # 3. (BLOQUE MODIFICADO) Construir la consulta a la base de datos
        #    Obtenemos la hora actual (en UTC, asumiendo que el servidor está en UTC)
        #    Si tu servidor está en hora local, usa datetime.now()
        # La nueva línea (robusta):
        ahora = datetime.now(timezone.utc)
        corridas = Corridas.query.filter(
            Corridas.ruta_id == ruta_id,
            db.func.date(Corridas.fecha_hora_salida) == fecha,
            Corridas.fecha_hora_salida > ahora # <-- ¡AQUÍ ESTÁ LA LÓGICA DE ROBUSTEZ!
        ).order_by(Corridas.fecha_hora_salida.asc()).all() # (Opcional: ordenar por hora)
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

       # 3. (BLOQUE MODIFICADO) Buscar todos los asientos ocupados (RESERVADOS y BLOQUEADOS)

        # 3a. Asientos YA PAGADOS (Permanentes)
        asientos_reservados_query = db.session.query(AsientosReservados.numero_asiento)\
            .join(Reservas)\
            .filter(Reservas.corrida_id == corrida_id)\
            .all()
        
        # 3b. Asientos BLOQUEADOS (Temporales) y no expirados
        asientos_bloqueados_query = db.session.query(AsientosBloqueados.numero_asiento)\
            .filter(
                AsientosBloqueados.corrida_id == corrida_id,
                AsientosBloqueados.expira_en > datetime.now(timezone.utc)
            ).all()

        # 4. Combinar las listas
        lista_reservados = {asiento[0] for asiento in asientos_reservados_query}
        lista_bloqueados = {asiento[0] for asiento in asientos_bloqueados_query}
        
        lista_ocupados_y_bloqueados = list(lista_reservados.union(lista_bloqueados))

        # 5. Devolver la lista completa de asientos
        return jsonify({
            'capacidad_total': capacidad_total,
            'asientos_ocupados': lista_ocupados_y_bloqueados # <-- CAMBIO DE NOMBRE
        })

    except Exception as e:
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500


# --- ENDPOINT DE RESERVA (ACTUALIZADO CON PAGO) ---
@app.route('/api/reservar', methods=['POST'])
def crear_reserva():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No se enviaron datos JSON'}), 400

    corrida_id = data.get('corrida_id')
    pasajeros_data = data.get('pasajeros')

    if not corrida_id or not pasajeros_data:
        return jsonify({'error': 'Faltan datos: corrida_id, pasajeros'}), 400

    try:
        asientos_solicitados = [p['asiento'] for p in pasajeros_data]

        # 1. Verificar que NINGUNO de los asientos solicitados esté ya ocupado
        asientos_ocupados = db.session.query(AsientosReservados.numero_asiento)\
            .join(Reservas)\
            .filter(
                Reservas.corrida_id == corrida_id,
                AsientosReservados.numero_asiento.in_(asientos_solicitados)
            ).all()

        if asientos_ocupados:
            asientos_ya_tomados = [asiento[0] for asiento in asientos_ocupados]
            return jsonify({'error': 'Asientos no disponibles', 'asientos_ocupados': asientos_ya_tomados}), 409

        # 2. Encontrar o crear al Usuario "comprador"
        primer_pasajero = pasajeros_data[0]
        usuario = Usuarios.query.filter_by(telefono=primer_pasajero['telefono']).first()
        if not usuario:
            email_pasajero = primer_pasajero.get('email')
            if email_pasajero == '':
                email_pasajero = None
            usuario = Usuarios(
                nombre_completo=primer_pasajero['nombre'],
                telefono=primer_pasajero['telefono'],
                email=email_pasajero
            )
            db.session.add(usuario)
            db.session.flush()
        
        # 3. Calcular el precio total
        corrida = Corridas.query.get(corrida_id)
        if not corrida:
            return jsonify({'error': 'Corrida no encontrada'}), 404
        
        total_a_pagar = corrida.precio * len(asientos_solicitados)
        # Stripe maneja los precios en centavos (ej. 350.00 MXN = 35000 centavos)
        total_en_centavos = int(total_a_pagar * 100)

        # 4. Generar un código de reserva único
        codigo_reserva_nuevo = f"PT-{corrida_id}-{usuario.id}-{int(datetime.now().timestamp())}"

        # 5. Crear la Reserva "padre" (aún como 'pendiente')
        nueva_reserva = Reservas(
            codigo_reserva=codigo_reserva_nuevo,
            corrida_id=corrida_id,
            usuario_id=usuario.id,
            estado_pago='pendiente', # ¡Importante!
            total_pagado=total_a_pagar # Guardamos el total
        )
        db.session.add(nueva_reserva)
        db.session.flush() # Obtiene el ID de la nueva reserva

        # 6. Crear los "AsientosReservados" (hijos)
        for pasajero in pasajeros_data:
            nuevo_asiento = AsientosReservados(
                reserva_id=nueva_reserva.id,
                numero_asiento=pasajero['asiento'],
                nombre_pasajero=pasajero['nombre'],
                telefono_pasajero=pasajero['telefono']
            )
            db.session.add(nuevo_asiento)

      # 7. (CORREGIDO) Construir la URL de éxito ANTES, incluyendo nuestro código
        #    Usamos concatenación simple para evitar problemas con las llaves de Stripe
        success_url_template = "http://localhost:3000/pago-exitoso?session_id={CHECKOUT_SESSION_ID}&reserva_code=" + nueva_reserva.codigo_reserva

        # 8. (ACTUALIZADO) Crear la Sesión de Checkout en Stripe
        checkout_session = stripe.checkout.Session.create(
            line_items=[{
                'price_data': {
                    'currency': 'mxn', 
                    'product_data': {
                        'name': f'Boleto(s) Pacífico Tour: {corrida.ruta.origen} a {corrida.ruta.destino}',
                        'description': f"Asiento(s): {', '.join(map(str, asientos_solicitados))}",
                    },
                    'unit_amount': total_en_centavos,
                },
                'quantity': 1,
            }],
            mode='payment',
            client_reference_id=nueva_reserva.codigo_reserva, 
            
            # --- ¡AQUÍ ESTÁ LA LÍNEA CORREGIDA! ---
            success_url=success_url_template, # Usamos nuestra URL personalizada
            
            cancel_url='http://localhost:3000/pago-cancelado',
        )

        # 9. Confirmar los cambios en la base de datos (¡AHORA SÍ!)
        db.session.commit()

        # 10. Devolver la URL de pago al frontend
        return jsonify({
            'message': 'Sesión de pago creada. Redirigiendo...',
            'payment_url': checkout_session.url
        }), 201
    except Exception as e:
        db.session.rollback() # Revierte los cambios
        print("\n---ERROR DETALLADO EN /api/reservar---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
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
# (NUEVO) --- ENDPOINT: WEBHOOK DE PAGOS (STRIPE) ---
@app.route('/api/pagos/webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    event = None

    try:
        # 1. Verificar que la petición viene de Stripe (usando tu llave secreta del webhook)
        event = stripe.Webhook.construct_event(
            payload, sig_header, app.config['STRIPE_WEBHOOK_SECRET']
        )
    except ValueError as e:
        # Payload inválido
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        # Firma inválida
        return jsonify({'error': 'Invalid signature'}), 400

    # 2. Manejar el evento que nos interesa: 'checkout.session.completed'
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # 3. Recuperar nuestro código de reserva que guardamos en 'client_reference_id'
        codigo_reserva = session.get('client_reference_id')
        
        if codigo_reserva:
            try:
                # 4. Encontrar la reserva en nuestra BD
                reserva = Reservas.query.filter_by(codigo_reserva=codigo_reserva).first()
                
                if reserva and reserva.estado_pago == 'pendiente':
                    # 5. ¡ACTUALIZAR EL ESTADO!
                    reserva.estado_pago = 'pagado'
                    # Guardamos el total que Stripe reporta (en centavos / 100)
                    reserva.total_pagado = session.get('amount_total') / 100.0
                    db.session.commit()
                    print(f"ÉXITO: Reserva {codigo_reserva} marcada como 'pagado'.")
                else:
                    # La reserva no se encontró o ya estaba pagada
                    print(f"WARN: Webhook recibió pago para reserva no encontrada o ya pagada: {codigo_reserva}")
            
            except Exception as e:
                db.session.rollback()
                print(f"--- 💥 ERROR EN WEBHOOK al actualizar BD 💥 ---")
                traceback.print_exc()
                print("--------------------------------------------------\n")
                # Devolvemos 500 para que Stripe reintente
                return jsonify({'error': 'Error de base de datos'}), 500
        else:
            print(f"WARN: Webhook de pago exitoso sin 'client_reference_id' (codigo_reserva).")

    # 6. Devolver 200 OK a Stripe para confirmar que recibimos el evento
    return jsonify({'status': 'received'}), 200

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


# (NUEVO) --- ENDPOINT: REGISTRO DE ADMIN (Solo para desarrollo) ---
@app.route('/api/admin/register', methods=['POST'])
def admin_register():
    data = request.get_json()
    if not data or 'telefono' not in data or 'password' not in data or 'nombre' not in data:
        return jsonify({'error': 'Faltan datos: telefono, password, nombre'}), 400

    telefono = data['telefono']
    nombre = data['nombre']
    
    # Hashear la contraseña
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    
    # Crear el nuevo admin
    nuevo_admin = Usuarios(
        nombre_completo=nombre,
        telefono=telefono,
        password_hash=hashed_password,
        rol='admin' # ¡Importante!
    )
    
    try:
        db.session.add(nuevo_admin)
        db.session.commit()
        return jsonify({'message': f'Admin {nombre} creado exitosamente'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'No se pudo crear el admin (quizás el teléfono ya existe): {str(e)}'}), 409

# (NUEVO) --- ENDPOINT: LOGIN DE ADMIN ---
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    if not data or 'telefono' not in data or 'password' not in data:
        return jsonify({'error': 'Faltan datos: telefono, password'}), 400

    telefono = data['telefono']
    password = data['password']

    # 1. Buscar al usuario
    usuario = Usuarios.query.filter_by(telefono=telefono).first()

    # 2. Verificar que exista, que sea 'admin' y que la contraseña sea correcta
    if not usuario or usuario.rol != 'admin':
        return jsonify({'error': 'Credenciales inválidas'}), 401 # 401 Unauthorized

    if not bcrypt.check_password_hash(usuario.password_hash, password):
        return jsonify({'error': 'Credenciales inválidas'}), 401

    # 3. Si todo es correcto, crear un token de acceso
    access_token = create_access_token(identity=usuario.telefono)
    return jsonify({
        'message': f'Bienvenido {usuario.nombre_completo}',
        'access_token': access_token
    })

# (NUEVO) --- ENDPOINT: EJEMPLO DE RUTA PROTEGIDA ---
@app.route('/api/admin/rutas', methods=['GET'])
@jwt_required() # ¡Magia! Esta línea protege la ruta
def get_rutas():
    # Gracias a @jwt_required, podemos saber quién nos visita
    current_user = get_jwt_identity()
    print(f"Petición hecha por: {current_user}")
    
    rutas = Rutas.query.all()
    lista_rutas = [{'id': r.id, 'origen': r.origen, 'destino': r.destino} for r in rutas]
    return jsonify(lista_rutas)

# --- ENDPOINT: CREAR UNA NUEVA RUTA ---
@app.route('/api/admin/rutas', methods=['POST'])
@jwt_required() # Protegido: solo admins pueden crear rutas
def crear_ruta():
    # 1. Verificar que el que llama es un admin
    # (Aunque jwt_required() ya lo hace, podemos verificar el 'rol' si quisiéramos)
    current_user_phone = get_jwt_identity()
    usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
    
    if not usuario or usuario.rol != 'admin':
        return jsonify({'error': 'Acceso no autorizado'}), 403 # 403 Forbidden

    # 2. Obtener los datos del formulario (JSON)
    data = request.get_json()
    if not data or 'origen' not in data or 'destino' not in data:
        return jsonify({'error': 'Faltan datos: origen, destino'}), 400

    origen = data.get('origen')
    destino = data.get('destino')
    duracion = data.get('duracion') # Opcional

    # 3. Crear la nueva ruta
    try:
        nueva_ruta = Rutas(
            origen=origen,
            destino=destino,
            duracion_estimada_min=duracion
        )
        db.session.add(nueva_ruta)
        db.session.commit()
        
        # 4. Devolver la ruta recién creada (para que el frontend la añada a la lista)
        return jsonify({
            'id': nueva_ruta.id,
            'origen': nueva_ruta.origen,
            'destino': nueva_ruta.destino
        }), 201 # 201 Created

    except Exception as e:
        db.session.rollback()
        print("\n--- 💥 ERROR DETALLADO EN /api/admin/rutas (POST) 💥 ---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

# (NUEVO) --- ENDPOINT: OBTENER TODAS LAS CORRIDAS (ADMIN) ---
@app.route('/api/admin/corridas', methods=['GET'])
@jwt_required()
def get_todas_corridas():
    # (Validación de admin omitida por brevedad, @jwt_required ya protege)
    try:
        # Hacemos un 'join' (unión) para obtener también el nombre de la ruta
        corridas_db = db.session.query(Corridas, Rutas.origen, Rutas.destino)\
            .join(Rutas, Corridas.ruta_id == Rutas.id)\
            .order_by(Corridas.fecha_hora_salida.desc())\
            .all()

        # Convertimos los resultados a JSON
        lista_corridas = []
        for corrida, origen, destino in corridas_db:
            lista_corridas.append({
                'id': corrida.id,
                'ruta_nombre': f"{origen} → {destino}",
                'fecha_hora_salida': corrida.fecha_hora_salida.isoformat(), # Formato ISO (ej. 2025-11-07T09:00:00)
                'precio': str(corrida.precio),
                'capacidad': corrida.capacidad_total
            })
        
        return jsonify(lista_corridas)

    except Exception as e:
        db.session.rollback()
        print("\n--- 💥 ERROR DETALLADO EN /api/admin/corridas (GET) 💥 ---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

# (NUEVO) --- ENDPOINT: CREAR UNA NUEVA CORRIDA (ADMIN) ---
@app.route('/api/admin/corridas', methods=['POST'])
@jwt_required()
def crear_corrida():
    # Verificamos que sea un admin
    current_user_phone = get_jwt_identity()
    usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
    
    if not usuario or usuario.rol != 'admin':
        return jsonify({'error': 'Acceso no autorizado'}), 403

    data = request.get_json()
    if not data or 'ruta_id' not in data or 'fecha_hora' not in data or 'precio' not in data:
        return jsonify({'error': 'Faltan datos: ruta_id, fecha_hora, precio'}), 400

    try:
        # Crear la nueva corrida con los datos del JSON
        nueva_corrida = Corridas(
            ruta_id=int(data['ruta_id']),
            fecha_hora_salida=datetime.fromisoformat(data['fecha_hora']), # Espera formato ISO (ej. 2025-11-08T09:00:00)
            precio=float(data['precio']),
            capacidad_total=data.get('capacidad', 19) # 19 por defecto
        )
        db.session.add(nueva_corrida)
        db.session.commit()

        # Devolvemos un objeto 'completo' (con el nombre de la ruta)
        # para que el frontend pueda actualizar la tabla al instante
        ruta = Rutas.query.get(nueva_corrida.ruta_id)

        return jsonify({
            'id': nueva_corrida.id,
            'ruta_nombre': f"{ruta.origen} → {ruta.destino}",
            'fecha_hora_salida': nueva_corrida.fecha_hora_salida.isoformat(),
            'precio': str(nueva_corrida.precio),
            'capacidad': nueva_corrida.capacidad_total
        }), 201 # 201 Created

    except Exception as e:
        db.session.rollback()
        print("\n--- 💥 ERROR DETALLADO EN /api/admin/corridas (POST) 💥 ---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
# (NUEVO) --- ENDPOINT: CANCELAR (DELETE) UNA CORRIDA ---
@app.route('/api/admin/corridas/<int:corrida_id>', methods=['DELETE'])
@jwt_required()
def cancelar_corrida(corrida_id):
    # Verificamos que sea un admin
    current_user_phone = get_jwt_identity()
    usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
    
    if not usuario or usuario.rol != 'admin':
        return jsonify({'error': 'Acceso no autorizado'}), 403

    try:
        # 1. Buscar la corrida que se quiere borrar
        corrida = Corridas.query.get(corrida_id)
        if not corrida:
            return jsonify({'error': 'Corrida no encontrada'}), 404

        # 2. ¡Lógica de Robustez!
        #    Verificar si esta corrida YA tiene reservas (boletos vendidos)
        reservas_existentes = Reservas.query.filter_by(corrida_id=corrida_id).first()
        if reservas_existentes:
            return jsonify({
                'error': 'Esta corrida no se puede eliminar porque ya tiene boletos vendidos.'
            }), 409 # 409 Conflict

        # 3. Si no hay reservas, es seguro eliminarla
        db.session.delete(corrida)
        db.session.commit()

        return jsonify({'message': 'Corrida cancelada exitosamente'}), 200

    except Exception as e:
        db.session.rollback()
        print("\n--- 💥 ERROR DETALLADO EN /api/admin/corridas (DELETE) 💥 ---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
# (NUEVO) --- ENDPOINT: ACTUALIZAR (PUT) UNA CORRIDA ---
@app.route('/api/admin/corridas/<int:corrida_id>', methods=['PUT'])
@jwt_required()
def actualizar_corrida(corrida_id):
    # Verificamos que sea un admin
    current_user_phone = get_jwt_identity()
    usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
    
    if not usuario or usuario.rol != 'admin':
        return jsonify({'error': 'Acceso no autorizado'}), 403

    try:
        # 1. Buscar la corrida que se quiere actualizar
        corrida = Corridas.query.get(corrida_id)
        if not corrida:
            return jsonify({'error': 'Corrida no encontrada'}), 404

        # 2. Obtener los nuevos datos del JSON
        data = request.get_json()
        if not data or 'ruta_id' not in data or 'fecha_hora' not in data or 'precio' not in data:
            return jsonify({'error': 'Faltan datos: ruta_id, fecha_hora, precio'}), 400

        # 3. (OPCIONAL) Lógica de Robustez
        #    Si la corrida ya tiene boletos, quizás solo quieras permitir cambiar el precio
        #    reservas_existentes = Reservas.query.filter_by(corrida_id=corrida_id).first()
        #    if reservas_existentes and (corrida.ruta_id != int(data['ruta_id']) or ... ):
        #        return jsonify({'error': 'No se puede cambiar la ruta/hora de una corrida con boletos vendidos'}), 409

        # 4. Actualizar los campos del objeto 'corrida'
        corrida.ruta_id = int(data['ruta_id'])
        corrida.fecha_hora_salida = datetime.fromisoformat(data['fecha_hora'])
        corrida.precio = float(data['precio'])
        corrida.capacidad_total = data.get('capacidad', 19)

        # 5. Guardar los cambios en la BD
        db.session.commit()

        # 6. Devolver el objeto actualizado (con el nombre de la ruta)
        ruta = Rutas.query.get(corrida.ruta_id)
        return jsonify({
            'id': corrida.id,
            'ruta_nombre': f"{ruta.origen} → {ruta.destino}",
            'fecha_hora_salida': corrida.fecha_hora_salida.isoformat(),
            'precio': str(corrida.precio),
            'capacidad': corrida.capacidad_total
        }), 200

    except Exception as e:
        db.session.rollback()
        print("\n--- 💥 ERROR DETALLADO EN /api/admin/corridas (PUT) 💥 ---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
    
#--- ENDPOINT: GENERADOR DE BOLETO PDF ---
@app.route('/api/ticket/pdf/<codigo_reserva>', methods=['GET'])
def get_ticket_pdf(codigo_reserva):
    try:
        # 1. Buscar la reserva y todos sus datos
        reserva = Reservas.query.filter_by(codigo_reserva=codigo_reserva).first()
        if not reserva:
            return jsonify({'error': 'Reserva no encontrada'}), 404
        
        # Usamos las relaciones (backrefs) para obtener los datos
        corrida = reserva.corrida
        ruta = corrida.ruta
        pasajeros = reserva.asientos # Esta es la lista de AsientosReservados

        # 2. Generar el QR en memoria (igual que antes)
        qr = qrcode.QRCode(version=1, box_size=4, border=2) # Hacemos el QR más pequeño
        qr.add_data(codigo_reserva)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Guardar QR en un buffer para FPDF
        qr_buffer = io.BytesIO()
        img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)

        # 3. Crear el PDF con FPDF (Formato de Boleto, ej. 80mm de ancho)
        pdf = FPDF(orientation='P', unit='mm', format=(80, 150)) # Ancho 80mm, Alto 150mm
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=5)
        
        # --- Contenido del Boleto ---
        pdf.set_font('Arial', 'B', 14)
        pdf.cell(0, 10, 'Pacífico Tour', 0, 1, 'C')
        
        pdf.set_font('Arial', '', 10)
        pdf.cell(0, 7, f'RUTA: {ruta.origen.upper()}', 0, 1)
        pdf.cell(0, 7, f'DESTINO: {ruta.destino.upper()}', 0, 1)
        pdf.cell(0, 7, f'SALIDA: {corrida.fecha_hora_salida.strftime("%Y-%m-%d %I:%M %p")}', 0, 1)
        pdf.cell(0, 7, f'ESTADO: {reserva.estado_pago.upper()}', 0, 1)
        pdf.ln(3) # Salto de línea

        # Encabezados de la tabla de pasajeros
        pdf.set_font('Arial', 'B', 8)
        pdf.cell(50, 7, 'PASAJERO', 1)
        pdf.cell(20, 7, 'ASIENTO', 1)
        pdf.ln()

        # Datos de los pasajeros (Manejo de acentos con 'latin-1')
        pdf.set_font('Arial', '', 8)
        for p in pasajeros:
            try:
                # FPDF no maneja bien UTF-8, forzamos latin-1
                nombre_limpio = p.nombre_pasajero.encode('latin-1', 'replace').decode('latin-1')
            except:
                nombre_limpio = 'Pasajero'
            pdf.cell(50, 7, nombre_limpio, 1)
            pdf.cell(20, 7, str(p.numero_asiento), 1)
            pdf.ln()
        
        pdf.ln(5)
        
        # Insertar el QR en el PDF
        pdf.image(qr_buffer, x=15, y=pdf.get_y(), w=50, h=50, type='PNG')
        pdf.set_y(pdf.get_y() + 52) # Moverse después del QR

        pdf.set_font('Arial', 'I', 8)
        pdf.cell(0, 5, f'CODIGO: {reserva.codigo_reserva}', 0, 1, 'C')
        
        # 4. Devolver el PDF al navegador
        
        # --- ¡ESTA ES LA CORRECCIÓN! ---
        # fpdf.output(dest='S') devuelve un 'bytearray'
        pdf_byte_array = pdf.output(dest='S')
        
        # El servidor (Werkzeug) exige 'bytes'. Los convertimos.
        pdf_output_bytes = bytes(pdf_byte_array) 
        # --- FIN DE LA CORRECCIÓN ---
        
        return Response(pdf_output_bytes, # Le pasamos los 'bytes'
                        mimetype='application/pdf',
                        headers={'Content-Disposition': f'inline; filename=boleto_{codigo_reserva}.pdf'})
    
    except Exception as e:
        print(f"--- 💥 ERROR DETALLADO EN /api/ticket/pdf 💥 ---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error al generar el PDF: {str(e)}'}), 500

# (NUEVO) --- ENDPOINT: BLOQUEAR ASIENTOS TEMPORALMENTE ---
# --- ENDPOINT: BLOQUEAR ASIENTOS ---
@app.route('/api/bloquear-asientos', methods=['POST'])
def bloquear_asientos():
    data = request.get_json()
    corrida_id = data.get('corrida_id')
    asientos = data.get('asientos') # Lista de números [5, 6]

    if not corrida_id or not asientos:
        return jsonify({'error': 'Faltan datos de corrida o asientos'}), 400

    try:
        # 1. Chequeo doble: ¿Están ya reservados (pagados)?
        asientos_ya_reservados = db.session.query(AsientosReservados.numero_asiento)\
            .join(Reservas).filter(
                Reservas.corrida_id == corrida_id,
                AsientosReservados.numero_asiento.in_(asientos)
            ).all()
        
        if asientos_ya_reservados:
            return jsonify({'error': 'Asiento ya reservado (pagado)'}), 409

        # 2. Chequeo de bloqueos actuales (si ya alguien más los está viendo)
        bloqueos_actuales = AsientosBloqueados.query.filter(
            AsientosBloqueados.corrida_id == corrida_id,
            AsientosBloqueados.numero_asiento.in_(asientos),
            AsientosBloqueados.expira_en > datetime.now(timezone.utc)
        ).all()

        if bloqueos_actuales:
            bloqueados_nums = [b.numero_asiento for b in bloqueos_actuales]
            return jsonify({'error': 'Asiento bloqueado temporalmente', 'asientos': bloqueados_nums}), 409

        # 3. Si están libres, creamos el bloqueo (expira en 5 minutos)
        tiempo_expiracion = datetime.now(timezone.utc) + timedelta(minutes=5)
        
        for asiento_num in asientos:
            nuevo_bloqueo = AsientosBloqueados(
                corrida_id=corrida_id,
                numero_asiento=asiento_num,
                expira_en=tiempo_expiracion
            )
            db.session.add(nuevo_bloqueo)

        db.session.commit()
        return jsonify({'message': 'Bloqueo temporal exitoso', 'expiracion': tiempo_expiracion.isoformat()}), 200

    except sqlalchemy.exc.IntegrityError as e: # <-- ¡ATRAPAMOS EL ERROR ESPECÍFICO!
        db.session.rollback()
        # Si la violación de unicidad ocurre, significa que el asiento ya fue bloqueado
        if 'duplicate key value violates unique constraint' in str(e):
             return jsonify({
                'error': 'Lo sentimos, uno o más asientos han sido tomados o están bloqueados por otro usuario.'
            }), 409 # 409 Conflict 
        else:
             # Si es otro error de integridad, devolvemos 500
             raise 

    except Exception as e:
        db.session.rollback()
        print("\n--- 💥 ERROR DETALLADO EN /api/bloquear-asientos 💥 ---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

# (NUEVO) --- ENDPOINT: MANIFIESTO DE PASAJEROS ---
@app.route('/api/admin/manifiesto/<int:corrida_id>', methods=['GET'])
@jwt_required()
def get_manifiesto(corrida_id):
    # Verificamos que sea un admin
    current_user_phone = get_jwt_identity()
    usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
    
    if not usuario or usuario.rol != 'admin':
        return jsonify({'error': 'Acceso no autorizado'}), 403

    try:
        # 1. Buscamos la corrida para obtener los detalles del viaje
        corrida = Corridas.query.get(corrida_id)
        if not corrida:
            return jsonify({'error': 'Corrida no encontrada'}), 404
        
        # 2. Buscamos todos los asientos que fueron PAGADOS para esta corrida
        manifiesto_db = db.session.query(AsientosReservados)\
            .join(Reservas)\
            .filter(
                Reservas.corrida_id == corrida_id,
                Reservas.estado_pago == 'pagado' # ¡Solo boletos pagados!
            )\
            .order_by(AsientosReservados.numero_asiento.asc())\
            .all()

        # 3. Formateamos la lista de pasajeros
        pasajeros_lista = []
        for asiento_reservado in manifiesto_db:
            pasajeros_lista.append({
                'asiento': asiento_reservado.numero_asiento,
                'nombre': asiento_reservado.nombre_pasajero,
                'telefono': asiento_reservado.telefono_pasajero,
                'reserva_codigo': asiento_reservado.reserva.codigo_reserva
            })

        # 4. Devolvemos el manifiesto completo
        return jsonify({
            'corrida_id': corrida_id,
            'ruta': f"{corrida.ruta.origen} → {corrida.ruta.destino}",
            'fecha_hora': corrida.fecha_hora_salida.strftime('%Y-%m-%d %I:%M %p'),
            'total_pasajeros': len(pasajeros_lista),
            'manifiesto': pasajeros_lista
        })

    except Exception as e:
        db.session.rollback()
        print("\n--- 💥 ERROR DETALLADO EN /api/admin/manifiesto 💥 ---")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
    

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))  # Usa el puerto asignado o 8000 por defecto
    app.run(host="0.0.0.0", port=port)
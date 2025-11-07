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

# --- 1. Inicializa las extensiones (¡GLOBALMENTE, SIN LA APP!)
db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()

def create_app():
    # 1. Crea la instancia de Flask
    app = Flask(__name__)

    # 2. Configura las variables (Lee de la ENV de Railway/Docker)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL',
        'postgresql://postgres:LEHFoOWFTAGsrAwGoFteTHCUjCBrwmyy@postgres.railway.internal:5432/railway'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'clave-fallback-muy-larga')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
    
    # Configuración de Stripe
    app.config['STRIPE_SECRET_KEY'] = os.environ.get('STRIPE_SECRET_KEY')
    app.config['STRIPE_WEBHOOK_SECRET'] = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    # 3. Inicializa las extensiones con la APP
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    
    # Configurar Stripe
    stripe.api_key = app.config['STRIPE_SECRET_KEY']
    
    # Configuración de CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://localhost:3000",
                "https://TU_DOMINIO_FRONTEND.vercel.app"
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    # 4. Importa tus modelos dentro del contexto de la aplicación
    with app.app_context():
        from models import Usuarios, Reservas, Corridas, Rutas, AsientosReservados, AsientosBloqueados
        # db.create_all() # No lo hacemos aquí, se hace con una ruta separada

    # 5. Registra todas las rutas
    register_routes(app)
    
    # 6. Devuelve la aplicación configurada
    return app

def register_routes(app):
    # Ruta de prueba de conexion a la db
    @app.route('/api/test')
    def hello_world():
        try:
            with app.app_context():
                db.session.execute(text('SELECT 1')) 
            return {'message': 'El backend de Python está CONECTADO a PostgreSQL!'}
        except Exception as e:
            return {'message': f'Error de conexión: {str(e)}'}

    # RUTA: para crear las tablas en la BD
    @app.route('/api/create_tables')
    def create_tables():
        try:
            with app.app_context():
                db.create_all()
            return {'message': 'Tablas creadas exitosamente!'}
        except Exception as e:
            return {'message': f'Error al crear tablas: {str(e)}'}
        
    # ---ENDPOINT: OBTENER CORRIDAS ---
    @app.route('/api/corridas', methods=['GET'])
    def get_corridas():
        ruta_id = request.args.get('ruta_id')
        fecha_str = request.args.get('fecha')

        if not ruta_id or not fecha_str:
            return jsonify({'error': 'Faltan parámetros: se requiere ruta_id y fecha'}), 400

        try:
            fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
            
            ahora = datetime.now(timezone.utc)
            
            with app.app_context():
                corridas = Corridas.query.filter(
                    Corridas.ruta_id == ruta_id,
                    db.func.date(Corridas.fecha_hora_salida) == fecha,
                    Corridas.fecha_hora_salida > ahora
                ).order_by(Corridas.fecha_hora_salida.asc()).all()
                
                lista_corridas = []
                for corrida in corridas:
                    lista_corridas.append({
                        'id': corrida.id,
                        'hora_salida': corrida.fecha_hora_salida.strftime('%I:%M %p'),
                        'precio': str(corrida.precio),
                        'capacidad': corrida.capacidad_total
                    })
                
                return jsonify(lista_corridas)

        except ValueError as e:
            return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400
        except Exception as e:
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
        
    # --- ENDPOINT: OBTENER ASIENTOS OCUPADOS ---
    @app.route('/api/asientos', methods=['GET'])
    def get_asientos():
        corrida_id = request.args.get('corrida_id')

        if not corrida_id:
            return jsonify({'error': 'Falta parámetro: se requiere corrida_id'}), 400

        try:
            with app.app_context():
                corrida = Corridas.query.get(corrida_id)
                if not corrida:
                    return jsonify({'error': 'Corrida no encontrada'}), 404
                
                capacidad_total = corrida.capacidad_total

                asientos_reservados_query = db.session.query(AsientosReservados.numero_asiento)\
                    .join(Reservas)\
                    .filter(Reservas.corrida_id == corrida_id)\
                    .all()
                
                asientos_bloqueados_query = db.session.query(AsientosBloqueados.numero_asiento)\
                    .filter(
                        AsientosBloqueados.corrida_id == corrida_id,
                        AsientosBloqueados.expira_en > datetime.now(timezone.utc)
                    ).all()

                lista_reservados = {asiento[0] for asiento in asientos_reservados_query}
                lista_bloqueados = {asiento[0] for asiento in asientos_bloqueados_query}
                
                lista_ocupados_y_bloqueados = list(lista_reservados.union(lista_bloqueados))

                return jsonify({
                    'capacidad_total': capacidad_total,
                    'asientos_ocupados': lista_ocupados_y_bloqueados
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
            with app.app_context():
                asientos_solicitados = [p['asiento'] for p in pasajeros_data]

                asientos_ocupados = db.session.query(AsientosReservados.numero_asiento)\
                    .join(Reservas)\
                    .filter(
                        Reservas.corrida_id == corrida_id,
                        AsientosReservados.numero_asiento.in_(asientos_solicitados)
                    ).all()

                if asientos_ocupados:
                    asientos_ya_tomados = [asiento[0] for asiento in asientos_ocupados]
                    return jsonify({'error': 'Asientos no disponibles', 'asientos_ocupados': asientos_ya_tomados}), 409

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
                
                corrida = Corridas.query.get(corrida_id)
                if not corrida:
                    return jsonify({'error': 'Corrida no encontrada'}), 404
                
                total_a_pagar = corrida.precio * len(asientos_solicitados)
                total_en_centavos = int(total_a_pagar * 100)

                codigo_reserva_nuevo = f"PT-{corrida_id}-{usuario.id}-{int(datetime.now().timestamp())}"

                nueva_reserva = Reservas(
                    codigo_reserva=codigo_reserva_nuevo,
                    corrida_id=corrida_id,
                    usuario_id=usuario.id,
                    estado_pago='pendiente',
                    total_pagado=total_a_pagar
                )
                db.session.add(nueva_reserva)
                db.session.flush()

                for pasajero in pasajeros_data:
                    nuevo_asiento = AsientosReservados(
                        reserva_id=nueva_reserva.id,
                        numero_asiento=pasajero['asiento'],
                        nombre_pasajero=pasajero['nombre'],
                        telefono_pasajero=pasajero['telefono']
                    )
                    db.session.add(nuevo_asiento)

                success_url = f"http://localhost:3000/pago-exitoso?session_id={{CHECKOUT_SESSION_ID}}&reserva_code={nueva_reserva.codigo_reserva}"

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
                    success_url=success_url,
                    cancel_url='http://localhost:3000/pago-cancelado',
                )

                db.session.commit()

            return jsonify({
                'message': 'Sesión de pago creada. Redirigiendo...',
                'payment_url': checkout_session.url
            }), 201
        except Exception as e:
            db.session.rollback()
            print("\n---ERROR DETALLADO EN /api/reservar---")
            traceback.print_exc()
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: GENERADOR DE QR ---
    @app.route('/api/ticket/qr/<codigo_reserva>', methods=['GET'])
    def get_ticket_qr(codigo_reserva):
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(codigo_reserva)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            buf.seek(0)
            
            return send_file(buf, mimetype='image/png')

        except Exception as e:
            print(f"Error generando QR: {e}")
            return jsonify({'error': 'Error al generar el código QR'}), 500

    # --- ENDPOINT: WEBHOOK DE PAGOS (STRIPE) ---
    @app.route('/api/pagos/webhook', methods=['POST'])
    def stripe_webhook():
        payload = request.data
        sig_header = request.headers.get('Stripe-Signature')
        event = None

        if not app.config['STRIPE_WEBHOOK_SECRET']:
            return jsonify({'error': 'Webhook secret no configurado'}), 500

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, app.config['STRIPE_WEBHOOK_SECRET']
            )
        except ValueError as e:
            return jsonify({'error': 'Invalid payload'}), 400
        except stripe.error.SignatureVerificationError as e:
            return jsonify({'error': 'Invalid signature'}), 400

        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            codigo_reserva = session.get('client_reference_id')
            
            if codigo_reserva:
                try:
                    with app.app_context():
                        reserva = Reservas.query.filter_by(codigo_reserva=codigo_reserva).first()
                        
                        if reserva and reserva.estado_pago == 'pendiente':
                            reserva.estado_pago = 'pagado'
                            reserva.total_pagado = session.get('amount_total', 0) / 100.0
                            db.session.commit()
                            print(f"ÉXITO: Reserva {codigo_reserva} marcada como 'pagado'.")
                        else:
                            print(f"WARN: Reserva no encontrada o ya pagada: {codigo_reserva}")
                    
                except Exception as e:
                    db.session.rollback()
                    print(f"ERROR en webhook: {str(e)}")
                    return jsonify({'error': 'Error de base de datos'}), 500

        return jsonify({'status': 'received'}), 200

    # --- ENDPOINT: VALIDAR TICKET (PARA EL ADMIN) ---
    @app.route('/api/validar-ticket', methods=['POST'])
    def validar_ticket():
        data = request.get_json()
        if not data or 'codigo_reserva' not in data:
            return jsonify({'error': 'Falta el codigo_reserva'}), 400

        codigo = data['codigo_reserva']

        try:
            with app.app_context():
                reserva = Reservas.query.filter_by(codigo_reserva=codigo).first()

                if not reserva:
                    return jsonify({
                        'status': 'invalido',
                        'error': 'Boleto no encontrado. Código inválido.'
                    }), 404

                if reserva.estado_pago != 'pagado':
                    return jsonify({
                        'status': 'invalido',
                        'error': 'Boleto no pagado.'
                    }), 402

                corrida = Corridas.query.get(reserva.corrida_id)
                
                pasajeros_db = AsientosReservados.query.filter_by(reserva_id=reserva.id).all()
                
                pasajeros_lista = []
                for p in pasajeros_db:
                    pasajeros_lista.append({
                        'nombre': p.nombre_pasajero,
                        'asiento': p.numero_asiento
                    })

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
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: REGISTRO DE ADMIN (Solo para desarrollo) ---
    @app.route('/api/admin/register', methods=['POST'])
    def admin_register():
        data = request.get_json()
        if not data or 'telefono' not in data or 'password' not in data or 'nombre' not in data:
            return jsonify({'error': 'Faltan datos: telefono, password, nombre'}), 400

        telefono = data['telefono']
        nombre = data['nombre']
        
        hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        
        try:
            with app.app_context():
                nuevo_admin = Usuarios(
                    nombre_completo=nombre,
                    telefono=telefono,
                    password_hash=hashed_password,
                    rol='admin'
                )
                
                db.session.add(nuevo_admin)
                db.session.commit()
                return jsonify({'message': f'Admin {nombre} creado exitosamente'}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'No se pudo crear el admin (quizás el teléfono ya existe): {str(e)}'}), 409

    # --- ENDPOINT: LOGIN DE ADMIN ---
    @app.route('/api/admin/login', methods=['POST'])
    def admin_login():
        data = request.get_json()
        if not data or 'telefono' not in data or 'password' not in data:
            return jsonify({'error': 'Faltan datos: telefono, password'}), 400

        telefono = data['telefono']
        password = data['password']

        try:
            with app.app_context():
                usuario = Usuarios.query.filter_by(telefono=telefono).first()

                if not usuario or usuario.rol != 'admin':
                    return jsonify({'error': 'Credenciales inválidas'}), 401

                if not bcrypt.check_password_hash(usuario.password_hash, password):
                    return jsonify({'error': 'Credenciales inválidas'}), 401

                access_token = create_access_token(identity=usuario.telefono)
                return jsonify({
                    'message': f'Bienvenido {usuario.nombre_completo}',
                    'access_token': access_token
                })
        except Exception as e:
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: EJEMPLO DE RUTA PROTEGIDA ---
    @app.route('/api/admin/rutas', methods=['GET'])
    @jwt_required()
    def get_rutas():
        current_user = get_jwt_identity()
        print(f"Petición hecha por: {current_user}")
        
        try:
            with app.app_context():
                rutas = Rutas.query.all()
                lista_rutas = [{'id': r.id, 'origen': r.origen, 'destino': r.destino} for r in rutas]
                return jsonify(lista_rutas)
        except Exception as e:
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: CREAR UNA NUEVA RUTA ---
    @app.route('/api/admin/rutas', methods=['POST'])
    @jwt_required()
    def crear_ruta():
        current_user_phone = get_jwt_identity()
        
        try:
            with app.app_context():
                usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
                
                if not usuario or usuario.rol != 'admin':
                    return jsonify({'error': 'Acceso no autorizado'}), 403

                data = request.get_json()
                if not data or 'origen' not in data or 'destino' not in data:
                    return jsonify({'error': 'Faltan datos: origen, destino'}), 400

                origen = data.get('origen')
                destino = data.get('destino')
                duracion = data.get('duracion')

                nueva_ruta = Rutas(
                    origen=origen,
                    destino=destino,
                    duracion_estimada_min=duracion
                )
                db.session.add(nueva_ruta)
                db.session.commit()
                
                return jsonify({
                    'id': nueva_ruta.id,
                    'origen': nueva_ruta.origen,
                    'destino': nueva_ruta.destino
                }), 201

        except Exception as e:
            db.session.rollback()
            print("\n--- ERROR EN /api/admin/rutas (POST) ---")
            traceback.print_exc()
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: OBTENER TODAS LAS CORRIDAS (ADMIN) ---
    @app.route('/api/admin/corridas', methods=['GET'])
    @jwt_required()
    def get_todas_corridas():
        try:
            with app.app_context():
                corridas_db = db.session.query(Corridas, Rutas.origen, Rutas.destino)\
                    .join(Rutas, Corridas.ruta_id == Rutas.id)\
                    .order_by(Corridas.fecha_hora_salida.desc())\
                    .all()

                lista_corridas = []
                for corrida, origen, destino in corridas_db:
                    lista_corridas.append({
                        'id': corrida.id,
                        'ruta_nombre': f"{origen} → {destino}",
                        'fecha_hora_salida': corrida.fecha_hora_salida.isoformat(),
                        'precio': str(corrida.precio),
                        'capacidad': corrida.capacidad_total
                    })
                
                return jsonify(lista_corridas)

        except Exception as e:
            print("\n--- ERROR EN /api/admin/corridas (GET) ---")
            traceback.print_exc()
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: CREAR UNA NUEVA CORRIDA (ADMIN) ---
    @app.route('/api/admin/corridas', methods=['POST'])
    @jwt_required()
    def crear_corrida():
        current_user_phone = get_jwt_identity()
        
        try:
            with app.app_context():
                usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
                
                if not usuario or usuario.rol != 'admin':
                    return jsonify({'error': 'Acceso no autorizado'}), 403

                data = request.get_json()
                if not data or 'ruta_id' not in data or 'fecha_hora' not in data or 'precio' not in data:
                    return jsonify({'error': 'Faltan datos: ruta_id, fecha_hora, precio'}), 400

                nueva_corrida = Corridas(
                    ruta_id=int(data['ruta_id']),
                    fecha_hora_salida=datetime.fromisoformat(data['fecha_hora']),
                    precio=float(data['precio']),
                    capacidad_total=data.get('capacidad', 19)
                )
                db.session.add(nueva_corrida)
                db.session.commit()

                ruta = Rutas.query.get(nueva_corrida.ruta_id)

                return jsonify({
                    'id': nueva_corrida.id,
                    'ruta_nombre': f"{ruta.origen} → {ruta.destino}",
                    'fecha_hora_salida': nueva_corrida.fecha_hora_salida.isoformat(),
                    'precio': str(nueva_corrida.precio),
                    'capacidad': nueva_corrida.capacidad_total
                }), 201

        except Exception as e:
            db.session.rollback()
            print("\n--- ERROR EN /api/admin/corridas (POST) ---")
            traceback.print_exc()
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: CANCELAR (DELETE) UNA CORRIDA ---
    @app.route('/api/admin/corridas/<int:corrida_id>', methods=['DELETE'])
    @jwt_required()
    def cancelar_corrida(corrida_id):
        current_user_phone = get_jwt_identity()
        
        try:
            with app.app_context():
                usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
                
                if not usuario or usuario.rol != 'admin':
                    return jsonify({'error': 'Acceso no autorizado'}), 403

                corrida = Corridas.query.get(corrida_id)
                if not corrida:
                    return jsonify({'error': 'Corrida no encontrada'}), 404

                reservas_existentes = Reservas.query.filter_by(corrida_id=corrida_id).first()
                if reservas_existentes:
                    return jsonify({
                        'error': 'Esta corrida no se puede eliminar porque ya tiene boletos vendidos.'
                    }), 409

                db.session.delete(corrida)
                db.session.commit()

                return jsonify({'message': 'Corrida cancelada exitosamente'}), 200

        except Exception as e:
            db.session.rollback()
            print("\n--- ERROR EN /api/admin/corridas (DELETE) ---")
            traceback.print_exc()
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: ACTUALIZAR (PUT) UNA CORRIDA ---
    @app.route('/api/admin/corridas/<int:corrida_id>', methods=['PUT'])
    @jwt_required()
    def actualizar_corrida(corrida_id):
        current_user_phone = get_jwt_identity()
        
        try:
            with app.app_context():
                usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
                
                if not usuario or usuario.rol != 'admin':
                    return jsonify({'error': 'Acceso no autorizado'}), 403

                corrida = Corridas.query.get(corrida_id)
                if not corrida:
                    return jsonify({'error': 'Corrida no encontrada'}), 404

                data = request.get_json()
                if not data or 'ruta_id' not in data or 'fecha_hora' not in data or 'precio' not in data:
                    return jsonify({'error': 'Faltan datos: ruta_id, fecha_hora, precio'}), 400

                corrida.ruta_id = int(data['ruta_id'])
                corrida.fecha_hora_salida = datetime.fromisoformat(data['fecha_hora'])
                corrida.precio = float(data['precio'])
                corrida.capacidad_total = data.get('capacidad', 19)

                db.session.commit()

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
            print("\n--- ERROR EN /api/admin/corridas (PUT) ---")
            traceback.print_exc()
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500
    
    # --- ENDPOINT: GENERADOR DE BOLETO PDF ---
    @app.route('/api/ticket/pdf/<codigo_reserva>', methods=['GET'])
    def get_ticket_pdf(codigo_reserva):
        try:
            with app.app_context():
                reserva = Reservas.query.filter_by(codigo_reserva=codigo_reserva).first()
                if not reserva:
                    return jsonify({'error': 'Reserva no encontrada'}), 404
                
                corrida = reserva.corrida
                ruta = corrida.ruta
                pasajeros = reserva.asientos

                qr = qrcode.QRCode(version=1, box_size=4, border=2)
                qr.add_data(codigo_reserva)
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                
                qr_buffer = io.BytesIO()
                img.save(qr_buffer, format='PNG')
                qr_buffer.seek(0)

                pdf = FPDF(orientation='P', unit='mm', format=(80, 150))
                pdf.add_page()
                pdf.set_auto_page_break(auto=True, margin=5)
                
                pdf.set_font('Arial', 'B', 14)
                pdf.cell(0, 10, 'Pacífico Tour', 0, 1, 'C')
                
                pdf.set_font('Arial', '', 10)
                pdf.cell(0, 7, f'RUTA: {ruta.origen.upper()}', 0, 1)
                pdf.cell(0, 7, f'DESTINO: {ruta.destino.upper()}', 0, 1)
                pdf.cell(0, 7, f'SALIDA: {corrida.fecha_hora_salida.strftime("%Y-%m-%d %I:%M %p")}', 0, 1)
                pdf.cell(0, 7, f'ESTADO: {reserva.estado_pago.upper()}', 0, 1)
                pdf.ln(3)

                pdf.set_font('Arial', 'B', 8)
                pdf.cell(50, 7, 'PASAJERO', 1)
                pdf.cell(20, 7, 'ASIENTO', 1)
                pdf.ln()

                pdf.set_font('Arial', '', 8)
                for p in pasajeros:
                    try:
                        nombre_limpio = p.nombre_pasajero.encode('latin-1', 'replace').decode('latin-1')
                    except:
                        nombre_limpio = 'Pasajero'
                    pdf.cell(50, 7, nombre_limpio, 1)
                    pdf.cell(20, 7, str(p.numero_asiento), 1)
                    pdf.ln()
                
                pdf.ln(5)
                
                pdf.image(qr_buffer, x=15, y=pdf.get_y(), w=50, h=50, type='PNG')
                pdf.set_y(pdf.get_y() + 52)

                pdf.set_font('Arial', 'I', 8)
                pdf.cell(0, 5, f'CODIGO: {reserva.codigo_reserva}', 0, 1, 'C')
                
                pdf_byte_array = pdf.output(dest='S')
                pdf_output_bytes = bytes(pdf_byte_array)
                
                return Response(pdf_output_bytes,
                                mimetype='application/pdf',
                                headers={'Content-Disposition': f'inline; filename=boleto_{codigo_reserva}.pdf'})
    
        except Exception as e:
            print(f"--- ERROR EN /api/ticket/pdf ---")
            traceback.print_exc()
            return jsonify({'error': f'Error al generar el PDF: {str(e)}'}), 500

    # --- ENDPOINT: BLOQUEAR ASIENTOS ---
    @app.route('/api/bloquear-asientos', methods=['POST'])
    def bloquear_asientos():
        data = request.get_json()
        corrida_id = data.get('corrida_id')
        asientos = data.get('asientos')

        if not corrida_id or not asientos:
            return jsonify({'error': 'Faltan datos de corrida o asientos'}), 400

        try:
            with app.app_context():
                asientos_ya_reservados = db.session.query(AsientosReservados.numero_asiento)\
                    .join(Reservas).filter(
                        Reservas.corrida_id == corrida_id,
                        AsientosReservados.numero_asiento.in_(asientos)
                    ).all()
                
                if asientos_ya_reservados:
                    return jsonify({'error': 'Asiento ya reservado (pagado)'}), 409

                bloqueos_actuales = AsientosBloqueados.query.filter(
                    AsientosBloqueados.corrida_id == corrida_id,
                    AsientosBloqueados.numero_asiento.in_(asientos),
                    AsientosBloqueados.expira_en > datetime.now(timezone.utc)
                ).all()

                if bloqueos_actuales:
                    bloqueados_nums = [b.numero_asiento for b in bloqueos_actuales]
                    return jsonify({'error': 'Asiento bloqueado temporalmente', 'asientos': bloqueados_nums}), 409

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

        except sqlalchemy.exc.IntegrityError as e:
            db.session.rollback()
            if 'duplicate key value violates unique constraint' in str(e):
                 return jsonify({
                    'error': 'Lo sentimos, uno o más asientos han sido tomados o están bloqueados por otro usuario.'
                }), 409
            else:
                 raise 

        except Exception as e:
            db.session.rollback()
            print("\n--- ERROR EN /api/bloquear-asientos ---")
            traceback.print_exc()
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

    # --- ENDPOINT: MANIFIESTO DE PASAJEROS ---
    @app.route('/api/admin/manifiesto/<int:corrida_id>', methods=['GET'])
    @jwt_required()
    def get_manifiesto(corrida_id):
        current_user_phone = get_jwt_identity()
        
        try:
            with app.app_context():
                usuario = Usuarios.query.filter_by(telefono=current_user_phone).first()
                
                if not usuario or usuario.rol != 'admin':
                    return jsonify({'error': 'Acceso no autorizado'}), 403

                corrida = Corridas.query.get(corrida_id)
                if not corrida:
                    return jsonify({'error': 'Corrida no encontrada'}), 404
                
                manifiesto_db = db.session.query(AsientosReservados)\
                    .join(Reservas)\
                    .filter(
                        Reservas.corrida_id == corrida_id,
                        Reservas.estado_pago == 'pagado'
                    )\
                    .order_by(AsientosReservados.numero_asiento.asc())\
                    .all()

                pasajeros_lista = []
                for asiento_reservado in manifiesto_db:
                    pasajeros_lista.append({
                        'asiento': asiento_reservado.numero_asiento,
                        'nombre': asiento_reservado.nombre_pasajero,
                        'telefono': asiento_reservado.telefono_pasajero,
                        'reserva_codigo': asiento_reservado.reserva.codigo_reserva
                    })

                return jsonify({
                    'corrida_id': corrida_id,
                    'ruta': f"{corrida.ruta.origen} → {corrida.ruta.destino}",
                    'fecha_hora': corrida.fecha_hora_salida.strftime('%Y-%m-%d %I:%M %p'),
                    'total_pasajeros': len(pasajeros_lista),
                    'manifiesto': pasajeros_lista
                })

        except Exception as e:
            db.session.rollback()
            print("\n--- ERROR EN /api/admin/manifiesto ---")
            traceback.print_exc()
            return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500

# --- Llamamos a create_app para obtener la instancia principal ---
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
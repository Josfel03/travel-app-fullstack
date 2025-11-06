from flask import Flask, jsonify, request # <-- ASEGÚRATE DE IMPORTAR jsonify y request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from datetime import datetime # 
# 1. Crea la instancia de Flask
app = Flask(__name__)

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
        
# 6. Esto es para correrlo en modo desarrollo
if __name__ == '__main__':
    app.run(debug=True)
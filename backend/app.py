
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

# --- Inicializa SQLAlchemy fuera de la app ---
db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    CORS(app)

    # --- Configuración de la BD ---
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "sqlite:///local.db")
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # --- Inicializa SQLAlchemy con la app ---
    db.init_app(app)

    # --- Importa modelos y crea tablas dentro del contexto ---
    with app.app_context():
        from models import *  # importa tus modelos
        db.create_all()
        print("✅ Tablas creadas exitosamente si no existían.")

    # --- Registra rutas (si tienes un archivo separado) ---
    # from routes import register_routes
    # register_routes(app)

    return app


# --- Ejecuta el servidor ---
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8000)))

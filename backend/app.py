from flask import Flask
app = Flask(__name__)

@app.route('/api/test')
def hello_world():
    return {'message': 'El backend de Python está funcionando!'}
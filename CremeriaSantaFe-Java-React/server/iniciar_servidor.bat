@echo off
REM Inicia la API de Cremeria Santa Fe en Windows (crea el entorno la primera vez)
cd /d %~dp0
if not exist .venv ( py -m venv .venv )
call .venv\Scripts\activate
pip install -r requirements.txt
python app.py
pause

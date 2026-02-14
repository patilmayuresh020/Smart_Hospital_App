@echo off
echo Installing dependencies...
pip install flask flask-cors
echo.
echo Starting Server...
set FLASK_APP=backend/server.py
python -m flask run --host=0.0.0.0 --port=5000
pause

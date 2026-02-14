@echo off
echo Starting Smart Hospital System...
echo --------------------------------
echo Installing dependencies...
pip install flask flask-cors
echo.
echo Starting Server...
echo Open your browser to the URL shown below.
echo Press CTRL+C to stop.
echo --------------------------------
python backend/server.py
pause

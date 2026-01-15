@echo off
echo Starting Ship Life Local Server...
echo.
echo Server will run at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
python -m http.server 8000
pause

@echo off
echo Starting FellowDivers JSON Editor Client...
echo.
echo Make sure the server is running first!
echo (Double-click start-server.bat in the editor folder)
echo.
cd /d "%~dp0"
npm run dev
pause

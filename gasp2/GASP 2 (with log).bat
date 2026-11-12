@echo off
rem GASP 2 with a visible log window (for troubleshooting). Closing this window stops the server.
cd /d "%~dp0"
git pull --ff-only
node server.js --port 4848
pause

@echo off
title GASP Studio
cd /d "%~dp0"
echo Checking for updates...
git pull --ff-only --quiet 2>nul && echo Up to date. || echo (Could not pull updates; continuing with what is here.)
echo.
echo Starting GASP Studio... leave this window open while you work. Close it to stop.
powershell -NoProfile -Command "try { $o=(Get-NetTCPConnection -LocalPort 4747 -State Listen -ErrorAction Stop | Select-Object -First 1).OwningProcess; if ((Get-Process -Id $o).ProcessName -eq 'node') { Stop-Process -Id $o -Force; Start-Sleep -Milliseconds 500 } } catch {}"
node studio.js serve
pause

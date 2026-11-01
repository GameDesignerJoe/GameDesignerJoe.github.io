@echo off
title GASP Studio
cd /d "%~dp0"
echo Checking for updates...
git pull --ff-only --quiet 2>nul && echo Up to date. || echo (Could not pull updates; continuing with what is here.)
echo.
echo Starting GASP Studio... leave this window open while you work. Close it to stop.
node studio.js serve
pause

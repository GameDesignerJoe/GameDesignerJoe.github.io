@echo off
title GASP Studio
cd /d "%~dp0"
echo Starting GASP Studio... leave this window open while you work.
node studio.js serve
pause

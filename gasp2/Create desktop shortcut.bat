@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'GASP 2.lnk')); $s.TargetPath=(Join-Path $env:WINDIR 'System32\wscript.exe'); $s.Arguments='\"%~dp0gasp2-app.vbs\"'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0app\gasp.ico'; $s.Description='GASP 2'; $s.Save(); Write-Host 'Shortcut created on your Desktop: GASP 2. Right-click it, Pin to taskbar if you like.'"
pause

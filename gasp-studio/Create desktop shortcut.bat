@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'GASP Studio.lnk')); $s.TargetPath=(Join-Path $env:WINDIR 'System32\wscript.exe'); $s.Arguments='\"%~dp0gasp-app.vbs\"'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0app\gasp.ico'; $s.Description='GASP Studio'; $s.Save(); Write-Host 'Shortcut created on your Desktop: GASP Studio. Right-click it > Pin to taskbar if you like.'"
pause

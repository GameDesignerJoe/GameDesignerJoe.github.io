@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'GASP Studio.lnk')); $s.TargetPath='%~dp0GASP App.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0app\gasp.ico'; $s.WindowStyle=7; $s.Description='GASP Studio'; $s.Save(); Write-Host 'Shortcut created on your Desktop: GASP Studio'"
pause

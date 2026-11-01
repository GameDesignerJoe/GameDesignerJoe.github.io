# GASP Studio app launcher: server hidden, app window first, updates pulled in the background.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$port = 4747
$url = "http://localhost:$port"

function PortOpen { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $port); $c.Close(); return $true } catch { return $false } }

$server = $null
if (-not (PortOpen)) {
  $server = Start-Process -FilePath "node" -ArgumentList "studio.js serve --noopen --port $port" -WorkingDirectory $root -WindowStyle Hidden -PassThru
  for ($i = 0; $i -lt 100; $i++) { if (PortOpen) { break }; Start-Sleep -Milliseconds 100 }
}

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$profile = Join-Path $root "work\_appwindow"
$winArgs = "--app=$url --window-size=1500,950 --user-data-dir=`"$profile`" --no-first-run --no-default-browser-check --disable-features=msEdgeSidebar"
if ($edge) { $win = Start-Process -FilePath $edge -ArgumentList $winArgs -PassThru }
elseif ($chrome) { $win = Start-Process -FilePath $chrome -ArgumentList $winArgs -PassThru }
else { Start-Process $url; $win = $null }

# updates: after the window is up, in the background; they apply next launch
Start-Process -FilePath "git" -ArgumentList "pull --ff-only --quiet" -WorkingDirectory $root -WindowStyle Hidden -ErrorAction SilentlyContinue | Out-Null

if ($win) { $win.WaitForExit() }
if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }

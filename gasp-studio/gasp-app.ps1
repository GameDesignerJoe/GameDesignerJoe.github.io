# GASP Studio app launcher: starts the server hidden, opens the app window, stops the server when the window closes.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$port = 4747
$url = "http://localhost:$port"

# pull updates quietly (ignore failures)
try { git pull --ff-only --quiet 2>$null | Out-Null } catch {}

# is a server already running?
$up = $false
try { $r = Invoke-WebRequest -Uri "$url/api/info" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $up = $true } } catch {}

$server = $null
if (-not $up) {
  $server = Start-Process -FilePath "node" -ArgumentList "studio.js serve --noopen --port $port" -WorkingDirectory $root -WindowStyle Hidden -PassThru
  for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 250; try { $r = Invoke-WebRequest -Uri "$url/api/info" -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { break } } catch {} }
}

# open as an app window (Edge, else Chrome, else the default browser)
$edge = @("$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$profile = Join-Path $root "work\_appwindow"
$args = "--app=$url --window-size=1500,950 --user-data-dir=`"$profile`" --no-first-run --no-default-browser-check"
if ($edge) { $win = Start-Process -FilePath $edge -ArgumentList $args -PassThru }
elseif ($chrome) { $win = Start-Process -FilePath $chrome -ArgumentList $args -PassThru }
else { Start-Process $url; $win = $null }

# when the app window closes, stop the server we started
if ($win) { $win.WaitForExit() }
if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }

# GASP 2 app launcher: server hidden, app window first, updates pulled in the background (they apply next launch).
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$port = 4848
$url = "http://localhost:$port"

function PortOpen { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $port); $c.Close(); return $true } catch { return $false } }
function PortOwner { try { (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -First 1).OwningProcess } catch { $null } }
function StopPortOwner { $o = PortOwner; if ($o) { $p = Get-Process -Id $o -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -eq "node") { Stop-Process -Id $o -Force -ErrorAction SilentlyContinue; for ($i = 0; $i -lt 30; $i++) { if (-not (PortOpen)) { break }; Start-Sleep -Milliseconds 100 } } } }
# a server left over from an older version would serve old code: replace it
if (PortOpen) { StopPortOwner }

$server = Start-Process -FilePath "node" -ArgumentList "server.js --noopen --port $port" -WorkingDirectory $root -WindowStyle Hidden -PassThru
for ($i = 0; $i -lt 100; $i++) { if (PortOpen) { break }; Start-Sleep -Milliseconds 100 }

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$profile = Join-Path $root ".appwindow"
$winArgs = "--app=$url --window-size=1600,980 --user-data-dir=`"$profile`" --no-first-run --no-default-browser-check --disable-features=msEdgeSidebar"
if ($edge) { $win = Start-Process -FilePath $edge -ArgumentList $winArgs -PassThru }
elseif ($chrome) { $win = Start-Process -FilePath $chrome -ArgumentList $winArgs -PassThru }
else { Start-Process $url; $win = $null }

Start-Process -FilePath "git" -ArgumentList "pull --ff-only --quiet" -WorkingDirectory $root -WindowStyle Hidden -ErrorAction SilentlyContinue | Out-Null

if ($win) { $win.WaitForExit() }
if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
StopPortOwner

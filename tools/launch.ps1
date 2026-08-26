# Chaind Blitz launcher: ensures the dev server is up, then opens the game
# in an app-style browser window (Chrome/Edge --app mode, else default browser).
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:8765/"

function Test-Server {
  try { $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; return $true }
  catch { return $false }
}

if (-not (Test-Server)) {
  $node = (Get-Command node).Source
  if (-not $node) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("Node.js not found on PATH - install Node.js to run Chaind Blitz.", "Chaind Blitz") | Out-Null
    exit 1
  }
  Start-Process -FilePath $node -ArgumentList "`"$root\tools\serve.js`"" -WorkingDirectory $root -WindowStyle Hidden
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 400
    if (Test-Server) { break }
  }
}

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome)   { Start-Process $chrome -ArgumentList "--app=$url" }
elseif ($edge) { Start-Process $edge   -ArgumentList "--app=$url" }
else           { Start-Process $url }

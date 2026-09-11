# Extract pinokio-app.zip into runtime/ (music-server + www + serve.js).
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$Zip = Join-Path $RepoRoot 'cache\pinokio-app.zip'
$Dest = Join-Path $RepoRoot 'runtime'
$Marker = Join-Path $Dest 'music-server.exe'

if ((Test-Path $Marker) -and (Test-Path (Join-Path $Dest 'www\index.html')) -and (Test-Path (Join-Path $Dest 'serve.js'))) {
  Write-Host "App runtime already present: $Dest"
  exit 0
}

if (-not (Test-Path $Zip)) {
  throw "App zip not found: $Zip"
}

if (Test-Path $Dest) {
  Remove-Item $Dest -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

Write-Host "Extracting app runtime..."
Expand-Archive -LiteralPath $Zip -DestinationPath $Dest -Force

if (-not (Test-Path $Marker)) {
  throw "music-server.exe missing after extract"
}
if (-not (Test-Path (Join-Path $Dest 'www\index.html'))) {
  throw 'www/index.html missing after extract'
}

Write-Host "App runtime ready: $Dest"

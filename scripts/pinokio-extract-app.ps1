# Extract pinokio-app.zip into runtime/ (music-server + www + serve.js).
# Keeps runtime/resources (mm-server engine) if it already exists.
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$Zip = Join-Path $RepoRoot 'cache\pinokio-app.zip'
$Dest = Join-Path $RepoRoot 'runtime'
$Marker = Join-Path $Dest 'music-server.exe'
$Resources = Join-Path $Dest 'resources'

if (-not (Test-Path $Zip)) {
  throw "App zip not found: $Zip"
}

$temp = Join-Path $RepoRoot ('cache\pinokio-extract-' + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
try {
  Write-Host "Extracting app runtime..."
  Expand-Archive -LiteralPath $Zip -DestinationPath $temp -Force

  $root = $temp
  if (-not (Test-Path (Join-Path $root 'music-server.exe'))) {
    $inner = Get-ChildItem $temp -Directory | Select-Object -First 1
    if ($inner) { $root = $inner.FullName }
  }
  if (-not (Test-Path (Join-Path $root 'music-server.exe'))) {
    throw 'music-server.exe missing after extract'
  }
  if (-not (Test-Path (Join-Path $root 'www\index.html'))) {
    throw 'www/index.html missing after extract'
  }

  New-Item -ItemType Directory -Force -Path $Dest | Out-Null

  # Preserve the heavy engine tree across app refreshes.
  $savedResources = $null
  if (Test-Path $Resources) {
    $savedResources = Join-Path $RepoRoot ('cache\pinokio-resources-' + [guid]::NewGuid().ToString('n'))
    Move-Item $Resources $savedResources -Force
  }

  foreach ($name in @('music-server.exe', 'serve.js', 'COMMIT', 'www')) {
    $from = Join-Path $root $name
    $to = Join-Path $Dest $name
    if (-not (Test-Path $from)) { continue }
    if (Test-Path $to) { Remove-Item $to -Recurse -Force }
    Copy-Item $from $to -Recurse -Force
  }

  if ($savedResources) {
    if (Test-Path $Resources) { Remove-Item $Resources -Recurse -Force }
    Move-Item $savedResources $Resources -Force
  }
} finally {
  if (Test-Path $temp) { Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue }
}

if (-not (Test-Path $Marker)) {
  throw "music-server.exe missing in $Dest"
}
if (-not (Test-Path (Join-Path $Dest 'www\index.html'))) {
  throw 'www/index.html missing after extract'
}

Write-Host "App runtime ready: $Dest"

# Stage mm-server engine under resources/ (repo-root, H3-style durable asset).
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$Zip = Join-Path $RepoRoot 'cache\MiniMax-Music3-Studio-portable.zip'
$Dest = Join-Path $RepoRoot 'resources\minimaxmusic-cpp'
$Marker = Join-Path $Dest 'mm-server.exe'
$Legacy = Join-Path $RepoRoot 'runtime\resources\minimaxmusic-cpp\mm-server.exe'

if (Test-Path $Marker) {
  Write-Host "Engine already present: $Dest"
  exit 0
}

# Old Pinokio zip layout → keep engine without re-download.
if (Test-Path $Legacy) {
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Copy-Item -Path (Join-Path $RepoRoot 'runtime\resources\minimaxmusic-cpp\*') -Destination $Dest -Recurse -Force
  Write-Host "Migrated engine from runtime/resources -> $Dest"
  exit 0
}

if (-not (Test-Path $Zip)) {
  throw "Portable zip not found: $Zip"
}

$ExtractRoot = Join-Path $RepoRoot 'cache\portable-extract'
if (Test-Path $ExtractRoot) {
  Remove-Item $ExtractRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ExtractRoot | Out-Null

Write-Host "Extracting portable archive..."
Expand-Archive -LiteralPath $Zip -DestinationPath $ExtractRoot -Force

$mm = Get-ChildItem -Path $ExtractRoot -Recurse -Filter 'mm-server.exe' -File | Select-Object -First 1
if (-not $mm) {
  throw 'mm-server.exe not found inside the portable zip'
}

$SourceDir = $mm.Directory.FullName
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Write-Host "Copying engine bundle from $SourceDir -> $Dest"
Copy-Item -Path (Join-Path $SourceDir '*') -Destination $Dest -Recurse -Force

if (-not (Test-Path $Marker)) {
  throw "Failed to stage mm-server.exe at $Marker"
}

Write-Host "Engine ready: $Marker"

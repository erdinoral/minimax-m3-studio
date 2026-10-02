# Stage mm-server engine under resources/ (repo-root, H3-style durable asset).
# ASCII-only: Windows PowerShell 5.1 on non-English locales misreads UTF-8 arrows as quotes.
param(
  [string]$Zip = 'cache\MiniMax-Music3-Studio-portable.zip'
)
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$Zip = Join-Path $RepoRoot $Zip
$Dest = Join-Path $RepoRoot 'resources\minimaxmusic-cpp'
# The engine whose CUDA backends live in cuda13\ and cuda12\; the studio picks one.
$Marker = Join-Path $Dest 'cuda13\ggml-cuda.dll'

if (Test-Path $Marker) {
  Write-Host ("Engine already present: " + $Dest)
  exit 0
}

if (-not (Test-Path $Zip)) {
  throw ("Portable zip not found: " + $Zip)
}

$ExtractRoot = Join-Path $RepoRoot 'cache\portable-extract'
if (Test-Path $ExtractRoot) {
  Remove-Item $ExtractRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ExtractRoot | Out-Null

Write-Host 'Extracting portable archive...'
Expand-Archive -LiteralPath $Zip -DestinationPath $ExtractRoot -Force

$mm = Get-ChildItem -Path $ExtractRoot -Recurse -Filter 'mm-server.exe' -File | Select-Object -First 1
if (-not $mm) {
  throw 'mm-server.exe not found inside the portable zip'
}

$SourceDir = $mm.Directory.FullName
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
# An older engine kept one ggml-cuda.dll beside the exe; ggml would load it as a
# second CUDA backend next to the one chosen from cuda13\ or cuda12\.
$Flat = Join-Path $Dest 'ggml-cuda.dll'
if (Test-Path $Flat) {
  Remove-Item $Flat -Force
}
Write-Host ("Copying engine bundle from " + $SourceDir + " -> " + $Dest)
Copy-Item -Path (Join-Path $SourceDir '*') -Destination $Dest -Recurse -Force
Remove-Item $ExtractRoot -Recurse -Force

if (-not (Test-Path $Marker)) {
  throw ("Failed to stage the engine at " + $Marker)
}

Write-Host ("Engine ready: " + $Dest)

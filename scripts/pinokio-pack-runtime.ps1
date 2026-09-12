# Build a one-click Pinokio runtime zip: music-server + UI + serve script (no npm for end users).
param(
  [switch]$ForceServerBuild
)
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

Write-Host 'Building UI...'
npm --prefix app run build
if ($LASTEXITCODE -ne 0) { throw 'UI build failed' }

$server = Join-Path $RepoRoot 'target\release\music-server.exe'
if ($ForceServerBuild -or ($env:CI -eq 'true') -or -not (Test-Path $server)) {
  Write-Host 'Building music-server (release)...'
  cargo build -p music-server --release
  if ($LASTEXITCODE -ne 0) { throw 'music-server build failed' }
}

$sha = (git rev-parse HEAD).Trim()
$stage = Join-Path $RepoRoot 'cache\pinokio-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'www') | Out-Null

Copy-Item $server (Join-Path $stage 'music-server.exe') -Force
Copy-Item (Join-Path $RepoRoot 'scripts\pinokio-serve.js') (Join-Path $stage 'serve.js') -Force
Copy-Item (Join-Path $RepoRoot 'app\dist\*') (Join-Path $stage 'www') -Recurse -Force
Set-Content -Path (Join-Path $stage 'COMMIT') -Value $sha -NoNewline

$outDir = Join-Path $RepoRoot 'cache'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zip = Join-Path $outDir 'pinokio-app.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }

Write-Host "Zipping $zip ..."
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Set-Content -Path (Join-Path $outDir 'pinokio-runtime.sha') -Value $sha -NoNewline
Get-Item $zip | Select-Object FullName, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
Write-Host "COMMIT $sha"

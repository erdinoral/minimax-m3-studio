# Build M3 Studio from this repo (H3-style): UI + music-server.
# No release zip — Update is git pull + this script.
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

function Ensure-Cargo {
  if (Get-Command cargo -ErrorAction SilentlyContinue) { return }
  Write-Host 'Rust/cargo not found. Installing rustup (default toolchain)...'
  $init = Join-Path $RepoRoot 'cache\rustup-init.exe'
  New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot 'cache') | Out-Null
  Invoke-WebRequest -Uri 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe' -OutFile $init -UseBasicParsing
  & $init -y --default-toolchain stable
  $cargoHome = Join-Path $env:USERPROFILE '.cargo\bin'
  if (Test-Path $cargoHome) {
    $env:Path = "$cargoHome;$env:Path"
  }
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'cargo still missing after rustup. Open a new terminal or install Visual Studio Build Tools (C++), then re-run Install.'
  }
}

Ensure-Cargo

Write-Host 'Installing UI dependencies...'
npm --prefix app ci
if ($LASTEXITCODE -ne 0) {
  Write-Host 'npm ci failed; trying npm install...'
  npm --prefix app install
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
}

Write-Host 'Building UI...'
npm --prefix app run build
if ($LASTEXITCODE -ne 0) { throw 'UI build failed' }

Write-Host 'Building music-server (release)...'
cargo build -p music-server --release
if ($LASTEXITCODE -ne 0) { throw 'music-server build failed' }

$server = Join-Path $RepoRoot 'target\release\music-server.exe'
$ui = Join-Path $RepoRoot 'app\dist\index.html'
if (-not (Test-Path $server)) { throw "missing $server" }
if (-not (Test-Path $ui)) { throw "missing $ui" }

Write-Host "Build OK: $server"
Write-Host "UI OK: $ui"

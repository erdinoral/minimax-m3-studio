# Pull the latest Pinokio app zip when GitHub's published COMMIT differs from local.
# Engine weights under runtime/resources are left alone.
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

$ReleaseBase = 'https://github.com/erdinoral/minimax-m3-studio/releases/download/pinokio-runtime-v2'
$ShaUrl = "$ReleaseBase/pinokio-runtime.sha"
$ZipUrl = "$ReleaseBase/pinokio-app.zip"
$Cache = Join-Path $RepoRoot 'cache'
$Zip = Join-Path $Cache 'pinokio-app.zip'
$LocalCommit = Join-Path $RepoRoot 'runtime\COMMIT'
$Marker = Join-Path $RepoRoot 'runtime\music-server.exe'

New-Item -ItemType Directory -Force -Path $Cache | Out-Null

function Get-RemoteSha {
  try {
    $resp = Invoke-WebRequest -Uri $ShaUrl -UseBasicParsing -TimeoutSec 30
    return ($resp.Content | Out-String).Trim()
  } catch {
    Write-Host "Could not read remote Pinokio runtime sha ($($_.Exception.Message)); keeping local runtime."
    return $null
  }
}

$remote = Get-RemoteSha
$local = $null
if (Test-Path $LocalCommit) {
  $local = (Get-Content -Raw $LocalCommit).Trim()
}

$haveApp = (Test-Path $Marker) -and (Test-Path (Join-Path $RepoRoot 'runtime\www\index.html')) -and (Test-Path (Join-Path $RepoRoot 'runtime\serve.js'))

if ($haveApp -and $remote -and $local -and ($remote -eq $local)) {
  Write-Host "Pinokio runtime already current ($local)."
  exit 0
}

if (-not $remote) {
  if ($haveApp) { exit 0 }
  throw 'No local app runtime and could not reach GitHub release.'
}

Write-Host "Refreshing Pinokio app runtime: local=$local remote=$remote"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $ZipUrl -OutFile $Zip -UseBasicParsing -TimeoutSec 600
& (Join-Path $PSScriptRoot 'pinokio-extract-app.ps1')
if ($LASTEXITCODE -ne 0) { throw 'extract failed' }

# Ensure COMMIT matches remote even if an older zip lacked the file.
Set-Content -Path $LocalCommit -Value $remote -NoNewline
Write-Host "Pinokio app runtime updated to $remote"

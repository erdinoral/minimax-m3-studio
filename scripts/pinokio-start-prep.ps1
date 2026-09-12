# Called on every Start: pull GitHub, rebuild only when the commit changed
# (or when build outputs are missing). Offline / dirty tree still starts local build.
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

$server = Join-Path $RepoRoot 'target\release\music-server.exe'
$ui = Join-Path $RepoRoot 'app\dist\index.html'
$needBuild = -not ((Test-Path $server) -and (Test-Path $ui))

$before = $null
try { $before = (git rev-parse HEAD).Trim() } catch { }

Write-Host 'Checking GitHub for updates...'
try {
  git pull --ff-only 2>&1 | ForEach-Object { Write-Host $_ }
} catch {
  Write-Host "git pull skipped: $($_.Exception.Message)"
}

$after = $null
try { $after = (git rev-parse HEAD).Trim() } catch { }

if ($before -and $after -and ($before -ne $after)) {
  Write-Host "Repo updated $before -> $after — rebuilding..."
  $needBuild = $true
} elseif ($needBuild) {
  Write-Host 'Build outputs missing — building...'
} else {
  Write-Host "Already up to date ($after)."
}

if ($needBuild) {
  & (Join-Path $PSScriptRoot 'pinokio-build.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'build failed' }
}

# Engine once; no-op if already staged / migrated from old runtime/.
& (Join-Path $PSScriptRoot 'pinokio-extract-engine.ps1')

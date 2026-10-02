$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$appRoot = Join-Path $repoRoot 'release\local-portable\MiniMax-Music3-Studio'
$exe = Join-Path $appRoot 'MiniMax-Music3-Studio.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Local desktop build is missing.' }

# A local preview should see the library and already installed models from the
# user's existing Studio installation. Published portable builds use data/.
$existingData = Join-Path $env:LOCALAPPDATA 'MiniMax Music3 Studio'
if (Test-Path -LiteralPath (Join-Path $existingData 'studio-settings.json')) {
  $env:MINIMAX_STUDIO_DATA_ROOT = $existingData
  $env:MINIMAX_STUDIO_SETTINGS_PATH = Join-Path $existingData 'studio-settings.json'
  $env:MINIMAX_MUSIC_MODELS_ROOT = Join-Path $existingData 'models\minimaxmusic-cpp'
}

Write-Host 'Opening MiniMax Music3 Studio desktop window...'
Start-Process -FilePath $exe -WorkingDirectory $appRoot -Wait

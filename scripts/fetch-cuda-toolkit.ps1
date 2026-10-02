# Assemble a build-only CUDA toolkit from NVIDIA's redistributable archives.
# No installer, no administrator rights and no display driver: the machine's
# own driver stays untouched. Prints the toolkit root on success.
# ASCII-only: Windows PowerShell 5.1 on non-English locales misreads UTF-8.
param(
  [string]$Release = '13.3.0',
  [string]$Destination = ''
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
if (-not $Destination) { $Destination = Join-Path $RepoRoot "cache\cuda-toolkit-$Release" }
$Marker = Join-Path $Destination 'bin\nvcc.exe'
if ((Test-Path $Marker) -and (Test-Path (Join-Path $Destination 'lib\x64\cublas.lib'))) {
  Write-Output $Destination
  exit 0
}

$Base = 'https://developer.download.nvidia.com/compute/cuda/redist/'
$Manifest = Invoke-RestMethod ($Base + "redistrib_$Release.json")
# What ggml-cuda needs to compile and link: the compiler with its CRT headers
# and NVVM, the runtime, CCCL (CUB/Thrust headers) and cuBLAS.
$Components = @('cuda_nvcc', 'cuda_crt', 'libnvvm', 'cuda_cudart', 'cccl', 'libcublas')

$Downloads = Join-Path $RepoRoot 'cache\cuda-redist'
New-Item -ItemType Directory -Force -Path $Downloads, $Destination | Out-Null
foreach ($name in $Components) {
  $entry = $Manifest.$name
  if (-not $entry) { throw "CUDA $Release has no $name component" }
  $platform = $entry.'windows-x86_64'
  $archive = Join-Path $Downloads (Split-Path $platform.relative_path -Leaf)
  if (-not (Test-Path $archive) -or (Get-Item $archive).Length -ne [int64]$platform.size) {
    Write-Host ("Downloading " + $name + " " + $entry.version + " (" + [math]::Round($platform.size / 1MB) + " MB)")
    curl.exe -fL --retry 3 -o $archive ($Base + $platform.relative_path)
    if ($LASTEXITCODE -ne 0) { throw "Download of $name failed" }
  }
  $hash = (Get-FileHash -Algorithm SHA256 $archive).Hash.ToLowerInvariant()
  if ($hash -ne $platform.sha256) { Remove-Item $archive -Force; throw "$name failed its SHA-256 check" }

  $unpack = Join-Path $Downloads $name
  if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
  Expand-Archive -LiteralPath $archive -DestinationPath $unpack -Force
  # Each archive holds one top folder with bin/include/lib; merge them all.
  $top = Get-ChildItem -Path $unpack -Directory | Select-Object -First 1
  Copy-Item -Path (Join-Path $top.FullName '*') -Destination $Destination -Recurse -Force
  Remove-Item $unpack -Recurse -Force
}

if (-not (Test-Path $Marker)) { throw "nvcc.exe is missing from $Destination" }
Write-Output $Destination

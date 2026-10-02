param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$OutputDirectory,
    [ValidateSet('auto', 'cuda', 'vulkan', 'all')]
    [string]$RuntimeBackend = 'auto',
    [ValidateSet('universal', 'native', 'sm_89')]
    [string]$CudaArchitecture = 'universal',
    # A CUDA toolkit root that is not installed system-wide, such as the one
    # scripts/fetch-cuda-toolkit.ps1 assembles. Without the Visual Studio CUDA
    # integration only Ninja can drive nvcc, so this also switches generators.
    [string]$CudaToolkit,
    # The release layout: ggml backends as loadable modules and the CUDA one in
    # a cuda<major> folder beside mm-server.exe, which the studio names to the
    # engine through MM3_CUDA_BACKEND.
    [switch]$BackendDl
)

$ErrorActionPreference = 'Stop'
# git, cmake and the compiler all report progress on stderr. With the output
# redirected to a log, PowerShell treats every one of those lines as a
# terminating error, so the build died on "Cloning into ...". Every native call
# below checks $LASTEXITCODE, which is the actual verdict.
$PSDefaultParameterValues['*:ErrorAction'] = 'Stop'
$ErrorActionPreference = 'Continue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$engineSource = Get-Content -Raw (Join-Path $repoRoot 'engines\minimaxmusic-cpp-source.json') | ConvertFrom-Json
# Windows still refuses paths past 260 characters, and the engine's own build
# tree is deep. A full commit hash under %TEMP% used up the budget before cmake
# had written a single object, so the checkout gets a short home; set
# MM3_ENGINE_BUILD_ROOT to move it to a shorter drive root if even that is tight.
$engineBuildRoot = if ($env:MM3_ENGINE_BUILD_ROOT) { $env:MM3_ENGINE_BUILD_ROOT } else { $env:TEMP }
$engineWorktree = Join-Path $engineBuildRoot "mm3-$($engineSource.commit.Substring(0, 8))"
$enginePatches = @(Get-ChildItem -Path (Join-Path $repoRoot 'engines\patches') -Filter '*.patch' -File -ErrorAction SilentlyContinue | Sort-Object Name)

if ($CudaToolkit) {
    $CudaToolkit = [System.IO.Path]::GetFullPath($CudaToolkit)
    if (-not (Test-Path (Join-Path $CudaToolkit 'bin\nvcc.exe'))) { throw "No nvcc.exe under the CUDA toolkit $CudaToolkit." }
    $env:CUDA_PATH = $CudaToolkit
    $env:PATH = "$CudaToolkit\bin;$CudaToolkit\bin\x64;$env:PATH"
}

function Test-CudaToolchain {
    $nvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    $nvcc = Get-Command nvcc -ErrorAction SilentlyContinue
    if (-not $nvidiaSmi -or -not $nvcc) { return $false }
    & $nvidiaSmi.Source -L *> $null
    return $LASTEXITCODE -eq 0
}

function Assert-VulkanSdk {
    $sdk = $env:VULKAN_SDK
    $glslc = Get-Command glslc -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($sdk) -or -not (Test-Path (Join-Path $sdk 'Include\vulkan\vulkan.h')) -or -not (Test-Path (Join-Path $sdk 'Lib\vulkan-1.lib')) -or -not $glslc) {
        throw 'The selected minimaxmusic.cpp Vulkan build requires a Vulkan SDK with headers, vulkan-1.lib, and glslc; a Vulkan runtime alone is insufficient.'
    }
}

function Resolve-RuntimeBackend {
    if ($RuntimeBackend -eq 'auto') {
        if (Test-CudaToolchain) { return 'cuda' }
        if (-not [string]::IsNullOrWhiteSpace($env:VULKAN_SDK)) {
            Assert-VulkanSdk
            return 'vulkan'
        }
        throw 'No supported native build toolchain was detected. Install CUDA for NVIDIA or a complete Vulkan SDK, then select -RuntimeBackend explicitly.'
    }
    if ($RuntimeBackend -eq 'cuda' -and -not (Test-CudaToolchain)) {
        throw 'The CUDA build requires both a working NVIDIA driver (nvidia-smi) and nvcc.'
    }
    if ($RuntimeBackend -eq 'vulkan') { Assert-VulkanSdk }
    if ($RuntimeBackend -eq 'all') {
        if (-not (Test-CudaToolchain)) { throw 'The all-backends build requires both a working NVIDIA driver (nvidia-smi) and nvcc.' }
        Assert-VulkanSdk
    }
    return $RuntimeBackend
}

function Get-VcVars64 {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path $vswhere)) {
        throw 'A Visual Studio C++ build installation is required for a custom CUDA architecture build (vswhere.exe was not found).'
    }
    $installationPath = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($installationPath)) {
        throw 'Could not find a Visual Studio C++ build installation for the custom CUDA architecture build.'
    }
    $vcvars = Join-Path $installationPath.Trim() 'VC\Auxiliary\Build\vcvars64.bat'
    if (-not (Test-Path $vcvars)) { throw "Visual Studio vcvars64.bat is missing: $vcvars" }
    return $vcvars
}

function Assert-SpecificOutputDirectory {
    $fullPath = [System.IO.Path]::GetFullPath($OutputDirectory)
    if ($fullPath -eq [System.IO.Path]::GetPathRoot($fullPath)) {
        throw 'OutputDirectory must be a specific child directory, not a drive root.'
    }
    return $fullPath
}

function Sync-PinnedSource {
    # The custom CUDA build runs inside vcvars64, which brings Visual Studio's
    # own CMake and Ninja; every other build needs CMake on PATH.
    $customCuda = $RuntimeBackend -eq 'cuda' -or ($RuntimeBackend -eq 'auto' -and (Test-CudaToolchain))
    if (-not $customCuda -and -not (Get-Command cmake -ErrorAction SilentlyContinue)) {
        throw 'CMake is required to build the pinned minimaxmusic.cpp runtime. Install CMake and add it to PATH.'
    }
    if (-not (Test-Path (Join-Path $engineWorktree '.git'))) {
        git clone --recurse-submodules $engineSource.repository $engineWorktree
        if ($LASTEXITCODE -ne 0) { throw 'Could not clone the pinned minimaxmusic.cpp source.' }
    }
    git -C $engineWorktree fetch --depth 1 origin $engineSource.commit
    if ($LASTEXITCODE -ne 0) { throw "Could not fetch minimaxmusic.cpp commit $($engineSource.commit)." }
    # Patches from an earlier build would block the checkout or apply twice.
    git -C $engineWorktree reset --hard --quiet
    git -C $engineWorktree checkout --detach $engineSource.commit
    if ($LASTEXITCODE -ne 0) { throw "Could not check out minimaxmusic.cpp commit $($engineSource.commit)." }
    git -C $engineWorktree submodule update --init --recursive
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialise minimaxmusic.cpp submodules.' }
    foreach ($patch in $enginePatches) {
        git -C $engineWorktree apply --ignore-whitespace $patch.FullName
        if ($LASTEXITCODE -ne 0) { throw "Engine patch $($patch.Name) does not apply to commit $($engineSource.commit)." }
    }
}

function Invoke-CustomCudaBuild {
    # The engine's own buildcuda.cmd leaves GGML_NATIVE on, and ggml then sets
    # CMAKE_CUDA_ARCHITECTURES to "native" - a binary that only runs on the card
    # it was compiled on. A release must run on other people's cards, so the
    # universal build turns GGML_NATIVE off and lets ggml apply its documented
    # spread: virtual 50/61/70/75/80, real 86/89, virtual 90, and Blackwell on
    # CUDA 12.8 and above.
    $settings = switch ($CudaArchitecture) {
        # A release must run on other people's machines, so both halves are
        # spelled out: GGML_NATIVE off keeps ggml's CPU kernels off this exact
        # processor's instruction set, and the architecture list covers the
        # cards - PTX for Turing and Ampere, device code for the RTX 30, 40 and
        # 50 series. Upstream's own script leaves both at "whatever this machine
        # is", which produces a binary only this machine can run.
        # The trailing 120-virtual follows NVIDIA's "Building for Maximum
        # Compatibility" rule: without PTX for the newest architecture there is
        # nothing to JIT from and the kernel launch simply fails. ggml rewrites
        # it to 120a-virtual on the way through - its Blackwell kernels use FP4
        # tensor core instructions that only exist in 12Xa - so this buys PTX
        # for Blackwell variants, not for whatever comes after them. ggml's own
        # comment puts that boundary at Rubin.
        'universal' { '-DGGML_NATIVE=OFF -DCMAKE_CUDA_ARCHITECTURES=75-virtual;80-virtual;86-real;89-real;90-virtual;120a-real;120-virtual' }
        'native' { '-DCMAKE_CUDA_ARCHITECTURES=native' }
        'sm_89' { '-DCMAKE_CUDA_ARCHITECTURES=89' }
        default { throw "No custom CMake architecture is defined for '$CudaArchitecture'." }
    }
    $vcvars = Get-VcVars64
    $buildDirectoryName = "build-cuda-$CudaArchitecture"
    $parallelism = [Math]::Max(1, [Environment]::ProcessorCount)
    # Two targets are shipped. mm-server is the engine; neural-codec turns a
    # finished track back into VAE latents, which is the first half of handing
    # audio back to the model - continuing a track, replacing a chorus, writing
    # an intro in front of one. The rest - mm-lm, mm-synth, quantize and seven
    # test binaries - never leave the build directory.
    #
    # ccache, when it is installed, is what turns a rebuild from twenty minutes
    # into one: ggml picks it up on its own through GGML_CCACHE, and the CUDA
    # kernels - which are almost all of the time here - are what it caches.
    $ccache = if (Get-Command ccache -ErrorAction SilentlyContinue) { '-DGGML_CCACHE=ON' } else { '-DGGML_CCACHE=OFF' }
    # Flash attention kernels for every quantisation, not only the few ggml
    # compiles by default. Without them a quant with no kernel falls back to the
    # general path, which is the slow one - and the studio now offers quants
    # down to Q3, exactly the ones left out. It costs build time, nothing else.
    $flashAttention = '-DGGML_CUDA_FA_ALL_QUANTS=ON'
    # Symbols, kept beside the binary rather than thrown away.
    #
    # An engine that dies leaves Windows an address and nothing else -
    # "Exception code 0xc0000005, fault offset 0x1791c" - and without a program
    # database that address cannot be turned into a line of code. It costs a
    # file next to the executable and no speed: the optimiser is untouched.
    $symbols = '-DCMAKE_MSVC_DEBUG_INFORMATION_FORMAT=ProgramDatabase -DCMAKE_EXE_LINKER_FLAGS=/DEBUG -DCMAKE_SHARED_LINKER_FLAGS=/DEBUG'
    $layout = ''
    $targets = '--target mm-server --target neural-codec'
    if ($BackendDl) {
        $buildDirectoryName += '-dl'
        # ggml refuses a native CPU backend as a loadable module; the release
        # ships every CPU variant and picks one at load time instead.
        # The backends are no longer link dependencies of mm-server, and the
        # CPU variants have one target each, so everything is built.
        $layout = '-DGGML_BACKEND_DL=ON -DGGML_NATIVE=OFF -DGGML_CPU_ALL_VARIANTS=ON'
        $targets = ''
    }
    $toolkit = ''
    if ($CudaToolkit) {
        $buildDirectoryName += '-ninja'
        $toolkit = "-G Ninja -DCMAKE_BUILD_TYPE=Release -DCUDAToolkit_ROOT=`"$CudaToolkit`" -DCMAKE_CUDA_COMPILER=`"$CudaToolkit\bin\nvcc.exe`""
    }
    $command = "call `"$vcvars`" >nul && cmake -S . -B `"$buildDirectoryName`" $toolkit -DGGML_CUDA=ON $layout $ccache $flashAttention $symbols $settings && cmake --build `"$buildDirectoryName`" --config Release $targets --parallel $parallelism"
    Push-Location $engineWorktree
    # The compiler's own output must not become this function's return value:
    # PowerShell returns everything a function writes, and the build directory
    # name came back with several thousand lines of cmake in front of it.
    try { & cmd.exe /d /s /c $command | Out-Host } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "minimaxmusic.cpp CUDA build for $CudaArchitecture failed." }
    return $buildDirectoryName
}

function Invoke-RuntimeBuild {
    $resolvedBackend = Resolve-RuntimeBackend
    if ($CudaArchitecture -ne 'universal' -and $resolvedBackend -ne 'cuda') {
        throw "-CudaArchitecture $CudaArchitecture is only supported with the CUDA backend; resolved backend is '$resolvedBackend'."
    }
    if ($resolvedBackend -eq 'cuda') {
        return Invoke-CustomCudaBuild
    }

    $buildScriptName = switch ($resolvedBackend) {
        'cuda' { 'buildcuda.cmd' }
        'vulkan' { 'buildvulkan.cmd' }
        'all' { 'buildall.cmd' }
    }
    $buildScript = Join-Path $engineWorktree $buildScriptName
    if (-not (Test-Path $buildScript)) { throw "Pinned minimaxmusic.cpp build script is missing: $buildScript" }
    Push-Location $engineWorktree
    try { & $buildScript | Out-Host } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "minimaxmusic.cpp $resolvedBackend build failed." }
    return 'build'
}

Sync-PinnedSource
$buildDirectoryName = Invoke-RuntimeBuild
$runtime = @(
    (Join-Path $engineWorktree "$buildDirectoryName\Release\mm-server.exe"),
    (Join-Path $engineWorktree "$buildDirectoryName\mm-server.exe"),
    (Join-Path $engineWorktree 'mm-server.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $runtime) { throw 'minimaxmusic.cpp build completed without mm-server.exe.' }

$resolvedOutputDirectory = Assert-SpecificOutputDirectory
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null
Copy-Item $runtime (Join-Path $resolvedOutputDirectory 'mm-server.exe') -Force
$codec = Join-Path (Split-Path -Parent $runtime) 'neural-codec.exe'
if (Test-Path $codec) { Copy-Item $codec (Join-Path $resolvedOutputDirectory 'neural-codec.exe') -Force }
Get-ChildItem -Path (Split-Path -Parent $runtime) -Filter '*.dll' -File | Copy-Item -Destination $resolvedOutputDirectory -Force
if ($BackendDl) {
    $nvccVersion = (& nvcc --version | Select-String -Pattern 'release (\d+)\.').Matches[0].Groups[1].Value
    $cudaFolder = Join-Path $resolvedOutputDirectory "cuda$nvccVersion"
    New-Item -ItemType Directory -Force -Path $cudaFolder | Out-Null
    Move-Item (Join-Path $resolvedOutputDirectory 'ggml-cuda.dll') (Join-Path $cudaFolder 'ggml-cuda.dll') -Force
}
# The engine's own symbols travel with it, so a crash address on someone else's
# machine can be read here.
Get-ChildItem -Path (Split-Path -Parent $runtime) -Filter 'mm-server.pdb' -File -ErrorAction SilentlyContinue |
    Copy-Item -Destination $resolvedOutputDirectory -Force
if (-not (Test-Path (Join-Path $resolvedOutputDirectory 'mm-server.exe'))) { throw 'mm-server.exe was not staged into the requested output directory.' }

# The Visual C++ runtime the engine imports is not staged here: the studio
# checks for it on the user's machine and runs Microsoft's own redistributable
# installer when it is genuinely missing, which is how every other application
# that links against it behaves.

[pscustomobject]@{
    backend = Resolve-RuntimeBackend
    cuda_architecture = $CudaArchitecture
    runtime = Join-Path $resolvedOutputDirectory 'mm-server.exe'
} | ConvertTo-Json -Compress

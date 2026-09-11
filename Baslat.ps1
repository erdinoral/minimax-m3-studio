# ============================================================
#  MiniMax Music3 Studio - Tek tik Baslat
#  Backend (music-server) + Arayuz (Vite) birlikte acilir.
# ============================================================

# Resolve the project root = folder that contains this script (studio repo root)
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir      = Join-Path $ProjectRoot 'app'
$ServerExe   = Join-Path $ProjectRoot 'target\debug\music-server.exe'

function Test-Port($port) {
    $c = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    return $null -ne $c
}

function Test-Http($url, $timeoutSec = 4) {
    # NOTE: the studio health endpoint can take ~2s because it inspects the
    # engine before replying, so the timeout must not be too tight.
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec $timeoutSec -ErrorAction Stop
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MiniMax Music3 Studio baslatiliyor..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Backend : music-server.exe  ->  http://127.0.0.1:8765" -ForegroundColor Gray
Write-Host "  Arayuz  : Vite dev server   ->  http://127.0.0.1:3000"  -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ---------- Kontroller ----------
if (-not (Test-Path $ServerExe)) {
    Write-Host "[HATA] music-server.exe bulunamadi: $ServerExe" -ForegroundColor Red
    Write-Host "        Once backend derleyin:" -ForegroundColor Yellow
    Write-Host "        cd /d $ProjectRoot  (then)  cargo build -p music-server" -ForegroundColor Yellow
    Read-Host "Devam etmek icin bir tusa basin"; exit 1
}
if (-not (Test-Path (Join-Path $AppDir 'node_modules'))) {
    Write-Host "[HATA] Arayuz bagimliliklari eksik:" -ForegroundColor Red
    Write-Host "        npm --prefix `"$AppDir`" install" -ForegroundColor Yellow
    Read-Host "Devam etmek icin bir tusa basin"; exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[HATA] Node.js / npm bulunamadi. https://nodejs.org adresinden kurun." -ForegroundColor Red
    Read-Host "Devam etmek icin bir tusa basin"; exit 1
}

# ---------- Backend ----------
if (Test-Http 'http://127.0.0.1:8765/health') {
    Write-Host "  Backend zaten calisiyor (8765)." -ForegroundColor Yellow
} else {
    try {
        # Start the server with its own console window so logs are visible
        Start-Process -FilePath $ServerExe -WorkingDirectory $ProjectRoot
        Write-Host "  Backend baslatildi, hazir olmasi bekleniyor..." -ForegroundColor Gray
    } catch {
        Write-Host "[HATA] Backend baslatilamadi: $($_.Exception.Message)" -ForegroundColor Red
        Read-Host "Devam etmek icin bir tusa basin"; exit 1
    }
    $ready = $false
    # Backend can take ~10-15s to boot; each health probe may itself take ~2s.
    for ($i = 0; $i -lt 30; $i++) {
        if (Test-Http 'http://127.0.0.1:8765/health' 4) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if ($ready) { Write-Host "  Backend hazir." -ForegroundColor Green }
    else        { Write-Host "  [UYARI] Backend hazir olmadi, yine de devam ediliyor." -ForegroundColor Yellow }
}

# ---------- Arayuz (Vite) ----------
if (Test-Http 'http://127.0.0.1:3000') {
    Write-Host "  Arayuz zaten calisiyor (3000)." -ForegroundColor Yellow
} else {
    try {
        $viteLog = Join-Path $AppDir 'vite.log'
        # "npm run dev" logs to %viteLog% and keeps its own console open
        Start-Process -FilePath 'cmd.exe' -ArgumentList "/c","npm run dev > `"$viteLog`" 2>&1" -WorkingDirectory $AppDir
        Write-Host "  Arayuz baslatiliyor (log: $viteLog)..." -ForegroundColor Gray
        $viteUp = $false
        for ($i = 0; $i -lt 30; $i++) {
            if (Test-Http 'http://127.0.0.1:3000') { $viteUp = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if ($viteUp) { Write-Host "  Arayuz hazir." -ForegroundColor Green }
        else {
            Write-Host "  [UYARI] Arayuz hazir olmadi. $viteLog dosyasini kontrol edin." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[HATA] Arayuz baslatilamadi: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ---------- Tarayici ----------
Write-Host "  Tarayici aciliyor..." -ForegroundColor Gray
try { Start-Process 'http://127.0.0.1:3000' } catch { }

Write-Host ""
Write-Host "  Her sey hazir!" -ForegroundColor Green
Write-Host "  Kapatmak icin 'Baslat.ps1' icinde bu pencereye [K] yazip enter'a basin" -ForegroundColor Gray
Write-Host "  (ya da backend/arayuz pencerelerini manuel kapatin)." -ForegroundColor Gray
Write-Host ""

# ---------- Bekleme + kapatma secenegi ----------
$choice = Read-Host "  [K] Servisleri KAPAT  /  [Enter] Açik birak ve cik"
if ($choice -eq 'K' -or $choice -eq 'k') {
    Write-Host "  Servisler kapatiliyor..." -ForegroundColor Yellow
    Get-Process -Name music-server -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "  Backend kapatildi. Arayuz (node) penceresini manuel kapatabilirsiniz." -ForegroundColor Yellow
}
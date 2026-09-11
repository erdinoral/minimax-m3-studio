@echo off
chcp 65001 >nul
rem ============================================================
rem  MiniMax Music3 Studio - Servisleri KAPAT
rem  Backend (music-server) ve Arayuz (Vite/node) kapatilir.
rem  Not: Tarayici sekmesini de kapatin.
rem ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-Process -Name music-server -ErrorAction SilentlyContinue | Stop-Process -Force; " ^
  "$n = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*nodejs*' }; " ^
  "if ($n) { Stop-Process -Name node -Force -ErrorAction SilentlyContinue }; " ^
  "Start-Sleep -Seconds 1; " ^
  "if (Get-NetTCPConnection -State Listen -LocalPort 3000,8765 -ErrorAction SilentlyContinue) { Write-Host 'Bazi servisler hala acik.' -ForegroundColor Yellow } else { Write-Host 'Tum servisler kapatildi.' -ForegroundColor Green }"
echo.
pause
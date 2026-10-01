@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Can cai Node.js 24 tro len.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci --cache .npm-cache
  if errorlevel 1 goto fail
)
call npm.cmd run build
if errorlevel 1 goto fail
echo.
echo Mo http://127.0.0.1:3000 trong trinh duyet.
echo Giu cua so nay mo. Nhan Ctrl+C de dung.
call npm.cmd start
if errorlevel 1 goto fail
exit /b 0
:fail
echo.
echo Khong the khoi dong. Xem thong bao ben tren va README.md.
pause
exit /b 1

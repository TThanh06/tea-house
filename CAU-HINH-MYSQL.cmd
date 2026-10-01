@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Can Node.js 24 tro len.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci --cache .npm-cache
  if errorlevel 1 goto fail
)
call npm.cmd run db:setup

if errorlevel 1 goto fail
echo.
pause
exit /b 0
:fail
echo.
echo Chua hoan tat. Xem huong dan ben tren; cau hinh dang dung duoc giu nguyen neu chua luu thanh cong.
pause
exit /b 1

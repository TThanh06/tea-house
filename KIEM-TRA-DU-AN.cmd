@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Chay CHAY-DU-AN.cmd de cai thu vien truoc.
  pause
  exit /b 1
)
call npm.cmd run verify
if errorlevel 1 goto fail
call npm.cmd run db:check
if errorlevel 1 goto fail
echo.
echo KIEM TRA THANH CONG. Xem README va docs/NGHIEM-THU.md de demo.
pause
exit /b 0
:fail
echo.
echo KIEM TRA CHUA DAT. Xem loi ben tren.
pause
exit /b 1

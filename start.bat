@echo off
rem Double-click to start MariaDB, backend and frontend, then open the site.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-start.ps1" %*
if errorlevel 1 (
  echo.
  echo Start failed. Read the message above.
  pause
)

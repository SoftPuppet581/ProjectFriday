@echo off
rem Double-click to stop the frontend, backend and MariaDB.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-stop.ps1" %*
pause

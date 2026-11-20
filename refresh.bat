@echo off
rem Run right before the demo: refreshes game news and Steam prices (start.bat must have been run first).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-refresh.ps1" %*
pause

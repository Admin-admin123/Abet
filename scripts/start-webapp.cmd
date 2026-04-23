@echo off
setlocal
cd /d %~dp0\..
powershell -ExecutionPolicy Bypass -File .\scripts\start-webapp.ps1 %*
endlocal

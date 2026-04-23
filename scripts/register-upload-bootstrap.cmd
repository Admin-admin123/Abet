@echo off
setlocal
cd /d %~dp0\..
powershell -ExecutionPolicy Bypass -File .\scripts\register-upload-bootstrap.ps1
endlocal

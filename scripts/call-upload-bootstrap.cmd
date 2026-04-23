@echo off
setlocal
cd /d %~dp0\..
set URL=http://localhost:5678/webhook/upload
echo Calling: %URL%
curl.exe -s -w "\nHTTP %%{http_code}\n" -X POST "%URL%" -H "x-api-key: my-secret-key-2026" -F "file=@Docs/2026-03-11T2125_Grades-CSE251.csv" -F "file_type=grades" -F "term=2242"
endlocal

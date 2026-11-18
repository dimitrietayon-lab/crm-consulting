@echo off
setlocal EnableExtensions
cd /d "C:\innolab\crm-consulting"
set "LOG=rename-log.txt"
>"%LOG%" echo Rename started %DATE% %TIME%

call :MOVE "backend\src\routes\sprint-targets.js"     "backend\src\routes\acquisition-targets.js"
call :MOVE "backend\src\routes\sprint-assessments.js" "backend\src\routes\acquisition-assessments.js"
call :MOVE "backend\src\routes\sprint-offers.js"      "backend\src\routes\acquisition-offers.js"
call :MOVE "backend\src\routes\sprint-handover.js"    "backend\src\routes\acquisition-handover.js"
call :MOVE "backend\src\routes\sprint-settings.js"    "backend\src\routes\acquisition-settings.js"
call :MOVE "backend\src\routes\sprint-outreach.js"    "backend\src\routes\acquisition-outreach.js"
call :MOVE "backend\src\routes\sprint-contacts.js"    "backend\src\routes\acquisition-contacts.js"
call :MOVE "backend\src\routes\sprint-market.js"      "backend\src\routes\acquisition-market.js"

call :MOVE "backend\src\lib\sprintCompliance.js" "backend\src\lib\acquisitionCompliance.js"
call :MOVE "backend\src\lib\sprintAccount.js"    "backend\src\lib\acquisitionAccount.js"

call :MOVE "backend\src\lib\pdf\sprint-assessment.js" "backend\src\lib\pdf\acquisition-assessment.js"
call :MOVE "backend\src\lib\pdf\sprint-offer.js"      "backend\src\lib\pdf\acquisition-offer.js"
call :MOVE "backend\src\lib\pdf\sprint-report.js"     "backend\src\lib\pdf\acquisition-report.js"

call :MOVE "frontend\app\(protected)\sprint-targets" "frontend\app\(protected)\akquise"
call :MOVE "frontend\components\sprint"              "frontend\components\acquisition"

call :MOVE "frontend\lib\sprintOptions.js"  "frontend\lib\acquisitionOptions.js"
call :MOVE "frontend\lib\sprintSettings.js" "frontend\lib\acquisitionSettings.js"
call :MOVE "frontend\lib\sprintTeam.js"     "frontend\lib\acquisitionTeam.js"

call :DEL "frontend\components\acquisition\SprintNav.jsx"
call :DEL "frontend\components\acquisition\StatusPicker.jsx"

echo.>>"%LOG%"
type "%LOG%"
echo.
echo Done. Log: %LOG%
pause
exit /b 0

:MOVE
if not exist "%~1" (
  echo SKIP   %~1>>"%LOG%"
  exit /b 0
)
if exist "%~2\*" (
  rmdir /s /q "%~2"
) else (
  if exist "%~2" del /q "%~2"
)
move /y "%~1" "%~2" >>"%LOG%" 2>&1
if errorlevel 1 (
  echo ERROR  %~1 -^> %~2>>"%LOG%"
) else (
  echo MOVED  %~1 -^> %~2>>"%LOG%"
)
exit /b 0

:DEL
if exist "%~1" (
  del /q "%~1" >>"%LOG%" 2>&1
  echo DELETED %~1>>"%LOG%"
)
exit /b 0

@echo off
chcp 65001 > nul
echo Archiving project to ..\v5.2 ...
robocopy "%~dp0." "%~dp0..\v5.2" /E /XD node_modules dist .firebase .git .gemini coverage build_logs *.log
if %ERRORLEVEL% LEQ 7 (
    echo Robocopy finished successfully.
    exit /b 0
) else (
    echo Robocopy failed with error level %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

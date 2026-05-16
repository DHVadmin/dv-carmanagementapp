@echo off
chcp 65001 > nul
echo.
echo  동행빌리지 차량관리 앱 - 설치 도우미
echo  PowerShell 스크립트를 실행합니다...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

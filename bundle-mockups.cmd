@echo off
cd /d "%~dp0"
node bundle-mockups.cjs
start "" "mockups-uebersicht.html"
pause

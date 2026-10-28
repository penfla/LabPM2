@echo off
REM License-Identifier: PolyForm-Noncommercial-1.0.0
REM Copyright (c) 2026 Flavio Pendolino
REM https://polyformproject.org/licenses/noncommercial/1.0.0
REM Start LabPM. The only setting is "dataDir" in labpm.config.json (e.g. "\\\\NAS\\labpm" or "D:\\labpm-data").
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.13 or newer is required: https://nodejs.org
  pause
  exit /b 1
)
cd /d "%~dp0"
node --no-warnings server\index.js %*
pause

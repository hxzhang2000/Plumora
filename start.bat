@echo off
rem ============================================================
rem  Plumora - one-click launcher  (ASCII shim)
rem
rem  The real logic lives in start.ps1 next to this file.
rem
rem  Why a shim instead of one self-contained .bat?
rem  This machine's console code page is 936 (GBK), and cmd.exe
rem  parses a .bat file using the code page that is active while
rem  it reads the file - so UTF-8 Chinese text inside a .bat gets
rem  chopped into garbage commands. Encoding the .bat as GBK would
rem  work here but break as soon as the machine switches to the
rem  UTF-8 console code page. Keeping this file pure ASCII makes it
rem  code-page independent, and PowerShell reads start.ps1 as
rem  UTF-8 (with BOM) reliably on both PowerShell 5.1 and 7+.
rem
rem  Usage:
rem    start.bat             dev server (default, hot reload)
rem    start.bat prod        build + preview server
rem    start.bat help        show help
rem ============================================================
setlocal EnableExtensions
cd /d "%~dp0"

set "PS1=%~dp0start.ps1"
if not exist "%PS1%" goto :no_script

set "PSEXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%PSEXE%" goto :have_ps
set "PSEXE=powershell.exe"
where %PSEXE% >nul 2>&1
if errorlevel 1 goto :no_ps

:have_ps
rem Normalize common help spellings so PowerShell does not reject -h / --help
rem as an unknown parameter name.
if /i "%~1"=="-h"     goto :ps_help
if /i "%~1"=="--help" goto :ps_help
if /i "%~1"=="/?"     goto :ps_help
if /i "%~1"=="-?"     goto :ps_help

"%PSEXE%" -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%PS1%" %*
set "RC=%errorlevel%"
goto :report

:ps_help
"%PSEXE%" -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%PS1%" help
set "RC=%errorlevel%"
goto :report

:report
if "%RC%"=="0" goto :done
echo.
echo [ERROR] start.ps1 exited with code %RC%.
echo.
pause

:done
endlocal & exit /b %RC%

:no_script
echo.
echo [ERROR] start.ps1 was not found next to this file.
echo         Expected at: %PS1%
echo.
pause
endlocal & exit /b 1

:no_ps
echo.
echo [ERROR] Windows PowerShell was not found on this machine.
echo         Expected at: %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
echo.
pause
endlocal & exit /b 1

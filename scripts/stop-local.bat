@echo off
setlocal
cd /d "%~dp0.."
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"

echo ==========================================================
echo   Yaldi HaYakar (Dear Child) - Stopping Local Environment
echo ==========================================================

if "%~1"=="--clean" (
    echo Stopping containers and removing database volume (-v^)...
    docker compose down -v
) else if "%~1"=="-CleanData" (
    echo Stopping containers and removing database volume (-v^)...
    docker compose down -v
) else (
    echo Stopping containers (preserving database volume^)...
    docker compose down
)

if errorlevel 1 (
    echo [ERROR] Failed to stop docker compose environment.
    pause
    exit /b 1
)

echo Local environment stopped cleanly.
exit /b 0

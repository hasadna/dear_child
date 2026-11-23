@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"

echo ==========================================================
echo   Yaldi HaYakar (Dear Child) - Local Cluster Simulation
echo ==========================================================

:: 1. Check Docker installation
where docker >nul 2>&1
if errorlevel 1 (
    echo [1/5] Docker is not installed. Attempting installation via winget...
    where winget >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Docker is not installed and winget is unavailable.
        echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
        pause
        exit /b 1
    )
    winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [ERROR] Docker Desktop installation failed or was cancelled.
        pause
        exit /b 1
    )
    echo Docker Desktop installed. Please restart Windows or sign out/in once, then re-run.
    pause
    exit /b 0
)

:: 2. Ensure Docker Engine is running
docker info >nul 2>&1
if errorlevel 1 (
    set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    if not exist "!DOCKER_EXE!" (
        echo [ERROR] Docker Engine is not running and Docker Desktop was not found at "!DOCKER_EXE!".
        pause
        exit /b 1
    )
    echo [2/5] Starting Docker Desktop...
    start "" "!DOCKER_EXE!"
    set /a WAIT_COUNT=0
    :wait_docker
    timeout /t 3 /nobreak >nul
    set /a WAIT_COUNT+=3
    docker info >nul 2>&1
    if not errorlevel 1 goto docker_ready
    echo       Waiting for Docker Engine... (!WAIT_COUNT!s/120s^)
    if !WAIT_COUNT! lss 120 goto wait_docker
    echo [ERROR] Docker Engine did not become ready within 120 seconds.
    pause
    exit /b 1
)
:docker_ready
echo [2/5] Docker Engine is ready.

:: 3. Build and start containers
echo [3/5] Building and starting containers (docker compose up --build -d^)...
docker compose up --build -d
if errorlevel 1 (
    echo [ERROR] docker compose up failed.
    pause
    exit /b 1
)

:: 4. Wait for PostgreSQL/PostGIS healthcheck and run migrations + seed
echo [4/5] Waiting for PostgreSQL/PostGIS and running migrations + seed...
set /a DB_TRIES=0
:wait_db
for /f "delims=" %%H in ('docker inspect --format "{{.State.Health.Status}}" dear-child-postgis 2^>nul') do set "DB_HEALTH=%%H"
if "!DB_HEALTH!"=="healthy" goto db_ready
timeout /t 2 /nobreak >nul
set /a DB_TRIES+=1
if !DB_TRIES! lss 30 goto wait_db
echo [ERROR] PostgreSQL container (dear-child-postgis^) did not become healthy in time.
pause
exit /b 1

:db_ready
docker compose exec -T app node dist/db/migrate.js
if errorlevel 1 (
    echo [ERROR] Database migration failed.
    pause
    exit /b 1
)

docker compose exec -T app node dist/db/seed-dictionaries.js
if errorlevel 1 (
    echo [ERROR] Dictionary seed failed.
    pause
    exit /b 1
)

:: 5. Verify HTTP health and open browser
echo [5/5] Verifying application health at http://localhost:3000/api/v1/health ...
set /a APP_TRIES=0
:wait_app
curl -sf http://localhost:3000/api/v1/health >nul 2>&1
if not errorlevel 1 goto app_ready
timeout /t 1 /nobreak >nul
set /a APP_TRIES+=1
if !APP_TRIES! lss 20 goto wait_app
echo [WARNING] Health endpoint did not respond yet; check logs with: docker compose logs -f app
goto open_browser

:app_ready
echo Application is healthy and live at http://localhost:3000 !

:open_browser
echo Opening http://localhost:3000 in your default browser...
start "" "http://localhost:3000"
exit /b 0

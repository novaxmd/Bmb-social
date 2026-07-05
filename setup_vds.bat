@echo off
setlocal
echo ======================================================
echo    Bmbtech - VDS Setup and Build Script
echo ======================================================
echo.

:: 1. FFmpeg Check
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] FFmpeg not found! Please install FFmpeg and add it to PATH.
    echo Or set FFMPEG_PATH correctly in backend/.env.production.
    pause
    exit /b
)
echo [+] FFmpeg detected.

:: 2. Dependencies
echo.
echo [1/4] Installing dependencies...
call npm run setup
if %errorlevel% neq 0 goto :error

:: 3. Database
echo.
echo [2/4] Preparing database...
cd backend
call npx prisma generate
call npx prisma db push
cd ..
if %errorlevel% neq 0 goto :error

:: 4. Build
echo.
echo [3/4] Building projects (this may take a while)...
echo [*] Building backend...
cd backend
call npm run build
cd ..

echo [*] Building frontend...
cd frontend
:: Temporarily copy the production env file to .env.local so Next.js picks it up
copy .env.production .env.local /y
call npm run build
cd ..

if %errorlevel% neq 0 goto :error

:: 5. Startup Info
echo.
echo ======================================================
echo    SETUP COMPLETE!
echo ======================================================
echo.
echo To start the project:
echo 1. If PM2 is installed (Recommended):
echo    pm2 start ecosystem.config.js
echo.
echo 2. To start manually:
echo    npm start
echo.
echo Remember: via Cloudflare Tunnel you need to point;
echo - download.bmntech.site -> http://92.249.61.22:3344
echo - api.download.bmntech.site -> http://92.249.61.22:3355
echo.
pause
exit /b

:error
echo.
echo [ERROR] Something went wrong! Please check the errors above.
pause
exit /b

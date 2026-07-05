@echo off
SETLOCAL EnableDelayedExpansion

echo ===========================================
echo    Bmbtech VDS Quick Setup Script (v2)
echo ===========================================
echo.

:: 1. FFmpeg Check and Installation
echo [+] Checking FFmpeg...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] FFmpeg not found. Installing via Winget...
    echo [!] Note: This may take a few minutes.
    winget install --id=Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [X] Automatic installation via Winget failed.
        echo [!] Please install FFmpeg manually and add its bin folder to PATH.
    ) else (
        echo [V] FFmpeg installed successfully. (You may need to restart your system)
    )
) else (
    echo [V] FFmpeg is already installed.
)

:: 2. yt-dlp Check and Standalone Installation
echo.
echo [+] Checking yt-dlp...
set YTDLP_PATH=yt-dlp
yt-dlp --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] yt-dlp not found on system. Downloading a local copy...
    if not exist "backend" mkdir backend
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'backend\yt-dlp.exe'"
    if exist "backend\yt-dlp.exe" (
        echo [V] backend\yt-dlp.exe is ready.
        set YTDLP_PATH=%CD%\backend\yt-dlp.exe
    )
) else (
    echo [V] yt-dlp is already installed on the system.
)

:: 3. Node Dependencies and Database
echo.
echo [+] Installing Node.js dependencies and configuring DB...
call npm install
cd backend
call npm install
echo [!] Creating database schema...
call npx prisma generate
call npx prisma db push
cd ..
cd frontend
call npm install
cd ..

echo.
echo ===========================================
echo    Setup Complete!
echo ===========================================
echo 1. If FFmpeg installation just finished, you may need to close and reopen the terminal.
echo 2. Fill in the .env file in the backend folder with your bot tokens.
echo 3. Start the application with the 'npm run dev' command.
echo.
pause

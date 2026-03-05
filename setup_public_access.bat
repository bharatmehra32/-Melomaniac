@echo off
REM Melomaniac Public Access Setup Script
REM This script helps you create a public link to Melomaniac

echo.
echo ====================================
echo  Melomaniac - Public Access Setup
echo ====================================
echo.
echo Choose an option:
echo 1. Setup ngrok (requires free account)
echo 2. Setup LocalTunnel (no signup needed)
echo.

set /p choice="Enter your choice (1 or 2): "

if "%choice%"=="1" (
    echo.
    echo Step 1: Get your ngrok Authtoken from: https://dashboard.ngrok.com
    echo.
    set /p token="Paste your Authtoken here (or press Enter to skip): "
    
    if not "%token%"=="" (
        ngrok authtoken %token%
        echo.
        echo Now starting ngrok tunnel...
        echo Your public URL will appear below:
        echo.
        ngrok http 3000
    ) else (
        echo Skipped. Run manually when you have your token:
        echo   ngrok authtoken YOUR_TOKEN
        echo   ngrok http 3000
    )
) else if "%choice%"=="2" (
    echo.
    echo Installing LocalTunnel (no signup required)...
    npm install -g localtunnel
    echo.
    echo Starting LocalTunnel...
    echo Your public URL will appear below:
    echo.
    lt --port 3000
) else (
    echo Invalid choice. Please run the script again.
)

pause

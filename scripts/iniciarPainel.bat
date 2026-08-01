@echo off
title Painel Barbearia Bot
color 0A
echo ==========================================
echo    INICIANDO O PAINEL DO WHATSAPP...
echo ==========================================
echo.
cd /d "%~dp0\.."
node src\server.js
pause
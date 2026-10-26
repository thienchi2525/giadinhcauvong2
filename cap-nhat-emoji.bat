@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Dang quet thu muc Emoji va cap nhat emoji-manifest.json ...
node scripts\emoji-sync.mjs %*
echo.
echo Xong. Hay commit + push emoji-manifest.json len GitHub (neu khong dung Actions tu dong).
pause

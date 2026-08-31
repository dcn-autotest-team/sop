@echo off
chcp 65001 >nul
title SOP Hub 控制台
echo ======================================================
echo           🚀 正在启动 SOP Hub 本地控制台...
echo ======================================================
echo.

:: 启动后台 Node 服务
start "" /b node server.js

:: 等待 1 秒后在系统默认浏览器中打开控制台
timeout /t 1 /nobreak >nul
start http://localhost:3333

echo 服务已就绪！浏览器已自动打开控制台 (http://localhost:3333)
echo.
echo 如需关闭服务，直接关闭本窗口即可。
echo ======================================================
pause >nul

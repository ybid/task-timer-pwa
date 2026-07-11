@echo off
echo ====================================
echo 任务计时器 PWA - 安装和启动脚本
echo ====================================
echo.

echo [1/2] 正在安装依赖...
cd /d "%~dp0"
call npm install --registry=https://registry.npmmirror.com

if %errorlevel% neq 0 (
    echo.
    echo ❌ 依赖安装失败！
    echo 请尝试以下解决方案：
    echo 1. 检查网络连接
    echo 2. 运行: npm cache clean --force
    echo 3. 删除 node_modules 文件夹后重试
    pause
    exit /b 1
)

echo.
echo ✅ 依赖安装完成！
echo.
echo [2/2] 正在启动开发服务器...
echo.
echo 📱 应用将在 http://localhost:3000 启动
echo 💡 按 Ctrl+C 可停止服务器
echo.

call npm run dev

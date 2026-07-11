# 快速启动指南

## 方法一：使用启动脚本（推荐）

双击运行 `start.bat` 文件，它会自动安装依赖并启动开发服务器。

## 方法二：手动安装

### 1. 安装依赖

打开命令行，进入项目目录：

```bash
cd task-timer-pwa
```

安装依赖（使用淘宝镜像加速）：

```bash
npm install --registry=https://registry.npmmirror.com
```

如果 npm install 卡住或失败，可以尝试：

```bash
# 清理缓存后重试
npm cache clean --force
npm install --registry=https://registry.npmmirror.com
```

或者使用 cnpm：

```bash
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动。

### 3. 在浏览器中访问

打开浏览器访问：http://localhost:3000

### 4. iPad 测试

确保你的 iPad 和电脑在同一网络，然后在 iPad Safari 中访问：

```
http://[你的电脑IP地址]:3000
```

查看电脑 IP 地址的方法：
- Windows: 运行 `ipconfig`，查找 IPv4 地址
- Mac/Linux: 运行 `ifconfig` 或 `ip addr`

## 常见问题

### npm install 卡住不动

1. 检查网络连接
2. 使用淘宝镜像：`npm install --registry=https://registry.npmmirror.com`
3. 清理缓存：`npm cache clean --force`
4. 删除 node_modules 文件夹后重新安装

### 端口 3000 被占用

修改 `vite.config.ts` 中的端口号：

```typescript
server: {
  host: true,
  port: 3001,  // 改为其他端口
}
```

### TypeScript 类型错误

确保已正确安装所有依赖：

```bash
npm install
```

## 生产部署

构建生产版本：

```bash
npm run build
```

构建产物在 `dist` 目录，可部署到任意静态托管服务。

> 离线能力需要生产构建（Service Worker 在 `npm run dev` 下默认关闭）。

## 可选：开启云端同步

同步为可选功能，未配置时应用完全离线工作。

1. 启动同步后端：

   ```bash
   cd server
   npm install
   npm run dev    # http://localhost:8787
   ```

2. 在项目根目录创建 `.env`：

   ```bash
   VITE_SYNC_API_BASE=http://localhost:8787
   ```

3. 重启 `npm run dev`，顶栏出现「同步」按钮即可使用。

生产部署（Cloudflare Workers）详见 `README.md` 的「可选：开启云端同步」一节。

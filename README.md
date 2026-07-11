# 计划甘特表 PWA（任务计时器）

iPad 优化的渐进式 Web 应用，用于追踪任务进度与计时。支持项目分组、每日进度记录、全屏计时器、拖拽排序，并可选择开启云端同步。

## 功能特性

- ✅ 计划 / 分组 / 任务三级结构，进度以甘特热力图展示
- ✅ 全屏计时器，自动记录开始/结束时间，统计今日/本周时长
- ✅ 计时中断自动保存草稿，刷新或重新打开可「继续计时」
- ✅ 拖拽排序（鼠标 / 触摸 / 键盘均可）、长按弹出操作菜单
- ✅ 可访问性优化：对话框 Esc 关闭 + 焦点陷阱、单元格可键盘操作、允许页面缩放
- ✅ IndexedDB 本地数据持久化（含软删除，可恢复）
- ✅ PWA 安装 + 离线可用（`vite-plugin-pwa` / Workbox 真实预缓存）
- ✅ 可选云端同步：本地优先，后端不可达时完全离线工作
- ✅ 全局错误边界，避免白屏

## 技术栈

- React 18 + TypeScript + Vite 4
- TailwindCSS 3 样式
- IndexedDB（`idb`）本地存储
- `@dnd-kit` 拖拽排序
- `vite-plugin-pwa`（Workbox）离线支持
- Hono 轻量同步后端（`server/`，本地文件 KV 或 Cloudflare KV）

## 快速开始

```bash
npm install        # 安装前端依赖
npm run dev        # 开发服务器 http://localhost:3000
npm run build      # 类型检查 + 生产构建，产物在 dist/
npm run preview    # 预览生产构建
```

## iPad 使用指南

1. 将 `dist` 目录部署到任意静态托管（Vercel / Netlify / GitHub Pages / 对象存储）。
2. Safari 打开应用 URL → 分享 →「添加到主屏幕」。
3. 从主屏幕图标启动即可获得全屏体验。

> 开发期调试：用电脑同网段 IP（如 `http://192.168.x.x:3000`）在 iPad Safari 打开即可。
> 注意：`npm run dev` 下 Service Worker 默认关闭（避免缓存干扰），**离线能力仅在 `npm run build` + `preview`/部署后才生效**。

## 项目结构

```
task-timer-pwa/
├── public/                  # 静态资源（图标等）
├── server/                  # 云端同步后端（Hono，可选）
│   ├── src/
│   │   ├── index.ts         # 构建 Hono app（路由）
│   │   ├── dev.ts           # Node 本地运行入口
│   │   ├── worker.ts        # Cloudflare Workers 入口
│   │   ├── kv.ts            # KV 适配（本地文件 / CF KV）
│   │   ├── auth.ts          # 设备令牌签名/校验
│   │   └── store.ts         # 同步合并（last-write-wins）
│   ├── wrangler.toml        # Cloudflare 部署配置
│   └── package.json
├── src/
│   ├── components/
│   │   ├── GanttView.tsx    # 主视图（甘特表 + 拖拽 + 弹窗）
│   │   ├── Timer.tsx        # 全屏计时器（草稿自动保存）
│   │   ├── Modal.tsx        # 可访问对话框
│   │   ├── Toast.tsx        # 轻提示
│   │   ├── ConfirmDialog.tsx
│   │   └── ErrorBoundary.tsx
│   ├── db/index.ts          # IndexedDB 操作（含同步辅助）
│   ├── sync/client.ts       # 前端同步客户端
│   ├── types/index.ts       # 类型 + 同步协议类型
│   ├── utils/uuid.ts        # 兼容非安全上下文的 uuid
│   ├── App.tsx / main.tsx   # 入口
│   └── index.css
├── index.html
├── vite.config.ts           # 含 VitePWA 配置
└── package.json
```

## 可选：开启云端同步

同步是**本地优先**的——未配置同步服务器时，应用完全离线可用；配置后点击顶栏「同步」按钮即可多设备合并数据（基于 `updatedAt` 的最后写入优先，删除以软删除 `deletedAt` 形式传播）。

### 1. 启动同步后端（本地开发）

```bash
cd server
npm install
npm run dev          # 监听 http://localhost:8787
```

### 2. 让前端指向后端

在项目根目录创建 `.env`：

```bash
# .env
VITE_SYNC_API_BASE=http://localhost:8787
```

重启 `npm run dev`，顶栏会出现在线状态点与「同步」按钮。

### 3. 部署到 Cloudflare Workers（生产）

```bash
cd server
npm install
npx wrangler kv namespace create task-timer-sync   # 记下返回的 id
# 把 id 填入 wrangler.toml 的 [[kv_namespaces]].id
npx wrangler secret put SYNC_SECRET                # 设置一个强密钥
npm run deploy
```

部署后把生产域名填入前端 `.env` 的 `VITE_SYNC_API_BASE`，重新构建即可。

> 鉴权说明：采用设备令牌（无账号体系）。设备用稳定 `deviceId` 换取 HMAC 签名令牌，服务端无状态校验，适合 Serverless 场景。

## 数据备份与迁移

由于数据存于浏览器 IndexedDB，换设备或清缓存会丢失。建议：

- 开启云端同步（见上）做多设备备份；
- 后续可扩展「导出 / 导入 JSON」按钮（当前版本未内置，数据结构见 `src/types`）。

## 注意事项

- 首次加载需初始化 IndexedDB。
- iOS Safari 对 PWA 支持有限（如 `beforeunload` 不一定触发），计时草稿已通过定时保存 + `visibilitychange` 兜底。
- 同步冲突采用「最后写入优先」，适合单用户多设备的个人场景，非多人协作冲突解决。

## 故障排查

### `npm run dev` 报 `Failed to write to output file ... Access is denied`

**现象**：Vite 启动后控制台刷一堆 `esbuild` 写 `node_modules/.vite/deps_temp_*` 或 `.vite-cache/deps_temp_*` 的 `Access is denied`，随后进程崩溃；但 `npm run build` 正常、`npm run preview` 正常。

**根因（已验证）**：不是代码问题。这是 **Windows 安全软件（Microsoft Defender 实时防护 / 受控文件夹访问）在拦截 esbuild 的批量写盘**。Vite 开发服务器的「依赖预构建」会用 esbuild **一次性并发写出约 24 个缓存文件**；Defender 对新建文件的实时扫描会与 esbuild 的并发写/重命名抢锁，导致写入被拒。项目若位于 `C:\Users\<你>\Documents\` 下（受保护目录），受控文件夹访问尤其容易触发。

> 佐证：`npm run build` 用 Rollup（无 esbuild 预构建风暴）正常；手动单文件写入正常；只有 esbuild 的批量缓存写被拒；把 `cacheDir` 移出 `node_modules`（甚至移到项目根）仍无效——说明与路径无关，是 OS 层的写入限制。

**解决方案（任选其一）**：

1. **【推荐·最省事】把项目移出受保护目录**
   把仓库放到非 `Documents/Desktop/Pictures` 路径，例如 `C:\dev\task-timer-pwa` 或 `D:\repos\task-timer-pwa`，重新 `npm install` 后 `npm run dev` 即可。对团队影响最小，无需改任何配置。

2. **【推荐·保留原路径】将项目加入 Defender 排除项**（需管理员 PowerShell）
   ```powershell
   # 以管理员身份打开 PowerShell
   Add-MpPreference -ExclusionPath "C:\Users\xyb\Documents\Workspace\local\task-timer-pwa"
   # 若仍被「受控文件夹访问」拦截，再把可执行文件加入白名单：
   Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Users\xyb\Documents\Workspace\local\task-timer-pwa\node_modules\@esbuild\win32-x64\esbuild.exe"
   Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Users\xyb\Documents\Workspace\local\task-timer-pwa\node_modules\.bin\vite.cmd"
   ```

3. **【推荐·团队一致体验】用 WSL2 开发**
   在 WSL2 的 Linux 文件系统里 `npm install && npm run dev`，完全不受 Windows 杀软拦截，体验最稳。适合 Windows 团队统一开发环境。

4. **临时方案**：开发时短暂关闭 Defender 实时防护（不推荐长期使用）。

> 注意：`vite.config.ts` 里已将 `cacheDir` 设为项目根的 `.vite-cache`（已加入 `.gitignore`），这是把缓存移出 `node_modules` 的良好实践，但**它本身并不能解决上述 Defender 拦截**——真正要执行上面任一方案。

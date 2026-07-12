# task-timer-pwa

iPad 优化的「计划甘特表」任务进度追踪 PWA。React 18 + Vite 4 + Tailwind 3 + IndexedDB（idb），本地优先、可选云端同步（单用户多设备）。

## 快速开始

```bash
npm install
npm run dev          # 前端开发服务器（默认 3000）
npm run build        # tsc + vite 生产构建
npm run preview      # 预览构建产物
```

云端同步（可选）：后端在 `server/`（Hono + Cloudflare KV），前端根目录 `.env` 设置 `VITE_SYNC_API_BASE`。后端改动后需重新 `npm run deploy` + 前端 `npm run build`。

## haoxue 子模块（口算训练）

入口：主界面右上角「🧮 口算训练」按钮，以全屏子模块打开。

- **共用账户**：复用主项目登录账户，数据经同一账户并入云端同步。
- **独立存储**：`src/haoxue/store/db.ts` 独立 IndexedDB（DB_NAME=`haoxue`），与主项目数据库隔离。
- **多孩子档案**：支持多个孩子，各自独立进度（ProfilesList 全局 + per-profile 实体）。
- **训练体系**：12 关卡（一位数加减 → 表内乘除 → 两位加减 → 混合 → 综合），覆盖集精熟判定 + 智能难度滑动窗口。
- **游戏化（P1）**：XP 等级、连击、连续训练日历、每日任务、7 个成就。
- **家长面板（P2）**：弱项分析、近 14 天正确率 SVG 趋势图、本周练习报告 CSV 导出。
- **同步**：`src/haoxue/sync/bridge.ts` 复用主项目同步端点，store 前缀 `hx_`，独立 lastSync 时间戳，防抖 1.5s。

### 目录

```
src/haoxue/
  index.tsx              # 子模块根：工具栏 + 路由（home/levels/training/report）
  types.ts               # 实体类型
  logic/                 # engine / levels / stats / achievements / weakness（纯函数）
  store/                 # db(IndexedDB) / profiles(档案) / useHaoxueStore(React 状态层)
  sync/bridge.ts         # 云同步桥
  components/            # Home / Levels / Training / ParentPanel
```

## 关键约定

- 所有实体写入自动带 `updatedAt`；同步按 `updatedAt` 最后写入优先（适合单用户，非多人协作冲突解决）。
- 禁止代码中直接调用 `crypto.randomUUID()`（iPad 局域网非安全上下文可能不可用），统一用 `src/utils/uuid.ts` 的 `uuid()`。
- 改用拖拽用 `@dnd-kit`；离线 PWA 仅 `build` + 部署后生效。

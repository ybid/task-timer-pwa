import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Keep Vite's dep-optimization cache OUT of node_modules. On Windows,
  // Microsoft Defender real-time scanning races with esbuild's concurrent
  // writes into node_modules/.vite and fails with "Access is denied".
  // Relocating the cache to a project-root dir avoids that collision.
  cacheDir: '.vite-cache',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png'],
      manifest: {
        name: '计划甘特表 - 任务进度追踪',
        short_name: '甘特表',
        description: 'iPad 优化的计划甘特表工具，支持项目分组、每日进度追踪、全屏计时器',
        theme_color: '#2563eb',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: '/?utm_source=pwa',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        // Keep SW off during `vite dev` to avoid caching headaches while developing.
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

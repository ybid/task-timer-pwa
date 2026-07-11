// vite.config.ts
import { defineConfig } from "file:///C:/Users/xyb/Documents/Workspace/local/task-timer-pwa/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/xyb/Documents/Workspace/local/task-timer-pwa/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/xyb/Documents/Workspace/local/task-timer-pwa/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon.png"],
      manifest: {
        name: "\u8BA1\u5212\u7518\u7279\u8868 - \u4EFB\u52A1\u8FDB\u5EA6\u8FFD\u8E2A",
        short_name: "\u7518\u7279\u8868",
        description: "iPad \u4F18\u5316\u7684\u8BA1\u5212\u7518\u7279\u8868\u5DE5\u5177\uFF0C\u652F\u6301\u9879\u76EE\u5206\u7EC4\u3001\u6BCF\u65E5\u8FDB\u5EA6\u8FFD\u8E2A\u3001\u5168\u5C4F\u8BA1\u65F6\u5668",
        theme_color: "#2563eb",
        background_color: "#f9fafb",
        display: "standalone",
        start_url: "/?utm_source=pwa",
        scope: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        clientsClaim: true
      },
      devOptions: {
        // Keep SW off during `vite dev` to avoid caching headaches while developing.
        enabled: false
      }
    })
  ],
  server: {
    host: true,
    port: 3e3
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx4eWJcXFxcRG9jdW1lbnRzXFxcXFdvcmtzcGFjZVxcXFxsb2NhbFxcXFx0YXNrLXRpbWVyLXB3YVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxceHliXFxcXERvY3VtZW50c1xcXFxXb3Jrc3BhY2VcXFxcbG9jYWxcXFxcdGFzay10aW1lci1wd2FcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3h5Yi9Eb2N1bWVudHMvV29ya3NwYWNlL2xvY2FsL3Rhc2stdGltZXItcHdhL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2ljb24tMTkyLnBuZycsICdpY29uLTUxMi5wbmcnLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAnZmF2aWNvbi5wbmcnXSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6ICdcdThCQTFcdTUyMTJcdTc1MThcdTcyNzlcdTg4NjggLSBcdTRFRkJcdTUyQTFcdThGREJcdTVFQTZcdThGRkRcdThFMkEnLFxuICAgICAgICBzaG9ydF9uYW1lOiAnXHU3NTE4XHU3Mjc5XHU4ODY4JyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdpUGFkIFx1NEYxOFx1NTMxNlx1NzY4NFx1OEJBMVx1NTIxMlx1NzUxOFx1NzI3OVx1ODg2OFx1NURFNVx1NTE3N1x1RkYwQ1x1NjUyRlx1NjMwMVx1OTg3OVx1NzZFRVx1NTIwNlx1N0VDNFx1MzAwMVx1NkJDRlx1NjVFNVx1OEZEQlx1NUVBNlx1OEZGRFx1OEUyQVx1MzAwMVx1NTE2OFx1NUM0Rlx1OEJBMVx1NjVGNlx1NTY2OCcsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzI1NjNlYicsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjZjlmYWZiJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBzdGFydF91cmw6ICcvP3V0bV9zb3VyY2U9cHdhJyxcbiAgICAgICAgc2NvcGU6ICcvJyxcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7IHNyYzogJ2ljb24tMTkyLnBuZycsIHNpemVzOiAnMTkyeDE5MicsIHR5cGU6ICdpbWFnZS9wbmcnLCBwdXJwb3NlOiAnYW55IG1hc2thYmxlJyB9LFxuICAgICAgICAgIHsgc3JjOiAnaWNvbi01MTIucG5nJywgc2l6ZXM6ICc1MTJ4NTEyJywgdHlwZTogJ2ltYWdlL3BuZycsIHB1cnBvc2U6ICdhbnkgbWFza2FibGUnIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgd29ya2JveDoge1xuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwscG5nLHN2ZyxpY28sd29mZjJ9J10sXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICdpbmRleC5odG1sJyxcbiAgICAgICAgY2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxuICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXG4gICAgICB9LFxuICAgICAgZGV2T3B0aW9uczoge1xuICAgICAgICAvLyBLZWVwIFNXIG9mZiBkdXJpbmcgYHZpdGUgZGV2YCB0byBhdm9pZCBjYWNoaW5nIGhlYWRhY2hlcyB3aGlsZSBkZXZlbG9waW5nLlxuICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IHRydWUsXG4gICAgcG9ydDogMzAwMCxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1YsU0FBUyxvQkFBb0I7QUFDNVgsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUV4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsZ0JBQWdCLGdCQUFnQix3QkFBd0IsYUFBYTtBQUFBLE1BQ3JGLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxRQUNQLE9BQU87QUFBQSxVQUNMLEVBQUUsS0FBSyxnQkFBZ0IsT0FBTyxXQUFXLE1BQU0sYUFBYSxTQUFTLGVBQWU7QUFBQSxVQUNwRixFQUFFLEtBQUssZ0JBQWdCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxlQUFlO0FBQUEsUUFDdEY7QUFBQSxNQUNGO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUCxjQUFjLENBQUMsc0NBQXNDO0FBQUEsUUFDckQsa0JBQWtCO0FBQUEsUUFDbEIsdUJBQXVCO0FBQUEsUUFDdkIsY0FBYztBQUFBLE1BQ2hCO0FBQUEsTUFDQSxZQUFZO0FBQUE7QUFBQSxRQUVWLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxFQUNiO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

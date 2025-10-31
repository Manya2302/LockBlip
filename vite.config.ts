import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    // listen on LAN so other devices can reach the dev server
    host: '0.0.0.0',
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      // Proxy API requests to the backend dev server and preserve client IP
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          // Ensure X-Forwarded-For contains the original client IP
          proxy.on('proxyReq', (proxyReq, req, res) => {
            try {
              const realIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
              if (realIp) {
                proxyReq.setHeader('X-Forwarded-For', realIp);
              }
            } catch (e) {
              // ignore
            }
          });
        },
      },
    },
  },
});


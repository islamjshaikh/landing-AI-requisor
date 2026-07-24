import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Replit-specific plugins (@replit/vite-plugin-shadcn-theme-json,
// @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer)
// have been removed. The shadcn theme is now driven directly by the CSS
// variables in client/src/index.css.

export default defineConfig(async () => {
  const plugins = [react()];

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        // ⚠ If you import images from outside /client, Vite may block them.
        // Prefer placing images under client/public or client/src/assets.
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
    // DEV SERVER (npm run dev): proxy /api → backend on 8080
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
        },
      },
    },
    // Frontend root & build output
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
  };
});

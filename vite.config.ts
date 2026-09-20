import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src/client",
  publicDir: path.resolve("public"),
  resolve: {
    alias: {
      "@shared": path.resolve("src/shared"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/api/stt-stream": {
        target: "ws://127.0.0.1:8080",
        ws: true,
      },
    },
    fs: {
      allow: [path.resolve("."), path.resolve("src"), path.resolve("public")],
    },
  },
  build: {
    outDir: path.resolve("dist/client"),
    emptyOutDir: true,
  },
});

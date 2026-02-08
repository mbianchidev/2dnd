import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/2dnd/" : "/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: false,
  },
});

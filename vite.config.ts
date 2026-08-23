import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isDesktopBuild = mode === "desktop";
  return {
    base: isDesktopBuild
      ? "./"
      : process.env.VITE_BASE_PATH
        ?? (process.env.GITHUB_ACTIONS ? "/2dnd/" : "/"),
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "src"),
      },
    },
    build: {
      outDir: "dist",
      sourcemap: !isDesktopBuild,
      rollupOptions: {
        input: {
          landing: resolve(import.meta.dirname, "index.html"),
          game: resolve(import.meta.dirname, "game.html"),
        },
      },
    },
    server: {
      port: 3000,
      open: false,
    },
  };
});

import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => {
  const isDesktopBuild = mode === "desktop";
  const isProductionBuild = command === "build";
  return {
    base: isDesktopBuild
      ? "./"
      : process.env.VITE_BASE_PATH
        ?? (process.env.GITHUB_ACTIONS ? "/2dnd/" : "/"),
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "src"),
        ...(isProductionBuild ? {
          phaser: resolve(import.meta.dirname, "node_modules/phaser/src/phaser-no-physics.js"),
        } : {}),
      },
    },
    define: isProductionBuild ? {
      global: "globalThis",
      "typeof CANVAS_RENDERER": "true",
      "typeof WEBGL_RENDERER": "true",
      "typeof WEBGL_DEBUG": "false",
      "typeof FEATURE_SOUND": "true",
    } : {},
    build: {
      outDir: "dist",
      sourcemap: !isDesktopBuild,
      rolldownOptions: {
        input: isDesktopBuild
          ? { game: resolve(import.meta.dirname, "game.html") }
          : {
            landing: resolve(import.meta.dirname, "index.html"),
            game: resolve(import.meta.dirname, "game.html"),
          },
        output: {
          strictExecutionOrder: true,
          sanitizeFileName: (name: string): string => name.replace(/~/g, "-"),
          chunkFileNames: "assets/game-[name]-[hash].js",
          assetFileNames: "assets/game-[name]-[hash][extname]",
          codeSplitting: {
            groups: [
              {
                name: "phaser",
                test: /[\\/]node_modules[\\/]phaser[\\/]src[\\/]/,
                maxSize: 1_500_000,
                entriesAware: true,
              },
              {
                name: "game",
                test: /[\\/]src[\\/]/,
                maxSize: 500_000,
                entriesAware: true,
              },
            ],
          },
        },
      },
    },
    server: {
      port: 3000,
      open: false,
    },
  };
});

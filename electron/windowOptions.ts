import type { BrowserWindowConstructorOptions } from "electron";

export function createDesktopWindowOptions(
  preloadPath: string,
  isDevelopment: boolean,
): BrowserWindowConstructorOptions {
  return {
    width: 1_440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#000000",
    show: false,
    title: "2D&D",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDevelopment,
      spellcheck: false,
    },
  };
}

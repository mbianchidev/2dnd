import {
  contextBridge,
  ipcRenderer,
  type IpcRendererEvent,
} from "electron";
import type {
  DesktopApi,
  DesktopPlatform,
  DesktopState,
} from "./contracts.js";

const DESKTOP_CHANNELS = Object.freeze({
  getState: "desktop:get-state",
  toggleFullscreen: "desktop:toggle-fullscreen",
  quitApp: "desktop:quit-app",
  reportError: "desktop:report-error",
  fullscreenChanged: "desktop:fullscreen-changed",
});

const MAX_RENDERER_ERROR_LENGTH = 4_096;

function isDesktopPlatform(value: unknown): value is DesktopPlatform {
  return value === "linux"
    || value === "macos"
    || value === "windows"
    || value === "other";
}

function readDesktopState(value: unknown): DesktopState {
  if (
    typeof value !== "object"
    || value === null
    || !("appVersion" in value)
    || typeof value.appVersion !== "string"
    || !("isFullscreen" in value)
    || typeof value.isFullscreen !== "boolean"
    || !("logPath" in value)
    || typeof value.logPath !== "string"
    || !("platform" in value)
    || !isDesktopPlatform(value.platform)
  ) {
    throw new Error("Desktop main process returned an invalid window state");
  }
  return {
    appVersion: value.appVersion,
    isFullscreen: value.isFullscreen,
    logPath: value.logPath,
    platform: value.platform,
  };
}

const desktopApi: DesktopApi = Object.freeze({
  async getState(): Promise<DesktopState> {
    const value: unknown = await ipcRenderer.invoke(DESKTOP_CHANNELS.getState);
    return readDesktopState(value);
  },
  async toggleFullscreen(): Promise<boolean> {
    const value: unknown = await ipcRenderer.invoke(
      DESKTOP_CHANNELS.toggleFullscreen,
    );
    if (typeof value !== "boolean") {
      throw new Error("Desktop main process returned an invalid fullscreen state");
    }
    return value;
  },
  quitApp(): void {
    ipcRenderer.send(DESKTOP_CHANNELS.quitApp);
  },
  reportError(message: string): void {
    if (typeof message !== "string") {
      throw new Error("Desktop renderer errors must be strings");
    }
    ipcRenderer.send(
      DESKTOP_CHANNELS.reportError,
      message.slice(0, MAX_RENDERER_ERROR_LENGTH),
    );
  },
  onFullscreenChanged(listener: (isFullscreen: boolean) => void): () => void {
    const handleChange = (
      _event: IpcRendererEvent,
      value: unknown,
    ): void => {
      if (typeof value === "boolean") listener(value);
    };
    ipcRenderer.on(DESKTOP_CHANNELS.fullscreenChanged, handleChange);
    return () => {
      ipcRenderer.removeListener(
        DESKTOP_CHANNELS.fullscreenChanged,
        handleChange,
      );
    };
  },
});

contextBridge.exposeInMainWorld("desktop", desktopApi);

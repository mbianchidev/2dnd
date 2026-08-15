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
  fullscreenChanged: "desktop:fullscreen-changed",
});

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
    || !("platform" in value)
    || !isDesktopPlatform(value.platform)
  ) {
    throw new Error("Desktop main process returned an invalid window state");
  }
  return {
    appVersion: value.appVersion,
    isFullscreen: value.isFullscreen,
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

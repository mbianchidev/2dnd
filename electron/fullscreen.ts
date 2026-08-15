import type { BrowserWindow } from "electron";

type FullscreenWindow = Pick<
  BrowserWindow,
  | "isFullScreen"
  | "isSimpleFullScreen"
  | "setFullScreen"
  | "setSimpleFullScreen"
>;

export function isWindowFullscreen(
  window: FullscreenWindow,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return window.isFullScreen()
    || (platform === "darwin" && window.isSimpleFullScreen());
}

export function setWindowFullscreen(
  window: FullscreenWindow,
  fullscreen: boolean,
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform !== "darwin") {
    window.setFullScreen(fullscreen);
    return;
  }
  if (fullscreen) {
    window.setSimpleFullScreen(true);
    return;
  }
  if (window.isFullScreen()) window.setFullScreen(false);
  if (window.isSimpleFullScreen()) window.setSimpleFullScreen(false);
}

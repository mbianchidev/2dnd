export type DesktopPlatform = "linux" | "macos" | "windows" | "other";

export interface DesktopState {
  readonly appVersion: string;
  readonly isFullscreen: boolean;
  readonly platform: DesktopPlatform;
}

export interface DesktopApi {
  getState(): Promise<DesktopState>;
  toggleFullscreen(): Promise<boolean>;
  onFullscreenChanged(listener: (isFullscreen: boolean) => void): () => void;
}

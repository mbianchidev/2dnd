export type DesktopPlatform = "linux" | "macos" | "windows" | "other";

export interface DesktopState {
  readonly appVersion: string;
  readonly isFullscreen: boolean;
  readonly logPath: string;
  readonly platform: DesktopPlatform;
}

export interface DesktopApi {
  getState(): Promise<DesktopState>;
  toggleFullscreen(): Promise<boolean>;
  quitApp(): void;
  reportError(message: string): void;
  onFullscreenChanged(listener: (isFullscreen: boolean) => void): () => void;
}

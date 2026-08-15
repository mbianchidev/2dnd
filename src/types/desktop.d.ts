import type { DesktopApi } from "../../electron/contracts";

declare global {
  interface Window {
    readonly desktop?: DesktopApi;
  }
}

export {};

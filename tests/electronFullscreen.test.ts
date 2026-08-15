import { describe, expect, it, vi } from "vitest";
import {
  isWindowFullscreen,
  setWindowFullscreen,
} from "../electron/fullscreen";

function createWindowState(native: boolean, simple: boolean) {
  return {
    isFullScreen: vi.fn(() => native),
    isSimpleFullScreen: vi.fn(() => simple),
    setFullScreen: vi.fn(),
    setSimpleFullScreen: vi.fn(),
  };
}

describe("Electron fullscreen policy", () => {
  it("uses deterministic simple fullscreen when entering on macOS", () => {
    const window = createWindowState(false, false);

    setWindowFullscreen(window, true, "darwin");

    expect(window.setSimpleFullScreen).toHaveBeenCalledWith(true);
    expect(window.setFullScreen).not.toHaveBeenCalled();
  });

  it("exits native macOS fullscreen through the native API", () => {
    const window = createWindowState(true, false);

    expect(isWindowFullscreen(window, "darwin")).toBe(true);
    setWindowFullscreen(window, false, "darwin");

    expect(window.setFullScreen).toHaveBeenCalledWith(false);
    expect(window.setSimpleFullScreen).not.toHaveBeenCalled();
  });

  it("exits simple macOS fullscreen through the simple API", () => {
    const window = createWindowState(false, true);

    expect(isWindowFullscreen(window, "darwin")).toBe(true);
    setWindowFullscreen(window, false, "darwin");

    expect(window.setSimpleFullScreen).toHaveBeenCalledWith(false);
    expect(window.setFullScreen).not.toHaveBeenCalled();
  });

  it("uses native fullscreen on Windows and Linux", () => {
    const window = createWindowState(false, false);

    setWindowFullscreen(window, true, "win32");

    expect(window.setFullScreen).toHaveBeenCalledWith(true);
    expect(window.setSimpleFullScreen).not.toHaveBeenCalled();
  });
});

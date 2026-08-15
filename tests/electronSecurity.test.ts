import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  createContentSecurityPolicy,
  DESKTOP_APP_URL,
  hasNoIpcArguments,
  isAllowedDevelopmentUrl,
  isAllowedExternalUrl,
  isAllowedRendererNavigation,
  isAllowedRendererResource,
  resolveAppAssetPath,
} from "../electron/security";
import { createDesktopWindowOptions } from "../electron/windowOptions";

describe("Electron security policy", () => {
  it("allows only repository-owned HTTPS destinations externally", () => {
    expect(isAllowedExternalUrl("https://github.com/mbianchidev/2dnd")).toBe(true);
    expect(
      isAllowedExternalUrl("https://github.com/mbianchidev/2dnd/issues/162"),
    ).toBe(true);
    expect(
      isAllowedExternalUrl("https://mbianchidev.github.io/2dnd/"),
    ).toBe(true);
    expect(isAllowedExternalUrl("http://github.com/mbianchidev/2dnd")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com/other/repository")).toBe(false);
    expect(isAllowedExternalUrl("https://example.com/")).toBe(false);
    expect(isAllowedExternalUrl("not a URL")).toBe(false);
  });

  it("accepts only explicit loopback development servers", () => {
    expect(isAllowedDevelopmentUrl("http://127.0.0.1:3000/")).toBe(true);
    expect(isAllowedDevelopmentUrl("http://localhost:4173/2dnd/")).toBe(true);
    expect(isAllowedDevelopmentUrl("http://127.0.0.1/")).toBe(false);
    expect(isAllowedDevelopmentUrl("https://127.0.0.1:3000/")).toBe(false);
    expect(isAllowedDevelopmentUrl("http://0.0.0.0:3000/")).toBe(false);
    expect(isAllowedDevelopmentUrl("http://example.com:3000/")).toBe(false);
  });

  it("keeps renderer navigation and resources on their approved origins", () => {
    expect(
      isAllowedRendererNavigation("app://2dnd/assets/game.js", DESKTOP_APP_URL),
    ).toBe(true);
    expect(
      isAllowedRendererNavigation("https://example.com/", DESKTOP_APP_URL),
    ).toBe(false);
    expect(
      isAllowedRendererNavigation("app://other/index.html", DESKTOP_APP_URL),
    ).toBe(false);
    expect(isAllowedRendererResource("app://2dnd/assets/game.js")).toBe(true);
    expect(isAllowedRendererResource("app://other/assets/game.js")).toBe(false);
    expect(
      isAllowedRendererResource(
        "ws://127.0.0.1:3000/",
        "http://127.0.0.1:3000/",
      ),
    ).toBe(true);
    expect(
      isAllowedRendererResource(
        "http://127.0.0.1:4000/",
        "http://127.0.0.1:3000/",
      ),
    ).toBe(false);
    expect(
      isAllowedRendererResource(
        "https://example.com/",
        "http://127.0.0.1:3000/",
      ),
    ).toBe(false);
  });

  it("maps app assets without allowing path traversal", () => {
    const root = resolve("/tmp", "2dnd-renderer");
    expect(resolveAppAssetPath("app://2dnd/", root)).toBe(
      resolve(root, "index.html"),
    );
    expect(resolveAppAssetPath("app://2dnd/assets/game.js", root)).toBe(
      resolve(root, "assets/game.js"),
    );
    expect(
      resolveAppAssetPath("app://2dnd/%2e%2e%2fsecret", root),
    ).toBeNull();
    expect(resolveAppAssetPath("app://other/index.html", root)).toBeNull();
  });

  it("uses a restrictive production content security policy", () => {
    const policy = createContentSecurityPolicy();
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("rejects IPC payloads and unsafe BrowserWindow capabilities", () => {
    expect(hasNoIpcArguments([])).toBe(true);
    expect(hasNoIpcArguments(["unexpected"])).toBe(false);
    const production = createDesktopWindowOptions("/preload.cjs", false);
    expect(production.webPreferences).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: false,
    });
    const development = createDesktopWindowOptions("/preload.cjs", true);
    expect(development.webPreferences?.devTools).toBe(true);
  });
});

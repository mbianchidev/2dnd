import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from "electron";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DESKTOP_CHANNELS } from "./channels.cjs";
import type {
  DesktopPlatform,
  DesktopState,
} from "./contracts.js";
import {
  createContentSecurityPolicy,
  DESKTOP_APP_HOST,
  DESKTOP_APP_SCHEME,
  DESKTOP_APP_URL,
  hasNoIpcArguments,
  isAllowedDevelopmentUrl,
  isAllowedExternalUrl,
  isAllowedRendererNavigation,
  isAllowedRendererResource,
  resolveAppAssetPath,
} from "./security.js";
import { createDesktopWindowOptions } from "./windowOptions.js";
import {
  createDesktopLogger,
  type DesktopLogger,
} from "./logger.js";
import {
  isWindowFullscreen,
  setWindowFullscreen,
} from "./fullscreen.js";

const PRODUCT_NAME = "2D&D";
const REMOTE_REQUEST_FILTER = {
  urls: [
    "http://*/*",
    "https://*/*",
    "ws://*/*",
    "wss://*/*",
  ],
};
const MAX_RENDERER_ERROR_LENGTH = 4_096;

let mainWindow: BrowserWindow | null = null;
let desktopLogger: DesktopLogger | null = null;

function formatError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

function reportDesktopError(context: string, error: unknown): void {
  const message = `${context}: ${formatError(error)}`;
  desktopLogger?.error(message);
  process.stderr.write(`[desktop] ${message}\n`);
}

function reportDesktopInfo(message: string): void {
  desktopLogger?.info(message);
  process.stdout.write(`[desktop] ${message}\n`);
}

function configureDesktopLogger(): void {
  try {
    desktopLogger = createDesktopLogger(
      join(app.getPath("userData"), "logs"),
    );
  } catch (error) {
    reportDesktopError("Failed to initialize persistent logging", error);
  }
}

function readDevelopmentUrl(): string | undefined {
  const candidate = process.env["ELECTRON_RENDERER_URL"];
  if (!candidate) return undefined;
  if (!isAllowedDevelopmentUrl(candidate)) {
    throw new Error(
      "ELECTRON_RENDERER_URL must be a loopback HTTP URL with an explicit port",
    );
  }
  return candidate;
}

function configureTestUserData(): void {
  const candidate = process.env["ELECTRON_USER_DATA_DIR"];
  if (!candidate) return;
  if (process.env["ELECTRON_TEST_MODE"] !== "1" || !isAbsolute(candidate)) {
    throw new Error(
      "ELECTRON_USER_DATA_DIR is available only in test mode and must be absolute",
    );
  }
  app.setPath("userData", resolve(candidate));
}

function getDesktopPlatform(): DesktopPlatform {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  return "other";
}

function assertTrustedSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window !== mainWindow) {
    throw new Error("Rejected desktop IPC from an untrusted renderer");
  }
  return window;
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    DESKTOP_CHANNELS.getState,
    (event: IpcMainInvokeEvent, ...args: unknown[]): DesktopState => {
      if (!hasNoIpcArguments(args)) {
        throw new Error("desktop:get-state does not accept arguments");
      }
      const window = assertTrustedSender(event);
      return {
        appVersion: app.getVersion(),
        isFullscreen: isWindowFullscreen(window),
        logPath: desktopLogger?.filePath ?? "",
        platform: getDesktopPlatform(),
      };
    },
  );
  ipcMain.handle(
    DESKTOP_CHANNELS.toggleFullscreen,
    (event: IpcMainInvokeEvent, ...args: unknown[]): boolean => {
      if (!hasNoIpcArguments(args)) {
        throw new Error("desktop:toggle-fullscreen does not accept arguments");
      }
      const window = assertTrustedSender(event);
      const nextFullscreen = !isWindowFullscreen(window);
      setWindowFullscreen(window, nextFullscreen);
      sendFullscreenState(window);
      return nextFullscreen;
    },
  );
  ipcMain.on(
    DESKTOP_CHANNELS.quitApp,
    (event: IpcMainEvent, ...args: unknown[]): void => {
      try {
        if (!hasNoIpcArguments(args)) {
          throw new Error("desktop:quit-app does not accept arguments");
        }
        assertTrustedSender(event);
        reportDesktopInfo("Quit requested by renderer");
        app.quit();
      } catch (error) {
        reportDesktopError("Rejected desktop quit request", error);
      }
    },
  );
  ipcMain.on(
    DESKTOP_CHANNELS.reportError,
    (event: IpcMainEvent, ...args: unknown[]): void => {
      try {
        assertTrustedSender(event);
        if (
          args.length !== 1
          || typeof args[0] !== "string"
          || args[0].length === 0
          || args[0].length > MAX_RENDERER_ERROR_LENGTH
        ) {
          throw new Error("desktop:report-error requires one bounded string");
        }
        reportDesktopError("Renderer error", args[0]);
      } catch (error) {
        reportDesktopError("Rejected renderer error report", error);
      }
    },
  );
}

function sendFullscreenState(window: BrowserWindow): void {
  if (!window.isDestroyed()) {
    window.webContents.send(
      DESKTOP_CHANNELS.fullscreenChanged,
      isWindowFullscreen(window),
    );
  }
}

async function openAllowedExternalUrl(value: string): Promise<void> {
  if (!isAllowedExternalUrl(value)) {
    reportDesktopError("Blocked external URL", value);
    return;
  }
  try {
    await shell.openExternal(value);
  } catch (error) {
    reportDesktopError("Failed to open external URL", error);
  }
}

function secureWebContents(
  contents: WebContents,
  rendererUrl: string,
  isDevelopment: boolean,
): void {
  contents.setWindowOpenHandler(({ url }) => {
    void openAllowedExternalUrl(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (isAllowedRendererNavigation(url, rendererUrl)) return;
    event.preventDefault();
    void openAllowedExternalUrl(url);
  });
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  contents.on("before-input-event", (event, input) => {
    if (
      !isDevelopment
      && input.type === "keyDown"
      && (
        input.key === "F12"
        || (
          input.control
          && input.shift
          && input.key.toLocaleLowerCase() === "i"
        )
      )
    ) {
      event.preventDefault();
    }
  });
}

function configureDefaultSession(
  developmentUrl: string | undefined,
): void {
  const defaultSession = session.defaultSession;
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  defaultSession.webRequest.onBeforeRequest(
    REMOTE_REQUEST_FILTER,
    (details, callback) => {
      callback({
        cancel: !isAllowedRendererResource(details.url, developmentUrl),
      });
    },
  );
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith(`${DESKTOP_APP_SCHEME}://`)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [createContentSecurityPolicy()],
      },
    });
  });
}

async function registerAppProtocol(): Promise<void> {
  const rendererRoot = join(app.getAppPath(), "dist");
  await protocol.handle(DESKTOP_APP_SCHEME, async (request) => {
    const assetPath = resolveAppAssetPath(request.url, rendererRoot);
    if (!assetPath || request.method !== "GET") {
      return new Response("Not found", { status: 404 });
    }
    try {
      return await net.fetch(pathToFileURL(assetPath).toString());
    } catch (error) {
      reportDesktopError(`Failed to load ${request.url}`, error);
      return new Response("Not found", { status: 404 });
    }
  });
}

async function createMainWindow(
  developmentUrl: string | undefined,
): Promise<void> {
  const isDevelopment = developmentUrl !== undefined;
  const preloadPath = join(import.meta.dirname, "preload.cjs");
  const window = new BrowserWindow(
    createDesktopWindowOptions(preloadPath, isDevelopment),
  );
  mainWindow = window;
  const rendererUrl = developmentUrl ?? DESKTOP_APP_URL;
  reportDesktopInfo(`Creating renderer window for ${rendererUrl}`);
  secureWebContents(window.webContents, rendererUrl, isDevelopment);

  window.on("enter-full-screen", () => sendFullscreenState(window));
  window.on("leave-full-screen", () => sendFullscreenState(window));
  window.on("unresponsive", () => {
    reportDesktopError("Renderer became unresponsive", rendererUrl);
  });
  window.on("closed", () => {
    reportDesktopInfo("Renderer window closed");
    if (mainWindow === window) mainWindow = null;
  });
  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    reportDesktopError(`Preload failed (${preloadPath})`, error);
  });
  window.webContents.on(
    "render-process-gone",
    (_event, details) => reportDesktopError(
      `Renderer process exited (${details.reason})`,
      `exitCode=${details.exitCode}`,
    ),
  );
  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl) => {
      reportDesktopError(
        `Failed to load renderer ${validatedUrl}`,
        `${errorCode}: ${errorDescription}`,
      );
    },
  );
  window.once("ready-to-show", () => {
    reportDesktopInfo("Renderer ready");
    window.show();
  });
  await window.loadURL(rendererUrl);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: DESKTOP_APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      stream: true,
    },
  },
]);

app.setName(PRODUCT_NAME);
configureTestUserData();
configureDesktopLogger();
reportDesktopInfo(
  `Application starting version=${app.getVersion()} platform=${process.platform} arch=${process.arch}`,
);

process.on("uncaughtException", (error) => {
  reportDesktopError("Uncaught main-process error", error);
});
process.on("unhandledRejection", (error) => {
  reportDesktopError("Unhandled main-process rejection", error);
});
app.on("child-process-gone", (_event, details) => {
  reportDesktopError(
    `Child process exited (${details.type}/${details.reason})`,
    `exitCode=${details.exitCode}`,
  );
});

app.whenReady()
  .then(async () => {
    const developmentUrl = readDevelopmentUrl();
    Menu.setApplicationMenu(null);
    configureDefaultSession(developmentUrl);
    registerIpcHandlers();
    await registerAppProtocol();
    await createMainWindow(developmentUrl);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow(developmentUrl).catch((error: unknown) => {
          reportDesktopError("Failed to recreate window", error);
        });
      }
    });
  })
  .catch((error: unknown) => {
    reportDesktopError("Desktop startup failed", error);
    app.exit(1);
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  reportDesktopInfo("Application will quit");
});

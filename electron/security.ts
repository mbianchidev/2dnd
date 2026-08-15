import {
  isAbsolute,
  relative,
  resolve,
} from "node:path";

export const DESKTOP_APP_HOST = "2dnd";
export const DESKTOP_APP_SCHEME = "app";
export const DESKTOP_APP_URL = `${DESKTOP_APP_SCHEME}://${DESKTOP_APP_HOST}/index.html`;

const ALLOWED_EXTERNAL_DESTINATIONS = Object.freeze([
  {
    origin: "https://github.com",
    pathPrefix: "/mbianchidev/2dnd",
  },
  {
    origin: "https://mbianchidev.github.io",
    pathPrefix: "/2dnd",
  },
]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasSafeCredentials(url: URL): boolean {
  return url.username.length === 0 && url.password.length === 0;
}

export function isAllowedExternalUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url || url.protocol !== "https:" || !hasSafeCredentials(url)) {
    return false;
  }
  return ALLOWED_EXTERNAL_DESTINATIONS.some(
    ({ origin, pathPrefix }) => url.origin === origin
      && (
        url.pathname === pathPrefix
        || url.pathname.startsWith(`${pathPrefix}/`)
      ),
  );
}

export function isAllowedDevelopmentUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url || url.protocol !== "http:" || !hasSafeCredentials(url)) {
    return false;
  }
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    return false;
  }
  const port = Number.parseInt(url.port, 10);
  return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

export function isAllowedRendererNavigation(
  value: string,
  rendererUrl: string,
): boolean {
  const target = parseUrl(value);
  const renderer = parseUrl(rendererUrl);
  if (!target || !renderer || !hasSafeCredentials(target)) return false;
  return target.protocol === renderer.protocol
    && target.hostname === renderer.hostname
    && target.port === renderer.port;
}

export function isAllowedRendererResource(
  value: string,
  developmentUrl?: string,
): boolean {
  const target = parseUrl(value);
  if (!target || !hasSafeCredentials(target)) return false;
  if (target.protocol === `${DESKTOP_APP_SCHEME}:`) {
    return target.hostname === DESKTOP_APP_HOST;
  }
  if (!developmentUrl || !isAllowedDevelopmentUrl(developmentUrl)) {
    return false;
  }
  const development = new URL(developmentUrl);
  const allowedProtocols = development.protocol === "https:"
    ? ["https:", "wss:"]
    : ["http:", "ws:"];
  return allowedProtocols.includes(target.protocol)
    && target.hostname === development.hostname
    && target.port === development.port;
}

export function resolveAppAssetPath(
  requestUrl: string,
  rendererRoot: string,
): string | null {
  const url = parseUrl(requestUrl);
  if (
    !url
    || url.protocol !== `${DESKTOP_APP_SCHEME}:`
    || url.hostname !== DESKTOP_APP_HOST
    || !hasSafeCredentials(url)
  ) {
    return null;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decodedPath.includes("\0")) return null;

  const relativePath = decodedPath === "/"
    ? "index.html"
    : decodedPath.replace(/^\/+/, "");
  const root = resolve(rendererRoot);
  const candidate = resolve(root, relativePath);
  const fromRoot = relative(root, candidate);
  if (
    fromRoot.length === 0
    || fromRoot.startsWith("..")
    || isAbsolute(fromRoot)
  ) {
    return null;
  }
  return candidate;
}

export function createContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

export function hasNoIpcArguments(args: readonly unknown[]): boolean {
  return args.length === 0;
}

import { Buffer } from "node:buffer";

export type SteamPlatform = "windows-x64" | "macos-universal" | "linux-x64";
export type SteamOs = "windows" | "macos" | "linux";

export interface SteamDepot {
  readonly platform: SteamPlatform;
  readonly os: SteamOs;
  readonly architectures: readonly ("x64" | "arm64")[];
  readonly executable: string;
  readonly binary: string;
  readonly packagedDirectory: string;
  readonly appArchive: string;
  readonly licenseDirectory: string;
  readonly idEnvironment: string;
}

export interface SteamBuildIds {
  readonly appId: string;
  readonly depots: Readonly<Record<SteamPlatform, string>>;
}

export interface SourceProvenance {
  readonly commit: string;
  readonly dirty: boolean;
  readonly diffHash: string | null;
}

export function formatSteamSourceNotice(
  template: string,
  provenance: SourceProvenance,
): string {
  return `${template}\nSource commit: ${provenance.commit}\n`
    + `https://github.com/mbianchidev/2dnd/tree/${provenance.commit}\n`
    + `Working-tree diff hash: ${provenance.diffHash ?? "none"}\n`
    + (provenance.dirty
      ? "\nMODIFIED WORKTREE PREVIEW: not a releasable corresponding-source receipt.\n"
      : "");
}

export const STEAM_DEPOTS: readonly SteamDepot[] = [
  {
    platform: "windows-x64",
    os: "windows",
    architectures: ["x64"],
    executable: "2D-and-D.exe",
    binary: "2D-and-D.exe",
    packagedDirectory: "win-unpacked",
    appArchive: "resources/app.asar",
    licenseDirectory: ".",
    idEnvironment: "STEAM_DEPOT_WINDOWS_ID",
  },
  {
    platform: "macos-universal",
    os: "macos",
    architectures: ["x64", "arm64"],
    executable: "2D&D.app",
    binary: "2D&D.app/Contents/MacOS/2D-and-D",
    packagedDirectory: "mac-universal",
    appArchive: "2D&D.app/Contents/Resources/app.asar",
    licenseDirectory: "2D&D.app/Contents",
    idEnvironment: "STEAM_DEPOT_MACOS_ID",
  },
  {
    platform: "linux-x64",
    os: "linux",
    architectures: ["x64"],
    executable: "2D-and-D",
    binary: "2D-and-D",
    packagedDirectory: "linux-unpacked",
    appArchive: "resources/app.asar",
    licenseDirectory: ".",
    idEnvironment: "STEAM_DEPOT_LINUX_ID",
  },
];

export const STEAM_INTEGRATIONS = Object.freeze({
  sdk: false,
  achievements: false,
  cloud: false,
  nativeInput: false,
});

export const STEAM_LICENSE_FILES = [
  "LICENSE.2dnd.txt",
  "LICENSE.phaser.txt",
  "LICENSE.eventemitter3.txt",
] as const;

export const STEAM_PLACEHOLDERS = [
  "STEAM_APP_ID",
  "STEAM_DEPOT_WINDOWS_ID",
  "STEAM_DEPOT_MACOS_ID",
  "STEAM_DEPOT_LINUX_ID",
  "STEAM_PREVIEW",
  "BUILD_DESCRIPTION",
] as const;

export function getSteamDepot(platform: string): SteamDepot {
  const depot = STEAM_DEPOTS.find((candidate) => candidate.platform === platform);
  if (!depot) throw new Error("Unsupported Steam platform");
  return depot;
}

export function isSteamId(value: unknown): value is string {
  return typeof value === "string"
    && /^[1-9][0-9]{0,9}$/.test(value)
    && Number(value) <= 0xffff_ffff;
}

export function parseSteamBuildIds(
  environment: Readonly<Record<string, string | undefined>>,
): SteamBuildIds {
  const readId = (name: string): string => {
    const value = environment[name];
    if (!isSteamId(value)) {
      throw new Error(`Missing or invalid ${name}; expected a positive uint32 ID`);
    }
    return value;
  };
  const appId = readId("STEAM_APP_ID");
  const windows = readId("STEAM_DEPOT_WINDOWS_ID");
  const macos = readId("STEAM_DEPOT_MACOS_ID");
  const linux = readId("STEAM_DEPOT_LINUX_ID");
  if (new Set([appId, windows, macos, linux]).size !== 4) {
    throw new Error("Steam app and depot IDs must be unique");
  }
  return {
    appId,
    depots: {
      "windows-x64": windows,
      "macos-universal": macos,
      "linux-x64": linux,
    },
  };
}

export function renderSteamTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key: string) => {
    if (!(STEAM_PLACEHOLDERS as readonly string[]).includes(key)) {
      throw new Error("Unknown Steam template placeholder");
    }
    const value = values[key];
    if (value === undefined) throw new Error(`Missing Steam template value: ${key}`);
    if (/["\\\r\n{}]/.test(value)) throw new Error("Unsafe Steam template value");
    return value;
  });
}

export function isForbiddenSteamPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.toLowerCase().split("/");
  const forbiddenDirectories = new Set([
    ".git", ".github", "src", "tests", "e2e", "electron-tests", "node_modules",
    "sdk", "steamworks", "local storage", "indexeddb", "session storage",
    "logs", "crashpad", "screenshots",
  ]);
  return parts.some((part) => forbiddenDirectories.has(part))
    || /(?:^|\/)(?:\.env[^/]*|\.ds_store|steam_appid\.txt|save[^/]*\.json)$/.test(
      normalized.toLowerCase(),
    )
    || /\.(?:map|pdb|ts|log|pem|pfx|p12|key)$/i.test(normalized);
}

export function isAllowedSteamAppEntry(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized === "package.json"
    || normalized === "dist/game.html"
    || normalized === "dist/favicon.svg"
    || /^dist\/assets\/game-[\w-]+\.js$/.test(normalized)
    || /^dist-electron\/[\w-]+\.(?:js|cjs)$/.test(normalized);
}

export function isAllowedSteamRuntimeEntry(path: string, depot: SteamDepot): boolean {
  const normalized = path.replace(/\\/g, "/");
  if (isForbiddenSteamPath(normalized) || /steam[_-]?api/i.test(normalized)) return false;
  if (depot.os === "macos") {
    if (!normalized.startsWith("2D&D.app/Contents/")) return false;
    const local = normalized.slice("2D&D.app/Contents/".length);
    if (
      ["Info.plist", "PkgInfo", "SOURCE.2dnd.txt", ...STEAM_LICENSE_FILES].includes(local)
      || local === "MacOS/2D-and-D"
      || /^Resources\/(?:app\.asar|icon\.icns)$/.test(local)
      || local === "_CodeSignature/CodeResources"
    ) return true;
    return /^Frameworks\/(?:Electron Framework\.framework|Mantle\.framework|ReactiveObjC\.framework|Squirrel\.framework|2D&D Helper(?: \((?:GPU|Plugin|Renderer)\))?\.app)\//.test(local);
  }
  const rootFiles = [
    depot.binary, ...STEAM_LICENSE_FILES, "SOURCE.2dnd.txt", "LICENSE", "LICENSE.electron.txt",
    "LICENSES.chromium.html", "chrome_100_percent.pak", "chrome_200_percent.pak",
    "resources.pak", "icudtl.dat", "snapshot_blob.bin", "v8_context_snapshot.bin",
    "vk_swiftshader_icd.json",
  ];
  const platformFiles = depot.os === "linux"
    ? ["chrome-sandbox", "chrome_crashpad_handler", "libEGL.so", "libGLESv2.so",
      "libffmpeg.so", "libvk_swiftshader.so", "libvulkan.so.1"]
    : ["d3dcompiler_47.dll", "ffmpeg.dll", "libEGL.dll", "libGLESv2.dll",
      "vk_swiftshader.dll", "vulkan-1.dll"];
  return [...rootFiles, ...platformFiles].includes(normalized)
    || normalized === "resources/app.asar"
    || /^locales\/[\w@-]+\.pak$/.test(normalized);
}

export function assertSteamBinary(
  header: Uint8Array,
  platform: SteamPlatform,
): void {
  const bytes = Buffer.from(header);
  let supported = false;
  if (platform === "linux-x64" && bytes.length >= 20) {
    supported = bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
      && bytes[4] === 2 && bytes[5] === 1 && bytes.readUInt16LE(18) === 0x3e;
  } else if (platform === "windows-x64" && bytes.length >= 64) {
    const peOffset = bytes.readUInt32LE(0x3c);
    supported = bytes.subarray(0, 2).toString() === "MZ"
      && peOffset + 6 <= bytes.length
      && bytes.subarray(peOffset, peOffset + 4).equals(Buffer.from([0x50, 0x45, 0, 0]))
      && bytes.readUInt16LE(peOffset + 4) === 0x8664;
  } else if (platform === "macos-universal" && bytes.length >= 8) {
    const magic = bytes.readUInt32BE(0);
    const count = bytes.readUInt32BE(4);
    const stride = magic === 0xcafebabf ? 32 : 20;
    if (
      (magic === 0xcafebabe || magic === 0xcafebabf)
      && count >= 2 && count <= 8 && bytes.length >= 8 + count * stride
    ) {
      const types = Array.from({ length: count }, (_value, index) =>
        bytes.readUInt32BE(8 + index * stride)
      );
      supported = types.includes(0x01000007) && types.includes(0x0100000c);
    }
  }
  if (!supported) throw new Error(`Executable architecture does not match ${platform}`);
}

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

export type DesktopLogLevel = "INFO" | "WARN" | "ERROR";

export interface DesktopLogger {
  readonly filePath: string;
  readonly previousFilePath: string;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface DesktopLoggerOptions {
  readonly maxBytes?: number;
  readonly now?: () => Date;
}

export const DESKTOP_LOG_FILE_NAME = "2dnd.log";
export const DESKTOP_PREVIOUS_LOG_FILE_NAME = "2dnd.previous.log";
export const DEFAULT_DESKTOP_LOG_MAX_BYTES = 1024 * 1024;
const MAX_LOG_MESSAGE_LENGTH = 8_192;

function normalizeLogMessage(message: string): string {
  return message
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "?")
    .slice(0, MAX_LOG_MESSAGE_LENGTH);
}

export function createDesktopLogger(
  directory: string,
  options: DesktopLoggerOptions = {},
): DesktopLogger {
  const maxBytes = options.maxBytes ?? DEFAULT_DESKTOP_LOG_MAX_BYTES;
  if (!Number.isInteger(maxBytes) || maxBytes < 128) {
    throw new Error("Desktop log maxBytes must be an integer of at least 128");
  }
  const now = options.now ?? (() => new Date());
  const filePath = join(directory, DESKTOP_LOG_FILE_NAME);
  const previousFilePath = join(directory, DESKTOP_PREVIOUS_LOG_FILE_NAME);
  mkdirSync(directory, { recursive: true });

  const write = (level: DesktopLogLevel, message: string): void => {
    const line = `${now().toISOString()} [${level}] ${
      normalizeLogMessage(message)
    }\n`;
    const lineBytes = Buffer.byteLength(line);
    try {
      const currentBytes = existsSync(filePath) ? statSync(filePath).size : 0;
      if (currentBytes > 0 && currentBytes + lineBytes > maxBytes) {
        rmSync(previousFilePath, { force: true });
        renameSync(filePath, previousFilePath);
      }
      appendFileSync(filePath, line, { encoding: "utf8", mode: 0o600 });
    } catch (error) {
      process.stderr.write(
        `[desktop] Failed to write log: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
    }
  };

  return {
    filePath,
    previousFilePath,
    info: (message: string): void => write("INFO", message),
    warn: (message: string): void => write("WARN", message),
    error: (message: string): void => write("ERROR", message),
  };
}

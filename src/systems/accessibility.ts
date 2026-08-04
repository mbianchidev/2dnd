import { debugLog } from "../config";

export const CUTSCENE_ACCESSIBILITY_STORAGE_KEY = "2dnd_cutscene_accessibility";

export const CUTSCENE_TEXT_SCALES = [1, 1.25, 1.5] as const;

export type CutsceneTextScale = (typeof CUTSCENE_TEXT_SCALES)[number];
export type CutsceneAdvanceMode = "manual" | "automatic";

export interface CutsceneAccessibilityPreferences {
  reducedMotion: boolean;
  textScale: CutsceneTextScale;
  advanceMode: CutsceneAdvanceMode;
}

const DEFAULT_CUTSCENE_ACCESSIBILITY: CutsceneAccessibilityPreferences = {
  reducedMotion: false,
  textScale: 1,
  advanceMode: "manual",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTextScale(value: unknown): value is CutsceneTextScale {
  return CUTSCENE_TEXT_SCALES.some((scale) => scale === value);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function normalizeCutsceneAccessibilityPreferences(
  value: unknown,
): CutsceneAccessibilityPreferences {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_CUTSCENE_ACCESSIBILITY,
      reducedMotion: prefersReducedMotion(),
    };
  }
  return {
    reducedMotion: typeof value.reducedMotion === "boolean"
      ? value.reducedMotion
      : prefersReducedMotion(),
    textScale: isTextScale(value.textScale) ? value.textScale : 1,
    advanceMode: value.advanceMode === "automatic" ? "automatic" : "manual",
  };
}

function loadPreferences(): CutsceneAccessibilityPreferences {
  if (typeof localStorage === "undefined") {
    return normalizeCutsceneAccessibilityPreferences(undefined);
  }
  try {
    const saved = localStorage.getItem(CUTSCENE_ACCESSIBILITY_STORAGE_KEY);
    return normalizeCutsceneAccessibilityPreferences(
      saved === null ? undefined : JSON.parse(saved) as unknown,
    );
  } catch (error: unknown) {
    debugLog(`Could not load cutscene accessibility settings: ${String(error)}`);
    return normalizeCutsceneAccessibilityPreferences(undefined);
  }
}

export class CutsceneAccessibilityStore {
  private preferences = loadPreferences();

  get(): Readonly<CutsceneAccessibilityPreferences> {
    return this.preferences;
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.update({ reducedMotion });
  }

  setAdvanceMode(advanceMode: CutsceneAdvanceMode): void {
    this.update({ advanceMode });
  }

  cycleTextScale(): void {
    const currentIndex = CUTSCENE_TEXT_SCALES.indexOf(this.preferences.textScale);
    const next = CUTSCENE_TEXT_SCALES[
      (currentIndex + 1) % CUTSCENE_TEXT_SCALES.length
    ];
    this.update({ textScale: next });
  }

  reload(): void {
    this.preferences = loadPreferences();
  }

  private update(changes: Partial<CutsceneAccessibilityPreferences>): void {
    this.preferences = { ...this.preferences, ...changes };
    if (typeof localStorage === "undefined") {
      return;
    }
    try {
      localStorage.setItem(
        CUTSCENE_ACCESSIBILITY_STORAGE_KEY,
        JSON.stringify(this.preferences),
      );
    } catch (error: unknown) {
      debugLog(`Could not save cutscene accessibility settings: ${String(error)}`);
    }
  }
}

export const cutsceneAccessibility = new CutsceneAccessibilityStore();

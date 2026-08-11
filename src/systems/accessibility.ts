import type * as Phaser from "phaser";
import { debugLog } from "../config";
import { installSceneLayoutAudit, syncInteractiveHitArea } from "../managers/layout";

export const GAME_PREFERENCES_STORAGE_KEY = "2dnd_preferences";
export const LEGACY_AUDIO_PREFERENCES_STORAGE_KEY = "2dnd_audio_prefs";
export const LEGACY_CUTSCENE_ACCESSIBILITY_STORAGE_KEY =
  "2dnd_cutscene_accessibility";
export const CUTSCENE_ACCESSIBILITY_STORAGE_KEY =
  LEGACY_CUTSCENE_ACCESSIBILITY_STORAGE_KEY;

export const TEXT_SCALES = [1, 1.25, 1.5] as const;
export const CUTSCENE_TEXT_SCALES = TEXT_SCALES;

export type TextScale = (typeof TEXT_SCALES)[number];
export type CutsceneTextScale = TextScale;
export type CutsceneAdvanceMode = "manual" | "automatic";
export type TouchControlVisibility = "auto" | "on" | "off";
export type ControlHandedness = "left" | "right";
export type PromptSourcePreference =
  | "auto"
  | "keyboard"
  | "gamepad"
  | "touch";

export interface AudioPreferences {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  dialogVolume: number;
  muted: boolean;
}

export interface AccessibilityPreferences {
  reducedMotion: boolean;
  textScale: TextScale;
  highContrast: boolean;
  advanceMode: CutsceneAdvanceMode;
}

export interface ControlPreferences {
  touchControls: TouchControlVisibility;
  handedness: ControlHandedness;
  promptSource: PromptSourcePreference;
}

export type CutsceneAccessibilityPreferences = AccessibilityPreferences;

export interface GamePreferences {
  version: 2;
  audio: AudioPreferences;
  accessibility: AccessibilityPreferences;
  controls: ControlPreferences;
}

type GamePreferencesListener = (preferences: Readonly<GamePreferences>) => void;

interface TextPresentation {
  fontSize: number;
  stroke: string | CanvasGradient | CanvasPattern;
  strokeThickness: number;
}

const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  masterVolume: 1,
  musicVolume: 0.6,
  sfxVolume: 0.4,
  dialogVolume: 0.5,
  muted: false,
};

const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  reducedMotion: false,
  textScale: 1,
  highContrast: false,
  advanceMode: "manual",
};

const DEFAULT_CONTROL_PREFERENCES: ControlPreferences = {
  touchControls: "auto",
  handedness: "right",
  promptSource: "auto",
};

const textPresentations = new WeakMap<Phaser.GameObjects.Text, TextPresentation>();
const installedScenes = new WeakSet<Phaser.Scene>();
const pausedEmitters = new WeakSet<
  Phaser.GameObjects.Particles.ParticleEmitter
>();
const pausedTweens = new WeakSet<Phaser.Tweens.Tween>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTextScale(value: unknown): value is TextScale {
  return TEXT_SCALES.some((scale) => scale === value);
}

function normalizeVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function normalizeAudioPreferences(value: unknown): AudioPreferences {
  const source = isRecord(value) ? value : {};
  return {
    masterVolume: normalizeVolume(
      source.masterVolume,
      DEFAULT_AUDIO_PREFERENCES.masterVolume,
    ),
    musicVolume: normalizeVolume(
      source.musicVolume,
      DEFAULT_AUDIO_PREFERENCES.musicVolume,
    ),
    sfxVolume: normalizeVolume(
      source.sfxVolume,
      DEFAULT_AUDIO_PREFERENCES.sfxVolume,
    ),
    dialogVolume: normalizeVolume(
      source.dialogVolume,
      DEFAULT_AUDIO_PREFERENCES.dialogVolume,
    ),
    muted: typeof source.muted === "boolean"
      ? source.muted
      : DEFAULT_AUDIO_PREFERENCES.muted,
  };
}

export function normalizeAccessibilityPreferences(
  value: unknown,
): AccessibilityPreferences {
  const source = isRecord(value) ? value : {};
  return {
    reducedMotion: typeof source.reducedMotion === "boolean"
      ? source.reducedMotion
      : prefersReducedMotion(),
    textScale: isTextScale(source.textScale)
      ? source.textScale
      : DEFAULT_ACCESSIBILITY_PREFERENCES.textScale,
    highContrast: typeof source.highContrast === "boolean"
      ? source.highContrast
      : DEFAULT_ACCESSIBILITY_PREFERENCES.highContrast,
    advanceMode: source.advanceMode === "automatic" ? "automatic" : "manual",
  };
}

export const normalizeCutsceneAccessibilityPreferences =
  normalizeAccessibilityPreferences;

export function normalizeControlPreferences(
  value: unknown,
): ControlPreferences {
  const source = isRecord(value) ? value : {};
  const touchControls = source.touchControls;
  const promptSource = source.promptSource;
  return {
    touchControls: touchControls === "on" || touchControls === "off"
      ? touchControls
      : "auto",
    handedness: source.handedness === "left" ? "left" : "right",
    promptSource: promptSource === "keyboard"
      || promptSource === "gamepad"
      || promptSource === "touch"
      ? promptSource
      : "auto",
  };
}

export function normalizeGamePreferences(value: unknown): GamePreferences {
  const source = isRecord(value) ? value : {};
  return {
    version: 2,
    audio: normalizeAudioPreferences(source.audio),
    accessibility: normalizeAccessibilityPreferences(source.accessibility),
    controls: normalizeControlPreferences(source.controls),
  };
}

function readStoredValue(key: string): unknown {
  if (typeof localStorage === "undefined") return undefined;
  const saved = localStorage.getItem(key);
  return saved === null ? undefined : JSON.parse(saved) as unknown;
}

function loadPreferences(): GamePreferences {
  if (typeof localStorage === "undefined") {
    return normalizeGamePreferences(undefined);
  }
  try {
    const current = readStoredValue(GAME_PREFERENCES_STORAGE_KEY);
    if (current !== undefined) return normalizeGamePreferences(current);

    const migrated = normalizeGamePreferences({
      audio: readStoredValue(LEGACY_AUDIO_PREFERENCES_STORAGE_KEY),
      accessibility: readStoredValue(
        LEGACY_CUTSCENE_ACCESSIBILITY_STORAGE_KEY,
      ),
    });
    return migrated;
  } catch (error: unknown) {
    debugLog(`Could not load game preferences: ${String(error)}`);
    return normalizeGamePreferences(undefined);
  }
}

export class GamePreferencesStore {
  private preferences: GamePreferences;
  private readonly listeners = new Set<GamePreferencesListener>();

  constructor() {
    this.preferences = loadPreferences();
    this.persist();
  }

  get(): Readonly<GamePreferences> {
    return this.preferences;
  }

  getAudio(): Readonly<AudioPreferences> {
    return this.preferences.audio;
  }

  getAccessibility(): Readonly<AccessibilityPreferences> {
    return this.preferences.accessibility;
  }

  getControls(): Readonly<ControlPreferences> {
    return this.preferences.controls;
  }

  setAudio(changes: Partial<AudioPreferences>): void {
    this.update({
      audio: normalizeAudioPreferences({
        ...this.preferences.audio,
        ...changes,
      }),
    });
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.setAccessibility({ reducedMotion });
  }

  setHighContrast(highContrast: boolean): void {
    this.setAccessibility({ highContrast });
  }

  setAdvanceMode(advanceMode: CutsceneAdvanceMode): void {
    this.setAccessibility({ advanceMode });
  }

  cycleTextScale(): void {
    const currentIndex = TEXT_SCALES.indexOf(
      this.preferences.accessibility.textScale,
    );
    const next = TEXT_SCALES[(currentIndex + 1) % TEXT_SCALES.length];
    this.setAccessibility({ textScale: next });
  }

  cycleTouchControls(): void {
    const order: readonly TouchControlVisibility[] = ["auto", "on", "off"];
    const current = order.indexOf(this.preferences.controls.touchControls);
    this.setControls({
      touchControls: order[(current + 1) % order.length],
    });
  }

  setControlHandedness(handedness: ControlHandedness): void {
    this.setControls({ handedness });
  }

  cyclePromptSource(): void {
    const order: readonly PromptSourcePreference[] = [
      "auto",
      "keyboard",
      "gamepad",
      "touch",
    ];
    const current = order.indexOf(this.preferences.controls.promptSource);
    this.setControls({
      promptSource: order[(current + 1) % order.length],
    });
  }

  subscribe(listener: GamePreferencesListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reload(): void {
    this.preferences = loadPreferences();
    this.notify();
  }

  private setAccessibility(
    changes: Partial<AccessibilityPreferences>,
  ): void {
    this.update({
      accessibility: normalizeAccessibilityPreferences({
        ...this.preferences.accessibility,
        ...changes,
      }),
    });
  }

  private setControls(changes: Partial<ControlPreferences>): void {
    this.update({
      controls: normalizeControlPreferences({
        ...this.preferences.controls,
        ...changes,
      }),
    });
  }

  private update(changes: Partial<GamePreferences>): void {
    this.preferences = normalizeGamePreferences({
      ...this.preferences,
      ...changes,
    });
    this.persist();
    this.notify();
  }

  private persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        GAME_PREFERENCES_STORAGE_KEY,
        JSON.stringify(this.preferences),
      );
      localStorage.removeItem(LEGACY_AUDIO_PREFERENCES_STORAGE_KEY);
      localStorage.removeItem(LEGACY_CUTSCENE_ACCESSIBILITY_STORAGE_KEY);
    } catch (error: unknown) {
      debugLog(`Could not save game preferences: ${String(error)}`);
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.preferences);
  }
}

export class CutsceneAccessibilityStore {
  private readonly store = new GamePreferencesStore();

  get(): Readonly<AccessibilityPreferences> {
    return this.store.getAccessibility();
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.store.setReducedMotion(reducedMotion);
  }

  setHighContrast(highContrast: boolean): void {
    this.store.setHighContrast(highContrast);
  }

  setAdvanceMode(advanceMode: CutsceneAdvanceMode): void {
    this.store.setAdvanceMode(advanceMode);
  }

  cycleTextScale(): void {
    this.store.cycleTextScale();
  }

  reload(): void {
    this.store.reload();
  }
}

export const gamePreferences = new GamePreferencesStore();
export const cutsceneAccessibility = gamePreferences;

export function getAccessibilityPreferences(): Readonly<AccessibilityPreferences> {
  return gamePreferences.getAccessibility();
}

export function isReducedMotionEnabled(): boolean {
  return gamePreferences.getAccessibility().reducedMotion;
}

export function getMotionDuration(duration: number): number {
  return isReducedMotionEnabled() ? 0 : duration;
}

function getTextPresentation(text: Phaser.GameObjects.Text): TextPresentation {
  const existing = textPresentations.get(text);
  if (existing) return existing;
  const fontSize = Number.parseFloat(String(text.style.fontSize)) || 16;
  const presentation = {
    fontSize,
    stroke: text.style.stroke,
    strokeThickness: text.style.strokeThickness,
  };
  textPresentations.set(text, presentation);
  return presentation;
}

function applyTextPresentation(
  text: Phaser.GameObjects.Text,
  preferences: Readonly<AccessibilityPreferences>,
): void {
  const base = getTextPresentation(text);
  text.setFontSize(Math.round(base.fontSize * preferences.textScale));
  const maxWidth = text.getData("accessibilityMaxWidth");
  if (typeof maxWidth === "number" && maxWidth > 0) {
    text.setScale(Math.min(1, maxWidth / text.width), 1);
  }
  syncInteractiveHitArea(text);
  if (preferences.highContrast) {
    text.setStroke("#000000", Math.max(2, base.strokeThickness));
  } else {
    text.setStroke(base.stroke, base.strokeThickness);
  }
}

function applyToGameObject(
  gameObject: Phaser.GameObjects.GameObject,
  preferences: Readonly<AccessibilityPreferences>,
): void {
  const emitter = gameObject as Partial<
    Phaser.GameObjects.Particles.ParticleEmitter
  >;
  if (
    typeof emitter.pause === "function"
    && typeof emitter.resume === "function"
    && typeof emitter.emitting === "boolean"
  ) {
    const particleEmitter = emitter as Phaser.GameObjects.Particles.ParticleEmitter;
    if (preferences.reducedMotion && !pausedEmitters.has(particleEmitter)) {
      particleEmitter.pause();
      pausedEmitters.add(particleEmitter);
    } else if (
      !preferences.reducedMotion
      && pausedEmitters.has(particleEmitter)
    ) {
      particleEmitter.resume();
      pausedEmitters.delete(particleEmitter);
    }
  }
  const text = gameObject as Partial<Phaser.GameObjects.Text>;
  if (
    typeof text.setFontSize === "function"
    && text.style !== undefined
  ) {
    applyTextPresentation(gameObject as Phaser.GameObjects.Text, preferences);
    return;
  }
  const container = gameObject as Partial<Phaser.GameObjects.Container>;
  if (Array.isArray(container.list)) {
    for (const child of container.list) {
      applyToGameObject(child, preferences);
    }
  }
}

function applyCanvasPresentation(
  scene: Phaser.Scene,
  preferences: Readonly<GamePreferences>,
): void {
  const canvas = scene.game.canvas;
  canvas.style.filter = preferences.accessibility.highContrast
    ? "contrast(1.35) saturate(0.85)"
    : "";
  canvas.dataset.highContrast = String(
    preferences.accessibility.highContrast,
  );
  canvas.dataset.textScale = String(preferences.accessibility.textScale);
  canvas.dataset.reducedMotion = String(
    preferences.accessibility.reducedMotion,
  );
  canvas.dataset.masterVolume = String(preferences.audio.masterVolume);
  canvas.dataset.audioMuted = String(preferences.audio.muted);
  canvas.dataset.touchControlsPreference = preferences.controls.touchControls;
  canvas.dataset.controlHandedness = preferences.controls.handedness;
  canvas.dataset.promptPreference = preferences.controls.promptSource;
}

function isInfiniteTween(tween: Phaser.Tweens.Tween): boolean {
  if (tween.loop < 0) return true;
  if (!Array.isArray(tween.data)) return false;
  return tween.data.some((entry) => (
    "repeat" in entry
    && typeof entry.repeat === "number"
    && entry.repeat < 0
  ));
}

export function applySceneAccessibility(scene: Phaser.Scene): void {
  const preferences = gamePreferences.get();
  applyCanvasPresentation(scene, preferences);
  for (const tween of scene.tweens.getTweens()) {
    if (!isInfiniteTween(tween)) continue;
    if (
      preferences.accessibility.reducedMotion
      && !pausedTweens.has(tween)
    ) {
      tween.pause();
      pausedTweens.add(tween);
    } else if (
      !preferences.accessibility.reducedMotion
      && pausedTweens.has(tween)
    ) {
      tween.resume();
      pausedTweens.delete(tween);
    }
  }
  for (const gameObject of scene.children.list) {
    applyToGameObject(gameObject, preferences.accessibility);
  }
}

export function installSceneAccessibility(scene: Phaser.Scene): void {
  if (installedScenes.has(scene)) return;
  installedScenes.add(scene);
  installSceneLayoutAudit(scene);
  const originalAddText = scene.add.text;
  scene.add.text = (
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text => {
    const gameText = originalAddText.call(scene.add, x, y, text, style);
    applyTextPresentation(gameText, gamePreferences.getAccessibility());
    return gameText;
  };
  const apply = (): void => applySceneAccessibility(scene);
  const unsubscribe = gamePreferences.subscribe(apply);
  scene.events.on("postupdate", apply);
  scene.events.once("shutdown", () => {
    unsubscribe();
    scene.events.off("postupdate", apply);
    scene.add.text = originalAddText;
    installedScenes.delete(scene);
  });
  apply();
}

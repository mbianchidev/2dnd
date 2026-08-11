import * as Phaser from "phaser";
import { audioEngine } from "../systems/audio";
import {
  gamePreferences,
  type AudioPreferences,
} from "../systems/accessibility";
import { layoutTextStack, syncInteractiveHitArea } from "../managers/layout";

export const SETTINGS_PANEL_WIDTH = 520;
export const SETTINGS_PANEL_HEIGHT = 480;

interface SettingsControl {
  text: Phaser.GameObjects.Text;
  updateLabel: () => void;
}

interface AudioChannel {
  key: keyof Pick<
    AudioPreferences,
    "masterVolume" | "musicVolume" | "sfxVolume" | "dialogVolume"
  >;
  label: string;
  setter: (value: number) => void;
}

export interface SettingsControls {
  controls: Phaser.GameObjects.GameObject[];
}

function createControl(
  scene: Phaser.Scene,
  id: string,
  x: number,
  y: number,
  width: number,
  label: () => string,
  onActivate: () => void,
): SettingsControl {
  const text = scene.add.text(x, y, label(), {
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#f4f1e8",
    backgroundColor: "#252b45",
    padding: { x: 8, y: 5 },
    align: "center",
    wordWrap: { width: width - 16 },
  }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
  text.setData("layoutId", id);
  const updateLabel = (): void => {
    text.setText(label());
    syncInteractiveHitArea(text, 8);
  };
  syncInteractiveHitArea(text, 8);
  text.on("pointerover", () => text.setStroke("#ffffff", 1));
  text.on("pointerout", () => text.setStroke("", 0));
  text.on("pointerdown", () => {
    onActivate();
    updateLabel();
  });
  return { text, updateLabel };
}

function createAudioSlider(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  channel: AudioChannel,
  x: number,
  y: number,
  width: number,
): () => void {
  const label = scene.add.text(x + width, y, "", {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#eeeeee",
  }).setOrigin(1, 0);
  const trackY = y + 19;
  const track = scene.add.graphics();
  const fill = scene.add.graphics();
  const knob = scene.add.graphics();
  const zone = scene.add.zone(x + width / 2, trackY, width, 44)
    .setInteractive({ useHandCursor: true, draggable: true });
  container.add([label, track, fill, knob, zone]);

  const draw = (): void => {
    const value = gamePreferences.getAudio()[channel.key];
    const knobX = x + width * value;
    label.setText(`${channel.label}: ${Math.round(value * 100)}%`);
    track.clear();
    track.fillStyle(0x15182a, 1).fillRect(x, trackY - 5, width, 10);
    track.lineStyle(2, 0xffffff, 0.8).strokeRect(x, trackY - 5, width, 10);
    for (let tick = 0; tick <= 4; tick += 1) {
      const tickX = x + (width * tick) / 4;
      track.lineBetween(tickX, trackY - 7, tickX, trackY + 7);
    }
    fill.clear();
    fill.fillStyle(0x4f8cff, 1).fillRect(x, trackY - 4, width * value, 8);
    knob.clear();
    knob.fillStyle(0xffdf66, 1).fillCircle(knobX, trackY, 7);
    knob.lineStyle(2, 0x000000, 1).strokeCircle(knobX, trackY, 7);
  };

  const setFromX = (pointerX: number): void => {
    channel.setter(Phaser.Math.Clamp((pointerX - x) / width, 0, 1));
  };
  zone.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number) => {
    setFromX(dragX);
  });
  zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    setFromX(pointer.x);
  });
  draw();
  return draw;
}

export function addSettingsControls(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  px: number,
  py: number,
  panelWidth: number,
  panelHeight: number,
): SettingsControls {
  const centerX = px + panelWidth / 2;
  const contentX = px + 18;
  const contentWidth = panelWidth - 36;
  const columnGap = 20;
  const columnWidth = Math.floor((contentWidth - columnGap) / 2);
  const rightX = contentX + columnWidth + columnGap;
  const controls: Phaser.GameObjects.GameObject[] = [];
  const title = scene.add.text(centerX, py + 10, "Settings", {
    fontSize: "15px",
    fontFamily: "monospace",
    color: "#ffdf66",
    fontStyle: "bold",
  }).setOrigin(0.5, 0);
  const audioTitle = scene.add.text(contentX, py + 48, "Audio", {
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#ffffff",
    fontStyle: "bold",
  });
  container.add([title, audioTitle]);
  controls.push(title, audioTitle);

  const channels: AudioChannel[] = [
    {
      key: "masterVolume",
      label: "Master",
      setter: (value) => audioEngine.setMasterVolume(value),
    },
    {
      key: "musicVolume",
      label: "Music",
      setter: (value) => audioEngine.setMusicVolume(value),
    },
    {
      key: "sfxVolume",
      label: "SFX",
      setter: (value) => audioEngine.setSFXVolume(value),
    },
    {
      key: "dialogVolume",
      label: "Dialog",
      setter: (value) => audioEngine.setDialogVolume(value),
    },
  ];
  const redrawAudio = channels.map((channel, index) => createAudioSlider(
    scene,
    container,
    channel,
    contentX,
    py + 72 + index * 46,
    columnWidth,
  ));

  const mute = createControl(
    scene,
    "settings-mute",
    contentX + columnWidth / 2,
    py + 264,
    columnWidth,
    () => `Audio: ${gamePreferences.getAudio().muted ? "Muted" : "On"}`,
    () => audioEngine.toggleMute(),
  );
  const accessibilityTitle = scene.add.text(rightX, py + 48, "Accessibility", {
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#ffffff",
    fontStyle: "bold",
  });
  const textScale = createControl(
    scene,
    "settings-text-scale",
    rightX + columnWidth / 2,
    0,
    columnWidth,
    () => `Text Scale: ${Math.round(
      gamePreferences.getAccessibility().textScale * 100,
    )}%`,
    () => gamePreferences.cycleTextScale(),
  );
  const contrast = createControl(
    scene,
    "settings-high-contrast",
    rightX + columnWidth / 2,
    0,
    columnWidth,
    () => `High Contrast: ${
      gamePreferences.getAccessibility().highContrast ? "On" : "Off"
    }`,
    () => gamePreferences.setHighContrast(
      !gamePreferences.getAccessibility().highContrast,
    ),
  );
  const motion = createControl(
    scene,
    "settings-reduced-motion",
    rightX + columnWidth / 2,
    0,
    columnWidth,
    () => `Reduced Motion: ${
      gamePreferences.getAccessibility().reducedMotion ? "On" : "Off"
    }`,
    () => gamePreferences.setReducedMotion(
      !gamePreferences.getAccessibility().reducedMotion,
    ),
  );
  const advance = createControl(
    scene,
    "settings-cutscene-advance",
    rightX + columnWidth / 2,
    0,
    columnWidth,
    () => `Cutscene Advance: ${
      gamePreferences.getAccessibility().advanceMode === "manual"
        ? "Manual"
        : "Automatic"
    }`,
    () => gamePreferences.setAdvanceMode(
      gamePreferences.getAccessibility().advanceMode === "manual"
        ? "automatic"
        : "manual",
    ),
  );
  const accessibilityControls = [
    textScale.text,
    contrast.text,
    motion.text,
    advance.text,
  ];
  const layoutAccessibility = (): void => {
    layoutTextStack(accessibilityControls, {
      x: rightX,
      y: py + 76,
      width: columnWidth,
      gap: 8,
      align: "center",
      hitAreaPadding: 8,
    });
  };
  layoutAccessibility();
  const controlsTitle = scene.add.text(contentX, py + 330, "Controls", {
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#ffffff",
    fontStyle: "bold",
  });
  const compactWidth = Math.floor((contentWidth - 16) / 3);
  const touch = createControl(
    scene,
    "settings-touch-controls",
    contentX + compactWidth / 2,
    py + 354,
    compactWidth,
    () => `Touch\n${gamePreferences.getControls().touchControls}`,
    () => gamePreferences.cycleTouchControls(),
  );
  const handedness = createControl(
    scene,
    "settings-handedness",
    contentX + compactWidth + 8 + compactWidth / 2,
    py + 354,
    compactWidth,
    () => `Layout\n${gamePreferences.getControls().handedness}`,
    () => gamePreferences.setControlHandedness(
      gamePreferences.getControls().handedness === "right" ? "left" : "right",
    ),
  );
  const prompts = createControl(
    scene,
    "settings-prompts",
    contentX + (compactWidth + 8) * 2 + compactWidth / 2,
    py + 354,
    compactWidth,
    () => `Prompts\n${gamePreferences.getControls().promptSource}`,
    () => gamePreferences.cyclePromptSource(),
  );
  const controlsToUpdate = [
    mute,
    textScale,
    contrast,
    motion,
    advance,
    touch,
    handedness,
    prompts,
  ];
  const mappingNote = scene.add.text(
    centerX,
    py + panelHeight - 48,
    "Stable mappings; custom remapping is unsupported.",
    {
      fontSize: "8px",
      fontFamily: "monospace",
      color: "#b8bfd8",
      align: "center",
      wordWrap: { width: contentWidth },
    },
  ).setOrigin(0.5, 1);
  container.add([
    mute.text,
    accessibilityTitle,
    textScale.text,
    contrast.text,
    motion.text,
    advance.text,
    controlsTitle,
    touch.text,
    handedness.text,
    prompts.text,
    mappingNote,
  ]);
  controls.push(
    mute.text,
    accessibilityTitle,
    textScale.text,
    contrast.text,
    motion.text,
    advance.text,
    controlsTitle,
    touch.text,
    handedness.text,
    prompts.text,
    mappingNote,
  );

  const unsubscribe = gamePreferences.subscribe(() => {
    redrawAudio.forEach((redraw) => redraw());
    controlsToUpdate.forEach((control) => control.updateLabel());
    layoutAccessibility();
  });
  container.once(Phaser.GameObjects.Events.DESTROY, unsubscribe);
  return { controls };
}

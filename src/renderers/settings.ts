import * as Phaser from "phaser";
import { cutsceneAccessibility } from "../systems/accessibility";

interface SettingsControl {
  text: Phaser.GameObjects.Text;
  updateLabel: () => void;
}

export interface CutsceneSettingsControls {
  controls: Phaser.GameObjects.GameObject[];
  height: number;
}

function createControl(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: () => string,
  onActivate: () => void,
): SettingsControl {
  const text = scene.add.text(x, y, "", {
    fontSize: "13px",
    color: "#dddddd",
    backgroundColor: "#1d2130",
    padding: { x: 8, y: 6 },
    align: "center",
  }).setOrigin(0.5, 0).setFixedSize(width, 28).setInteractive({ useHandCursor: true });
  const updateLabel = (): void => {
    text.setText(label());
  };
  text.on("pointerover", () => text.setColor("#ffdd66"));
  text.on("pointerout", () => text.setColor("#dddddd"));
  text.on("pointerdown", () => {
    onActivate();
    updateLabel();
  });
  updateLabel();
  return { text, updateLabel };
}

export function addCutsceneSettingsControls(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
): CutsceneSettingsControls {
  const title = scene.add.text(x, y, "Cutscenes", {
    fontSize: "14px",
    color: "#ffdd66",
    fontStyle: "bold",
  }).setOrigin(0.5, 0);
  const controls = [
    createControl(
      scene,
      x,
      y + 22,
      width,
      () => `Motion: ${cutsceneAccessibility.get().reducedMotion ? "Reduced" : "Full"}`,
      () => cutsceneAccessibility.setReducedMotion(
        !cutsceneAccessibility.get().reducedMotion,
      ),
    ),
    createControl(
      scene,
      x,
      y + 54,
      width,
      () => `Text Scale: ${Math.round(cutsceneAccessibility.get().textScale * 100)}%`,
      () => cutsceneAccessibility.cycleTextScale(),
    ),
    createControl(
      scene,
      x,
      y + 86,
      width,
      () => `Advance: ${cutsceneAccessibility.get().advanceMode === "manual"
        ? "Manual"
        : "Automatic"}`,
      () => cutsceneAccessibility.setAdvanceMode(
        cutsceneAccessibility.get().advanceMode === "manual"
          ? "automatic"
          : "manual",
      ),
    ),
  ];
  container.add([title, ...controls.map((control) => control.text)]);
  return {
    controls: [title, ...controls.map((control) => control.text)],
    height: 118,
  };
}

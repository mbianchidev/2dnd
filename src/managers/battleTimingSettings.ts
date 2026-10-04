import * as Phaser from "phaser";
import { TIMED_ROUND_DURATIONS } from "../data/battleTiming";
import type { PlayerState } from "../systems/player";
import { calcPanelLayout, createOverlayContainer, setOverlayViewport } from "../utils/ui";
import { layoutTextStack, syncInteractiveHitArea } from "./layout";

interface TimingSettingControl {
  id: string;
  text: Phaser.GameObjects.Text;
  label(): string;
  activate(): void;
}

export function createBattleTimingSettingsOverlay(
  scene: Phaser.Scene,
  player: PlayerState,
  changed: () => void,
  back: () => void,
): Phaser.GameObjects.Container {
  const container = createOverlayContainer(scene, "battle-timing-settings", 75);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.75)
    .fillRect(0, 0, scene.cameras.main.width, scene.cameras.main.height);
  dim.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, scene.cameras.main.width, scene.cameras.main.height),
    Phaser.Geom.Rectangle.Contains,
  );
  const background = scene.add.graphics();
  const title = scene.add.text(0, 0, "Battle Timing", {
    fontSize: "14px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
  }).setData("layoutId", "battle-timing-settings-title");
  const lead = scene.add.text(0, 0, "For this campaign. Standard has no time limit.", {
    fontSize: "11px", fontFamily: "monospace", color: "#ffffff",
    wordWrap: { width: 480 },
  });
  const timeout = scene.add.text(0, 0, "Timeout: validated Defend. Never spends MP or items; if the main action was spent, only ends the turn.", {
    fontSize: "10px", fontFamily: "monospace", color: "#ffffff",
    wordWrap: { width: 480 },
  });
  const guidance = scene.add.text(0, 0, [
    "Only hero/manual decisions, including targets, are timed. One budget per turn; bonus actions keep remaining time.",
    "Actions, blocking logs/overlays, transitions, hidden/unfocused pages and controller recovery pause time. Esc/B or Pause reads the log; Enter/A or Resume continues.",
    "Reload restores the checkpoint or pending encounter, not a hidden deadline. Timed mode is optional, not an accessibility requirement.",
    "WASD/arrows: choose. Enter/Space/A: change. Esc/B: close.",
  ].join("\n\n"), {
    fontSize: "9px", fontFamily: "monospace", color: "#e1e6f0",
    wordWrap: { width: 480 },
  });
  const controls: TimingSettingControl[] = [];
  let selected = 0;
  let pending: string | null = null;
  const readyAt = scene.time.now + 150;
  const announcement = document.createElement("span");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-atomic", "true");
  announcement.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);";
  document.body.appendChild(announcement);

  const update = (): void => {
    controls.forEach((control, index) => {
      control.text.setText(`${selected === index ? "> " : "  "}${control.label()}`);
      control.text.setBackgroundColor(selected === index ? "#34416b" : "#121a2e");
      syncInteractiveHitArea(control.text, 2);
    });
    announcement.textContent = `Battle mode ${player.battleTiming.mode}. `
      + `Decision duration ${player.battleTiming.durationSeconds} seconds. Timeout Defend.`;
  };
  const addControl = (id: string, label: () => string, activate: () => void): void => {
    const text = scene.add.text(0, 0, "", {
      fontSize: "12px", fontFamily: "monospace", color: "#ffffff",
      padding: { x: 8, y: 5 }, wordWrap: { width: 464 },
    }).setData("layoutId", id).setInteractive({ useHandCursor: true });
    const index = controls.length;
    text.on("pointerover", () => { selected = index; update(); });
    text.on("pointerdown", () => {
      selected = index;
      activate();
      if (container.active) update();
    });
    controls.push({ id, text, label, activate });
  };
  addControl("battle-timing-mode", () =>
    `Mode: ${player.battleTiming.mode === "standard" ? "Standard (unlimited)" : "Timed"}`,
  () => {
    player.battleTiming = {
      ...player.battleTiming,
      mode: player.battleTiming.mode === "standard" ? "timed" : "standard",
    };
    changed();
  });
  addControl("battle-timing-duration", () =>
    `Decision duration: ${player.battleTiming.durationSeconds}s (Timed only)`,
  () => {
    const index = TIMED_ROUND_DURATIONS.indexOf(player.battleTiming.durationSeconds);
    player.battleTiming = {
      ...player.battleTiming,
      durationSeconds: TIMED_ROUND_DURATIONS[(index + 1) % TIMED_ROUND_DURATIONS.length]!,
    };
    changed();
  });
  addControl("battle-timing-back", () => "Back to Settings", back);
  container.add([
    dim, background, title, lead, controls[0]!.text, controls[1]!.text,
    timeout, guidance, controls[2]!.text,
  ]);
  update();

  let measurements = "";
  const reflow = (): void => {
    if (!container.active) return;
    const texts = [title, lead, controls[0]!.text, controls[1]!.text, timeout, guidance, controls[2]!.text];
    const next = texts.map((text) => `${text.displayWidth}:${text.displayHeight}`).join(",");
    if (next === measurements) return;
    measurements = next;
    const height = layoutTextStack(texts, { x: 0, y: 0, width: 488, gap: 8 }) + 24;
    const bounds = calcPanelLayout(scene, 520, height);
    layoutTextStack(texts, {
      x: bounds.px + 16, y: bounds.py + 12, width: bounds.panelW - 32,
      gap: 8, hitAreaPadding: 2,
    });
    background.clear();
    background.fillStyle(0x080c16, 1)
      .fillRect(bounds.px, bounds.py, bounds.panelW, bounds.panelH);
    background.lineStyle(2, 0xffffff, 1)
      .strokeRect(bounds.px, bounds.py, bounds.panelW, bounds.panelH);
    background.setInteractive(
      new Phaser.Geom.Rectangle(bounds.px, bounds.py, bounds.panelW, bounds.panelH),
      Phaser.Geom.Rectangle.Contains,
    );
    setOverlayViewport(scene, "battle-timing-settings", {
      x: bounds.px, y: bounds.py, width: bounds.panelW, height: bounds.panelH,
    });
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (!container.active || scene.time.now < readyAt) return;
    const direction = /^(ArrowUp|ArrowLeft|w|W|a|A)$/.test(event.key) ? -1
      : /^(ArrowDown|ArrowRight|s|S|d|D)$/.test(event.key) ? 1 : 0;
    if (direction !== 0) {
      selected = (selected + direction + controls.length) % controls.length;
      update();
    } else if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      pending = controls[selected]!.id;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const keyUp = (event: KeyboardEvent): void => {
    if (!pending || (event.key !== "Enter" && event.key !== " ")) return;
    const control = controls.find((candidate) => candidate.id === pending);
    pending = null;
    if (container.active && control) {
      control.activate();
      if (container.active) update();
    }
  };
  scene.input.keyboard?.on("keydown", keyDown);
  scene.input.keyboard?.on("keyup", keyUp);
  scene.events.on("postupdate", reflow);
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.keyboard?.off("keydown", keyDown);
    scene.input.keyboard?.off("keyup", keyUp);
    scene.events.off("postupdate", reflow);
    announcement.remove();
    pending = null;
  });
  reflow();
  return container;
}

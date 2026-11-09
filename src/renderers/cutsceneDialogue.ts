import type * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { CutsceneStep } from "../data/cutsceneTypes";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { resolveCutscenePortraits } from "../systems/cutscenePortraits";
import type { HeroVisualDescriptor } from "../systems/heroVisuals";
import type { PlayerState } from "../systems/player";
import { getScaledBounds, subscribeOverlayReflow } from "../managers/layout";
import { createOverlayContainer, createPanelGraphics, createStatusAnnouncer, setOverlayViewport } from "../utils/ui";
import type { HeroTextureLease } from "./heroTextures";
import { acquirePortraitTexture } from "./portraitTextures";

const portraitReportOwners = new WeakMap<HTMLCanvasElement, CutsceneDialogueRenderer>();

/** Measured dialogue owns its portraits, native announcement and preference reflow. */
export class CutsceneDialogueRenderer {
  private readonly container: Phaser.GameObjects.Container;
  private readonly announcer: HTMLDivElement;
  private readonly unsubscribe: () => void;
  private readonly leases: HeroTextureLease[] = [];
  private step: CutsceneStep | null = null;
  panelTop = GAME_HEIGHT;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerState,
    private readonly heroDescriptor: HeroVisualDescriptor,
    parent: Phaser.GameObjects.Container,
    private readonly onReflow: () => void,
  ) {
    this.container = createOverlayContainer(scene, "cutscene-dialogue", 0);
    parent.add(this.container);
    this.announcer = createStatusAnnouncer("cutscene-dialogue-status");
    this.unsubscribe = subscribeOverlayReflow(scene, () => {
      if (this.step) { this.draw(this.step); this.onReflow(); }
    });
  }

  present(step: CutsceneStep): void {
    this.step = step;
    this.draw(step);
    const speaker = this.speaker(step);
    this.announcer.textContent = `${speaker ? `${speaker}: ` : ""}${this.body(step)}`;
  }

  clear(): void {
    this.step = null;
    this.clearObjects();
    this.panelTop = GAME_HEIGHT;
    this.announcer.replaceChildren();
    if (portraitReportOwners.get(this.scene.game.canvas) === this) {
      portraitReportOwners.delete(this.scene.game.canvas);
      this.scene.game.canvas.removeAttribute("data-cutscene-portraits");
    }
  }

  destroy(): void {
    this.unsubscribe();
    this.clear();
    this.container.destroy(true);
    this.announcer.remove();
  }

  private clearObjects(): void {
    this.container.removeAll(true);
    for (const lease of this.leases.splice(0)) lease.release();
  }

  private speaker(step: CutsceneStep): string {
    return (step.type === "dialogue" ? step.speaker
      : step.type === "credits" ? "Credits" : step.heading ?? "").replace("{hero}", this.player.name);
  }

  private body(step: CutsceneStep): string {
    return (step.type === "credits" ? step.lines.join("\n")
      : step.type === "summary" ? step.heading : step.text).split("{hero}").join(this.player.name);
  }

  private draw(step: CutsceneStep): void {
    this.clearObjects();
    const preferences = getAccessibilityPreferences();
    const portraits = step.type === "dialogue" ? resolveCutscenePortraits(step, this.player, this.heroDescriptor) : [];
    const padding = 16;
    const panelX = 18;
    const panelWidth = GAME_WIDTH - 36;
    const portraitSpace = 84;
    const bodyX = panelX + padding + (portraits.length > 0 ? portraitSpace : 0);
    const bodyWidth = panelWidth - padding * 2 - portraits.length * portraitSpace;
    const heading = this.scene.add.text(bodyX, 0, this.speaker(step), {
      fontSize: "15px", color: preferences.highContrast ? "#ffffff" : "#efd594", fontStyle: "bold",
      wordWrap: { width: bodyWidth, useAdvancedWrap: true },
    }).setData("layoutId", "cutscene-speaker");
    const body = this.scene.add.text(bodyX, 0, this.body(step), {
      fontSize: "14px", color: "#f4f1e8", wordWrap: { width: bodyWidth, useAdvancedWrap: true }, lineSpacing: 4,
    }).setData("layoutId", "cutscene-copy");
    const hint = this.scene.add.text(GAME_WIDTH - 34, 0,
      preferences.advanceMode === "automatic" ? "Automatic  |  Esc skip" : "Space / Enter / click  |  Esc skip",
      { fontSize: "10px", color: preferences.highContrast ? "#ffffff" : "#b7c8c3" },
    ).setOrigin(1, 0).setData("layoutId", "cutscene-advance");
    const headingHeight = this.speaker(step) ? getScaledBounds(heading).height + 8 : 0;
    heading.setVisible(headingHeight > 0);
    const copyHeight = headingHeight + getScaledBounds(body).height;
    const portraitRows = portraits.map((portrait) => {
      const name = this.scene.add.text(0, 0, portrait.label, {
        fontSize: "9px", color: "#f4f1e8", align: "center",
        wordWrap: { width: 72, useAdvancedWrap: true },
      }).setOrigin(0.5, 0).setData("layoutId", `portrait-name-${portrait.actorId}`);
      const role = this.scene.add.text(0, 0, portrait.speaking ? "Speaking" : "Listening", {
        fontSize: "8px", color: portrait.speaking ? "#efd594" : "#b7c8c3",
      }).setOrigin(0.5, 0).setData("layoutId", `portrait-role-${portrait.actorId}`);
      return { portrait, name, role, height: 80 + getScaledBounds(name).height + 4 + getScaledBounds(role).height };
    });
    const contentHeight = Math.max(copyHeight, ...portraitRows.map(({ height }) => height), 72);
    const panelHeight = Math.max(132, padding * 2 + contentHeight + 12 + getScaledBounds(hint).height);
    this.panelTop = GAME_HEIGHT - 12 - panelHeight;
    if (this.panelTop < 36) throw new Error("[cutscene] Dialogue exceeds its measured viewport.");
    const panel = createPanelGraphics(this.scene, panelX, this.panelTop, panelWidth, panelHeight, 0.97,
      preferences.highContrast ? 0xffffff : 0xc3aa73);
    heading.setY(this.panelTop + padding);
    body.setY(this.panelTop + padding + headingHeight);
    hint.setY(this.panelTop + padding + contentHeight + 12);
    this.container.add([panel, heading, body, hint]);
    const report = portraitRows.map(({ portrait, name, role }, index) => {
      const x = index === 0 ? panelX + padding + 36 : panelX + panelWidth - padding - 36;
      const y = this.panelTop + padding;
      const frame = this.scene.add.rectangle(x, y + 36, 74, 74, 0x20363b)
        .setStrokeStyle(portrait.speaking ? 2 : 1,
          preferences.highContrast ? 0xffffff : portrait.speaking ? 0xefd594 : 0x78918d);
      const lease = acquirePortraitTexture(this.scene, portrait);
      this.leases.push(lease);
      const image = this.scene.add.image(x, y + 36, lease.key).setDisplaySize(72, 72)
        .setAlpha(portrait.speaking ? 1 : 0.82);
      image.setData("layoutBounds", getScaledBounds(image)).setData("layoutId", `portrait-${portrait.actorId}`);
      name.setPosition(x, y + 80);
      role.setPosition(x, name.y + getScaledBounds(name).height + 4);
      this.container.add([frame, image, name, role]);
      return { actorId: portrait.actorId, kind: portrait.kind, label: portrait.label,
        speaking: portrait.speaking, textureKey: lease.key };
    });
    portraitReportOwners.set(this.scene.game.canvas, this);
    this.scene.game.canvas.setAttribute("data-cutscene-portraits", JSON.stringify(report));
    setOverlayViewport(this.scene, "cutscene-dialogue",
      { x: panelX, y: this.panelTop, width: panelWidth, height: panelHeight });
  }
}

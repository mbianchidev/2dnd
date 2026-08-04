import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { getChronicleCutscenes } from "../systems/cutscenes";

import type { CutsceneDefinition, CutsceneId } from "../data/cutscenes";
import type { PlayerState } from "../systems/player";

export class ChronicleManager {
  private container: Phaser.GameObjects.Container | null = null;
  private entries: readonly CutsceneDefinition<CutsceneId>[] = [];
  private selectedIndex = 0;
  private readonly keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    enter: Phaser.Input.Keyboard.Key;
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onReplay: (id: CutsceneId) => void,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error("Chronicle requires keyboard input.");
    }
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      enter: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    };
  }

  isOpen(): boolean {
    return this.container !== null;
  }

  getDebugState(): string {
    return this.container
      ? ` [CHRONICLE] [CHRONICLE_SELECTION:${this.selectedIndex + 1}/${this.entries.length}]`
      : "";
  }

  open(player: PlayerState): void {
    this.entries = getChronicleCutscenes(player.progression);
    this.selectedIndex = 0;
    this.render();
  }

  close(): void {
    this.container?.destroy(true);
    this.container = null;
  }

  update(): boolean {
    if (!this.container) {
      return false;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
      this.moveSelection(-1);
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
      this.moveSelection(1);
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
      this.replaySelected();
    }
    return true;
  }

  replaySelected(): void {
    const selected = this.entries[this.selectedIndex];
    if (selected) {
      this.onReplay(selected.id);
    }
  }

  private moveSelection(delta: number): void {
    if (this.entries.length === 0) {
      return;
    }
    this.selectedIndex = (
      this.selectedIndex + delta + this.entries.length
    ) % this.entries.length;
    this.render();
  }

  private render(): void {
    this.container?.destroy(true);
    const container = this.scene.add.container(0, 0).setDepth(95);
    const backdrop = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.78,
    );
    const panel = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      500,
      390,
      0x111522,
      0.98,
    ).setStrokeStyle(2, 0xc9a84c);
    const title = this.scene.add.text(GAME_WIDTH / 2, 48, "Chronicle", {
      fontSize: "25px",
      color: "#ffdd66",
      fontStyle: "bold",
    }).setOrigin(0.5);
    const subtitle = this.scene.add.text(
      GAME_WIDTH / 2,
      78,
      "Revisit completed story moments",
      { fontSize: "12px", color: "#b8bdca" },
    ).setOrigin(0.5);
    container.add([backdrop, panel, title, subtitle]);

    if (this.entries.length === 0) {
      container.add(this.scene.add.text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        "No memories recorded yet.",
        { fontSize: "16px", color: "#dddddd" },
      ).setOrigin(0.5));
    } else {
      const pageSize = 8;
      const pageStart = Math.floor(this.selectedIndex / pageSize) * pageSize;
      const pageEntries = this.entries.slice(pageStart, pageStart + pageSize);
      pageEntries.forEach((entry, rowIndex) => {
        const index = pageStart + rowIndex;
        const selected = index === this.selectedIndex;
        const row = this.scene.add.text(
          94,
          112 + rowIndex * 34,
          `${selected ? ">" : " "} ${entry.title}`,
          {
            fontSize: "14px",
            color: selected ? "#ffdd66" : "#e3e5eb",
            backgroundColor: selected ? "#252c41" : "#151a27",
            padding: { x: 8, y: 6 },
            fixedWidth: 452,
          },
        ).setInteractive({ useHandCursor: true });
        row.on("pointerover", () => {
          this.selectedIndex = index;
          this.render();
        });
        row.on("pointerdown", () => this.replaySelected());
        container.add(row);
      });
      const page = Math.floor(this.selectedIndex / pageSize) + 1;
      const pageCount = Math.ceil(this.entries.length / pageSize);
      container.add(this.scene.add.text(
        GAME_WIDTH / 2,
        390,
        `Page ${page}/${pageCount}`,
        { fontSize: "11px", color: "#aeb4c2" },
      ).setOrigin(0.5));
    }
    const footer = this.scene.add.text(
      GAME_WIDTH / 2,
      426,
      "Up/Down select  |  Enter/Space replay  |  C/Esc close",
      { fontSize: "11px", color: "#aeb4c2" },
    ).setOrigin(0.5);
    container.add(footer);
    this.container = container;
  }
}

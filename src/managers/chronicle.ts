import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { getChronicleCutscenes } from "../systems/cutscenes";

import type { CutsceneDefinition, CutsceneId } from "../data/cutscenes";
import type { PlayerState } from "../systems/player";
import type { WorldEventLogEntry } from "../systems/worldEvents";
import { createOverlayContainer } from "../utils/ui";
import { layoutTextStack } from "./layout";
import { paginateMeasuredItems } from "../systems/layout";

type ChronicleEntry =
  | {
    kind: "cutscene";
    cutscene: CutsceneDefinition<CutsceneId>;
  }
  | {
    kind: "worldEvent";
    record: WorldEventLogEntry;
  };

export class ChronicleManager {
  private container: Phaser.GameObjects.Container | null = null;
  private entries: readonly ChronicleEntry[] = [];
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
    if (!this.container) return "";
    const selected = this.entries[this.selectedIndex];
    const recordTag = selected?.kind === "worldEvent"
      ? ` [WORLD_EVENT_RECORD:${selected.record.eventId}:${selected.record.outcomeId}]`
      : "";
    return ` [CHRONICLE] [CHRONICLE_SELECTION:${this.selectedIndex + 1}/${this.entries.length}]${recordTag}`;
  }

  open(player: PlayerState): void {
    this.entries = [
      ...getChronicleCutscenes(player.progression).map((cutscene) => ({
        kind: "cutscene" as const,
        cutscene,
      })),
      ...player.progression.worldEvents.log.slice().reverse().map((record) => ({
        kind: "worldEvent" as const,
        record,
      })),
    ];
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
    if (selected?.kind === "cutscene") {
      this.onReplay(selected.cutscene.id);
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
    const panelWidth = 500;
    const panelHeight = 390;
    const panelX = (GAME_WIDTH - panelWidth) / 2;
    const panelY = (GAME_HEIGHT - panelHeight) / 2;
    const container = createOverlayContainer(
      this.scene,
      "chronicle",
      95,
      {
        x: panelX,
        y: panelY,
        width: panelWidth,
        height: panelHeight,
      },
    );
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
      panelWidth,
      panelHeight,
      0x111522,
      0.98,
    ).setStrokeStyle(2, 0xc9a84c);
    const title = this.scene.add.text(GAME_WIDTH / 2, panelY + 20, "Chronicle", {
      fontSize: "25px",
      color: "#ffdd66",
      fontStyle: "bold",
    }).setOrigin(0.5);
    const subtitle = this.scene.add.text(
      GAME_WIDTH / 2,
      panelY + 52,
      "Story memories and resolved World Events",
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
      const rows = this.entries.map((entry, index) => {
        const selected = index === this.selectedIndex;
        const row = this.scene.add.text(
          0,
          0,
          `${selected ? ">" : " "} ${
            entry.kind === "cutscene"
              ? entry.cutscene.title
              : `[Event] ${entry.record.title}`
          }`,
          {
            fontSize: "14px",
            color: selected ? "#ffdd66" : "#e3e5eb",
            backgroundColor: selected ? "#252c41" : "#151a27",
            padding: { x: 8, y: 6 },
            fixedWidth: 452,
            wordWrap: { width: 436, useAdvancedWrap: true },
          },
        ).setInteractive({ useHandCursor: true });
        row.setData(
          "layoutId",
          entry.kind === "cutscene"
            ? `chronicle-cutscene-${entry.cutscene.id}`
            : `chronicle-event-${entry.record.eventId}`,
        );
        row.on("pointerover", () => {
          this.selectedIndex = index;
          this.render();
        });
        row.on("pointerdown", () => {
          this.selectedIndex = index;
          if (entry.kind === "cutscene") this.replaySelected();
          else this.render();
        });
        return row;
      });
      const pages = paginateMeasuredItems(
        rows.map((row) => row.displayHeight),
        155,
        6,
      );
      const pageIndex = Math.max(
        0,
        pages.findIndex((page) => page.includes(this.selectedIndex)),
      );
      const visibleIndexes = new Set(pages[pageIndex] ?? []);
      const visibleRows = rows.filter((_row, index) => visibleIndexes.has(index));
      rows
        .filter((_row, index) => !visibleIndexes.has(index))
        .forEach((row) => row.destroy());
      container.add(visibleRows);
      layoutTextStack(visibleRows, {
        x: 94,
        y: panelY + 80,
        width: 452,
        gap: 6,
        hitAreaPadding: 4,
      });
      container.add(this.scene.add.text(
        GAME_WIDTH / 2,
        390,
        `Page ${pageIndex + 1}/${pages.length}`,
        { fontSize: "11px", color: "#aeb4c2" },
      ).setOrigin(0.5));
      const selectedEntry = this.entries[this.selectedIndex];
      if (selectedEntry?.kind === "worldEvent") {
        const record = selectedEntry.record;
        container.add(this.scene.add.text(
          94,
          320,
          `${record.source} | ${record.location.areaName} `
          + `(${record.location.chunkX},${record.location.chunkY})\n`
          + `${record.period}, ${record.weather} | ${record.outcome}`,
          {
            fontSize: "11px",
            color: "#d7dae2",
            backgroundColor: "#151a27",
            padding: { x: 8, y: 6 },
            fixedWidth: 452,
            wordWrap: { width: 432 },
          },
        ));
      }
    }
    const footer = this.scene.add.text(
      GAME_WIDTH / 2,
      426,
      "Up/Down select | Enter replays story entries | C/Esc close",
      { fontSize: "11px", color: "#aeb4c2" },
    ).setOrigin(0.5);
    container.add(footer);
    this.container = container;
  }
}

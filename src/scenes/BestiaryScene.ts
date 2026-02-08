/**
 * Bestiary scene: browse defeated monsters and their discovered stats.
 */

import Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import type { BestiaryData, BestiaryEntry } from "../systems/bestiary";
import { getBestiaryEntries } from "../systems/bestiary";
import { getItem } from "../data/items";
import type { WeatherState } from "../systems/weather";

export class BestiaryScene extends Phaser.Scene {
  private player!: PlayerState;
  private defeatedBosses!: Set<string>;
  private bestiary!: BestiaryData;
  private entries: BestiaryEntry[] = [];
  private scrollOffset = 0;
  private maxVisible = 0;
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private detailText!: Phaser.GameObjects.Text;
  private selectedIndex = 0;
  private listContainer!: Phaser.GameObjects.Container;
  private weatherState?: WeatherState;
  private totalSteps = 0;

  constructor() {
    super({ key: "BestiaryScene" });
  }

  init(data: {
    player: PlayerState;
    defeatedBosses: Set<string>;
    bestiary: BestiaryData;
    weatherState?: WeatherState;
    totalSteps?: number;
  }): void {
    this.player = data.player;
    this.defeatedBosses = data.defeatedBosses;
    this.bestiary = data.bestiary;
    this.weatherState = data.weatherState;
    this.totalSteps = data.totalSteps ?? 0;
    this.entries = getBestiaryEntries(this.bestiary);
    this.scrollOffset = 0;
    this.selectedIndex = 0;
    this.entryTexts = [];
  }

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(0x0e0e1e);
    this.cameras.main.fadeIn(300);

    // Title
    this.add
      .text(w / 2, 16, "📖 Bestiary", {
        fontSize: "22px",
        fontFamily: "monospace",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    if (this.entries.length === 0) {
      this.add
        .text(w / 2, h / 2, "No monsters encountered yet.\nDefeat monsters to fill your bestiary!", {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#888",
          align: "center",
        })
        .setOrigin(0.5);

      this.addBackButton(w, h);
      return;
    }

    // Left panel: monster list
    const listBg = this.add.graphics();
    listBg.fillStyle(0x181830, 0.95);
    listBg.fillRect(10, 48, w * 0.38, h - 100);
    listBg.lineStyle(1, 0xc0a060, 0.7);
    listBg.strokeRect(10, 48, w * 0.38, h - 100);

    this.add.text(20, 52, "Defeated Monsters", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#c0a060",
    });

    // Calculate max visible entries
    const entryHeight = 26;
    const listTop = 72;
    const listBottom = h - 60;
    this.maxVisible = Math.floor((listBottom - listTop) / entryHeight);

    this.listContainer = this.add.container(20, listTop);
    this.renderMonsterList();

    // Right panel: detail
    const detailBg = this.add.graphics();
    detailBg.fillStyle(0x181830, 0.95);
    detailBg.fillRect(w * 0.4, 48, w * 0.58, h - 100);
    detailBg.lineStyle(1, 0xc0a060, 0.7);
    detailBg.strokeRect(w * 0.4, 48, w * 0.58, h - 100);

    this.detailText = this.add.text(w * 0.4 + 15, 58, "", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#ccc",
      lineSpacing: 6,
      wordWrap: { width: w * 0.55 - 20 },
    });

    this.showDetail(this.entries[0]);

    // Input
    this.setupInput();
    this.addBackButton(w, h);
  }

  private renderMonsterList(): void {
    // Clear existing
    for (const t of this.entryTexts) t.destroy();
    this.entryTexts = [];

    const visibleEntries = this.entries.slice(
      this.scrollOffset,
      this.scrollOffset + this.maxVisible
    );

    visibleEntries.forEach((entry, i) => {
      const globalIndex = this.scrollOffset + i;
      const isSelected = globalIndex === this.selectedIndex;
      const prefix = entry.isBoss ? "☠ " : "  ";
      const color = isSelected ? "#ffd700" : "#aaa";

      const text = this.add
        .text(0, i * 26, `${prefix}${entry.name} (×${entry.timesDefeated})`, {
          fontSize: "12px",
          fontFamily: "monospace",
          color,
        })
        .setInteractive({ useHandCursor: true });

      text.on("pointerover", () => {
        text.setColor("#ffd700");
      });
      text.on("pointerout", () => {
        if (globalIndex !== this.selectedIndex) text.setColor("#aaa");
      });
      text.on("pointerdown", () => {
        this.selectedIndex = globalIndex;
        this.renderMonsterList();
        this.showDetail(entry);
      });

      this.listContainer.add(text);
      this.entryTexts.push(text);
    });
  }

  private showDetail(entry: BestiaryEntry): void {
    const lines: string[] = [];

    // Name with boss indicator
    if (entry.isBoss) {
      lines.push(`☠ ${entry.name} (Boss)`);
    } else {
      lines.push(entry.name);
    }
    lines.push(`Times Defeated: ${entry.timesDefeated}`);
    lines.push("");

    // Stats - always show HP after defeat
    lines.push(`― Stats ―`);
    lines.push(`HP: ${entry.hp}`);

    // AC: only if discovered
    if (entry.acDiscovered) {
      lines.push(`AC: ${entry.ac}`);
    } else {
      lines.push(`AC: ???`);
    }

    lines.push("");

    // Rewards - always shown after first defeat
    lines.push(`― Rewards ―`);
    lines.push(`XP: ${entry.xpReward}`);
    lines.push(`Gold: ${entry.goldReward}`);

    // Items dropped (only ones the player has actually seen)
    if (entry.itemsDropped.length > 0) {
      lines.push("");
      lines.push(`― Known Drops ―`);
      for (const itemId of entry.itemsDropped) {
        const item = getItem(itemId);
        lines.push(`  • ${item ? item.name : itemId}`);
      }
    } else {
      lines.push("");
      lines.push(`― Known Drops ―`);
      lines.push(`  No drops observed yet.`);
    }

    this.detailText.setText(lines.join("\n"));
  }

  private setupInput(): void {
    const upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const bKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);

    upKey.on("down", () => {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        if (this.selectedIndex < this.scrollOffset) {
          this.scrollOffset = this.selectedIndex;
        }
        this.renderMonsterList();
        this.showDetail(this.entries[this.selectedIndex]);
      }
    });

    downKey.on("down", () => {
      if (this.selectedIndex < this.entries.length - 1) {
        this.selectedIndex++;
        if (this.selectedIndex >= this.scrollOffset + this.maxVisible) {
          this.scrollOffset = this.selectedIndex - this.maxVisible + 1;
        }
        this.renderMonsterList();
        this.showDetail(this.entries[this.selectedIndex]);
      }
    });

    escKey.on("down", () => this.goBack());
    bKey.on("down", () => this.goBack());
  }

  private addBackButton(w: number, h: number): void {
    const btnContainer = this.add.container(w / 2, h - 30);
    const bg = this.add
      .image(0, 0, "button")
      .setDisplaySize(160, 32)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 0, "← Back (B/ESC)", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ddd",
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => {
      bg.setTexture("buttonHover");
      label.setColor("#ffd700");
    });
    bg.on("pointerout", () => {
      bg.setTexture("button");
      label.setColor("#ddd");
    });
    bg.on("pointerdown", () => this.goBack());

    btnContainer.add([bg, label]);
  }

  private goBack(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start("OverworldScene", {
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
        weatherState: this.weatherState,
        totalSteps: this.totalSteps,
      });
    });
  }
}

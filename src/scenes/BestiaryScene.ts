/**
 * Bestiary scene: browse ALL monsters, showing "???" for undiscovered ones.
 * Entries are ordered by their position in ALL_MONSTERS (area / difficulty).
 * Supports paged browsing with W/S to navigate, A/D to change pages.
 */

import Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import type { BestiaryData, BestiaryEntry } from "../systems/bestiary";
import { getItem } from "../data/items";
import { ALL_MONSTERS, type Monster } from "../data/monsters";
import { type WeatherState, createWeatherState } from "../systems/weather";
import type { SavedSpecialNpc } from "../data/npcs";

/** How many monster entries to show per page. */
const ENTRIES_PER_PAGE = 8;

export class BestiaryScene extends Phaser.Scene {
  private player!: PlayerState;
  private defeatedBosses!: Set<string>;
  private bestiary!: BestiaryData;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();
  private savedSpecialNpcs: SavedSpecialNpc[] = [];

  /** Ordered master list of all monsters (same reference as ALL_MONSTERS). */
  private allMonsters: Monster[] = [];
  /** Current page index (0-based). */
  private currentPage = 0;
  /** Selected entry index within the current page. */
  private selectedOnPage = 0;

  private listContainer!: Phaser.GameObjects.Container;
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private detailText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private prevBtn!: Phaser.GameObjects.Text;
  private nextBtn!: Phaser.GameObjects.Text;
  private discoveredLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "BestiaryScene" });
  }

  init(data: {
    player: PlayerState;
    defeatedBosses: Set<string>;
    bestiary: BestiaryData;
    timeStep?: number;
    weatherState?: WeatherState;
    savedSpecialNpcs?: SavedSpecialNpc[];
  }): void {
    this.player = data.player;
    this.defeatedBosses = data.defeatedBosses;
    this.bestiary = data.bestiary;
    this.timeStep = data.timeStep ?? 0;
    this.weatherState = data.weatherState ?? createWeatherState();
    this.savedSpecialNpcs = data.savedSpecialNpcs ?? [];
    this.allMonsters = ALL_MONSTERS;
    this.currentPage = 0;
    this.selectedOnPage = 0;
    this.entryTexts = [];
  }

  /** Total number of pages. */
  private get totalPages(): number {
    return Math.max(1, Math.ceil(this.allMonsters.length / ENTRIES_PER_PAGE));
  }

  /** Number of discovered (defeated) monsters. */
  private get discoveredCount(): number {
    return this.allMonsters.filter((m) => m.id in this.bestiary.entries).length;
  }

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(0x0e0e1e);
    this.cameras.main.fadeIn(300);

    // Title
    this.add
      .text(w / 2, 12, "📖 Bestiary", {
        fontSize: "22px",
        fontFamily: "monospace",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    // Discovered counter
    this.discoveredLabel = this.add
      .text(w / 2, 38, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#888",
      })
      .setOrigin(0.5, 0);
    this.updateDiscoveredLabel();

    // Left panel: monster list
    const listBg = this.add.graphics();
    listBg.fillStyle(0x181830, 0.95);
    listBg.fillRect(10, 54, w * 0.38, h - 106);
    listBg.lineStyle(1, 0xc0a060, 0.7);
    listBg.strokeRect(10, 54, w * 0.38, h - 106);

    this.listContainer = this.add.container(20, 62);

    // Page navigation: clickable ◄ / ► arrows + page number
    const pageCx = 10 + (w * 0.38) / 2;
    const pageY = h - 48;

    this.prevBtn = this.add
      .text(pageCx - 60, pageY, "◄ A", {
        fontSize: "16px", fontFamily: "monospace", color: "#c0a060",
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    this.prevBtn.on("pointerover", () => this.prevBtn.setColor("#ffd700"));
    this.prevBtn.on("pointerout", () => this.prevBtn.setColor("#c0a060"));
    this.prevBtn.on("pointerdown", () => this.goToPrevPage());

    this.pageText = this.add
      .text(pageCx, pageY, "", {
        fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    this.nextBtn = this.add
      .text(pageCx + 60, pageY, "D ►", {
        fontSize: "16px", fontFamily: "monospace", color: "#c0a060",
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    this.nextBtn.on("pointerover", () => this.nextBtn.setColor("#ffd700"));
    this.nextBtn.on("pointerout", () => this.nextBtn.setColor("#c0a060"));
    this.nextBtn.on("pointerdown", () => this.goToNextPage());

    // Right panel: detail
    const detailBg = this.add.graphics();
    detailBg.fillStyle(0x181830, 0.95);
    detailBg.fillRect(w * 0.4, 54, w * 0.58, h - 106);
    detailBg.lineStyle(1, 0xc0a060, 0.7);
    detailBg.strokeRect(w * 0.4, 54, w * 0.58, h - 106);

    this.detailText = this.add.text(w * 0.4 + 15, 64, "", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#ccc",
      lineSpacing: 6,
      wordWrap: { width: w * 0.55 - 20 },
    });

    this.renderPage();
    this.setupInput();
    this.addBackButton(w, h);
  }

  private updateDiscoveredLabel(): void {
    this.discoveredLabel.setText(
      `Discovered: ${this.discoveredCount} / ${this.allMonsters.length}`
    );
  }

  /** Get the monsters on the current page. */
  private pageMonsters(): Monster[] {
    const start = this.currentPage * ENTRIES_PER_PAGE;
    return this.allMonsters.slice(start, start + ENTRIES_PER_PAGE);
  }

  /** Render the left-side list for the current page and update detail. */
  private renderPage(): void {
    // Clear existing entries
    for (const t of this.entryTexts) t.destroy();
    this.entryTexts = [];

    const monsters = this.pageMonsters();

    monsters.forEach((monster, i) => {
      const discovered = monster.id in this.bestiary.entries;
      const isSelected = i === this.selectedOnPage;
      const bossPrefix = monster.isBoss ? "☠ " : "  ";
      let label: string;
      let baseColor: string;

      if (discovered) {
        const entry = this.bestiary.entries[monster.id];
        label = `${bossPrefix}${monster.name} (×${entry.timesDefeated})`;
        baseColor = isSelected ? "#ffd700" : "#aaa";
      } else {
        label = `${bossPrefix}???`;
        baseColor = isSelected ? "#ffd700" : "#555";
      }

      const text = this.add
        .text(0, i * 26, label, {
          fontSize: "12px",
          fontFamily: "monospace",
          color: baseColor,
        })
        .setInteractive({ useHandCursor: true });

      text.on("pointerover", () => text.setColor("#ffd700"));
      text.on("pointerout", () => {
        if (i !== this.selectedOnPage) text.setColor(baseColor);
      });
      text.on("pointerdown", () => {
        this.selectedOnPage = i;
        this.renderPage();
      });

      this.listContainer.add(text);
      this.entryTexts.push(text);
    });

    // Update page indicator and arrow visibility
    this.pageText.setText(`Page ${this.currentPage + 1}/${this.totalPages}`);
    this.prevBtn.setVisible(this.currentPage > 0);
    this.nextBtn.setVisible(this.currentPage < this.totalPages - 1);

    // Show detail for selected monster
    const selected = monsters[this.selectedOnPage];
    if (selected) {
      this.showDetail(selected);
    } else {
      this.detailText.setText("");
    }
  }

  /** Show detail panel for a monster (full info if discovered, ??? otherwise). */
  private showDetail(monster: Monster): void {
    const discovered = monster.id in this.bestiary.entries;

    if (!discovered) {
      this.detailText.setText(
        "???\n\nThis monster has not been encountered yet.\nDefeat it to reveal its stats!"
      );
      return;
    }

    const entry: BestiaryEntry = this.bestiary.entries[monster.id];
    const lines: string[] = [];

    if (entry.isBoss) {
      lines.push(`☠ ${entry.name} (Boss)`);
    } else {
      lines.push(entry.name);
    }
    lines.push(`Times Defeated: ${entry.timesDefeated}`);
    lines.push("");

    lines.push(`― Stats ―`);
    lines.push(`HP: ${entry.hp}`);
    lines.push(entry.acDiscovered ? `AC: ${entry.ac}` : `AC: ???`);
    lines.push("");

    lines.push(`― Rewards ―`);
    lines.push(`XP: ${entry.xpReward}`);
    lines.push(`Gold: ${entry.goldReward}`);

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

  private goToPrevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.selectedOnPage = 0;
      this.renderPage();
    }
  }

  private goToNextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.selectedOnPage = 0;
      this.renderPage();
    }
  }

  private setupInput(): void {
    const upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    const leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const bKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);

    upKey.on("down", () => {
      if (this.selectedOnPage > 0) {
        this.selectedOnPage--;
        this.renderPage();
      }
    });

    downKey.on("down", () => {
      if (this.selectedOnPage < this.pageMonsters().length - 1) {
        this.selectedOnPage++;
        this.renderPage();
      }
    });

    leftKey.on("down", () => this.goToPrevPage());
    rightKey.on("down", () => this.goToNextPage());

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
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.savedSpecialNpcs,
      });
    });
  }
}

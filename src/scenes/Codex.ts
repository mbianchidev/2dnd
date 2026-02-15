/**
 * Bestiary scene: browse ALL monsters, weapons, armor, and items.
 * Shows "???" for undiscovered entries. Supports category tabs and paged lists.
 * Navigation: W/S to select, A/D or clickable arrows to change pages,
 * 1-4 or click tabs to switch categories.
 */

import Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import type { CodexData, CodexEntry } from "../systems/codex";
import { getItem, ITEMS, type Item } from "../data/items";
import { ALL_MONSTERS, type Monster } from "../data/monsters";
import { type WeatherState, createWeatherState } from "../systems/weather";
import type { SavedSpecialNpc } from "../data/npcs";
import { elementDisplayName } from "../data/elements";

/** How many entries to show per page. */
const ENTRIES_PER_PAGE = 8;

/** The four category tabs. */
type BestiaryCategory = "monsters" | "weapons" | "armor" | "items";

/** All weapons in the game (ordered by ITEMS array position). */
const ALL_WEAPONS: Item[] = ITEMS.filter((i) => i.type === "weapon");
/** All armor + shields in the game. */
const ALL_ARMOR: Item[] = ITEMS.filter((i) => i.type === "armor" || i.type === "shield");
/** All consumable / key / mount items. */
const ALL_ITEMS: Item[] = ITEMS.filter((i) => i.type === "consumable" || i.type === "key" || i.type === "mount");

export class CodexScene extends Phaser.Scene {
  private player!: PlayerState;
  private defeatedBosses!: Set<string>;
  private codex!: CodexData;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();
  private savedSpecialNpcs: SavedSpecialNpc[] = [];

  private category: BestiaryCategory = "monsters";
  private currentPage = 0;
  private selectedOnPage = 0;

  private listContainer!: Phaser.GameObjects.Container;
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private detailText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private prevBtn!: Phaser.GameObjects.Text;
  private nextBtn!: Phaser.GameObjects.Text;
  private discoveredLabel!: Phaser.GameObjects.Text;
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private tabUnderline!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: "CodexScene" });
  }

  init(data: {
    player: PlayerState;
    defeatedBosses: Set<string>;
    codex: CodexData;
    timeStep?: number;
    weatherState?: WeatherState;
    savedSpecialNpcs?: SavedSpecialNpc[];
  }): void {
    this.player = data.player;
    this.defeatedBosses = data.defeatedBosses;
    this.codex = data.codex;
    this.timeStep = data.timeStep ?? 0;
    this.weatherState = data.weatherState ?? createWeatherState();
    this.savedSpecialNpcs = data.savedSpecialNpcs ?? [];
    this.category = "monsters";
    this.currentPage = 0;
    this.selectedOnPage = 0;
    this.entryTexts = [];
    this.tabTexts = [];
  }

  // ── Helpers ──────────────────────────────────────────────────

  /** Get the master list for the active category. */
  private get masterList(): (Monster | Item)[] {
    switch (this.category) {
      case "monsters": return ALL_MONSTERS;
      case "weapons": return ALL_WEAPONS;
      case "armor": return ALL_ARMOR;
      case "items": return ALL_ITEMS;
    }
  }

  private get totalPages(): number {
    return Math.max(1, Math.ceil(this.masterList.length / ENTRIES_PER_PAGE));
  }

  /** Whether the player has "discovered" an entry. Monsters = defeated; items = ever owned. */
  private isDiscovered(entry: Monster | Item): boolean {
    if (this.category === "monsters") {
      return (entry as Monster).id in this.codex.entries;
    }
    const itemId = (entry as Item).id;
    const p = this.player;
    if (p.inventory.some((i) => i.id === itemId)) return true;
    if (p.equippedWeapon?.id === itemId) return true;
    if (p.equippedArmor?.id === itemId) return true;
    if (p.equippedShield?.id === itemId) return true;
    return false;
  }

  private discoveredCountForCategory(): number {
    return this.masterList.filter((e) => this.isDiscovered(e)).length;
  }

  // ── Create ───────────────────────────────────────────────────

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(0x0e0e1e);
    this.cameras.main.fadeIn(300);

    // Title
    this.add
      .text(w / 2, 8, "📖 Codex", {
        fontSize: "20px", fontFamily: "monospace", color: "#ffd700",
        stroke: "#000", strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    // Category tabs
    const tabLabels: { label: string; cat: BestiaryCategory }[] = [
      { label: "Monsters", cat: "monsters" },
      { label: "Weapons", cat: "weapons" },
      { label: "Armor", cat: "armor" },
      { label: "Items", cat: "items" },
    ];
    const tabY = 30;
    const tabSpacing = w / (tabLabels.length + 1);
    this.tabUnderline = this.add.graphics();
    for (let t = 0; t < tabLabels.length; t++) {
      const tx = tabSpacing * (t + 1);
      const isActive = this.category === tabLabels[t].cat;
      const tab = this.add
        .text(tx, tabY, tabLabels[t].label, {
          fontSize: "11px", fontFamily: "monospace",
          color: isActive ? "#ffd700" : "#888",
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      const cat = tabLabels[t].cat;
      tab.on("pointerdown", () => this.switchCategory(cat));
      this.tabTexts.push(tab);
      if (isActive) {
        this.tabUnderline.lineStyle(2, 0xffd700, 1);
        this.tabUnderline.lineBetween(tx - 30, tabY + 14, tx + 30, tabY + 14);
      }
    }

    // Discovered counter
    this.discoveredLabel = this.add
      .text(w / 2, 48, "", { fontSize: "10px", fontFamily: "monospace", color: "#888" })
      .setOrigin(0.5, 0);

    // Left panel
    const listBg = this.add.graphics();
    listBg.fillStyle(0x181830, 0.95);
    listBg.fillRect(10, 62, w * 0.38, h - 114);
    listBg.lineStyle(1, 0xc0a060, 0.7);
    listBg.strokeRect(10, 62, w * 0.38, h - 114);

    this.listContainer = this.add.container(20, 68);

    // Page nav
    const pageCx = 10 + (w * 0.38) / 2;
    const pageY = h - 48;

    this.prevBtn = this.add
      .text(pageCx - 60, pageY, "◄ A", {
        fontSize: "16px", fontFamily: "monospace", color: "#c0a060",
      })
      .setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.prevBtn.on("pointerover", () => this.prevBtn.setColor("#ffd700"));
    this.prevBtn.on("pointerout", () => this.prevBtn.setColor("#c0a060"));
    this.prevBtn.on("pointerdown", () => this.goToPrevPage());

    this.pageText = this.add
      .text(pageCx, pageY, "", { fontSize: "11px", fontFamily: "monospace", color: "#c0a060" })
      .setOrigin(0.5, 0);

    this.nextBtn = this.add
      .text(pageCx + 60, pageY, "D ►", {
        fontSize: "16px", fontFamily: "monospace", color: "#c0a060",
      })
      .setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.nextBtn.on("pointerover", () => this.nextBtn.setColor("#ffd700"));
    this.nextBtn.on("pointerout", () => this.nextBtn.setColor("#c0a060"));
    this.nextBtn.on("pointerdown", () => this.goToNextPage());

    // Right panel
    const detailBg = this.add.graphics();
    detailBg.fillStyle(0x181830, 0.95);
    detailBg.fillRect(w * 0.4, 62, w * 0.58, h - 114);
    detailBg.lineStyle(1, 0xc0a060, 0.7);
    detailBg.strokeRect(w * 0.4, 62, w * 0.58, h - 114);

    this.detailText = this.add.text(w * 0.4 + 15, 70, "", {
      fontSize: "13px", fontFamily: "monospace", color: "#ccc",
      lineSpacing: 6, wordWrap: { width: w * 0.55 - 20 },
    });

    this.renderPage();
    this.setupInput();
    this.addBackButton(w, h);
  }

  // ── Category switching ───────────────────────────────────────

  private switchCategory(cat: BestiaryCategory): void {
    if (this.category === cat) return;
    this.category = cat;
    this.currentPage = 0;
    this.selectedOnPage = 0;
    const cats: BestiaryCategory[] = ["monsters", "weapons", "armor", "items"];
    for (let i = 0; i < this.tabTexts.length; i++) {
      this.tabTexts[i].setColor(cats[i] === cat ? "#ffd700" : "#888");
    }
    this.tabUnderline.clear();
    const w = this.cameras.main.width;
    const tabSpacing = w / (cats.length + 1);
    const idx = cats.indexOf(cat);
    const tx = tabSpacing * (idx + 1);
    this.tabUnderline.lineStyle(2, 0xffd700, 1);
    this.tabUnderline.lineBetween(tx - 30, 30 + 14, tx + 30, 30 + 14);
    this.renderPage();
  }

  // ── Page rendering ───────────────────────────────────────────

  private pageEntries(): (Monster | Item)[] {
    const start = this.currentPage * ENTRIES_PER_PAGE;
    return this.masterList.slice(start, start + ENTRIES_PER_PAGE);
  }

  private renderPage(): void {
    for (const t of this.entryTexts) t.destroy();
    this.entryTexts = [];

    this.discoveredLabel.setText(
      `Discovered: ${this.discoveredCountForCategory()} / ${this.masterList.length}`
    );

    const entries = this.pageEntries();

    entries.forEach((entry, i) => {
      const discovered = this.isDiscovered(entry);
      const isSelected = i === this.selectedOnPage;
      let label: string;
      let baseColor: string;

      if (this.category === "monsters") {
        const m = entry as Monster;
        const bossPrefix = m.isBoss ? "☠ " : "  ";
        if (discovered) {
          const be = this.codex.entries[m.id];
          label = `${bossPrefix}${m.name} (×${be.timesDefeated})`;
          baseColor = isSelected ? "#ffd700" : "#aaa";
        } else {
          label = `${bossPrefix}???`;
          baseColor = isSelected ? "#ffd700" : "#555";
        }
      } else {
        const item = entry as Item;
        if (discovered) {
          label = `  ${item.name}`;
          baseColor = isSelected ? "#ffd700" : "#aaa";
        } else {
          label = `  ???`;
          baseColor = isSelected ? "#ffd700" : "#555";
        }
      }

      const text = this.add
        .text(0, i * 26, label, { fontSize: "12px", fontFamily: "monospace", color: baseColor })
        .setInteractive({ useHandCursor: true });
      text.on("pointerover", () => text.setColor("#ffd700"));
      text.on("pointerout", () => { if (i !== this.selectedOnPage) text.setColor(baseColor); });
      text.on("pointerdown", () => { this.selectedOnPage = i; this.renderPage(); });

      this.listContainer.add(text);
      this.entryTexts.push(text);
    });

    this.pageText.setText(`Page ${this.currentPage + 1}/${this.totalPages}`);
    this.prevBtn.setVisible(this.currentPage > 0);
    this.nextBtn.setVisible(this.currentPage < this.totalPages - 1);

    const selected = entries[this.selectedOnPage];
    if (selected) {
      this.showDetail(selected);
    } else {
      this.detailText.setText("");
    }
  }

  // ── Detail panel ─────────────────────────────────────────────

  private showDetail(entry: Monster | Item): void {
    if (!this.isDiscovered(entry)) {
      this.detailText.setText("???\n\nNot yet discovered.\nFind this in the world to reveal details!");
      return;
    }
    if (this.category === "monsters") {
      this.showMonsterDetail(entry as Monster);
    } else {
      this.showItemDetail(entry as Item);
    }
  }

  private showMonsterDetail(monster: Monster): void {
    const entry: CodexEntry = this.codex.entries[monster.id];
    const lines: string[] = [];
    lines.push(entry.isBoss ? `☠ ${entry.name} (Boss)` : entry.name);
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
    // Elemental information (progressively discovered)
    const discovered = entry.discoveredElements ?? [];
    const profile = monster.elementalProfile;
    if (discovered.length > 0 && profile) {
      lines.push("");
      lines.push(`― Elemental Info ―`);
      for (const elem of discovered) {
        const name = elementDisplayName(elem);
        if (profile.immunities?.includes(elem)) {
          lines.push(`  ✦ Immune to ${name}`);
        } else if (profile.weaknesses?.includes(elem)) {
          lines.push(`  ▼ Weak to ${name}`);
        } else if (profile.resistances?.includes(elem)) {
          lines.push(`  ▲ Resists ${name}`);
        }
      }
    } else if (profile) {
      lines.push("");
      lines.push(`― Elemental Info ―`);
      lines.push(`  Not yet discovered.`);
    }
    this.detailText.setText(lines.join("\n"));
  }

  private showItemDetail(item: Item): void {
    const lines: string[] = [];
    lines.push(item.name);
    lines.push(`Type: ${item.type}`);
    lines.push("");
    lines.push(item.description);
    if (item.effect > 0) {
      const effectLabel = item.type === "weapon" ? "Damage bonus" :
        (item.type === "armor" || item.type === "shield") ? "AC bonus" :
        item.type === "consumable" ? "Effect" : "Value";
      lines.push(`${effectLabel}: +${item.effect}`);
    }
    if (item.cost > 0) lines.push(`Shop price: ${item.cost} gold`);
    if (item.twoHanded) lines.push(`(Two-handed)`);
    if (item.levelReq) lines.push(`Requires level ${item.levelReq}`);
    if (item.element) lines.push(`Element: ${elementDisplayName(item.element)}`);
    this.detailText.setText(lines.join("\n"));
  }

  // ── Navigation ───────────────────────────────────────────────

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
      if (this.selectedOnPage > 0) { this.selectedOnPage--; this.renderPage(); }
    });
    downKey.on("down", () => {
      if (this.selectedOnPage < this.pageEntries().length - 1) { this.selectedOnPage++; this.renderPage(); }
    });
    leftKey.on("down", () => this.goToPrevPage());
    rightKey.on("down", () => this.goToNextPage());
    escKey.on("down", () => this.goBack());
    bKey.on("down", () => this.goBack());

    // Number keys 1-4 to switch category tabs
    const cats: BestiaryCategory[] = ["monsters", "weapons", "armor", "items"];
    for (let k = 1; k <= 4; k++) {
      const key = this.input.keyboard!.addKey(48 + k);
      const cat = cats[k - 1];
      key.on("down", () => this.switchCategory(cat));
    }
  }

  private addBackButton(w: number, h: number): void {
    const btnContainer = this.add.container(w / 2, h - 30);
    const bg = this.add
      .image(0, 0, "button")
      .setDisplaySize(160, 32)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 0, "← Back (B/ESC)", {
        fontSize: "13px", fontFamily: "monospace", color: "#ddd",
      })
      .setOrigin(0.5);
    bg.on("pointerover", () => { bg.setTexture("buttonHover"); label.setColor("#ffd700"); });
    bg.on("pointerout", () => { bg.setTexture("button"); label.setColor("#ddd"); });
    bg.on("pointerdown", () => this.goBack());
    btnContainer.add([bg, label]);
  }

  private goBack(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start("OverworldScene", {
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.savedSpecialNpcs,
      });
    });
  }
}

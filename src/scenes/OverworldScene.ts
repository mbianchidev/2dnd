/**
 * Overworld scene: tile-based map with WASD movement and encounters.
 */

import Phaser from "phaser";
import {
  MAP_DATA,
  MAP_WIDTH,
  MAP_HEIGHT,
  TOWNS,
  BOSSES,
  ENCOUNTER_RATES,
  Terrain,
  isWalkable,
  getTerrainAt,
} from "../data/map";
import { getRandomEncounter, getBoss } from "../data/monsters";
import { createPlayer, getArmorClass, awardXP, xpForLevel, type PlayerState } from "../systems/player";
import { abilityModifier } from "../utils/dice";
import { isDebug, debugLog, debugPanelLog, debugPanelState, debugPanelClear } from "../config";
import type { BestiaryData } from "../systems/bestiary";
import { createBestiary } from "../systems/bestiary";

const TILE_SIZE = 32;

export class OverworldScene extends Phaser.Scene {
  private player!: PlayerState;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private isMoving = false;
  private moveDelay = 150; // ms between moves
  private lastMoveTime = 0;
  private hudText!: Phaser.GameObjects.Text;
  private locationText!: Phaser.GameObjects.Text;
  private tileSprites: Phaser.GameObjects.Sprite[][] = [];
  private defeatedBosses: Set<string> = new Set();
  private bestiary: BestiaryData = createBestiary();
  private equipOverlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data?: { player?: PlayerState; defeatedBosses?: Set<string>; bestiary?: BestiaryData }): void {
    if (data?.player) {
      this.player = data.player;
    } else {
      this.player = createPlayer("Hero");
    }
    if (data?.defeatedBosses) {
      this.defeatedBosses = data.defeatedBosses;
    }
    if (data?.bestiary) {
      this.bestiary = data.bestiary;
    }
    // Reset movement state — a tween may have been orphaned when the scene
    // switched to battle mid-move, leaving isMoving permanently true.
    this.isMoving = false;
    this.lastMoveTime = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111111);
    this.cameras.main.fadeIn(500);

    this.renderMap();
    this.createPlayer();
    this.setupInput();
    this.createHUD();
    this.setupDebug();
    this.updateLocationText();
  }

  private setupDebug(): void {
    debugPanelClear();
    debugPanelState("OVERWORLD | Loading...");

    // Cheat keys (only work when debug is on)
    const gKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    const lKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    const hKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    gKey.on("down", () => {
      if (!isDebug()) return;
      this.player.gold += 100;
      debugLog("CHEAT: +100 gold", { total: this.player.gold });
      debugPanelLog(`[CHEAT] +100 gold (total: ${this.player.gold})`, true);
      this.updateHUD();
    });

    lKey.on("down", () => {
      if (!isDebug()) return;
      const needed = xpForLevel(this.player.level + 1) - this.player.xp;
      const xpResult = awardXP(this.player, Math.max(needed, 0));
      debugLog("CHEAT: Level up", { newLevel: xpResult.newLevel });
      debugPanelLog(`[CHEAT] Level up! Now Lv.${xpResult.newLevel}`, true);
      for (const spell of xpResult.newSpells) {
        debugPanelLog(`[CHEAT] Learned ${spell.name}!`, true);
      }
      this.updateHUD();
    });

    hKey.on("down", () => {
      if (!isDebug()) return;
      this.player.hp = this.player.maxHp;
      debugLog("CHEAT: Full heal");
      debugPanelLog(`[CHEAT] HP restored to ${this.player.maxHp}!`, true);
      this.updateHUD();
    });

    mKey.on("down", () => {
      if (!isDebug()) return;
      this.player.mp = this.player.maxMp;
      debugLog("CHEAT: Restore MP");
      debugPanelLog(`[CHEAT] MP restored to ${this.player.maxMp}!`, true);
      this.updateHUD();
    });
  }

  private renderMap(): void {
    this.tileSprites = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const terrain = MAP_DATA[y][x];
        const sprite = this.add.sprite(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          `tile_${terrain}`
        );
        this.tileSprites[y][x] = sprite;
      }
    }

    // Add town labels
    for (const town of TOWNS) {
      this.add
        .text(town.x * TILE_SIZE + TILE_SIZE / 2, town.y * TILE_SIZE - 4, town.name, {
          fontSize: "9px",
          fontFamily: "monospace",
          color: "#fff",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 1);
    }

    // Add boss markers (if not defeated)
    for (const boss of BOSSES) {
      if (!this.defeatedBosses.has(boss.monsterId)) {
        this.add
          .text(
            boss.x * TILE_SIZE + TILE_SIZE / 2,
            boss.y * TILE_SIZE - 4,
            "☠ " + boss.name,
            {
              fontSize: "8px",
              fontFamily: "monospace",
              color: "#ff4444",
              stroke: "#000",
              strokeThickness: 2,
            }
          )
          .setOrigin(0.5, 1);
      }
    }
  }

  private createPlayer(): void {
    this.playerSprite = this.add.sprite(
      this.player.x * TILE_SIZE + TILE_SIZE / 2,
      this.player.y * TILE_SIZE + TILE_SIZE / 2,
      "player"
    );
    this.playerSprite.setDepth(10);
  }

  private setupInput(): void {
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    // B key opens bestiary
    const bKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    bKey.on("down", () => this.openBestiary());

    // E key toggles equipment overlay
    const eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    eKey.on("down", () => this.toggleEquipOverlay());
  }

  private createHUD(): void {
    // HUD background
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x1a1a2e, 0.9);
    hudBg.fillRect(0, MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 80);
    hudBg.lineStyle(2, 0xc0a060, 1);
    hudBg.strokeRect(0, MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 80);
    hudBg.setDepth(20);

    this.hudText = this.add
      .text(10, MAP_HEIGHT * TILE_SIZE + 8, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ddd",
        lineSpacing: 4,
      })
      .setDepth(21);

    this.locationText = this.add
      .text(MAP_WIDTH * TILE_SIZE - 10, MAP_HEIGHT * TILE_SIZE + 8, "", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#aaa",
        align: "right",
        lineSpacing: 4,
      })
      .setOrigin(1, 0)
      .setDepth(21);

    this.updateHUD();
  }

  private updateHUD(): void {
    const p = this.player;
    this.hudText.setText(
      `${p.name} Lv.${p.level}\n` +
        `HP: ${p.hp}/${p.maxHp}  MP: ${p.mp}/${p.maxMp}\n` +
        `Gold: ${p.gold}  XP: ${p.xp}/${(p.level + 1) * (p.level + 1) * 100}  [B] Bestiary [E] Equip`
    );
  }

  private updateLocationText(): void {
    const terrain = getTerrainAt(this.player.x, this.player.y);
    const terrainNames: Record<number, string> = {
      [Terrain.Grass]: "Grassland",
      [Terrain.Forest]: "Forest",
      [Terrain.Mountain]: "Mountain",
      [Terrain.Water]: "Water",
      [Terrain.Sand]: "Desert",
      [Terrain.Town]: "Town",
      [Terrain.Dungeon]: "Dungeon",
      [Terrain.Boss]: "Boss Lair",
      [Terrain.Path]: "Road",
    };

    const town = TOWNS.find(
      (t) => t.x === this.player.x && t.y === this.player.y
    );
    const boss = BOSSES.find(
      (b) => b.x === this.player.x && b.y === this.player.y
    );

    let locStr = terrainNames[terrain ?? 0] ?? "Unknown";
    if (town) locStr = `${town.name}\n[SPACE] Enter Shop`;
    if (boss && !this.defeatedBosses.has(boss.monsterId))
      locStr = `${boss.name}'s Lair\n[SPACE] Challenge Boss`;

    this.locationText.setText(locStr);
  }

  private updateDebugPanel(): void {
    const p = this.player;
    const terrain = getTerrainAt(p.x, p.y);
    const terrainNames: Record<number, string> = {
      [Terrain.Grass]: "Grass",
      [Terrain.Forest]: "Forest",
      [Terrain.Mountain]: "Mountain",
      [Terrain.Water]: "Water",
      [Terrain.Sand]: "Sand",
      [Terrain.Town]: "Town",
      [Terrain.Dungeon]: "Dungeon",
      [Terrain.Boss]: "Boss",
      [Terrain.Path]: "Path",
    };
    const tName = terrainNames[terrain ?? 0] ?? "?";
    const rate = terrain !== undefined ? (ENCOUNTER_RATES[terrain] ?? 0) : 0;
    debugPanelState(
      `OVERWORLD | Pos: (${p.x},${p.y}) ${tName} | ` +
      `Enc: ${(rate * 100).toFixed(0)}% | ` +
      `HP ${p.hp}/${p.maxHp} MP ${p.mp}/${p.maxMp} | ` +
      `Lv.${p.level} XP ${p.xp} Gold ${p.gold} | ` +
      `Bosses: ${this.defeatedBosses.size}\n` +
      `Cheats: G=+100Gold H=Heal M=MP L=LvUp`
    );
  }

  update(time: number): void {
    this.updateDebugPanel();
    if (this.isMoving) return;
    if (time - this.lastMoveTime < this.moveDelay) return;

    let dx = 0;
    let dy = 0;

    if (this.keys.W.isDown) dy = -1;
    else if (this.keys.S.isDown) dy = 1;
    else if (this.keys.A.isDown) dx = -1;
    else if (this.keys.D.isDown) dx = 1;

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy, time);
    }

    // Space for actions (enter town/shop or challenge boss)
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.handleAction();
    }
  }

  private tryMove(dx: number, dy: number, time: number): void {
    const newX = this.player.x + dx;
    const newY = this.player.y + dy;

    const terrain = getTerrainAt(newX, newY);
    if (terrain === undefined || !isWalkable(terrain)) {
      debugLog("Blocked move", { to: { x: newX, y: newY }, terrain });
      return;
    }

    this.lastMoveTime = time;
    this.isMoving = true;
    this.player.x = newX;
    this.player.y = newY;

    this.tweens.add({
      targets: this.playerSprite,
      x: newX * TILE_SIZE + TILE_SIZE / 2,
      y: newY * TILE_SIZE + TILE_SIZE / 2,
      duration: 120,
      onComplete: () => {
        this.isMoving = false;
        this.updateHUD();
        this.updateLocationText();
        this.checkEncounter(terrain);
      },
    });
  }

  private checkEncounter(terrain: Terrain): void {
    // Boss tile: handled by SPACE action, not random
    if (terrain === Terrain.Boss) return;
    if (terrain === Terrain.Town) return;

    const rate = ENCOUNTER_RATES[terrain];
    if (Math.random() < rate) {
      const monster = getRandomEncounter(this.player.level);
      debugLog("Encounter!", { terrain: Terrain[terrain], rate, monster: monster.name });
      this.startBattle(monster);
    }
  }

  private handleAction(): void {
    // Check if on a town
    const town = TOWNS.find(
      (t) => t.x === this.player.x && t.y === this.player.y
    );
    if (town?.hasShop) {
      this.scene.start("ShopScene", {
        player: this.player,
        townName: town.name,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
      });
      return;
    }

    // Check if on a boss tile
    const boss = BOSSES.find(
      (b) => b.x === this.player.x && b.y === this.player.y
    );
    if (boss && !this.defeatedBosses.has(boss.monsterId)) {
      const monster = getBoss(boss.monsterId);
      if (monster) {
        this.startBattle(monster);
      }
    }
  }

  private startBattle(monster: ReturnType<typeof getRandomEncounter>): void {
    this.cameras.main.flash(300, 255, 255, 255);
    this.time.delayedCall(300, () => {
      this.scene.start("BattleScene", {
        player: this.player,
        monster,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
      });
    });
  }

  private openBestiary(): void {
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
    }
    this.scene.start("BestiaryScene", {
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      bestiary: this.bestiary,
    });
  }

  private toggleEquipOverlay(): void {
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
      return;
    }

    this.buildEquipOverlay();
  }

  private buildEquipOverlay(): void {
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
    }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelW = 280;
    const panelH = 360;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 20;

    this.equipOverlay = this.add.container(0, 0).setDepth(50);

    // Dim background
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.5);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.toggleEquipOverlay());
    this.equipOverlay.add(dim);

    // Panel background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.equipOverlay.add(bg);

    // Title
    const title = this.add.text(px + panelW / 2, py + 10, "⚔ Equipment", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.equipOverlay.add(title);

    const p = this.player;
    const ac = getArmorClass(p);
    let cy = py + 34;

    // --- Header stats ---
    const header = this.add.text(px + 14, cy, [
      `${p.name}  Lv.${p.level}`,
      `HP: ${p.hp}/${p.maxHp}   MP: ${p.mp}/${p.maxMp}   AC: ${ac}`,
    ].join("\n"), {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#ccc",
      lineSpacing: 4,
    });
    this.equipOverlay.add(header);
    cy += 38;

    // --- Weapon slot ---
    const weaponLabel = this.add.text(px + 14, cy, "Weapon:", {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay.add(weaponLabel);
    cy += 16;

    const ownedWeapons = p.inventory.filter((i) => i.type === "weapon");
    if (ownedWeapons.length === 0 && !p.equippedWeapon) {
      const bare = this.add.text(px + 20, cy, "Bare Hands", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay.add(bare);
      cy += 16;
    } else {
      // Show equipped weapon and owned alternatives
      const allWeapons = p.equippedWeapon
        ? [p.equippedWeapon, ...ownedWeapons.filter((i) => i.id !== p.equippedWeapon!.id)]
        : ownedWeapons;
      for (const wpn of allWeapons) {
        const isEquipped = p.equippedWeapon?.id === wpn.id;
        const prefix = isEquipped ? "► " : "  ";
        const color = isEquipped ? "#88ff88" : "#aaddff";
        const txt = this.add.text(px + 20, cy,
          `${prefix}${wpn.name} (+${wpn.effect} dmg)${isEquipped ? " [equipped]" : ""}`,
          { fontSize: "11px", fontFamily: "monospace", color }
        ).setInteractive({ useHandCursor: !isEquipped });
        if (!isEquipped) {
          txt.on("pointerover", () => txt.setColor("#ffd700"));
          txt.on("pointerout", () => txt.setColor(color));
          txt.on("pointerdown", () => {
            p.equippedWeapon = wpn;
            this.buildEquipOverlay();
          });
        }
        this.equipOverlay.add(txt);
        cy += 16;
      }
    }
    cy += 6;

    // --- Armor slot ---
    const armorLabel = this.add.text(px + 14, cy, "Armor:", {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay.add(armorLabel);
    cy += 16;

    const ownedArmor = p.inventory.filter((i) => i.type === "armor");
    if (ownedArmor.length === 0 && !p.equippedArmor) {
      const none = this.add.text(px + 20, cy, "No Armor", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay.add(none);
      cy += 16;
    } else {
      const allArmor = p.equippedArmor
        ? [p.equippedArmor, ...ownedArmor.filter((i) => i.id !== p.equippedArmor!.id)]
        : ownedArmor;
      for (const arm of allArmor) {
        const isEquipped = p.equippedArmor?.id === arm.id;
        const prefix = isEquipped ? "► " : "  ";
        const color = isEquipped ? "#88ff88" : "#aaddff";
        const txt = this.add.text(px + 20, cy,
          `${prefix}${arm.name} (+${arm.effect} AC)${isEquipped ? " [equipped]" : ""}`,
          { fontSize: "11px", fontFamily: "monospace", color }
        ).setInteractive({ useHandCursor: !isEquipped });
        if (!isEquipped) {
          txt.on("pointerover", () => txt.setColor("#ffd700"));
          txt.on("pointerout", () => txt.setColor(color));
          txt.on("pointerdown", () => {
            p.equippedArmor = arm;
            this.buildEquipOverlay();
          });
        }
        this.equipOverlay.add(txt);
        cy += 16;
      }
    }
    cy += 6;

    // --- Ability Scores ---
    const statsBlock = this.add.text(px + 14, cy, [
      `― Stats ―`,
      `STR ${p.stats.strength}  DEX ${p.stats.dexterity}`,
      `CON ${p.stats.constitution}  INT ${p.stats.intelligence}`,
      `WIS ${p.stats.wisdom}  CHA ${p.stats.charisma}`,
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ccc", lineSpacing: 4,
    });
    this.equipOverlay.add(statsBlock);
    cy += 66;

    // --- Consumables ---
    const consumables = p.inventory.filter((i) => i.type === "consumable");
    const potionCount = consumables.filter((i) => i.id === "potion").length;
    const etherCount = consumables.filter((i) => i.id === "ether").length;
    const greaterCount = consumables.filter((i) => i.id === "greaterPotion").length;

    const consBlock = this.add.text(px + 14, cy, [
      `― Consumables ―`,
      `Potions: ${potionCount}  Ethers: ${etherCount}`,
      `Greater Potions: ${greaterCount}`,
      ``,
      `Spells Known: ${p.knownSpells.length}`,
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ccc", lineSpacing: 4,
    });
    this.equipOverlay.add(consBlock);

    // Close hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 14, "Press E or click to close", {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#666",
    }).setOrigin(0.5, 1);
    this.equipOverlay.add(hint);
  }
}

/**
 * Shop scene: buy items, equip gear, rest at the inn.
 */

import Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import { useItem, ownsEquipment } from "../systems/player";
import { getShopItems, getShopItemsForTown, type Item } from "../data/items";
import type { BestiaryData } from "../systems/bestiary";
import { type WeatherState, createWeatherState } from "../systems/weather";
import { CYCLE_LENGTH } from "../systems/daynight";
import { getInnCost } from "../data/map";
import type { SavedSpecialNpc } from "../data/npcs";
import { audioEngine } from "../systems/audio";

export class ShopScene extends Phaser.Scene {
  private player!: PlayerState;
  private townName!: string;
  private defeatedBosses!: Set<string>;
  private bestiary!: BestiaryData;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();
  private shopItems!: Item[];
  private messageText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private itemListContainer!: Phaser.GameObjects.Container;
  private scrollMask!: Phaser.GameObjects.Graphics;
  private scrollY = 0;
  private maxScrollY = 0;
  private listVisibleH = 0;
  private fromCity = false;
  private cityId = "";
  private discount = 0;
  private savedSpecialNpcs: SavedSpecialNpc[] = [];

  constructor() {
    super({ key: "ShopScene" });
  }

  init(data: {
    player: PlayerState;
    townName: string;
    defeatedBosses: Set<string>;
    bestiary: BestiaryData;
    shopItemIds?: string[];
    timeStep?: number;
    weatherState?: WeatherState;
    fromCity?: boolean;
    cityId?: string;
    discount?: number;
    savedSpecialNpcs?: SavedSpecialNpc[];
  }): void {
    this.player = data.player;
    this.townName = data.townName;
    this.defeatedBosses = data.defeatedBosses;
    this.bestiary = data.bestiary;
    this.timeStep = data.timeStep ?? 0;
    this.weatherState = data.weatherState ?? createWeatherState();
    this.fromCity = data.fromCity ?? false;
    this.cityId = data.cityId ?? "";
    this.discount = data.discount ?? 0;
    this.savedSpecialNpcs = data.savedSpecialNpcs ?? [];
    this.shopItems = data.shopItemIds
      ? getShopItemsForTown(data.shopItemIds)
      : getShopItems();
    // Dungeon key is unique — hide it if already owned
    if (this.player.inventory.some((i) => i.id === "dungeonKey")) {
      this.shopItems = this.shopItems.filter((i) => i.id !== "dungeonKey");
    }
  }

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(0x1a1a2e);
    this.cameras.main.fadeIn(300);

    // Play city music for this town
    if (audioEngine.initialized) {
      audioEngine.playCityMusic(this.townName);
    }

    // Title
    const titleText = this.fromCity ? this.townName : `${this.townName} - General Store`;
    this.add
      .text(w / 2, 20, titleText, {
        fontSize: "22px",
        fontFamily: "monospace",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    // Gold display — prominent bar below title
    const goldBg = this.add.graphics();
    goldBg.fillStyle(0x2a2a1a, 0.95);
    goldBg.fillRect(0, 42, w, 22);
    goldBg.lineStyle(1, 0xc0a060, 0.6);
    goldBg.strokeRect(0, 42, w, 22);

    this.goldText = this.add
      .text(w / 2, 44, "", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 1,
      })
      .setOrigin(0.5, 0);

    // Player stats panel (left)
    const statsBg = this.add.graphics();
    statsBg.fillStyle(0x222244, 0.9);
    statsBg.fillRect(10, 68, w * 0.35, h - 132);
    statsBg.lineStyle(1, 0xc0a060, 1);
    statsBg.strokeRect(10, 68, w * 0.35, h - 132);

    this.add.text(20, 72, "Your Equipment", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffd700",
    });

    this.statsText = this.add.text(20, 94, "", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#aaa",
      lineSpacing: 5,
      wordWrap: { width: w * 0.35 - 20 },
    });

    // Shop items panel (right)
    const shopBg = this.add.graphics();
    shopBg.fillStyle(0x222244, 0.9);
    shopBg.fillRect(w * 0.38, 68, w * 0.6, h - 132);
    shopBg.lineStyle(1, 0xc0a060, 1);
    shopBg.strokeRect(w * 0.38, 68, w * 0.6, h - 132);

    this.add.text(w * 0.39 + 10, 72, "Items for Sale", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffd700",
    });

    const listTop = 94;
    const listBottom = h - 64;
    this.listVisibleH = listBottom - listTop;

    this.itemListContainer = this.add.container(w * 0.39 + 10, listTop);

    // Mask to clip items to visible area
    this.scrollMask = this.make.graphics({});
    this.scrollMask.fillStyle(0xffffff);
    this.scrollMask.fillRect(w * 0.38, listTop, w * 0.6, this.listVisibleH);
    this.itemListContainer.setMask(
      new Phaser.Display.Masks.GeometryMask(this, this.scrollMask)
    );

    this.scrollY = 0;
    this.renderShopItems();

    // Scroll with mouse wheel
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      this.scrollList(deltaY > 0 ? 30 : -30);
    });

    // Scroll with arrow keys
    this.input.keyboard!.on("keydown-DOWN", () => this.scrollList(30));
    this.input.keyboard!.on("keydown-UP", () => this.scrollList(-30));

    // Bottom bar background
    const bottomBarY = h - 56;
    const barBg = this.add.graphics();
    barBg.fillStyle(0x111122, 0.95);
    barBg.fillRect(0, bottomBarY, w, 56);
    barBg.lineStyle(1, 0xc0a060, 0.5);
    barBg.strokeRect(0, bottomBarY, w, 56);

    // Message area (top of bottom bar)
    this.messageText = this.add
      .text(w / 2, bottomBarY + 4, "Welcome! Click an item to purchase.", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#88ff88",
      })
      .setOrigin(0.5, 0);

    // Rest at Inn button (only in standalone shop mode, not from city)
    if (!this.fromCity) {
      const innCost = getInnCost(this.cityId);
      const restBtn = this.add
        .text(20, bottomBarY + 28, `🏨 Rest at Inn (${innCost}g)`, {
          fontSize: "13px",
          fontFamily: "monospace",
          color: "#aaddff",
          backgroundColor: "#2a2a4e",
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true });

      restBtn.on("pointerover", () => restBtn.setColor("#ffd700"));
      restBtn.on("pointerout", () => restBtn.setColor("#aaddff"));
      restBtn.on("pointerdown", () => this.restAtInn());
    }

    // Leave button
    const leaveBtn = this.add
      .text(w - 20, bottomBarY + 28, "← Leave (ESC)", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ff8888",
        backgroundColor: "#2a2a4e",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    leaveBtn.on("pointerdown", () => this.leaveShop());

    // ESC to leave
    this.input.keyboard!.on("keydown-ESC", () => this.leaveShop());

    this.updateDisplay();
  }

  private scrollList(delta: number): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
    this.itemListContainer.y = 94 - this.scrollY;
  }

  private renderShopItems(): void {
    this.itemListContainer.removeAll(true);

    const w = this.cameras.main.width;
    const maxTextW = w * 0.6 - 20;
    let yOffset = 0;

    this.shopItems.forEach((item) => {
      const isEquipment = item.type === "weapon" || item.type === "armor" || item.type === "shield";
      const alreadyOwned = isEquipment && ownsEquipment(this.player, item.id);
      const levelLocked = (item.levelReq ?? 0) > this.player.level;
      const discountedCost = Math.max(1, Math.floor(item.cost * (1 - this.discount)));
      const canBuy = !alreadyOwned && !levelLocked && this.player.gold >= discountedCost;
      const color = alreadyOwned ? "#555555" : levelLocked ? "#884444" : canBuy ? "#cccccc" : "#666666";

      const typeIcon =
        item.type === "consumable"
          ? "🧪"
          : item.type === "weapon"
            ? "⚔"
            : item.type === "armor"
              ? "🛡"
              : item.type === "shield"
                ? "🛡"
                : "🔑";

      const tag = alreadyOwned ? " [OWNED]" : levelLocked ? ` [Lv.${item.levelReq}]` : "";

      const priceLabel = this.discount > 0
        ? `~~${item.cost}g~~ ${discountedCost}g`
        : `${item.cost}g`;

      const text = this.add
        .text(
          0,
          yOffset,
          `${typeIcon} ${item.name} ${priceLabel} ${item.description}${tag}`,
          {
            fontSize: "12px",
            fontFamily: "monospace",
            color,
            wordWrap: { width: maxTextW },
          }
        )
        .setInteractive({ useHandCursor: canBuy });

      if (canBuy) {
        text.on("pointerover", () => text.setColor("#ffd700"));
        text.on("pointerout", () => text.setColor(color));
        text.on("pointerdown", () => this.purchaseItem(item));
      }

      this.itemListContainer.add(text);
      yOffset += text.height + 6;
    });

    const totalContentH = yOffset;
    this.maxScrollY = Math.max(0, totalContentH - this.listVisibleH);
    this.scrollY = 0;
    this.itemListContainer.y = 94;
  }

  private purchaseItem(item: Item): void {
    const isEquipment = item.type === "weapon" || item.type === "armor" || item.type === "shield";
    if (isEquipment && ownsEquipment(this.player, item.id)) {
      this.setMessage(`You already own ${item.name}!`, "#ff6666");
      return;
    }
    if ((item.levelReq ?? 0) > this.player.level) {
      this.setMessage(`You need to be level ${item.levelReq} to buy ${item.name}!`, "#ff6666");
      return;
    }

    const discountedCost = Math.max(1, Math.floor(item.cost * (1 - this.discount)));
    if (this.player.gold < discountedCost) {
      this.setMessage(`Not enough gold!`, "#ff6666");
      return;
    }
    this.player.gold -= discountedCost;
    this.player.inventory.push({ ...item });
    this.setMessage(`Purchased ${item.name}!`, "#88ff88");

    // Auto-equip only if the new item is better than current
    if (item.type === "weapon") {
      const currentEffect = this.player.equippedWeapon?.effect ?? 0;
      if (item.effect > currentEffect) {
        const idx = this.player.inventory.length - 1;
        useItem(this.player, idx);
        this.setMessage(`Purchased & equipped ${item.name}!`, "#88ff88");
      }
    } else if (item.type === "armor") {
      const currentEffect = this.player.equippedArmor?.effect ?? 0;
      if (item.effect > currentEffect) {
        const idx = this.player.inventory.length - 1;
        useItem(this.player, idx);
        this.setMessage(`Purchased & equipped ${item.name}!`, "#88ff88");
      }
    } else if (item.type === "shield") {
      if (!this.player.equippedWeapon?.twoHanded) {
        const currentEffect = this.player.equippedShield?.effect ?? 0;
        if (item.effect > currentEffect) {
          const idx = this.player.inventory.length - 1;
          useItem(this.player, idx);
          this.setMessage(`Purchased & equipped ${item.name}!`, "#88ff88");
        }
      }
    }

    this.updateDisplay();
    this.renderShopItems();
  }

  private restAtInn(): void {
    const innCost = getInnCost(this.cityId);
    if (this.player.gold < innCost) {
      this.setMessage(`Not enough gold to rest! (Need ${innCost}g)`, "#ff6666");
      return;
    }
    this.showInnConfirmation();
  }

  /** Show a prompt with two rest options: sleep until morning or wait until night. */
  private showInnConfirmation(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const boxW = 300;
    const boxH = 110;
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;

    const container = this.add.container(0, 0).setDepth(50);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.97);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    container.add(bg);

    const prompt = this.add.text(boxX + boxW / 2, boxY + 10, `Rest at the inn for ${getInnCost(this.cityId)}g?`, {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ffd700",
    }).setOrigin(0.5, 0);
    container.add(prompt);

    // Dawn = step 0 of the next cycle
    const DAWN_STEP = 0;
    // Night starts at step 265
    const NIGHT_STEP = 265;

    const sleepBtn = this.add.text(boxX + boxW / 2, boxY + 32, "🌅 Sleep Until Morning", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#88ff88",
      backgroundColor: "#2a2a4e",
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    sleepBtn.on("pointerover", () => sleepBtn.setColor("#ffd700"));
    sleepBtn.on("pointerout", () => sleepBtn.setColor("#88ff88"));
    sleepBtn.on("pointerdown", () => {
      container.destroy();
      // Advance to Dawn (step 0) of the next cycle
      const currentCycle = Math.floor(this.timeStep / CYCLE_LENGTH);
      this.confirmInnRest((currentCycle + 1) * CYCLE_LENGTH + DAWN_STEP,
        "You sleep soundly at the inn. Good morning! HP and MP restored.");
    });
    container.add(sleepBtn);

    const waitBtn = this.add.text(boxX + boxW / 2, boxY + 56, "🌙 Wait Until Night", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#aaaaff",
      backgroundColor: "#2a2a4e",
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    waitBtn.on("pointerover", () => waitBtn.setColor("#ffd700"));
    waitBtn.on("pointerout", () => waitBtn.setColor("#aaaaff"));
    waitBtn.on("pointerdown", () => {
      container.destroy();
      // Set to Night start of the current or next cycle
      const currentPos = ((this.timeStep % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
      const currentCycle = Math.floor(this.timeStep / CYCLE_LENGTH);
      const targetStep = currentPos < NIGHT_STEP
        ? currentCycle * CYCLE_LENGTH + NIGHT_STEP
        : (currentCycle + 1) * CYCLE_LENGTH + NIGHT_STEP;
      this.confirmInnRest(targetStep,
        "You rest at the inn and wait for nightfall. HP and MP restored.");
    });
    container.add(waitBtn);

    const cancelBtn = this.add.text(boxX + boxW / 2, boxY + 82, "Cancel", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ff8888",
      backgroundColor: "#2a2a4e",
      padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    cancelBtn.on("pointerover", () => cancelBtn.setColor("#ffd700"));
    cancelBtn.on("pointerout", () => cancelBtn.setColor("#ff8888"));
    cancelBtn.on("pointerdown", () => container.destroy());
    container.add(cancelBtn);
  }

  /** Execute the inn rest: heal the player and advance time to the target step. */
  private confirmInnRest(targetTimeStep: number, message: string): void {
    const innCost = getInnCost(this.cityId);
    this.player.gold -= innCost;
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.timeStep = targetTimeStep;
    this.setMessage(message, "#88ff88");
    this.updateDisplay();
    this.renderShopItems();
  }

  private setMessage(msg: string, color: string): void {
    this.messageText.setText(msg).setColor(color);
  }

  private updateDisplay(): void {
    const p = this.player;
    this.goldText.setText(`💰 Gold: ${p.gold}`);

    const weapon = p.equippedWeapon
      ? `${p.equippedWeapon.name} (+${p.equippedWeapon.effect})`
      : "Bare Hands";
    const armor = p.equippedArmor
      ? `${p.equippedArmor.name} (+${p.equippedArmor.effect} AC)`
      : "No Armor";
    const shield = p.equippedShield
      ? `${p.equippedShield.name} (+${p.equippedShield.effect} AC)`
      : "No Shield";
    const consumables = p.inventory.filter((i) => i.type === "consumable");
    const potionCount = consumables.filter((i) => i.id === "potion").length;
    const etherCount = consumables.filter((i) => i.id === "ether").length;
    const greaterCount = consumables.filter(
      (i) => i.id === "greaterPotion"
    ).length;

    this.statsText.setText(
      `Weapon: ${weapon}\n` +
        `Armor: ${armor}\n` +
        `Shield: ${shield}\n\n` +
        `Inventory:\n` +
        `  Potions: ${potionCount}\n` +
        `  Ethers: ${etherCount}\n` +
        `  Greater Potions: ${greaterCount}`
    );
  }

  private leaveShop(): void {
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

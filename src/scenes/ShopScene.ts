/**
 * Shop scene: buy items, equip gear, rest at the inn.
 */

import Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import { buyItem, useItem, ownsEquipment, longRest } from "../systems/player";
import { getShopItems, getShopItemsForTown, type Item } from "../data/items";
import type { BestiaryData } from "../systems/bestiary";
import { type WeatherState, createWeatherState } from "../systems/weather";
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
  private fromCity = false;
  private cityId = "";

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
  }): void {
    this.player = data.player;
    this.townName = data.townName;
    this.defeatedBosses = data.defeatedBosses;
    this.bestiary = data.bestiary;
    this.timeStep = data.timeStep ?? 0;
    this.weatherState = data.weatherState ?? createWeatherState();
    this.fromCity = data.fromCity ?? false;
    this.cityId = data.cityId ?? "";
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

    this.itemListContainer = this.add.container(w * 0.39 + 10, 94);
    this.renderShopItems();

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
      const restBtn = this.add
        .text(20, bottomBarY + 28, "🏨 Rest at Inn (10g)", {
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

  private renderShopItems(): void {
    this.itemListContainer.removeAll(true);

    this.shopItems.forEach((item, i) => {
      const isEquipment = item.type === "weapon" || item.type === "armor" || item.type === "shield";
      const alreadyOwned = isEquipment && ownsEquipment(this.player, item.id);
      const canBuy = !alreadyOwned && this.player.gold >= item.cost;
      const color = alreadyOwned ? "#555555" : canBuy ? "#cccccc" : "#666666";

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

      const ownedTag = alreadyOwned ? " [OWNED]" : "";

      const text = this.add
        .text(
          0,
          i * 30,
          `${typeIcon} ${item.name} - ${item.description} (${item.cost}g)${ownedTag}`,
          {
            fontSize: "12px",
            fontFamily: "monospace",
            color,
          }
        )
        .setInteractive({ useHandCursor: canBuy });

      if (canBuy) {
        text.on("pointerover", () => text.setColor("#ffd700"));
        text.on("pointerout", () => text.setColor(color));
        text.on("pointerdown", () => this.purchaseItem(item));
      }

      this.itemListContainer.add(text);
    });
  }

  private purchaseItem(item: Item): void {
    const isEquipment = item.type === "weapon" || item.type === "armor" || item.type === "shield";
    if (isEquipment && ownsEquipment(this.player, item.id)) {
      this.setMessage(`You already own ${item.name}!`, "#ff6666");
      return;
    }

    const success = buyItem(this.player, item);
    if (success) {
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
    } else {
      this.setMessage("Not enough gold!", "#ff6666");
    }

    this.updateDisplay();
    this.renderShopItems();
  }

  private restAtInn(): void {
    if (this.player.gold < 10) {
      this.setMessage("Not enough gold to rest! (Need 10g)", "#ff6666");
      return;
    }

    this.player.gold -= 10;
    this.player.longRestCount = 0; // reset for new inn visit
    const { hpRestored, mpRestored } = longRest(this.player);
    const hasLongRest = this.player.knownSpells.includes("longRest");
    const hint = hasLongRest ? " Use Long Rest (Q) to rest again!" : "";
    this.setMessage(`You rest at the inn. +${hpRestored} HP, +${mpRestored} MP.${hint}`, "#88ff88");
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
      `${p.name} Lv.${p.level}\n` +
        `HP: ${p.hp}/${p.maxHp}\n` +
        `MP: ${p.mp}/${p.maxMp}\n\n` +
        `Weapon: ${weapon}\n` +
        `Armor: ${armor}\n` +
        `Shield: ${shield}\n\n` +
        `Inventory:\n` +
        `  Potions: ${potionCount}\n` +
        `  Ethers: ${etherCount}\n` +
        `  Greater Potions: ${greaterCount}\n\n` +
        `Spells: ${p.knownSpells.length}\n` +
        `STR ${p.stats.strength} DEX ${p.stats.dexterity}\n` +
        `CON ${p.stats.constitution} INT ${p.stats.intelligence}`
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
      });
    });
  }
}

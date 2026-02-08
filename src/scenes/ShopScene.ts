/**
 * Shop scene: buy items, equip gear, rest at the inn.
 */

import Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import { buyItem, useItem, ownsEquipment } from "../systems/player";
import { getShopItems, type Item } from "../data/items";
import type { BestiaryData } from "../systems/bestiary";

export class ShopScene extends Phaser.Scene {
  private player!: PlayerState;
  private townName!: string;
  private defeatedBosses!: Set<string>;
  private bestiary!: BestiaryData;
  private shopItems!: Item[];
  private messageText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private itemListContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: "ShopScene" });
  }

  init(data: {
    player: PlayerState;
    townName: string;
    defeatedBosses: Set<string>;
    bestiary: BestiaryData;
  }): void {
    this.player = data.player;
    this.townName = data.townName;
    this.defeatedBosses = data.defeatedBosses;
    this.bestiary = data.bestiary;
    this.shopItems = getShopItems();
  }

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(0x1a1a2e);
    this.cameras.main.fadeIn(300);

    // Title
    this.add
      .text(w / 2, 20, `${this.townName} - General Store`, {
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
    statsBg.fillRect(10, 68, w * 0.35, h - 122);
    statsBg.lineStyle(1, 0xc0a060, 1);
    statsBg.strokeRect(10, 68, w * 0.35, h - 122);

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
    shopBg.fillRect(w * 0.38, 68, w * 0.6, h - 122);
    shopBg.lineStyle(1, 0xc0a060, 1);
    shopBg.strokeRect(w * 0.38, 68, w * 0.6, h - 122);

    this.add.text(w * 0.39 + 10, 72, "Items for Sale", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffd700",
    });

    this.itemListContainer = this.add.container(w * 0.39 + 10, 94);
    this.renderShopItems();

    // Message area
    this.messageText = this.add
      .text(w / 2, h - 40, "Welcome! Click an item to purchase.", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#88ff88",
      })
      .setOrigin(0.5);

    // Rest at Inn button
    const restBtn = this.add
      .text(20, h - 40, "🏨 Rest at Inn (10 gold)", {
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

    // Leave button
    const leaveBtn = this.add
      .text(w - 20, h - 40, "← Leave Shop (ESC)", {
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
      const isEquipment = item.type === "weapon" || item.type === "armor";
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
    const isEquipment = item.type === "weapon" || item.type === "armor";
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
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.setMessage("You rest at the inn. HP and MP fully restored!", "#88ff88");
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
        `Armor: ${armor}\n\n` +
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
      });
    });
  }
}

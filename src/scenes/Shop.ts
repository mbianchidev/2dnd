/**
 * Shop scene: buy items, equip gear, rest at the inn.
 */

import * as Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import { useItem, ownsEquipment, sellItem, isLastEquipment, isItemEquipped } from "../systems/player";
import { getItemDescription, getShopItems, getShopItemsForTown, getSellValue, canSellItem, type Item } from "../data/items";
import { discoverCraftingRecipes } from "../systems/crafting";
import {
  unlockCodexFromSignal,
  type CodexData,
} from "../systems/codex";
import { type WeatherState, createWeatherState } from "../systems/weather";
import { CYCLE_LENGTH, getTimePeriod } from "../systems/daynight";
import { getCity, getInnCost } from "../data/map";
import type { SavedSpecialNpc } from "../data/npcs";
import { audioEngine } from "../systems/audio";
import {
  SHOP_NEGOTIATION_OPTIONS,
  type ShopNegotiationOption,
} from "../data/skillChecks";
import {
  getShopNegotiationDiscount,
  rollSkillCheck,
} from "../systems/skillChecks";
import { saveGame } from "../systems/save";
import { restPartyAtInn } from "../systems/party";
import { prepareHeroLevelUp } from "../systems/classProgression";
import { SceneTransitionManager } from "../managers/sceneTransition";
import { installSceneLayoutAudit, layoutTextStack, registerLayoutGroup, subscribeOverlayReflow } from "../managers/layout";
import { installSceneAccessibility } from "../systems/accessibility";
import {
  installDicePresentation,
  presentSkillDiceResult,
} from "../managers/dicePresentation";
import { createSharedSceneState } from "../systems/sceneState";
import {
  combineShopAdjustments,
  getTownShopAdjustment,
} from "../systems/reputation";
import { getCampaignDifficultyRules, scaleCost, scaleSaleValue } from "../systems/difficulty";
import { debugPanelState } from "../config";
import { ShopLayoutRenderer } from "../renderers/shopLayout";
import { createItemVisual } from "../renderers/itemVisuals";
import { UI_COLORS } from "../systems/uiTheme";
import { bindPointerRelease } from "../utils/ui";

export class ShopScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);
  private player!: PlayerState;
  private townName!: string;
  private defeatedBosses!: Set<string>;
  private codex!: CodexData;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();
  private shopItems!: Item[];
  private messageText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private shopLayout!: ShopLayoutRenderer;
  private itemListContainer!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private maxScrollY = 0;
  private listVisibleH = 0;
  private fromCity = false;
  private cityId = "";
  private discount = 0;
  private negotiationDiscount = 0;
  private reputationAdjustment = 0;
  private shopSkillCheckId = "";
  private savedSpecialNpcs: SavedSpecialNpc[] = [];
  private mode: "buy" | "sell" = "buy"; // Current shop mode
  private buyTabButton!: Phaser.GameObjects.Text;
  private sellTabButton!: Phaser.GameObjects.Text;
  private negotiateButton?: Phaser.GameObjects.Text;
  private negotiationOverlay: Phaser.GameObjects.Container | null = null;
  private confirmationOverlay: Phaser.GameObjects.Container | null = null;
  private pendingCodexDiscoveryIds: string[] = [];
  private selectedItem: Item | null = null;
  private selectedItemAction: (() => void) | null = null;
  private inputReadyAt = 0;
  private confirmPressed = false;

  constructor() {
    super({ key: "ShopScene" });
  }

  init(data: {
    player: PlayerState;
    townName: string;
    defeatedBosses: Set<string>;
    codex: CodexData;
    shopItemIds?: string[];
    timeStep?: number;
    weatherState?: WeatherState;
    fromCity?: boolean;
    cityId?: string;
    discount?: number;
    shopSkillCheckId?: string;
    savedSpecialNpcs?: SavedSpecialNpc[];
  }): void {
    this.player = data.player;
    this.townName = data.townName;
    this.defeatedBosses = data.defeatedBosses;
    this.codex = data.codex;
    this.timeStep = data.timeStep ?? 0;
    this.weatherState = data.weatherState ?? createWeatherState();
    this.fromCity = data.fromCity ?? false;
    this.cityId = data.cityId ?? "";
    this.shopSkillCheckId = data.shopSkillCheckId ?? "";
    const savedNegotiation = this.shopSkillCheckId
      ? this.player.progression.skillChecks[this.shopSkillCheckId]
      : undefined;
    this.negotiationDiscount = Math.max(
      data.discount ?? 0,
      getShopNegotiationDiscount(savedNegotiation),
    );
    this.reputationAdjustment = getTownShopAdjustment(
      this.player,
      this.cityId,
    );
    this.discount = combineShopAdjustments(
      this.negotiationDiscount,
      this.reputationAdjustment,
    );
    this.savedSpecialNpcs = data.savedSpecialNpcs ?? [];
    this.negotiationOverlay = null;
    this.confirmationOverlay = null;
    this.pendingCodexDiscoveryIds = [];
    this.mode = "buy";
    this.scrollY = 0;
    this.confirmPressed = false;
    this.shopItems = data.shopItemIds
      ? getShopItemsForTown(data.shopItemIds)
      : getShopItems();
    // Dungeon key is unique — hide it if already owned
    if (this.player.inventory.some((i) => i.id === "dungeonKey")) {
      this.shopItems = this.shopItems.filter((i) => i.id !== "dungeonKey");
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x25353d);
    this.sceneTransitions.prepare(300);
    installSceneAccessibility(this, installSceneLayoutAudit);
    installDicePresentation(this);

    // Play city music for this town
    if (audioEngine.initialized) {
      audioEngine.playCityMusic(
        getCity(this.cityId)?.name ?? this.townName,
        getTimePeriod(this.timeStep),
      );
    }

    const titleText = this.fromCity ? this.townName : `${this.townName} - General Store`;
    this.shopLayout = new ShopLayoutRenderer(this, {
      title: titleText, negotiate: !!this.shopSkillCheckId,
      innLabel: this.fromCity ? undefined : `Rest at Inn (${this.getInnPrice()}g)`,
      buy: () => this.switchMode("buy"), sell: () => this.switchMode("sell"),
      leave: () => this.leaveShop(), rest: () => this.restAtInn(),
      reflow: () => this.renderItems(),
    });
    this.goldText = this.shopLayout.gold;
    this.messageText = this.shopLayout.message;
    this.buyTabButton = this.shopLayout.buy;
    this.sellTabButton = this.shopLayout.sell;
    this.negotiateButton = this.shopLayout.negotiate;
    this.itemListContainer = this.shopLayout.list;
    const negotiateButton = this.negotiateButton;
    if (negotiateButton) {
      negotiateButton.on("pointerover", () => {
        if (negotiateButton.input?.enabled) negotiateButton.setColor("#ffd700");
      });
      negotiateButton.on("pointerout", () => {
        if (negotiateButton.input?.enabled) negotiateButton.setColor("#88ddff");
      });
      bindPointerRelease(negotiateButton, () => this.showNegotiationOptions());
    }
    this.refreshNegotiationButton();
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      this.scrollList(deltaY > 0 ? 30 : -30);
    });
    this.input.keyboard!.on("keydown-DOWN", () => this.scrollList(30));
    this.input.keyboard!.on("keydown-UP", () => this.scrollList(-30));
    this.input.keyboard!.on("keydown-ESC", () => this.leaveShop());
    this.inputReadyAt = this.time.now + 150;
    this.input.keyboard!.on("keydown-ENTER", (event: KeyboardEvent) => {
      if (!event.repeat) this.confirmPressed = this.canConfirmItem();
    });
    this.input.keyboard!.on("keyup-ENTER", () => {
      const pressed = this.confirmPressed;
      this.confirmPressed = false;
      if (pressed && this.canConfirmItem()) this.selectedItemAction?.();
    });
    this.input.keyboard!.on("keydown-I", () => {
      if (this.selectedItem && !this.negotiationOverlay && !this.confirmationOverlay
        && !this.sceneTransitions.isPending) {
        this.confirmPressed = false;
        this.shopLayout.showItemDetails(this.selectedItem.name, getItemDescription(this.selectedItem));
      }
    });
    const clearConfirm = (): void => { this.confirmPressed = false; };
    this.game.events.on(Phaser.Core.Events.BLUR, clearConfirm);
    this.game.events.on(Phaser.Core.Events.HIDDEN, clearConfirm);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearConfirm();
      this.game.events.off(Phaser.Core.Events.BLUR, clearConfirm);
      this.game.events.off(Phaser.Core.Events.HIDDEN, clearConfirm);
    });
    this.updateDisplay();
    this.renderItems();
  }

  update(): void {
    debugPanelState(`SHOP | ${this.townName} | Mode: ${this.mode} | Row: ${this.scrollY} | Gold: ${this.player.gold}`);
  }

  private canConfirmItem(): boolean {
    return this.time.now >= this.inputReadyAt && !this.shopLayout.hasItemDetails
      && !this.negotiationOverlay && !this.confirmationOverlay && !this.sceneTransitions.isPending;
  }

  private scrollList(delta: number): void {
    if (this.shopLayout.hasItemDetails || this.negotiationOverlay || this.confirmationOverlay) return;
    this.confirmPressed = false;
    this.scrollY = Phaser.Math.Clamp(this.scrollY + Math.sign(delta), 0, this.maxScrollY);
    this.renderItems();
  }

  private switchMode(mode: "buy" | "sell"): void {
    if (this.negotiationOverlay || this.confirmationOverlay || this.shopLayout.hasItemDetails) return;
    if (this.mode === mode) return;
    this.confirmPressed = false;
    this.mode = mode;
    this.scrollY = 0;
    
    // Update tab button styles
    if (mode === "buy") {
      this.buyTabButton.setColor("#ffd700").setBackgroundColor("#3a3a5a");
      this.sellTabButton.setColor("#aaaaaa").setBackgroundColor("#2a2a4a");
      this.setMessage("Welcome! Click an item to purchase.", "#88ff88");
    } else {
      this.buyTabButton.setColor("#aaaaaa").setBackgroundColor("#2a2a4a");
      this.sellTabButton.setColor("#ffd700").setBackgroundColor("#3a3a5a");
      this.setMessage("Select an item to sell.", "#88ff88");
    }
    
    this.renderItems();
  }

  private refreshNegotiationButton(): void {
    if (!this.negotiateButton || !this.shopSkillCheckId) return;

    const record = this.player.progression.skillChecks[this.shopSkillCheckId];
    if (!record) {
      this.negotiateButton
        .setText("💬 Negotiate")
        .setColor("#88ddff")
        .setInteractive({ useHandCursor: true });
      return;
    }

    this.negotiateButton.disableInteractive();
    const discount = getShopNegotiationDiscount(record);
    if (discount > 0) {
      this.negotiateButton
        .setText(`Deal: -${Math.round(discount * 100)}%`)
        .setColor("#88ff88");
    } else {
      this.negotiateButton
        .setText("Negotiation failed")
        .setColor("#ff8888");
    }
  }

  private showNegotiationOptions(): void {
    if (
      !this.shopSkillCheckId
      || this.player.progression.skillChecks[this.shopSkillCheckId]
      || this.negotiationOverlay
      || this.confirmationOverlay
      || this.shopLayout.hasItemDetails
      || this.sceneTransitions.isPending
    ) {
      return;
    }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const boxW = 390;
    const boxH = 142;
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;
    const container = this.add.container(0, 0).setDepth(50);
    this.negotiationOverlay = container;

    const bg = this.add.graphics();
    bg.fillStyle(UI_COLORS.panel, 0.94);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    container.add(bg);

    container.add(
      this.add
        .text(
          boxX + boxW / 2,
          boxY + 10,
          "Choose one approach. You get one attempt at this shop.",
          {
            fontSize: "12px",
            fontFamily: "monospace",
            color: "#ffd700",
          },
        )
        .setOrigin(0.5, 0),
    );

    SHOP_NEGOTIATION_OPTIONS.forEach((option, index) => {
      const percent = Math.round(option.discount * 100);
      const button = this.add
        .text(
          boxX + boxW / 2,
          boxY + 38 + index * 32,
          `${option.label} (CHA DC ${option.dc}) — ${percent}% off\n${option.description}`,
          {
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#88ddff",
            align: "center",
            backgroundColor: "#2a2a4e",
            padding: { x: 10, y: 3 },
          },
        )
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      button.on("pointerover", () => button.setColor("#ffd700"));
      button.on("pointerout", () => button.setColor("#88ddff"));
      bindPointerRelease(button, () => {
        this.resolveNegotiation(option);
      });
      container.add(button);
    });

    const cancelButton = this.add
      .text(boxX + boxW / 2, boxY + boxH - 22, "Cancel", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#ff8888",
        backgroundColor: "#2a2a4e",
        padding: { x: 12, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    cancelButton.on("pointerover", () => cancelButton.setColor("#ffd700"));
    cancelButton.on("pointerout", () => cancelButton.setColor("#ff8888"));
    bindPointerRelease(cancelButton, () => {
      container.destroy();
      this.negotiationOverlay = null;
    });
    container.add(cancelButton);
    this.installModalLayout(container, bg, "shop-negotiation");
  }

  private resolveNegotiation(option: ShopNegotiationOption): void {
    if (
      !this.shopSkillCheckId
      || this.player.progression.skillChecks[this.shopSkillCheckId]
    ) {
      return;
    }

    const result = rollSkillCheck(
      this.player.stats,
      "charisma",
      option.dc,
      { optionId: option.id, rules: getCampaignDifficultyRules(this.player) },
    );
    this.player.progression.skillChecks[this.shopSkillCheckId] = result;
    this.negotiationDiscount = Math.max(
      this.negotiationDiscount,
      getShopNegotiationDiscount(result),
    );
    this.discount = combineShopAdjustments(
      this.negotiationDiscount,
      this.reputationAdjustment,
    );

    this.negotiationOverlay?.destroy();
    this.negotiationOverlay = null;
    this.refreshNegotiationButton();
    this.renderItems();

    const outcome = result.success
      ? `${option.label} succeeded. Prices are ${Math.round(option.discount * 100)}% lower.`
      : `${option.label} failed. The shopkeeper will not renegotiate.`;
    this.setMessage(
      `Charisma check: ${outcome}`,
      result.success ? "#88ff88" : "#ff8888",
    );
    presentSkillDiceResult(this, result, `Charisma negotiation: ${option.label}`);
    saveGame(
      this.player,
      this.defeatedBosses,
      this.codex,
      this.player.appearanceId,
      this.timeStep,
      this.weatherState,
    );
  }

  private renderItems(): void {
    this.listVisibleH = this.shopLayout.listBounds.height;
    this.selectedItem = null;
    this.selectedItemAction = null;
    if (this.mode === "buy") {
      this.renderShopItems();
    } else {
      this.renderInventoryForSelling();
    }
  }

  private renderItemRow(item: Item, label: string, color: string, y: number, id: string, action?: () => void): number | null {
    const bounds = this.shopLayout.listBounds;
    const text = this.add.text(30, y, label, {
      fontSize: "12px", fontFamily: "monospace", color, lineSpacing: 3,
      wordWrap: { width: bounds.width - 86 },
    }).setData("layoutId", id);
    const info = this.add.text(bounds.width - 50, y, "Info", {
      fontSize: "10px", fontFamily: "monospace", color: "#a9ced0",
      backgroundColor: "#334351", padding: { x: 5, y: 4 },
    }).setData("layoutId", `${id}-info`);
    const height = Math.max(text.displayHeight, info.displayHeight, 22) + 10;
    if (y + height > this.listVisibleH) {
      text.destroy();
      info.destroy();
      return null;
    }
    const icon = createItemVisual(this, item, 0, y, 22);
    icon.setData("layoutId", `${id}-icon`).setData("layoutBounds", {
      x: bounds.x, y: bounds.y + y, width: 22, height: 22,
    });
    if (!this.selectedItem) {
      this.selectedItem = item;
      this.selectedItemAction = action ?? null;
    }
    if (action) {
      text.setInteractive({ useHandCursor: true });
      bindPointerRelease(text, () => {
        if (!this.shopLayout.hasItemDetails && !this.negotiationOverlay && !this.confirmationOverlay && !this.sceneTransitions.isPending) action();
      });
    }
    info.setInteractive({ useHandCursor: true });
    bindPointerRelease(info, () => {
      if (!this.shopLayout.hasItemDetails && !this.negotiationOverlay && !this.confirmationOverlay
        && !this.sceneTransitions.isPending) {
        this.confirmPressed = false;
        this.shopLayout.showItemDetails(item.name, getItemDescription(item));
      }
    });
    this.itemListContainer.add([icon, text, info]);
    return height;
  }

  private renderShopItems(): void {
    this.itemListContainer.removeAll(true);
    let yOffset = 0;

    for (const [index, item] of this.shopItems.entries()) {
      if (index < this.scrollY) continue;
      const isEquipment = item.type === "weapon" || item.type === "armor" || item.type === "shield" || item.type === "mount";
      const alreadyOwned = isEquipment && ownsEquipment(this.player, item.id);
      const levelLocked = (item.levelReq ?? 0) > this.player.level;
      const discountedCost = scaleCost(item.cost, getCampaignDifficultyRules(this.player), this.discount, 1);
      const canBuy = !alreadyOwned && !levelLocked && this.player.gold >= discountedCost;
      const color = alreadyOwned ? "#555555" : levelLocked ? "#884444" : canBuy ? "#cccccc" : "#666666";


      // Show owned count for consumables
      let ownedCount = 0;
      if (item.type === "consumable") {
        ownedCount = this.player.inventory.filter(i => i.id === item.id).length;
      }
      const ownedTag = ownedCount > 0 ? ` (owned: ${ownedCount})` : "";
      const tag = alreadyOwned ? " [OWNED]" : levelLocked ? ` [Lv.${item.levelReq}]` : ownedTag;

      const priceLabel = this.discount !== 0
        ? `${discountedCost}g (${this.discount > 0 ? "discount" : "surcharge"})`
        : `${discountedCost}g`;

      const height = this.renderItemRow(item, `${item.name}${tag}\n${priceLabel}`, color, yOffset, `shop-item-${item.id}`,
        canBuy ? () => this.purchaseItem(item) : undefined);
      if (height === null) break;
      yOffset += height;
    }
    this.maxScrollY = Math.max(0, this.shopItems.length - 1);
  }

  private renderInventoryForSelling(): void {
    this.itemListContainer.removeAll(true);

    let yOffset = 0;

    if (this.player.inventory.length === 0) {
      const emptyText = this.add.text(0, yOffset, "Your inventory is empty.", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#888888",
      });
      this.itemListContainer.add(emptyText);
      this.maxScrollY = 0;
      this.scrollY = 0;
      return;
    }

    // Group items by id, tracking indices and equipped status
    const groups: {
      item: Item;
      indices: number[];
      sellableIndices: number[];
      equippedCount: number;
    }[] = [];
    const groupMap = new Map<string, typeof groups[number]>();

    this.player.inventory.forEach((item, index) => {
      let group = groupMap.get(item.id);
      if (!group) {
        group = { item, indices: [], sellableIndices: [], equippedCount: 0 };
        groups.push(group);
        groupMap.set(item.id, group);
      }
      group.indices.push(index);
      if (isItemEquipped(this.player, item)) {
        group.equippedCount++;
      } else {
        group.sellableIndices.push(index);
      }
    });

    this.scrollY = Math.min(this.scrollY, Math.max(0, groups.length - 1));
    for (const [index, group] of groups.entries()) {
      if (index < this.scrollY) continue;
      const { item, indices, sellableIndices, equippedCount } = group;
      const totalCount = indices.length;
      const sellValue = scaleSaleValue(getSellValue(item), getCampaignDifficultyRules(this.player));
      const canSell = canSellItem(item);
      const isLast = isLastEquipment(this.player, item);

      let sellable = canSell && !isLast && sellableIndices.length > 0;
      let reason = "";
      if (!canSell) {
        reason = " [UNSELLABLE]";
      } else if (equippedCount > 0 && sellableIndices.length === 0) {
        reason = " [EQUIPPED]";
        sellable = false;
      } else if (isLast) {
        reason = " [LAST EQUIPMENT]";
        sellable = false;
      }

      const color = sellable ? "#cccccc" : "#666666";
      const priceLabel = sellable ? `${sellValue}g each` : "";
      const countLabel = totalCount > 1 ? ` x${totalCount}` : "";
      const equippedLabel = equippedCount > 0 ? ` (${equippedCount} equipped)` : "";

      const height = this.renderItemRow(item, `${item.name}${countLabel}${equippedLabel}${reason}\n${priceLabel}`, color, yOffset,
        `shop-sell-${item.id}`, sellable ? () => this.showSellConfirmation(item, sellableIndices, sellValue) : undefined);
      if (height === null) break;
      yOffset += height;
    }
    this.maxScrollY = Math.max(0, groups.length - 1);
  }

  private installModalLayout(container: Phaser.GameObjects.Container, background: Phaser.GameObjects.Graphics, id: string): void {
    this.confirmPressed = false;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const dim = this.add.graphics().fillStyle(0x000000, 0.7).fillRect(0, 0, w, h)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    bindPointerRelease(dim, () => container.destroy(true));
    const panelHitArea = new Phaser.Geom.Rectangle();
    background.setInteractive(panelHitArea, Phaser.Geom.Rectangle.Contains);
    container.addAt(dim, 0);
    registerLayoutGroup(this, id, container, { x: 0, y: 0, width: w, height: h });
    const texts = container.list.filter((object): object is Phaser.GameObjects.Text => object instanceof Phaser.GameObjects.Text);
    const reflow = (): void => {
      const width = Math.min(460, w - 40);
      texts.forEach((text, index) => text.setWordWrapWidth(width - 32, true).setData("layoutId", `${id}-${index}`));
      const height = layoutTextStack(texts, { x: (w - width) / 2 + 16, y: 0, width: width - 32, gap: 10, align: "center" }) + 24;
      const top = (h - height) / 2;
      panelHitArea.setTo((w - width) / 2, top, width, height);
      layoutTextStack(texts, { x: (w - width) / 2 + 16, y: top + 12, width: width - 32, gap: 10, align: "center" });
      background.clear().fillStyle(0x202c37, 0.98).fillRoundedRect((w - width) / 2, top, width, height, 6);
      background.lineStyle(2, 0xc4ad7c).strokeRoundedRect((w - width) / 2, top, width, height, 6);
    };
    const unsubscribe = subscribeOverlayReflow(this, reflow);
    container.once(Phaser.GameObjects.Events.DESTROY, () => {
      unsubscribe();
      if (this.negotiationOverlay === container) this.negotiationOverlay = null;
      if (this.confirmationOverlay === container) this.confirmationOverlay = null;
    });
    reflow();
  }

  private showSellConfirmation(item: Item, sellableIndices: number[], sellValue: number): void {
    if (this.confirmationOverlay || this.negotiationOverlay) return;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const count = sellableIndices.length;
    const boxW = 280;
    const boxH = count > 1 ? 88 : 66;
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;

    const container = this.add.container(0, 0).setDepth(50);
    this.confirmationOverlay = container;

    const bg = this.add.graphics();
    bg.fillStyle(UI_COLORS.panel, 0.94);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    container.add(bg);

    const prompt = this.add.text(boxX + boxW / 2, boxY + 8, `Sell ${item.name} for ${sellValue}g?`, {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ffd700",
    }).setOrigin(0.5, 0);
    container.add(prompt);

    let btnY = boxY + 28;

    // Sell one button
    const sellOneBtn = this.add.text(boxX + boxW / 2, btnY, "Sell 1", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#88ff88",
      backgroundColor: "#2a2a4e",
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    sellOneBtn.on("pointerover", () => sellOneBtn.setColor("#ffd700"));
    sellOneBtn.on("pointerout", () => sellOneBtn.setColor("#88ff88"));
    bindPointerRelease(sellOneBtn, () => {
      container.destroy();
      this.executeSell(sellableIndices, 1, sellValue);
    });
    container.add(sellOneBtn);
    btnY += 22;

    // Sell all button (only if more than 1 sellable)
    if (count > 1) {
      const totalValue = sellValue * count;
      const sellAllBtn = this.add.text(boxX + boxW / 2, btnY, `Sell All (${count}) — ${totalValue}g`, {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#ffaa44",
        backgroundColor: "#2a2a4e",
        padding: { x: 10, y: 4 },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      sellAllBtn.on("pointerover", () => sellAllBtn.setColor("#ffd700"));
      sellAllBtn.on("pointerout", () => sellAllBtn.setColor("#ffaa44"));
      bindPointerRelease(sellAllBtn, () => {
        container.destroy();
        this.executeSell(sellableIndices, count, sellValue);
      });
      container.add(sellAllBtn);
      btnY += 22;
    }

    // Cancel
    const cancelBtn = this.add.text(boxX + boxW / 2, btnY, "Cancel", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ff8888",
      backgroundColor: "#2a2a4e",
      padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    cancelBtn.on("pointerover", () => cancelBtn.setColor("#ffd700"));
    cancelBtn.on("pointerout", () => cancelBtn.setColor("#ff8888"));
    bindPointerRelease(cancelBtn, () => container.destroy());
    container.add(cancelBtn);
    this.installModalLayout(container, bg, "shop-sale");
  }

  private executeSell(sellableIndices: number[], count: number, sellValue: number): void {
    // Sell from highest index first so splicing doesn't shift earlier indices
    const sorted = [...sellableIndices].sort((a, b) => b - a);
    let sold = 0;
    let totalGold = 0;
    let itemName = "";
    for (let i = 0; i < count && i < sorted.length; i++) {
      const idx = sorted[i];
      const item = this.player.inventory[idx];
      if (!item) continue;
      itemName = item.name;
      const result = sellItem(this.player, idx, sellValue);
      if (result.success) {
        sold++;
        totalGold += sellValue;
      }
    }
    if (sold > 0) {
      const msg = sold > 1
        ? `Sold ${sold}x ${itemName} for ${totalGold}g!`
        : `Sold ${itemName} for ${totalGold}g!`;
      this.setMessage(msg, "#88ff88");
    } else {
      this.setMessage("Could not sell item!", "#ff6666");
    }
    this.updateDisplay();
    this.renderItems();
  }

  private purchaseItem(item: Item): void {
    if (this.confirmationOverlay || this.negotiationOverlay || this.sceneTransitions.isPending) return;
    this.confirmPressed = false;
    const isEquipment = item.type === "weapon" || item.type === "armor" || item.type === "shield" || item.type === "mount";
    if (isEquipment && ownsEquipment(this.player, item.id)) {
      this.setMessage(`You already own ${item.name}!`, "#ff6666");
      return;
    }
    if ((item.levelReq ?? 0) > this.player.level) {
      this.setMessage(`You need to be level ${item.levelReq} to buy ${item.name}!`, "#ff6666");
      return;
    }

    const discountedCost = scaleCost(item.cost, getCampaignDifficultyRules(this.player), this.discount, 1);
    if (this.player.gold < discountedCost) {
      this.setMessage(`Not enough gold!`, "#ff6666");
      return;
    }
    this.player.gold -= discountedCost;
    this.player.inventory.push({ ...item });
    discoverCraftingRecipes(this.player, {
      type: "item",
      itemId: item.id,
    });
    const discovery = unlockCodexFromSignal(this.codex, {
      type: "itemAcquired",
      itemId: item.id,
    });
    this.pendingCodexDiscoveryIds.push(...discovery.unlockedIds);
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
    this.renderItems();
  }

  private getInnPrice(): number {
    return scaleCost(getInnCost(this.cityId), getCampaignDifficultyRules(this.player));
  }

  private restAtInn(): void {
    this.confirmPressed = false;
    const innCost = this.getInnPrice();
    if (this.player.gold < innCost) {
      this.setMessage(`Not enough gold to rest! (Need ${innCost}g)`, "#ff6666");
      return;
    }
    this.showInnConfirmation();
  }

  /** Show a prompt with two rest options: sleep until morning or wait until night. */
  private showInnConfirmation(): void {
    if (this.confirmationOverlay || this.negotiationOverlay) return;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const boxW = 300;
    const boxH = 110;
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;

    const container = this.add.container(0, 0).setDepth(50);
    this.confirmationOverlay = container;

    const bg = this.add.graphics();
    bg.fillStyle(UI_COLORS.panel, 0.94);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    container.add(bg);

    const prompt = this.add.text(boxX + boxW / 2, boxY + 10, `Rest at the inn for ${this.getInnPrice()}g?`, {
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
    bindPointerRelease(sleepBtn, () => {
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
    bindPointerRelease(waitBtn, () => {
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
    bindPointerRelease(cancelBtn, () => container.destroy());
    container.add(cancelBtn);
    this.installModalLayout(container, bg, "shop-inn");
  }

  /** Execute the inn rest: heal the player and advance time to the target step. */
  private confirmInnRest(targetTimeStep: number, message: string): void {
    const innCost = this.getInnPrice();
    if (this.player.gold < innCost) {
      this.setMessage(`Not enough gold to rest! (Need ${innCost}g)`, "#ff6666");
      return;
    }
    this.player.gold -= innCost;
    restPartyAtInn(this.player, true);
    this.timeStep = targetTimeStep;
    const preparation = this.player.pendingLevelUps > 0 ? prepareHeroLevelUp(this.player) : null;
    const saved = saveGame(this.player, this.defeatedBosses, this.codex,
      this.player.appearanceId, this.timeStep, this.weatherState);
    const error = preparation?.ok === false ? preparation.message : !saved.ok ? saved.message : undefined;
    this.setMessage(error ?? `${message}${preparation?.ok ? " Return outside to choose your next class." : ""}`,
      error ? "#ff6666" : "#88ff88");
    this.updateDisplay();
    this.renderItems();
  }

  private setMessage(msg: string, color: string): void {
    this.messageText.setText(msg).setColor(color);
    this.shopLayout.reflow();
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

    this.shopLayout.setSummary(
      `Weapon: ${weapon}\n` +
        `Armor: ${armor}\n` +
        `Shield: ${shield}\n\n` +
        `Prices: ${this.discount === 0 ? "standard" : `${Math.abs(Math.round(this.discount * 100))}% ${this.discount > 0 ? "discount" : "surcharge"}`}\n` +
        `Inventory:\n` +
        `  Potions: ${potionCount}\n` +
        `  Ethers: ${etherCount}\n` +
        `  Greater Potions: ${greaterCount}`
    );
  }

  private leaveShop(): void {
    this.confirmPressed = false;
    if (this.shopLayout?.closeItemDetails()) return;
    if (this.negotiationOverlay) {
      this.negotiationOverlay.destroy(true);
      return;
    }
    if (this.confirmationOverlay) {
      this.confirmationOverlay.destroy(true);
      return;
    }
    this.sceneTransitions.startWithFade(() => {
      this.scene.start("OverworldScene", createSharedSceneState({
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.savedSpecialNpcs,
        codexDiscoveryIds: [...new Set(this.pendingCodexDiscoveryIds)],
      }));
    }, {
      duration: 300,
      label: "leave shop",
    });
  }
}

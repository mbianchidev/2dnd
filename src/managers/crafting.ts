import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import {
  getCraftingRecipe,
  type CraftingCategory,
  type CraftingRecipeId,
  type CraftingStation,
} from "../data/crafting";
import type { CodexData } from "../systems/codex";
import {
  CRAFTING_SORTS,
  craftItem,
  getAvailableCraftingStations,
  getCraftingIngredientStatuses,
  reconcileCraftingRecipes,
  selectCraftingRecipes,
  type CraftingRecipeEntry,
  type CraftingSort,
} from "../systems/crafting";
import {
  getCompanion,
  type PartyMemberId,
} from "../systems/party";
import type { PlayerState } from "../systems/player";
import {
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";
import { openMobileTextInput } from "./input";
import { getCraftingDiscoveryCategories } from "../systems/featureDiscovery";

export interface CraftingManagerCallbacks {
  autoSave(): void;
  updateHUD(): void;
  showMessage(message: string, color?: string): void;
  reconcileAchievements(): void;
  refreshActors(): void;
}

const PAGE_SIZE = 6;
export class CraftingManager {
  private container: Phaser.GameObjects.Container | null = null;
  private player: PlayerState | null = null;
  private codex: CodexData | null = null;
  private selectedRecipeId: CraftingRecipeId | null = null;
  private actorId: PartyMemberId = "hero";
  private category: CraftingCategory | "all" = "all";
  private sort: CraftingSort = "category";
  private search = "";
  private batch = 1;
  private page = 0;
  private crafting = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: CraftingManagerCallbacks,
  ) {}

  isOpen(): boolean {
    return this.container !== null;
  }

  getDebugState(): string {
    if (!this.container || !this.player) return "";
    const entries = this.getEntries();
    const selected = this.getSelectedEntry(entries);
    return ` [CRAFTING Recipe:${selected?.recipe.id ?? "-"} Actor:${this.actorId} Batch:${this.batch} Category:${this.category} Sort:${this.sort} Search:${this.search || "-"} Known:${this.player.progression.crafting.knownRecipeIds.length}/${entries.length}]`;
  }

  open(player: PlayerState, codex: CodexData): void {
    this.close();
    this.player = player;
    this.codex = codex;
    reconcileCraftingRecipes(player, codex);
    this.actorId = "hero";
    this.category = "all";
    this.sort = "category";
    this.search = "";
    this.batch = 1;
    this.page = 0;
    this.selectedRecipeId = null;
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.render();
  }

  close(): void {
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.container?.destroy();
    this.container = null;
    this.player = null;
    this.codex = null;
    this.crafting = false;
    document.getElementById("mobile-text-input")?.remove();
  }

  clear(): void {
    this.close();
  }

  private getStation(): CraftingStation | undefined {
    const player = this.player;
    return player ? getAvailableCraftingStations(player)[0] : undefined;
  }

  private getEntries(): CraftingRecipeEntry[] {
    const player = this.player;
    if (!player) return [];
    return selectCraftingRecipes(player, {
      category: this.category,
      search: this.search,
      sort: this.sort,
      includeUnknown: true,
    }, this.actorId, this.getStation());
  }

  private getCategoryOptions(): Array<CraftingCategory | "all"> {
    const player = this.player;
    if (!player) return ["all"];
    return [
      "all",
      ...getCraftingDiscoveryCategories(player),
    ];
  }

  private getSelectedEntry(
    entries: readonly CraftingRecipeEntry[],
  ): CraftingRecipeEntry | undefined {
    return entries.find((entry) =>
      entry.recipe.id === this.selectedRecipeId
    ) ?? entries[0];
  }

  private ensureSelection(entries: readonly CraftingRecipeEntry[]): void {
    const selected = this.getSelectedEntry(entries);
    this.selectedRecipeId = selected?.recipe.id ?? null;
    const selectedIndex = selected
      ? entries.findIndex((entry) => entry.recipe.id === selected.recipe.id)
      : 0;
    this.page = Math.floor(Math.max(0, selectedIndex) / PAGE_SIZE);
    this.batch = Math.min(
      this.batch,
      selected?.recipe.maxBatch ?? 99,
    );
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    this.container?.destroy();
    const panelWidth = Math.min(760, GAME_WIDTH - 32);
    const panelHeight = Math.min(520, GAME_HEIGHT - 24);
    const panelX = (GAME_WIDTH - panelWidth) / 2;
    const panelY = (GAME_HEIGHT - panelHeight) / 2;
    const container = createOverlayContainer(
      this.scene,
      "crafting",
      320,
      {
        x: panelX,
        y: panelY,
        width: panelWidth,
        height: panelHeight,
      },
    );
    this.container = container;
    const dim = createDimGraphics(this.scene, GAME_WIDTH, GAME_HEIGHT);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    dim.on("pointerdown", () => this.close());
    container.add(dim);
    container.add(createPanelGraphics(
      this.scene,
      panelX,
      panelY,
      panelWidth,
      panelHeight,
      0.94,
      0xc89b3c,
    ));
    container.add(this.scene.add.text(
      panelX + panelWidth / 2,
      panelY + 12,
      "Crafting",
      {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffd966",
        fontStyle: "bold",
      },
    ).setOrigin(0.5, 0));

    const station = this.getStation();
    const actorName = this.actorId === "hero"
      ? player.name
      : getCompanion(player.party, this.actorId)?.name ?? this.actorId;
    container.add(this.scene.add.text(
      panelX + 16,
      panelY + 40,
      `Owner: ${actorName}  Station: ${station ?? "Field"}  Gold: ${player.gold}`,
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e8e8e8",
      },
    ));
    this.addButton(
      panelX + panelWidth - 122,
      panelY + 36,
      "Change owner",
      () => this.cycleActor(),
      "#9fe8ff",
    );

    const categoryLabel = this.category === "all"
      ? "All"
      : this.capitalize(this.category);
    this.addButton(
      panelX + 16,
      panelY + 60,
      `Category: ${categoryLabel}`,
      () => this.cycleCategory(1),
      "#80cbc4",
    );
    this.addButton(
      panelX + 180,
      panelY + 60,
      `Sort: ${this.capitalize(this.sort)}`,
      () => this.cycleSort(),
      "#c5a3ff",
    );
    this.addButton(
      panelX + 330,
      panelY + 60,
      `Search: ${this.search || "Any"}`,
      () => this.openSearch(),
      "#83d8ff",
    );

    const entries = this.getEntries();
    this.ensureSelection(entries);
    const selected = this.getSelectedEntry(entries);
    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    this.page = Math.min(this.page, totalPages - 1);
    const visible = entries.slice(
      this.page * PAGE_SIZE,
      (this.page + 1) * PAGE_SIZE,
    );
    const listX = panelX + 16;
    const listY = panelY + 92;
    const listWidth = 292;
    visible.forEach((entry, index) => {
      const isSelected = entry.recipe.id === selected?.recipe.id;
      const marker = isSelected ? ">" : " ";
      const state = entry.known
        ? entry.craftable ? "[READY]" : "[KNOWN]"
        : "[?????]";
      const label = entry.known ? entry.recipe.name : "Unknown Recipe";
      this.addButton(
        listX,
        listY + index * 40,
        `${marker} ${state} ${this.truncate(label, 22)}`,
        () => {
          this.selectedRecipeId = entry.recipe.id;
          this.batch = 1;
          this.render();
        },
        entry.craftable
          ? "#8cffb0"
          : entry.known ? "#f5e6c8" : "#888888",
        listWidth,
      );
      if (entry.known) {
        container.add(this.scene.add.text(
          listX + 12,
          listY + index * 40 + 18,
          `${this.capitalize(entry.recipe.category)} - ${this.truncate(entry.recipe.preview.benefit, 36)}`,
          {
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#b8b8b8",
          },
        ));
      }
    });
    container.add(this.scene.add.text(
      listX + listWidth / 2,
      listY + PAGE_SIZE * 40 + 2,
      `Page ${this.page + 1}/${totalPages}  Up/Down select  PgUp/PgDn page`,
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#bdbdbd",
      },
    ).setOrigin(0.5, 0));

    const detailX = panelX + 326;
    const detailWidth = panelWidth - 342;
    if (!selected) {
      container.add(this.scene.add.text(
        detailX,
        listY,
        "No recipes match the current filters.",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ffcc80",
          wordWrap: { width: detailWidth },
        },
      ));
    } else if (!selected.known) {
      container.add(this.scene.add.text(
        detailX,
        listY,
        `Unknown Recipe\n\nSource hint:\n${selected.recipe.preview.sourceHint}`,
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#aaaaaa",
          wordWrap: { width: detailWidth },
          lineSpacing: 4,
        },
      ));
    } else {
      this.renderKnownRecipe(selected, detailX, listY, detailWidth);
    }

    this.renderHistory(
      panelX + 16,
      panelY + panelHeight - 88,
      panelWidth - 32,
    );
    container.add(this.scene.add.text(
      panelX + panelWidth / 2,
      panelY + panelHeight - 18,
      "Enter/Space craft  Left/Right batch  Q/E category  R sort  F search  Tab owner  Esc close",
      {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#d0d0d0",
      },
    ).setOrigin(0.5, 0));
  }

  private renderKnownRecipe(
    selected: CraftingRecipeEntry,
    x: number,
    y: number,
    width: number,
  ): void {
    const player = this.player!;
    const recipe = selected.recipe;
    this.container?.add(this.scene.add.text(
      x,
      y,
      `${recipe.name}\n${recipe.preview.summary}`,
      {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffd966",
        wordWrap: { width },
        lineSpacing: 4,
      },
    ));
    const statuses = getCraftingIngredientStatuses(
      player,
      recipe.id,
      this.actorId,
      this.batch,
    );
    const ingredientLines = statuses.map((status) => {
      const enough = status.owned >= status.required;
      return `${enough ? "[OK]" : "[--]"} ${status.ingredient.label}: ${status.owned}/${status.required}`;
    });
    const output = getCraftingRecipe(recipe.id);
    const currentEquipment = recipe.upgrade
      ? this.actorId === "hero"
        ? [
          player.equippedWeapon,
          player.equippedArmor,
          player.equippedShield,
          player.equippedOffHand,
        ].find((item) => item?.id === recipe.upgrade?.inputItemId)
        : undefined
      : undefined;
    const comparison = recipe.upgrade
      ? `Upgrade: ${recipe.upgrade.inputItemId} -> ${recipe.outputItemId}`
        + (currentEquipment ? " [EQUIPPED LINK PRESERVED]" : "")
      : `Output: ${output.outputQuantity * this.batch}x ${output.outputItemId}`;
    this.container?.add(this.scene.add.text(
      x,
      y + 62,
      [
        `Benefit: ${recipe.preview.benefit}`,
        "",
        ...ingredientLines,
        `Gold: ${player.gold}/${(recipe.goldCost ?? 0) * this.batch}`,
        recipe.station
          ? `Station: ${this.getStation() === recipe.station ? "[OK]" : "[--]"} ${recipe.station}`
          : "Station: [OK] Field",
        "",
        comparison,
        selected.craftable ? "[READY] All requirements met." : `[BLOCKED] ${selected.reason ?? "Requirements not met."}`,
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#eeeeee",
        wordWrap: { width },
        lineSpacing: 3,
      },
    ));
    this.addButton(
      x,
      y + 278,
      `-  Batch ${this.batch}  +`,
      () => this.changeBatch(1),
      "#9fe8ff",
      150,
    );
    this.addButton(
      x + 166,
      y + 278,
      selected.craftable ? "Craft" : "Cannot craft",
      () => this.executeCraft(),
      selected.craftable ? "#8cffb0" : "#777777",
      138,
    );
  }

  private renderHistory(x: number, y: number, width: number): void {
    const history = this.player!.progression.crafting.recentHistory.slice(-3);
    const lines = history.length === 0
      ? ["Recent crafts: none"]
      : [
        "Recent crafts:",
        ...history.reverse().map((entry) =>
          `#${entry.sequence} ${getCraftingRecipe(entry.recipeId).name} x${entry.quantity} -> ${entry.outputItemId} x${entry.outputQuantity}${entry.debug ? " [DEBUG]" : ""}`
        ),
      ];
    this.container?.add(this.scene.add.text(x, y, lines.join("\n"), {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#b8b8b8",
      wordWrap: { width },
      lineSpacing: 2,
    }));
  }

  private moveSelection(delta: number): void {
    const entries = this.getEntries();
    if (entries.length === 0) return;
    const current = Math.max(0, entries.findIndex((entry) =>
      entry.recipe.id === this.selectedRecipeId
    ));
    const next = Math.min(Math.max(current + delta, 0), entries.length - 1);
    this.selectedRecipeId = entries[next]!.recipe.id;
    this.batch = 1;
    this.page = Math.floor(next / PAGE_SIZE);
    this.render();
  }

  private changePage(delta: number): void {
    const entries = this.getEntries();
    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    this.page = Math.min(Math.max(this.page + delta, 0), totalPages - 1);
    this.selectedRecipeId = entries[this.page * PAGE_SIZE]?.recipe.id ?? null;
    this.batch = 1;
    this.render();
  }

  private changeBatch(delta: number): void {
    const selected = this.getSelectedEntry(this.getEntries());
    if (!selected?.known) return;
    const maximum = selected.recipe.maxBatch ?? 99;
    this.batch = Math.min(Math.max(this.batch + delta, 1), maximum);
    this.render();
  }

  private cycleCategory(delta: number): void {
    const options = this.getCategoryOptions();
    const current = options.indexOf(this.category);
    this.category = options[
      (Math.max(current, 0) + delta + options.length) % options.length
    ]!;
    this.selectedRecipeId = null;
    this.batch = 1;
    this.page = 0;
    this.render();
  }

  private cycleSort(): void {
    const current = CRAFTING_SORTS.indexOf(this.sort);
    this.sort = CRAFTING_SORTS[(current + 1) % CRAFTING_SORTS.length]!;
    this.render();
  }

  private cycleActor(): void {
    const player = this.player!;
    const ids: PartyMemberId[] = [
      "hero",
      ...player.party.companions.map((companion) => companion.id),
    ];
    const current = ids.indexOf(this.actorId);
    this.actorId = ids[(current + 1) % ids.length]!;
    this.batch = 1;
    this.render();
  }

  private openSearch(): void {
    openMobileTextInput("Search crafting recipes", this.search, 40, (value) => {
      this.search = value.slice(0, 40);
      this.selectedRecipeId = null;
      this.page = 0;
      this.render();
    });
  }

  private executeCraft(): void {
    if (this.crafting) return;
    const player = this.player;
    const selected = this.getSelectedEntry(this.getEntries());
    if (!player || !selected?.known || !selected.craftable) {
      this.callbacks.showMessage(
        selected?.reason ?? "This recipe cannot be crafted.",
        "#ff8888",
      );
      return;
    }
    this.crafting = true;
    const transactionId =
      `craft:${player.progression.crafting.nextSequence}:${selected.recipe.id}:${this.actorId}:${this.batch}`;
    const result = craftItem(player, {
      recipeId: selected.recipe.id,
      transactionId,
      actorId: this.actorId,
      batch: this.batch,
      station: this.getStation(),
    });
    this.crafting = false;
    this.callbacks.showMessage(
      result.message,
      result.crafted ? "#8cffb0" : "#ff8888",
    );
    if (result.crafted) {
      this.callbacks.reconcileAchievements();
      this.callbacks.updateHUD();
      this.callbacks.refreshActors();
      this.callbacks.autoSave();
    }
    this.render();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.container) return;
    if (document.getElementById("mobile-text-input")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      this.moveSelection(-1);
    } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      this.moveSelection(1);
    } else if (event.key === "PageUp") {
      this.changePage(-1);
    } else if (event.key === "PageDown") {
      this.changePage(1);
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      this.changeBatch(-1);
    } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      this.changeBatch(1);
    } else if (event.key.toLowerCase() === "q") {
      this.cycleCategory(-1);
    } else if (event.key.toLowerCase() === "e") {
      this.cycleCategory(1);
    } else if (event.key.toLowerCase() === "r") {
      this.cycleSort();
    } else if (event.key.toLowerCase() === "f") {
      this.openSearch();
    } else if (event.key === "Tab") {
      event.preventDefault();
      this.cycleActor();
    } else if (
      (event.key === "Enter" || event.key === " ")
      && !event.repeat
    ) {
      this.executeCraft();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  private addButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
    color: string,
    width?: number,
  ): Phaser.GameObjects.Text {
    const button = this.scene.add.text(x, y, label, {
      fontFamily: "monospace",
      fontSize: "9px",
      color,
      backgroundColor: "#24243f",
      padding: { x: 6, y: 4 },
      fixedWidth: width,
    }).setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setColor("#ffffff"));
    button.on("pointerout", () => button.setColor(color));
    button.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      action();
    });
    this.container?.add(button);
    return button;
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private truncate(value: string, maximum: number): string {
    return value.length > maximum
      ? `${value.slice(0, maximum - 3)}...`
      : value;
  }
}

import * as Phaser from "phaser";
import {
  CODEX_KNOWLEDGE_CATEGORIES,
  type CodexKnowledgeCategory,
  type CodexKnowledgeEntry,
  type CodexUnlockSource,
} from "../data/codexKnowledge";
import { elementDisplayName } from "../data/elements";
import { getItem } from "../data/items";
import {
  getMonsterFamily,
  getMonsterTextureKey,
  MONSTER_FAMILIES,
  type MonsterFamilyId,
} from "../data/monsterFamilies";
import { ALL_MONSTERS, type Monster } from "../data/monsters";
import type { SavedSpecialNpc } from "../data/npcs";
import { debugPanelState } from "../config";
import { openMobileTextInput } from "../managers/input";
import { SceneTransitionManager } from "../managers/sceneTransition";
import { installSceneAccessibility } from "../systems/accessibility";
import {
  getCodexFamilyProgress,
  getCodexKnowledgeList,
  getCodexMonsterList,
  isCodexKnowledgeUnlocked,
  type CodexData,
  type CodexEntry,
  type CodexKnowledgeSort,
  type CodexMonsterSort,
} from "../systems/codex";
import type { PlayerState } from "../systems/player";
import {
  createWeatherState,
  type WeatherState,
} from "../systems/weather";
import { getCodexDiscoveryCategories } from "../systems/featureDiscovery";

const ENTRIES_PER_PAGE = 8;

type CodexCategory = "monsters" | CodexKnowledgeCategory;
type CodexListEntry = Monster | CodexKnowledgeEntry;

interface CategoryTab {
  readonly category: CodexCategory;
  readonly label: string;
  readonly symbol: string;
}

const CATEGORY_TABS: readonly CategoryTab[] = [
  { category: "monsters", label: "Monsters", symbol: "M" },
  { category: "location", label: "Locations", symbol: "L" },
  { category: "item", label: "Items", symbol: "I" },
  { category: "character", label: "People", symbol: "C" },
  { category: "faction", label: "Factions", symbol: "F" },
  { category: "history", label: "History", symbol: "H" },
];

const CATEGORY_LABELS: Readonly<Record<CodexCategory, string>> = {
  monsters: "Monsters",
  location: "Locations",
  item: "Items",
  character: "Characters",
  faction: "Factions",
  history: "History",
};

function isMonster(entry: CodexListEntry): entry is Monster {
  return "family" in entry;
}

function knowledgeSourceLines(source: CodexUnlockSource): string[] {
  return [
    `Source: ${source.label}`,
    `Unlock hint: ${source.hint}`,
  ];
}

export class CodexScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);
  private player!: PlayerState;
  private defeatedBosses!: Set<string>;
  private codex!: CodexData;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();
  private savedSpecialNpcs: SavedSpecialNpc[] = [];

  private category: CodexCategory = "monsters";
  private monsterSort: CodexMonsterSort = "family";
  private knowledgeSort: CodexKnowledgeSort = "category";
  private familyFilter?: MonsterFamilyId;
  private groupDiscovered = true;
  private search = "";
  private currentPage = 0;
  private selectedOnPage = 0;

  private listContainer!: Phaser.GameObjects.Container;
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private detailText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private prevBtn!: Phaser.GameObjects.Text;
  private nextBtn!: Phaser.GameObjects.Text;
  private discoveredLabel!: Phaser.GameObjects.Text;
  private filterText!: Phaser.GameObjects.Text;
  private sortText!: Phaser.GameObjects.Text;
  private searchText!: Phaser.GameObjects.Text;
  private headerText!: Phaser.GameObjects.Text;
  private monsterPreview!: Phaser.GameObjects.Sprite;
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
    this.category = this.getAvailableCategoryTabs()[0]?.category ?? "monsters";
    this.monsterSort = "family";
    this.knowledgeSort = "category";
    this.familyFilter = undefined;
    this.groupDiscovered = true;
    this.search = "";
    this.currentPage = 0;
    this.selectedOnPage = 0;
    this.entryTexts = [];
    this.tabTexts = [];
  }

  private get masterList(): CodexListEntry[] {
    if (this.category === "monsters") {
      return getCodexMonsterList(
        this.codex,
        this.monsterSort,
        this.familyFilter,
        this.search,
      );
    }
    return getCodexKnowledgeList(this.codex, {
      category: this.category,
      search: this.search,
      sort: this.knowledgeSort,
      groupDiscovered: this.groupDiscovered,
    });
  }

  private get totalPages(): number {
    return Math.max(1, Math.ceil(this.masterList.length / ENTRIES_PER_PAGE));
  }

  private isDiscovered(entry: CodexListEntry): boolean {
    return isMonster(entry)
      ? entry.id in this.codex.entries
      : isCodexKnowledgeUnlocked(this.codex, entry.id);
  }

  private discoveredCountForCategory(): number {
    return this.masterList.filter((entry) => this.isDiscovered(entry)).length;
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(0x0e0e1e);
    this.sceneTransitions.prepare(300);
    installSceneAccessibility(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.getElementById("mobile-text-input")?.remove();
    });

    this.add.text(width / 2, 6, "CODEX", {
      fontSize: "19px",
      fontFamily: "monospace",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 2,
    }).setOrigin(0.5, 0);

    this.createCategoryTabs(width);
    this.createControls(width);
    this.createPanels(width, height);
    this.createPageNavigation(width, height);
    this.addBackButton(width, height);
    this.renderPage();
    this.setupInput();
  }

  private createCategoryTabs(width: number): void {
    const tabs = this.getAvailableCategoryTabs();
    const tabY = 28;
    const tabSpacing = width / (tabs.length + 1);
    this.tabUnderline = this.add.graphics();
    for (let index = 0; index < tabs.length; index++) {
      const definition = tabs[index]!;
      const x = tabSpacing * (index + 1);
      const tab = this.add.text(
        x,
        tabY,
        `[${definition.symbol}] ${definition.label}`,
        {
          fontSize: "9px",
          fontFamily: "monospace",
          color: definition.category === this.category ? "#ffd700" : "#999999",
        },
      ).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      tab.setData("accessibilityMaxWidth", tabSpacing - 4);
      tab.on("pointerdown", () => this.switchCategory(definition.category));
      this.tabTexts.push(tab);
    }
    this.updateTabPresentation();
  }

  private createControls(width: number): void {
    this.filterText = this.add.text(12, 48, "", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#d7b96e",
    }).setInteractive({ useHandCursor: true });
    this.filterText.on("pointerdown", () => this.cycleFilter());

    this.searchText = this.add.text(width / 2, 48, "", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#fff3a6",
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.searchText.on("pointerdown", () => this.openSearch());

    this.sortText = this.add.text(width - 12, 48, "", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#d7b96e",
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.sortText.on("pointerdown", () => this.cycleSort());

    this.discoveredLabel = this.add.text(width / 2, 66, "", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#b8b8c8",
    }).setOrigin(0.5, 0);
  }

  private createPanels(width: number, height: number): void {
    const panelY = 82;
    const panelHeight = height - 132;
    const leftWidth = width * 0.38;

    const listBackground = this.add.graphics();
    listBackground.fillStyle(0x181830, 0.95);
    listBackground.fillRect(10, panelY, leftWidth, panelHeight);
    listBackground.lineStyle(1, 0xc0a060, 0.9);
    listBackground.strokeRect(10, panelY, leftWidth, panelHeight);
    this.listContainer = this.add.container(18, panelY + 7);

    const detailX = width * 0.4;
    const detailWidth = width * 0.58;
    const detailBackground = this.add.graphics();
    detailBackground.fillStyle(0x181830, 0.95);
    detailBackground.fillRect(detailX, panelY, detailWidth, panelHeight);
    detailBackground.lineStyle(1, 0xc0a060, 0.9);
    detailBackground.strokeRect(detailX, panelY, detailWidth, panelHeight);

    this.headerText = this.add.text(detailX + 10, panelY + 8, "", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#ffd166",
      lineSpacing: 2,
      wordWrap: { width: detailWidth - 20 },
    });
    this.headerText.setData("accessibilityMaxWidth", detailWidth - 20);

    this.monsterPreview = this.add.sprite(
      detailX + 52,
      panelY + 126,
      getMonsterTextureKey(ALL_MONSTERS[0]!),
    ).setScale(0.68).setVisible(false);

    this.detailText = this.add.text(detailX + 108, panelY + 72, "", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#e2e2e8",
      lineSpacing: 2,
      wordWrap: { width: detailWidth - 118 },
    });
    this.detailText.setData("accessibilityMaxWidth", detailWidth - 118);
  }

  private createPageNavigation(width: number, height: number): void {
    const center = 10 + (width * 0.38) / 2;
    const y = height - 46;
    this.prevBtn = this.add.text(center - 58, y, "< A", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#d7b96e",
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.prevBtn.on("pointerdown", () => this.goToPrevPage());

    this.pageText = this.add.text(center, y, "", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#d7b96e",
    }).setOrigin(0.5, 0);

    this.nextBtn = this.add.text(center + 58, y, "D >", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#d7b96e",
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.nextBtn.on("pointerdown", () => this.goToNextPage());
  }

  private switchCategory(category: CodexCategory): void {
    if (
      this.sceneTransitions.isPending
      || this.category === category
      || !this.getAvailableCategoryTabs().some((tab) => tab.category === category)
    ) {
      return;
    }
    this.category = category;
    this.currentPage = 0;
    this.selectedOnPage = 0;
    this.updateTabPresentation();
    this.renderPage();
  }

  private cycleCategory(direction: number): void {
    const tabs = this.getAvailableCategoryTabs();
    if (tabs.length === 0) return;
    const index = tabs.findIndex(
      (tab) => tab.category === this.category,
    );
    const next = (
      index + direction + tabs.length
    ) % tabs.length;
    this.switchCategory(tabs[next]!.category);
  }

  private updateTabPresentation(): void {
    const tabs = this.getAvailableCategoryTabs();
    this.tabUnderline.clear();
    for (let index = 0; index < this.tabTexts.length; index++) {
      const active = tabs[index]!.category === this.category;
      const tab = this.tabTexts[index]!;
      tab.setColor(active ? "#ffd700" : "#999999");
      if (active) {
        const bounds = tab.getBounds();
        this.tabUnderline.lineStyle(2, 0xffd700, 1);
        this.tabUnderline.lineBetween(
          bounds.left,
          bounds.bottom + 1,
          bounds.right,
          bounds.bottom + 1,
        );
      }
    }
  }

  private getAvailableCategoryTabs(): CategoryTab[] {
    const categories = new Set(getCodexDiscoveryCategories(this.player));
    return CATEGORY_TABS.filter((tab) =>
      categories.has(tab.category)
    );
  }

  private cycleFilter(): void {
    if (this.sceneTransitions.isPending) return;
    if (this.category === "monsters") {
      const ids = MONSTER_FAMILIES.map((family) => family.id);
      const current = this.familyFilter ? ids.indexOf(this.familyFilter) : -1;
      this.familyFilter = current >= ids.length - 1
        ? undefined
        : ids[current + 1];
    } else {
      this.groupDiscovered = !this.groupDiscovered;
    }
    this.currentPage = 0;
    this.selectedOnPage = 0;
    this.renderPage();
  }

  private cycleSort(): void {
    if (this.sceneTransitions.isPending) return;
    if (this.category === "monsters") {
      const sorts: readonly CodexMonsterSort[] = [
        "family",
        "name",
        "defeated",
        "element",
      ];
      this.monsterSort = sorts[
        (sorts.indexOf(this.monsterSort) + 1) % sorts.length
      ]!;
    } else {
      const sorts: readonly CodexKnowledgeSort[] = [
        "category",
        "name",
        "source",
      ];
      this.knowledgeSort = sorts[
        (sorts.indexOf(this.knowledgeSort) + 1) % sorts.length
      ]!;
    }
    this.currentPage = 0;
    this.selectedOnPage = 0;
    this.renderPage();
  }

  private openSearch(): void {
    if (this.sceneTransitions.isPending) return;
    debugPanelState(
      `CODEX | Category: ${CATEGORY_LABELS[this.category]} | Focus: search`,
    );
    openMobileTextInput("Search Codex", this.search, 32, (value) => {
      this.search = value.trim();
      this.currentPage = 0;
      this.selectedOnPage = 0;
      this.renderPage();
    });
  }

  private clearSearch(): void {
    if (!this.search) return;
    this.search = "";
    this.currentPage = 0;
    this.selectedOnPage = 0;
    this.renderPage();
  }

  private pageEntries(): CodexListEntry[] {
    const start = this.currentPage * ENTRIES_PER_PAGE;
    return this.masterList.slice(start, start + ENTRIES_PER_PAGE);
  }

  private renderPage(): void {
    for (const text of this.entryTexts) text.destroy();
    this.entryTexts = [];

    const list = this.masterList;
    if (this.currentPage >= this.totalPages) this.currentPage = 0;
    const entries = this.pageEntries();
    this.selectedOnPage = Math.min(
      this.selectedOnPage,
      Math.max(0, entries.length - 1),
    );

    this.discoveredLabel.setText(
      `Discovered ${this.discoveredCountForCategory()} / ${list.length}`,
    );
    this.searchText.setText(
      this.search ? `/ Search: ${this.search}` : "/ Search",
    );
    if (this.category === "monsters") {
      this.filterText.setText(
        `F Family: ${
          this.familyFilter
            ? getMonsterFamily(this.familyFilter).name
            : "All"
        }`,
      );
      this.sortText.setText(`R Sort: ${this.monsterSort}`);
    } else {
      this.filterText.setText(
        `F Group: ${this.groupDiscovered ? "Known first" : "Canonical"}`,
      );
      this.sortText.setText(`R Sort: ${this.knowledgeSort}`);
    }

    entries.forEach((entry, index) => {
      const discovered = this.isDiscovered(entry);
      const selected = index === this.selectedOnPage;
      const marker = selected ? ">" : " ";
      let label: string;
      if (isMonster(entry)) {
        const family = getMonsterFamily(entry.family);
        const boss = entry.isBoss ? "BOSS " : "";
        label = discovered
          ? `${marker} ${boss}${family.symbol} ${entry.name}`
          : `${marker} ${boss}${family.symbol} ???`;
      } else {
        const symbol = CATEGORY_TABS.find(
          (tab) => tab.category === entry.category,
        )?.symbol ?? "?";
        label = discovered
          ? `${marker} [${symbol}] ${entry.name}`
          : `${marker} [${symbol}] Undiscovered`;
      }
      const color = selected
        ? "#ffd700"
        : discovered
        ? "#dddddd"
        : "#999999";
      const text = this.add.text(0, index * 25, label, {
        fontSize: "10px",
        fontFamily: "monospace",
        color,
      }).setInteractive({ useHandCursor: true });
      text.setData("discovered", discovered);
      text.setData(
        "accessibilityMaxWidth",
        this.cameras.main.width * 0.38 - 24,
      );
      text.on("pointerdown", () => {
        this.selectedOnPage = index;
        this.renderPage();
      });
      this.listContainer.add(text);
      this.entryTexts.push(text);
    });

    this.pageText.setText(`Page ${this.currentPage + 1}/${this.totalPages}`);
    this.prevBtn.setVisible(this.currentPage > 0);
    this.nextBtn.setVisible(this.currentPage < this.totalPages - 1);

    const selected = entries[this.selectedOnPage];
    if (!selected) {
      this.headerText.setText("No entries match this search.");
      this.detailText.setText("Clear or change the search query.");
      this.monsterPreview.setVisible(false);
      this.updateDebugState();
      return;
    }
    this.showDetail(selected);
  }

  private showDetail(entry: CodexListEntry): void {
    if (isMonster(entry)) {
      this.showMonsterDetail(entry);
      return;
    }
    this.showKnowledgeDetail(entry);
  }

  private showMonsterDetail(monster: Monster): void {
    const discovered = this.isDiscovered(monster);
    const progress = getCodexFamilyProgress(this.codex, monster.family);
    const family = progress.family;
    this.headerText.setText(
      `${family.symbol} ${family.name} - ${progress.discovered}/${progress.total}\n`
      + `${family.sharedTraits.join(" / ")}`
      + (progress.complete ? "\n[FAMILY COMPLETE]" : ""),
    );
    this.monsterPreview
      .setTexture(getMonsterTextureKey(monster))
      .setScale(monster.isBoss ? 0.6 : 0.68)
      .setVisible(true);

    if (!discovered) {
      this.monsterPreview.setTint(0x111111);
      this.detailText.setText(
        "UNDISCOVERED MONSTER\n\nDefeat this creature to reveal its record.",
      );
      this.updateDebugState(
        monster.id,
        false,
        ` | Texture: ${getMonsterTextureKey(monster)}`
        + ` | Completion: ${progress.complete ? "complete" : "incomplete"}`,
      );
      return;
    }

    this.monsterPreview.clearTint();
    const entry: CodexEntry = this.codex.entries[monster.id]!;
    const lines = [
      entry.isBoss ? `${entry.name} [BOSS]` : entry.name,
      `Defeated: ${entry.timesDefeated}`,
      `Family: ${family.name}`,
      `Affinity: ${
        monster.affinity ? elementDisplayName(monster.affinity) : "None"
      }`,
      "",
      `HP: ${entry.hp}`,
      entry.acDiscovered ? `AC: ${entry.ac}` : "AC: ???",
      `XP: ${entry.xpReward}`,
      `Gold: ${entry.goldReward}`,
      "",
      "Known drops:",
      ...(entry.itemsDropped.length > 0
        ? entry.itemsDropped.map((itemId) =>
          `- ${getItem(itemId)?.name ?? itemId}`
        )
        : ["- None observed"]),
    ];
    const profile = monster.elementalProfile;
    if (entry.discoveredElements.length > 0 && profile) {
      lines.push("", "Observed elements:");
      for (const element of entry.discoveredElements) {
        const name = elementDisplayName(element);
        if (profile.immunities?.includes(element)) lines.push(`- Immune: ${name}`);
        else if (profile.weaknesses?.includes(element)) lines.push(`- Weak: ${name}`);
        else if (profile.resistances?.includes(element)) lines.push(`- Resists: ${name}`);
      }
    }
    this.detailText.setText(lines.join("\n"));
    this.updateDebugState(
      monster.id,
      true,
      ` | Texture: ${getMonsterTextureKey(monster)}`
      + ` | Completion: ${progress.complete ? "complete" : "incomplete"}`,
    );
  }

  private showKnowledgeDetail(entry: CodexKnowledgeEntry): void {
    const discovered = this.isDiscovered(entry);
    const source = entry.sources[0]!;
    this.monsterPreview.setVisible(false);
    this.headerText.setText(
      discovered
        ? `[${CATEGORY_LABELS[entry.category].toUpperCase()}] ${entry.name}`
        : `[${CATEGORY_LABELS[entry.category].toUpperCase()}] UNDISCOVERED`,
    );
    if (!discovered) {
      this.detailText.setText([
        "This record has not been discovered.",
        "",
        ...knowledgeSourceLines(source),
      ].join("\n"));
      this.updateDebugState(entry.id, false);
      return;
    }

    const lines = [
      entry.summary,
      "",
      ...entry.details,
      "",
      ...knowledgeSourceLines(source),
    ];
    if (entry.category === "item") {
      const item = getItem(entry.id);
      if (item) {
        lines.push("", `Item type: ${item.type}`);
        if (item.effect > 0) lines.push(`Effect value: +${item.effect}`);
        if (item.cost > 0) lines.push(`Shop price: ${item.cost} gold`);
      }
    }
    this.detailText.setText(lines.join("\n"));
    this.updateDebugState(entry.id, true);
  }

  private updateDebugState(
    selectedId = "none",
    discovered = false,
    detail = "",
  ): void {
    const sort = this.category === "monsters"
      ? this.monsterSort
      : this.knowledgeSort;
    const filter = this.category === "monsters"
      ? `Family: ${this.familyFilter ?? "all"}`
      : `Filter: ${
        this.groupDiscovered ? "knownFirst" : "canonical"
      }`;
    debugPanelState(
      `CODEX | Category: ${CATEGORY_LABELS[this.category]}`
      + ` | ${filter}`
      + ` | Sort: ${sort}`
      + ` | Search: ${this.search || "-"}`
      + ` | Selected: ${selectedId}`
      + ` | ${discovered ? "DISCOVERED" : "UNDISCOVERED"}`
      + detail,
    );
  }

  private goToPrevPage(): void {
    if (this.sceneTransitions.isPending || this.currentPage <= 0) return;
    this.currentPage--;
    this.selectedOnPage = 0;
    this.renderPage();
  }

  private goToNextPage(): void {
    if (
      this.sceneTransitions.isPending
      || this.currentPage >= this.totalPages - 1
    ) {
      return;
    }
    this.currentPage++;
    this.selectedOnPage = 0;
    this.renderPage();
  }

  private moveSelection(direction: number): void {
    const entries = this.pageEntries();
    if (entries.length === 0) return;
    this.selectedOnPage = Math.max(
      0,
      Math.min(entries.length - 1, this.selectedOnPage + direction),
    );
    this.renderPage();
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    const bind = (
      codes: readonly number[],
      action: () => void,
    ): void => {
      for (const code of codes) keyboard.addKey(code).on("down", action);
    };

    bind([
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.UP,
    ], () => this.moveSelection(-1));
    bind([
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
    ], () => this.moveSelection(1));
    bind([
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
    ], () => this.goToPrevPage());
    bind([
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ], () => this.goToNextPage());
    bind([
      Phaser.Input.Keyboard.KeyCodes.ESC,
      Phaser.Input.Keyboard.KeyCodes.B,
    ], () => this.goBack());
    bind([Phaser.Input.Keyboard.KeyCodes.F], () => this.cycleFilter());
    bind([Phaser.Input.Keyboard.KeyCodes.R], () => this.cycleSort());
    bind([Phaser.Input.Keyboard.KeyCodes.Q], () => this.cycleCategory(-1));
    bind([Phaser.Input.Keyboard.KeyCodes.E], () => this.cycleCategory(1));
    bind([Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH], () => this.openSearch());
    bind([Phaser.Input.Keyboard.KeyCodes.BACKSPACE], () => this.clearSearch());

    const tabs = this.getAvailableCategoryTabs();
    for (let key = 1; key <= tabs.length; key++) {
      keyboard.addKey(48 + key).on("down", () => {
        this.switchCategory(tabs[key - 1]!.category);
      });
    }
  }

  private addBackButton(width: number, height: number): void {
    const container = this.add.container(width / 2, height - 28);
    const background = this.add.image(0, 0, "button")
      .setDisplaySize(160, 30)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(0, 0, "< Back (B/ESC)", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#eeeeee",
    }).setOrigin(0.5);
    background.on("pointerdown", () => this.goBack());
    container.add([background, label]);
  }

  private goBack(): void {
    if (this.sceneTransitions.isPending) return;
    document.getElementById("mobile-text-input")?.remove();
    this.sceneTransitions.startWithFade(() => {
      this.scene.start("OverworldScene", {
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.savedSpecialNpcs,
      });
    }, {
      duration: 300,
      label: "leave codex",
    });
  }
}

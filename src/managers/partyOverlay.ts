import * as Phaser from "phaser";
import { getAbility } from "../data/abilities";
import {
  COMPANION_IDS,
  isCompanionId,
  type CompanionId,
} from "../data/companions";
import { getItem, type Item } from "../data/items";
import { getSpell } from "../data/spells";
import {
  allocateStatPoint,
  getArmorClass,
  useCombatItem,
  useCombatItemOnTarget,
  type CombatActorState,
  type PlayerState,
  type PlayerStats,
  type ProgressingActorState,
} from "../systems/player";
import { playerCastSpellAtTargets } from "../systems/combat";
import {
  getCompanion,
  moveActiveCompanion,
  setCompanionActive,
  transferPartyItem,
  type CompanionState,
  type PartyMemberId,
} from "../systems/party";
import {
  MAX_GAMBITS_PER_COMPANION,
  createDefaultGambitRule,
  formatGambitRule,
  type GambitAction,
  type GambitCondition,
  type GambitRule,
  type GambitSubjectSelector,
  type GambitTargetSelector,
} from "../systems/gambits";
import {
  createDimGraphics,
  createPanelGraphics,
} from "../utils/ui";

interface PartyOverlayCallbacks {
  updateHUD(): void;
  autoSave(): void;
  showMessage(text: string, color?: string): void;
  refreshActors(): void;
}

type PartyOverlayPage = "status" | "items" | "gambits";

interface PartyMemberView {
  id: PartyMemberId;
  name: string;
  state: ProgressingActorState;
  companion?: CompanionState;
}

const STAT_LABELS: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: "strength", label: "STR" },
  { key: "dexterity", label: "DEX" },
  { key: "constitution", label: "CON" },
  { key: "intelligence", label: "INT" },
  { key: "wisdom", label: "WIS" },
  { key: "charisma", label: "CHA" },
];

export class PartyOverlayManager {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: PartyOverlayCallbacks;
  private overlay: Phaser.GameObjects.Container | null = null;
  private player: PlayerState | null = null;
  private selectedId: PartyMemberId = "hero";
  private targetId: PartyMemberId = "hero";
  private page: PartyOverlayPage = "status";
  private listPage = 0;

  constructor(scene: Phaser.Scene, callbacks: PartyOverlayCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  toggle(player: PlayerState): void {
    if (this.overlay) {
      this.close();
      return;
    }
    this.player = player;
    this.selectedId = this.resolveSelectedId(player);
    this.targetId = this.selectedId;
    this.page = "status";
    this.listPage = 0;
    this.render();
  }

  close(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.player = null;
  }

  private resolveSelectedId(player: PlayerState): PartyMemberId {
    if (this.selectedId === "hero") return "hero";
    return player.party.companions.some(
      (companion) => companion.id === this.selectedId,
    ) ? this.selectedId : "hero";
  }

  private getMembers(): PartyMemberView[] {
    const player = this.player!;
    return [
      { id: "hero", name: player.name, state: player },
      ...player.party.companions.map((companion) => ({
        id: companion.id,
        name: companion.name,
        state: companion,
        companion,
      })),
    ];
  }

  private getMember(memberId: PartyMemberId): PartyMemberView | undefined {
    return this.getMembers().find((member) => member.id === memberId);
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    this.overlay?.destroy();
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    const panelWidth = Math.min(620, width - 24);
    const panelHeight = Math.min(450, height - 24);
    const panelX = Math.floor((width - panelWidth) / 2);
    const panelY = Math.floor((height - panelHeight) / 2);
    const container = this.scene.add.container(0, 0).setDepth(80);
    const dim = createDimGraphics(this.scene, width, height, 0.7)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
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
      0.98,
      0xc0a060,
    ));
    container.add(this.scene.add.text(
      panelX + panelWidth / 2,
      panelY + 10,
      "Party",
      {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffd700",
      },
    ).setOrigin(0.5, 0));
    this.overlay = container;

    this.renderMemberList(panelX + 12, panelY + 42, 150);
    this.renderTabs(panelX + 176, panelY + 42, panelWidth - 188);
    if (this.page === "status") {
      this.renderStatusPage(panelX + 176, panelY + 74, panelWidth - 188);
    } else if (this.page === "items") {
      this.renderItemsPage(panelX + 176, panelY + 74, panelWidth - 188);
    } else {
      this.renderGambitsPage(panelX + 176, panelY + 74, panelWidth - 188);
    }
    this.addButton(
      panelX + panelWidth - 70,
      panelY + panelHeight - 30,
      "Close",
      () => this.close(),
      "#ff9999",
    );
  }

  private renderMemberList(x: number, y: number, width: number): void {
    let currentY = y;
    for (const member of this.getMembers()) {
      const companion = member.companion;
      const activeIndex = companion
        ? this.player!.party.activeCompanionIds.indexOf(companion.id)
        : -1;
      const activeLabel = member.id === "hero"
        ? "[Leader]"
        : activeIndex >= 0
          ? `[${activeIndex + 1}]`
          : "[Reserve]";
      this.addButton(
        x,
        currentY,
        `${member.name} ${activeLabel}`,
        () => {
          this.selectedId = member.id;
          this.targetId = member.id;
          this.listPage = 0;
          this.render();
        },
        member.id === this.selectedId ? "#ffd700" : "#b8ddff",
        width,
      );
      currentY += 30;
      if (companion) {
        this.addButton(x, currentY, "Up", () => {
          this.applyMutation(
            moveActiveCompanion(this.player!.party, companion.id, -1),
          );
        }, "#aaaaaa", 42);
        this.addButton(x + 48, currentY, "Down", () => {
          this.applyMutation(
            moveActiveCompanion(this.player!.party, companion.id, 1),
          );
        }, "#aaaaaa", 50);
        this.addButton(x + 104, currentY, activeIndex >= 0 ? "Out" : "In", () => {
          this.applyMutation(
            setCompanionActive(
              this.player!.party,
              companion.id,
              activeIndex < 0,
            ),
          );
        }, "#aaaaaa", 42);
        currentY += 28;
      }
    }
  }

  private renderTabs(x: number, y: number, width: number): void {
    const tabs: Array<{ page: PartyOverlayPage; label: string }> = [
      { page: "status", label: "Status" },
      { page: "items", label: "Items" },
      { page: "gambits", label: "Gambits" },
    ];
    const tabWidth = Math.floor((width - 12) / tabs.length);
    tabs.forEach((tab, index) => {
      this.addButton(
        x + index * (tabWidth + 4),
        y,
        tab.label,
        () => {
          this.page = tab.page;
          this.listPage = 0;
          this.render();
        },
        this.page === tab.page ? "#ffd700" : "#bbbbbb",
        tabWidth,
      );
    });
  }

  private renderStatusPage(x: number, y: number, width: number): void {
    const member = this.getMember(this.selectedId);
    if (!member) return;
    const state = member.state;
    let currentY = y;
    this.addText(x, currentY, `${member.name} Lv.${state.level}`, "#ffd700", 14);
    currentY += 24;
    this.addText(
      x,
      currentY,
      `HP ${state.hp}/${state.maxHp}  MP ${state.mp}/${state.maxMp}  AC ${getArmorClass(state)}`,
    );
    currentY += 22;
    this.addText(
      x,
      currentY,
      `XP ${state.xp}  Pending levels ${state.pendingLevelUps}`,
    );
    currentY += 24;
    if (member.companion) {
      this.addButton(x, currentY, `Control: ${member.companion.controlMode}`, () => {
        member.companion!.controlMode =
          member.companion!.controlMode === "manual" ? "gambit" : "manual";
        this.changed("Companion control updated.");
      }, "#aaffaa", 180);
      currentY += 34;
    }
    this.addText(x, currentY, "Stats", "#c0a060");
    currentY += 20;
    STAT_LABELS.forEach(({ key, label }, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      this.addText(
        x + column * 105,
        currentY + row * 26,
        `${label} ${state.stats[key]}`,
      );
      if (state.pendingStatPoints > 0) {
        this.addButton(
          x + column * 105 + 62,
          currentY + row * 26 - 3,
          "+",
          () => {
            if (allocateStatPoint(state, key)) {
              this.changed(`${label} increased.`);
            }
          },
          "#88ff88",
          26,
        );
      }
    });
    currentY += 64;
    this.addText(x, currentY, "Equipment", "#c0a060");
    currentY += 20;
    const equipment = [
      state.equippedWeapon?.name ?? "Bare Hands",
      state.equippedArmor?.name ?? "No Armor",
      state.equippedShield?.name ?? "No Shield",
    ];
    for (const label of equipment) {
      this.addText(x + 8, currentY, label);
      currentY += 18;
    }
    this.addText(
      x,
      currentY + 8,
      `Target: ${this.getMember(this.targetId)?.name ?? "Hero"}`,
      "#c0a060",
    );
    this.addButton(x + 210, currentY + 3, "Next Target", () => {
      this.cycleTarget();
      this.render();
    }, "#bbbbff", 110);
  }

  private renderItemsPage(x: number, y: number, width: number): void {
    const member = this.getMember(this.selectedId);
    const target = this.getMember(this.targetId);
    if (!member || !target) return;
    this.addText(
      x,
      y,
      `${member.name}'s bag -> ${target.name}`,
      "#ffd700",
      13,
    );
    this.addButton(x + width - 112, y - 4, "Next Target", () => {
      this.cycleTarget();
      this.render();
    }, "#bbbbff", 108);
    const pageSize = 9;
    const totalPages = Math.max(
      1,
      Math.ceil(member.state.inventory.length / pageSize),
    );
    this.listPage = Phaser.Math.Clamp(this.listPage, 0, totalPages - 1);
    const visible = member.state.inventory.slice(
      this.listPage * pageSize,
      (this.listPage + 1) * pageSize,
    );
    visible.forEach((item, offset) => {
      const itemIndex = this.listPage * pageSize + offset;
      const rowY = y + 32 + offset * 34;
      this.addText(x, rowY, `${item.name} (${item.type})`, "#dddddd");
      if (
        item.type === "weapon"
        || item.type === "armor"
        || item.type === "shield"
      ) {
        this.addButton(x + width - 178, rowY - 5, "Equip", () => {
          const result = useCombatItem(member.state, itemIndex);
          this.changed(result.message, result.used);
        }, "#aaffaa", 70);
      } else if (item.type === "consumable") {
        this.addButton(x + width - 178, rowY - 5, "Use", () => {
          const result = useCombatItemOnTarget(
            member.state,
            itemIndex,
            target.state,
          );
          this.changed(result.message, result.used);
        }, "#aaffaa", 70);
      }
      this.addButton(x + width - 100, rowY - 5, "Transfer", () => {
        const result = transferPartyItem(
          this.player!,
          member.id,
          target.id,
          itemIndex,
        );
        this.changed(result.message, result.transferred);
      }, "#aaddff", 90);
    });
    this.addButton(x, y + 350, `Page ${this.listPage + 1}/${totalPages}`, () => {
      this.listPage = (this.listPage + 1) % totalPages;
      this.render();
    }, "#bbbbbb", 100);
    const healingSpells = member.state.knownSpells
      .map((spellId) => getSpell(spellId))
      .filter((spell) => spell?.type === "heal");
    if (healingSpells.length > 0) {
      this.addButton(x + 112, y + 350, "Cast Heal", () => {
        const spell = healingSpells[0]!;
        const result = playerCastSpellAtTargets(
          member.state,
          spell.id,
          [],
          [{
            id: target.id,
            label: target.name,
            get currentHp() {
              return target.state.hp;
            },
            set currentHp(value: number) {
              target.state.hp = value;
            },
            get maxHp() {
              return target.state.maxHp;
            },
            effects: target.state.activeEffects,
          }],
        );
        this.changed(result.message, result.mpUsed > 0);
      }, "#ccffcc", 100);
    }
  }

  private renderGambitsPage(x: number, y: number, width: number): void {
    const companion = isCompanionId(this.selectedId)
      ? getCompanion(this.player!.party, this.selectedId)
      : undefined;
    if (!companion) {
      this.addText(x, y, "Select a companion to edit gambits.", "#888888");
      return;
    }
    this.addText(
      x,
      y,
      `${companion.name} - ${companion.controlMode}`,
      "#ffd700",
      13,
    );
    this.addButton(x + width - 100, y - 4, "Add Rule", () => {
      if (companion.gambits.length >= MAX_GAMBITS_PER_COMPANION) {
        this.callbacks.showMessage("Maximum 12 gambits.", "#ff8888");
        return;
      }
      companion.gambits.push(createDefaultGambitRule(
        `${companion.id}-${Date.now()}-${companion.gambits.length}`,
        companion.gambits.length + 1,
      ));
      this.changed("Gambit added.");
    }, "#aaffaa", 90);
    const pageSize = 4;
    const totalPages = Math.max(
      1,
      Math.ceil(companion.gambits.length / pageSize),
    );
    this.listPage = Phaser.Math.Clamp(this.listPage, 0, totalPages - 1);
    const visible = companion.gambits.slice(
      this.listPage * pageSize,
      (this.listPage + 1) * pageSize,
    );
    visible.forEach((rule, offset) => {
      const ruleIndex = this.listPage * pageSize + offset;
      const rowY = y + 34 + offset * 82;
      this.addText(
        x,
        rowY,
        `${rule.rank}. ${rule.enabled ? "[ON]" : "[OFF]"} ${formatGambitRule(rule)}`,
        rule.enabled ? "#dddddd" : "#777777",
        9,
        width,
      );
      const controls: Array<{ label: string; action: () => void }> = [
        { label: "S", action: () => this.cycleSubject(companion, ruleIndex) },
        { label: "C", action: () => this.cycleCondition(companion, ruleIndex) },
        { label: "A", action: () => this.cycleAction(companion, ruleIndex) },
        { label: "T", action: () => this.cycleRuleTarget(companion, ruleIndex) },
        { label: rule.enabled ? "Off" : "On", action: () => {
          rule.enabled = !rule.enabled;
          this.changed("Gambit toggled.");
        } },
        { label: "Up", action: () => this.moveRule(companion, ruleIndex, -1) },
        { label: "Down", action: () => this.moveRule(companion, ruleIndex, 1) },
        { label: "Del", action: () => {
          companion.gambits.splice(ruleIndex, 1);
          this.rankRules(companion.gambits);
          this.changed("Gambit removed.");
        } },
      ];
      controls.forEach((control, index) => {
        this.addButton(
          x + index * 47,
          rowY + 45,
          control.label,
          control.action,
          "#aaddff",
          42,
        );
      });
    });
    this.addButton(x, y + 370, `Page ${this.listPage + 1}/${totalPages}`, () => {
      this.listPage = (this.listPage + 1) % totalPages;
      this.render();
    }, "#bbbbbb", 100);
  }

  private cycleSubject(
    companion: CompanionState,
    ruleIndex: number,
  ): void {
    const options: GambitSubjectSelector[] = [
      { kind: "self" },
      { kind: "hero" },
      { kind: "anyPartyMember" },
      { kind: "anyEnemy" },
      ...this.player!.party.companions.map(
        (entry): GambitSubjectSelector => ({
          kind: "companion",
          companionId: entry.id,
        }),
      ),
    ];
    companion.gambits[ruleIndex]!.subject = this.nextOption(
      options,
      companion.gambits[ruleIndex]!.subject,
    );
    this.changed("Gambit subject updated.");
  }

  private cycleCondition(
    companion: CompanionState,
    ruleIndex: number,
  ): void {
    const options: GambitCondition[] = [
      { kind: "state", state: "alive" },
      {
        kind: "resource",
        resource: "hp",
        scale: "percent",
        comparison: "<",
        value: 50,
      },
      {
        kind: "resource",
        resource: "hp",
        scale: "percent",
        comparison: ">",
        value: 90,
      },
      {
        kind: "resource",
        resource: "mp",
        scale: "percent",
        comparison: "<",
        value: 25,
      },
      { kind: "status", statusId: "poison", present: true },
      {
        kind: "stat",
        stat: "dexterity",
        comparison: ">",
        value: 15,
      },
    ];
    companion.gambits[ruleIndex]!.condition = this.nextOption(
      options,
      companion.gambits[ruleIndex]!.condition,
    );
    this.changed("Gambit condition updated.");
  }

  private cycleAction(
    companion: CompanionState,
    ruleIndex: number,
  ): void {
    const itemIds = [...new Set(
      companion.inventory
        .filter((item) => item.type === "consumable")
        .map((item) => item.id),
    )];
    const options: GambitAction[] = [
      { kind: "attack" },
      { kind: "defend" },
      ...companion.knownSpells.map(
        (spellId): GambitAction => ({ kind: "spell", spellId }),
      ),
      ...companion.knownAbilities.map(
        (abilityId): GambitAction => ({ kind: "ability", abilityId }),
      ),
      ...itemIds.map(
        (itemId): GambitAction => ({ kind: "item", itemId }),
      ),
    ];
    companion.gambits[ruleIndex]!.action = this.nextOption(
      options,
      companion.gambits[ruleIndex]!.action,
    );
    this.changed("Gambit action updated.");
  }

  private cycleRuleTarget(
    companion: CompanionState,
    ruleIndex: number,
  ): void {
    const options: GambitTargetSelector[] = [
      { kind: "matchedSubject" },
      { kind: "self" },
      { kind: "hero" },
      { kind: "lowestHpAlly" },
      { kind: "highestHpAlly" },
      { kind: "lowestHpEnemy" },
      { kind: "highestHpEnemy" },
      { kind: "anyEnemy" },
      { kind: "automatic" },
      ...this.player!.party.companions.map(
        (entry): GambitTargetSelector => ({
          kind: "companion",
          companionId: entry.id,
        }),
      ),
    ];
    companion.gambits[ruleIndex]!.target = this.nextOption(
      options,
      companion.gambits[ruleIndex]!.target,
    );
    this.changed("Gambit target updated.");
  }

  private moveRule(
    companion: CompanionState,
    index: number,
    direction: -1 | 1,
  ): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= companion.gambits.length) return;
    const [moved] = companion.gambits.splice(index, 1);
    companion.gambits.splice(targetIndex, 0, moved!);
    this.rankRules(companion.gambits);
    this.changed("Gambit priority updated.");
  }

  private rankRules(rules: GambitRule[]): void {
    rules.forEach((rule, index) => { rule.rank = index + 1; });
  }

  private nextOption<T>(options: T[], current: T): T {
    const serialized = JSON.stringify(current);
    const index = options.findIndex(
      (option) => JSON.stringify(option) === serialized,
    );
    return options[(index + 1) % options.length]!;
  }

  private cycleTarget(): void {
    const members = this.getMembers();
    const index = members.findIndex((member) => member.id === this.targetId);
    this.targetId = members[(index + 1) % members.length]!.id;
  }

  private applyMutation(result: { changed: boolean; message: string }): void {
    this.changed(result.message, result.changed);
  }

  private changed(message: string, changed = true): void {
    this.callbacks.showMessage(message, changed ? "#88ff88" : "#ff8888");
    if (changed) {
      this.callbacks.updateHUD();
      this.callbacks.refreshActors();
      this.callbacks.autoSave();
    }
    this.render();
  }

  private addText(
    x: number,
    y: number,
    text: string,
    color = "#dddddd",
    size = 11,
    width?: number,
  ): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, text, {
      fontSize: `${size}px`,
      fontFamily: "monospace",
      color,
      wordWrap: width ? { width } : undefined,
    });
    this.overlay?.add(label);
    return label;
  }

  private addButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
    color = "#dddddd",
    width = 120,
  ): Phaser.GameObjects.Text {
    const button = this.scene.add.text(x, y, label, {
      fontSize: "10px",
      fontFamily: "monospace",
      color,
      backgroundColor: "#29324a",
      padding: { x: 5, y: 4 },
      fixedWidth: width,
      align: "center",
    }).setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setColor("#ffd700"));
    button.on("pointerout", () => button.setColor(color));
    button.on("pointerdown", action);
    this.overlay?.add(button);
    return button;
  }
}

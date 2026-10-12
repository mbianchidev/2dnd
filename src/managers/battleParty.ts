import * as Phaser from "phaser";
import { getAbility } from "../data/abilities";
import { getItem } from "../data/items";
import { getSpell } from "../data/spells";
import { isCompanionId } from "../data/companions";
import {
  consumeBattleActionEconomy,
  createBattleActionEconomy,
  executeValidatedBattleAction,
  getBattleActionDescriptor,
  validateBattleAction,
  type BattleActionEconomyState,
  type BattleActionExecutionContext,
  type BattleActionRequest,
  type BattleActionResources,
  type BattleActionSource,
  type ResolvedBattleAction,
} from "../systems/battleActions";
import {
  isCombatantActive,
  type BattleCombatantId,
  type BattleCombatantState,
  type CompanionTurnContext,
  type PartyCombatant,
} from "../systems/groupCombat";
import {
  getCompanion,
  type CompanionState,
  type PartyState,
} from "../systems/party";
import {
  selectGambitAction,
} from "../systems/gambits";
import { BATTLE_DEPTH } from "../renderers/battleDepth";
import { BattleDecisionMenu } from "./battleDecisionMenu";
import {
  executeTimedBattleTimeout,
  type BattleDecisionClock,
} from "../systems/battleTiming";
import type { GridNavigationDirection } from "../systems/layout";
import { getTargetableBodyParts, type BodyPart } from "../data/anatomy";
import { BattleBodyTargetManager } from "./battleBodyTarget";
import { paginateMeasuredItems } from "../systems/layout";
import { createOverlayContainer, setOverlayViewport } from "../utils/ui";
import { layoutTextStack, syncInteractiveHitArea } from "./layout";

interface BattlePartyCallbacks {
  present(result: ResolvedBattleAction): void;
  refresh(): void;
  afterAction(previouslyAliveEnemyIds: ReadonlySet<string>): boolean;
  timing?: {
    acceptsInput(): boolean;
    beginTurn(combatant: PartyCombatant): void;
  };
  aim?(targetId: BattleCombatantId, part?: BodyPart): void;
}

interface MenuRow {
  id: string;
  label: string;
  enabled: boolean;
  action(): void;
}

const MENU_PAGE_SIZE = 8;

export class BattlePartyManager {
  private readonly scene: Phaser.Scene;
  private readonly party: PartyState;
  private readonly sources: BattleActionSource[];
  private readonly callbacks: BattlePartyCallbacks;
  private menu: Phaser.GameObjects.Container | null = null;
  private currentCombatant: PartyCombatant | null = null;
  private currentCompanion: CompanionState | null = null;
  private currentContext: CompanionTurnContext | null = null;
  private economy: BattleActionEconomyState | null = null;
  private page = 0;
  private readonly decisionMenu: BattleDecisionMenu | null;
  private menuRows: MenuRow[] = [];
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private selectedRow = 0;
  private pendingActivation: (() => void) | null = null;
  private readonly bodyTargets: BattleBodyTargetManager;

  constructor(
    scene: Phaser.Scene,
    party: PartyState,
    sources: BattleActionSource[],
    callbacks: BattlePartyCallbacks,
    bodyTargets: BattleBodyTargetManager = new BattleBodyTargetManager(scene),
  ) {
    this.scene = scene;
    this.party = party;
    this.sources = sources;
    this.callbacks = callbacks;
    this.bodyTargets = bodyTargets;
    this.decisionMenu = callbacks.timing
      ? new BattleDecisionMenu(scene, "battle-companion-menu", callbacks.timing.acceptsInput)
      : null;
  }

  get manualActorId(): string | null {
    return this.currentCompanion?.controlMode === "manual"
      && this.currentCombatant && isCombatantActive(this.currentCombatant)
      ? this.currentCombatant.id
      : null;
  }

  get debugState(): string {
    return this.decisionMenu?.debugState ?? "";
  }

  navigate(direction: GridNavigationDirection): boolean {
    return this.decisionMenu?.navigate(direction) ?? false;
  }

  confirm(): boolean {
    return this.decisionMenu?.confirm() ?? false;
  }

  cancel(): boolean {
    return this.decisionMenu?.cancel() ?? false;
  }

  timeout(clock: BattleDecisionClock, decisionId: string): boolean {
    const context = this.currentContext;
    if (!context || !this.economy || !this.manualActorId) return false;
    const result = executeTimedBattleTimeout(
      clock, decisionId, this.source, this.economy, this.executionContext,
    );
    if (!result.claimed) return false;
    this.economy = result.economy;
    this.bodyTargets.close();
    this.clearMenu();
    context.addLog(result.executed
      ? `Time expired: ${result.message}`
      : `Time expired: ${result.message} Ending turn.`);
    if (result.action?.executed) this.callbacks.present(result.action);
    this.callbacks.refresh();
    const battleEnded = this.callbacks.afterAction(
      new Set(context.enemies.filter(isCombatantActive).map((enemy) => enemy.id)),
    );
    if (!battleEnded) context.completeTurn();
    return true;
  }

  startTurn(
    combatant: PartyCombatant,
    context: CompanionTurnContext,
  ): void {
    this.clear();
    const companion = isCompanionId(combatant.sourceId)
      ? getCompanion(this.party, combatant.sourceId)
      : undefined;
    if (!companion) {
      context.addLog(`${combatant.label} has no companion state and waits.`);
      context.completeTurn();
      return;
    }
    this.currentCombatant = combatant;
    this.currentCompanion = companion;
    this.currentContext = context;
    this.economy = createBattleActionEconomy(combatant.id);
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.scene.input.keyboard?.on("keyup", this.handleKeyUp, this);
    if (companion.controlMode === "gambit") {
      this.runGambits();
    } else {
      this.callbacks.timing?.beginTurn(combatant);
      this.showMainMenu();
    }
  }

  clear(): void {
    this.bodyTargets.close();
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.scene.input.keyboard?.off("keyup", this.handleKeyUp, this);
    this.clearMenu();
    this.currentCombatant = null;
    this.currentCompanion = null;
    this.currentContext = null;
    this.economy = null;
    this.page = 0;
    this.menuRows = [];
    this.menuTexts = [];
    this.pendingActivation = null;
  }

  private get source(): BattleActionSource {
    const combatantId = this.currentCombatant?.id;
    const source = this.sources.find(
      (candidate) => candidate.combatant.id === combatantId,
    );
    if (!source) throw new Error("Companion action source is unavailable.");
    return source;
  }

  private get executionContext(): BattleActionExecutionContext {
    const context = this.currentContext;
    if (!context) throw new Error("Companion turn context is unavailable.");
    return {
      combatants: context.actors,
      enemies: context.enemies,
      sources: this.sources,
      weatherPenalty: context.weatherPenalty,
      getEnemyDefenseBonus: (target) =>
        context.getEnemyDefenseBonus(target.id),
      onElementalInteraction: (targetId, interaction, element) =>
        context.recordElementalInteraction(targetId, interaction, element),
      onPhysicalInteraction: (targetId, interaction, type, bodyPartId) =>
        context.recordPhysicalInteraction?.(targetId, interaction, type, bodyPartId),
    };
  }

  private get resources(): BattleActionResources {
    if (!this.economy) throw new Error("Companion action economy is unavailable.");
    return {
      mp: this.source.state.mp,
      inventory: this.source.state.inventory,
      economy: this.economy,
      knownSpellIds: this.source.state.knownSpells,
      knownAbilityIds: this.source.state.knownAbilities,
      actorState: this.source.state,
    };
  }

  private runGambits(): void {
    const context = this.currentContext;
    const companion = this.currentCompanion;
    if (!context || !companion || !this.economy) return;
    const executedRuleIds = new Set<string>();
    const maxAttempts = companion.gambits.length + 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const decision = selectGambitAction(companion.gambits, {
        actorId: context.combatant.id,
        actors: context.actors,
        sources: this.sources,
        economy: this.economy,
        executedRuleIds,
      });
      if (!decision.plan) {
        context.addLog(`${companion.name} has no valid gambit action.`);
        context.completeTurn();
        return;
      }
      if (decision.ruleId) executedRuleIds.add(decision.ruleId);
      const battleEnded = this.executePlan(decision.plan);
      if (battleEnded) return;
      if (
        this.economy.actionUsed
        && this.economy.bonusActionUsed
      ) {
        context.completeTurn();
        return;
      }
      if (decision.fallback || !decision.ruleId) {
        context.completeTurn();
        return;
      }
    }
    context.completeTurn();
  }

  private showMainMenu(): void {
    const companion = this.currentCompanion;
    const context = this.currentContext;
    if (!companion || !context || !this.economy) return;
    const rows: MenuRow[] = [
      {
        id: "attack",
        label: "Attack",
        enabled: !this.economy.actionUsed,
        action: () => this.prepareRequest({
          actorId: context.combatant.id,
          kind: "attack",
          attackRange: companion.equippedWeapon?.weaponSprite === "bow"
            ? "ranged"
            : "melee",
        }),
      },
      {
        id: "defend",
        label: "Defend",
        enabled: !this.economy.actionUsed,
        action: () => this.prepareRequest({
          actorId: context.combatant.id,
          kind: "defend",
        }),
      },
      {
        id: "spells",
        label: "Spells",
        enabled: companion.knownSpells.length > 0,
        action: () => this.showSpellMenu(),
      },
      {
        id: "abilities",
        label: "Abilities",
        enabled: companion.knownAbilities.length > 0,
        action: () => this.showAbilityMenu(),
      },
      {
        id: "items",
        label: "Items",
        enabled: companion.inventory.some((item) => item.type !== "key"),
        action: () => this.showItemMenu(),
      },
      {
        id: "end-turn",
        label: "End Turn",
        enabled: true,
        action: () => {
          this.clearMenu();
          context.completeTurn();
        },
      },
    ];
    this.renderMenu(
      `${companion.name}  HP ${companion.hp}/${companion.maxHp}  MP ${companion.mp}/${companion.maxMp}`,
      rows,
    );
  }

  private showSpellMenu(): void {
    const context = this.currentContext;
    if (!context) return;
    const rows = this.source.state.knownSpells.flatMap((spellId): MenuRow[] => {
      const spell = getSpell(spellId);
      if (!spell || spell.type === "utility") return [];
      return [{
        id: `spell-${spell.id}`,
        label: `${spell.name} (${spell.mpCost} MP)`,
        enabled: this.source.state.mp >= spell.mpCost,
        action: () => this.prepareRequest({
          actorId: context.combatant.id,
          kind: "spell",
          actionId: spell.id,
        }),
      }];
    });
    this.renderPagedMenu("Spells", rows);
  }

  private showAbilityMenu(): void {
    const context = this.currentContext;
    if (!context) return;
    const rows = this.source.state.knownAbilities.flatMap(
      (abilityId): MenuRow[] => {
        const ability = getAbility(abilityId);
        if (!ability || ability.type === "utility") return [];
        return [{
          id: `ability-${ability.id}`,
          label: `${ability.name}${ability.bonusAction ? " [BA]" : ""} (${ability.mpCost} MP)`,
          enabled: this.source.state.mp >= ability.mpCost,
          action: () => this.prepareRequest({
            actorId: context.combatant.id,
            kind: "ability",
            actionId: ability.id,
          }),
        }];
      },
    );
    this.renderPagedMenu("Abilities", rows);
  }

  private showItemMenu(): void {
    const context = this.currentContext;
    if (!context) return;
    const rows = this.source.state.inventory.flatMap((item, itemIndex): MenuRow[] =>
      item.type === "key" || item.type === "mount"
        ? []
        : [{
            id: `item-${itemIndex}`,
            label: item.name,
            enabled: true,
            action: () => this.prepareRequest({
              actorId: context.combatant.id,
              kind: "item",
              actionId: item.id,
              itemIndex,
            }),
          }]
    );
    this.renderPagedMenu("Items", rows);
  }

  private prepareRequest(request: BattleActionRequest): void {
    const descriptor = getBattleActionDescriptor(request, this.resources);
    if (!descriptor) {
      this.currentContext?.addLog("That action is unavailable.");
      this.showMainMenu();
      return;
    }
    if (
      descriptor.targetType === "single_enemy"
      || descriptor.targetType === "single"
      || descriptor.targetType === "single_ally"
    ) {
      this.showTargetMenu(request);
      return;
    }
    this.validateAndExecute(request);
  }

  private showTargetMenu(request: BattleActionRequest): void {
    const context = this.currentContext;
    if (!context) return;
    const rows = context.actors.flatMap((actor): MenuRow[] => {
      if (!isCombatantActive(actor)) return [];
      const validation = validateBattleAction(
        context.actors,
        { ...request, preferredTargetId: actor.id },
        this.resources,
      );
      if (!validation.plan) return [];
      const rows: MenuRow[] = [{
        id: `target-${actor.id}`,
        label: `${actor.label}  HP ${actor.currentHp}/${actor.maxHp}`,
        enabled: true,
        action: () => this.validateAndExecute({ ...request, preferredTargetId: actor.id }),
      }];
      const enemy = context.enemies.find((candidate) => candidate.id === actor.id);
      const type = validation.plan.descriptor.physicalType;
      if (enemy && type && getTargetableBodyParts(enemy.monster).length > 0) {
        rows.push({
          id: `aim-${actor.id}`,
          label: `Aim parts: ${actor.label}`,
          enabled: true,
          action: () => {
            this.clearMenu();
            this.bodyTargets.open({
              monster: enemy.monster, targetId: enemy.id, targetLabel: enemy.label,
              label: "Aim", damageType: type, discoveries: enemy.physicalDiscoveries,
              select: (part) => this.callbacks.aim?.(actor.id, part),
              confirm: (bodyPartId) => this.validateAndExecute({
                ...request, preferredTargetId: actor.id, bodyPartId,
              }),
              cancel: () => {
                this.callbacks.refresh();
                this.showTargetMenu(request);
              },
            });
            },
        });
      }
      return rows;
    });
    this.renderPagedMenu("Choose Target", rows);
  }

  private validateAndExecute(request: BattleActionRequest): void {
    const context = this.currentContext;
    if (!context) return;
    const validation = validateBattleAction(
      context.actors,
      request,
      this.resources,
    );
    if (!validation.plan) {
      context.addLog(validation.message);
      this.showMainMenu();
      return;
    }
    this.executePlan(validation.plan);
  }

  private executePlan(plan: NonNullable<ReturnType<typeof validateBattleAction>["plan"]>): boolean {
    const context = this.currentContext;
    if (!context || !this.economy) return false;
    if (
      this.currentCompanion?.controlMode === "manual"
      && this.callbacks.timing
      && !this.callbacks.timing.acceptsInput()
    ) return false;
    const previouslyAliveEnemyIds = new Set(
      context.enemies.filter(isCombatantActive).map((enemy) => enemy.id),
    );
    const result = executeValidatedBattleAction(
      this.source,
      plan,
      this.executionContext,
    );
    context.addLog(result.message);
    if (!result.executed) {
      if (this.currentCompanion?.controlMode === "manual") this.showMainMenu();
      return false;
    }
    const transition = consumeBattleActionEconomy(this.economy, plan);
    if (transition.valid) this.economy = transition.state;
    this.callbacks.present(result);
    this.callbacks.refresh();
    const battleEnded = this.callbacks.afterAction(previouslyAliveEnemyIds);
    if (battleEnded) {
      this.clearMenu();
      return true;
    }
    if (this.currentCompanion?.controlMode === "manual") this.showMainMenu();
    return false;
  }

  private renderPagedMenu(title: string, rows: MenuRow[]): void {
    if (this.decisionMenu) {
      this.decisionMenu.show(title, rows, () => this.showMainMenu());
      return;
    }
    const measure = this.scene.add.text(0, 0, "Back", {
      fontSize: "11px", fontFamily: "monospace", wordWrap: { width: 272 },
    }).setVisible(false);
    const controlsHeight = measure.displayHeight + 9;
    const heights = rows.map((row) => measure.setText(`  ${row.label}`).displayHeight);
    const heading = this.scene.add.text(0, 0, title, {
      fontSize: "12px", fontFamily: "monospace", wordWrap: { width: 272 },
    }).setVisible(false);
    const available = Math.max(1, this.scene.cameras.main.height - heading.displayHeight - controlsHeight * 2 - 50);
    measure.destroy();
    heading.destroy();
    const pages = paginateMeasuredItems(heights, available, 9, MENU_PAGE_SIZE);
    const totalPages = pages.length;
    this.page = Phaser.Math.Clamp(this.page, 0, totalPages - 1);
    const visible = (pages[this.page] ?? []).map((index) => rows[index]!);
    if (totalPages > 1) {
      visible.push({
        id: "next",
        label: `Page ${this.page + 1}/${totalPages} — Next`,
        enabled: true,
        action: () => {
          this.page = (this.page + 1) % totalPages;
          this.renderPagedMenu(title, rows);
        },
      });
    }
    visible.push({
      id: "back",
      label: "Back",
      enabled: true,
      action: () => {
        this.page = 0;
        this.showMainMenu();
      },
    });
    this.renderMenu(title, visible);
  }

  private renderMenu(title: string, rows: MenuRow[]): void {
    if (this.decisionMenu) {
      this.decisionMenu.show(title, rows);
      return;
    }
    this.clearMenu();
    this.menuRows = rows;
    this.selectedRow = Math.max(0, rows.findIndex((row) => row.enabled));
    const width = 300;
    const container = createOverlayContainer(this.scene, "battle-companion-menu", BATTLE_DEPTH.uiOverlay);
    const background = this.scene.add.graphics();
    container.add(background);
    const heading = this.scene.add.text(0, 0, title, {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ffd700",
      wordWrap: { width: width - 28 },
    }).setData("layoutId", "battle-companion-title");
    container.add(heading);
    rows.forEach((row, index) => {
      const text = this.scene.add.text(0, 0, `  ${row.label}`, {
        fontSize: "11px",
        fontFamily: "monospace",
        color: row.enabled ? "#d8e8ff" : "#666666",
        wordWrap: { width: width - 28 },
      }).setData("layoutId", `battle-companion-${row.id ?? `row-${index}`}`);
      this.menuTexts.push(text);
      if (row.enabled) {
        text.setInteractive({ useHandCursor: true });
        text.on("pointerover", () => {
          this.selectedRow = index;
          this.updateSelection();
        });
        text.on("pointerdown", row.action);
      }
      container.add(text);
    });
    const height = layoutTextStack([heading, ...this.menuTexts], {
      x: 14, y: 10, width: width - 28, gap: 9,
    }) + 20;
    const x = this.scene.cameras.main.width - width - 10;
    const y = Math.max(10, this.scene.cameras.main.height - height - 10);
    container.setPosition(x, y);
    background.fillStyle(0x121a2e, 0.97).fillRoundedRect(0, 0, width, height, 6);
    background.lineStyle(1, 0xc0a060, 1).strokeRoundedRect(0, 0, width, height, 6);
    setOverlayViewport(this.scene, "battle-companion-menu", { x, y, width, height });
    this.menu = container;
    this.scene.game.canvas.dataset.companionMenu = title;
    this.updateSelection();
  }

  private clearMenu(): void {
    this.decisionMenu?.clear();
    this.menu?.destroy();
    this.menu = null;
    this.menuRows = [];
    this.menuTexts = [];
    this.pendingActivation = null;
    if (this.scene.game?.canvas) delete this.scene.game.canvas.dataset.companionMenu;
    if (this.scene.game?.canvas) delete this.scene.game.canvas.dataset.companionSelection;
  }

  private updateSelection(): void {
    this.menuTexts.forEach((text, index) => {
      const row = this.menuRows[index]!;
      const selected = row.enabled && index === this.selectedRow;
      text.setText(`${selected ? "> " : "  "}${row.label}`)
        .setColor(!row.enabled ? "#b0bec5" : selected ? "#ffd700" : "#d8e8ff");
      syncInteractiveHitArea(text);
    });
    if (this.scene.game?.canvas) {
      this.scene.game.canvas.dataset.companionSelection = this.menuRows[this.selectedRow]?.label ?? "";
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.menu || this.bodyTargets.isOpen || this.bodyTargets.ownsKey(event)) return;
    if (event.key === "Escape") {
      this.showMainMenu();
      return;
    }
    const direction = ["ArrowUp", "ArrowLeft", "w", "a", "W", "A"].includes(event.key) ? -1
      : ["ArrowDown", "ArrowRight", "s", "d", "S", "D"].includes(event.key) ? 1 : 0;
    if (direction) {
      for (let attempt = 0; attempt < this.menuRows.length; attempt++) {
        this.selectedRow = (this.selectedRow + direction + this.menuRows.length) % this.menuRows.length;
        if (this.menuRows[this.selectedRow]?.enabled) break;
      }
      this.updateSelection();
      event.preventDefault();
    } else if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      this.pendingActivation = this.menuRows[this.selectedRow]?.action ?? null;
      event.preventDefault();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (this.bodyTargets.ownsKey(event)) return;
    const activate = this.pendingActivation;
    this.pendingActivation = null;
    if (activate) {
      event.preventDefault();
      activate();
    }
  }
}

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

interface BattlePartyCallbacks {
  refresh(): void;
  afterAction(previouslyAliveEnemyIds: ReadonlySet<string>): boolean;
}

interface MenuRow {
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

  constructor(
    scene: Phaser.Scene,
    party: PartyState,
    sources: BattleActionSource[],
    callbacks: BattlePartyCallbacks,
  ) {
    this.scene = scene;
    this.party = party;
    this.sources = sources;
    this.callbacks = callbacks;
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
    if (companion.controlMode === "gambit") {
      this.runGambits();
    } else {
      this.showMainMenu();
    }
  }

  clear(): void {
    this.menu?.destroy();
    this.menu = null;
    this.currentCombatant = null;
    this.currentCompanion = null;
    this.currentContext = null;
    this.economy = null;
    this.page = 0;
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
    };
  }

  private get resources() {
    return {
      mp: this.source.state.mp,
      inventory: this.source.state.inventory,
      economy: this.economy!,
      knownSpellIds: this.source.state.knownSpells,
      knownAbilityIds: this.source.state.knownAbilities,
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
        label: "Defend",
        enabled: !this.economy.actionUsed,
        action: () => this.prepareRequest({
          actorId: context.combatant.id,
          kind: "defend",
        }),
      },
      {
        label: "Spells",
        enabled: companion.knownSpells.length > 0,
        action: () => this.showSpellMenu(),
      },
      {
        label: "Abilities",
        enabled: companion.knownAbilities.length > 0,
        action: () => this.showAbilityMenu(),
      },
      {
        label: "Items",
        enabled: companion.inventory.some((item) => item.type !== "key"),
        action: () => this.showItemMenu(),
      },
      {
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
      return validation.plan
        ? [{
            label: `${actor.label}  HP ${actor.currentHp}/${actor.maxHp}`,
            enabled: true,
            action: () => this.executePlan(validation.plan!),
          }]
        : [];
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
    const totalPages = Math.max(1, Math.ceil(rows.length / MENU_PAGE_SIZE));
    this.page = Phaser.Math.Clamp(this.page, 0, totalPages - 1);
    const visible = rows.slice(
      this.page * MENU_PAGE_SIZE,
      (this.page + 1) * MENU_PAGE_SIZE,
    );
    if (totalPages > 1) {
      visible.push({
        label: `Page ${this.page + 1}/${totalPages} — Next`,
        enabled: true,
        action: () => {
          this.page = (this.page + 1) % totalPages;
          this.renderPagedMenu(title, rows);
        },
      });
    }
    visible.push({
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
    this.clearMenu();
    const width = 300;
    const rowHeight = 25;
    const height = 42 + rows.length * rowHeight;
    const x = this.scene.cameras.main.width - width - 10;
    const y = Math.max(10, this.scene.cameras.main.height - height - 10);
    const container = this.scene.add.container(x, y).setDepth(30);
    const background = this.scene.add.graphics();
    background.fillStyle(0x121a2e, 0.97);
    background.fillRoundedRect(0, 0, width, height, 6);
    background.lineStyle(1, 0xc0a060, 1);
    background.strokeRoundedRect(0, 0, width, height, 6);
    container.add(background);
    container.add(this.scene.add.text(10, 8, title, {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ffd700",
      wordWrap: { width: width - 20 },
    }));
    rows.forEach((row, index) => {
      const text = this.scene.add.text(14, 34 + index * rowHeight, row.label, {
        fontSize: "11px",
        fontFamily: "monospace",
        color: row.enabled ? "#d8e8ff" : "#666666",
      });
      if (row.enabled) {
        text.setInteractive({ useHandCursor: true });
        text.on("pointerover", () => text.setColor("#ffd700"));
        text.on("pointerout", () => text.setColor("#d8e8ff"));
        text.on("pointerdown", row.action);
      }
      container.add(text);
    });
    this.menu = container;
  }

  private clearMenu(): void {
    this.menu?.destroy();
    this.menu = null;
  }
}

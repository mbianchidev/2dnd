import type * as Phaser from "phaser";
import { getAbility } from "../data/abilities";
import { getSpell } from "../data/spells";
import type { Item } from "../data/items";
import {
  getBattleActionDescriptor,
  validateBattleAction,
  type BattleActionEconomyState,
  type BattleActionExecutionContext,
  type BattleActionPlan,
  type BattleActionRequest,
  type BattleActionResources,
  type BattleActionSource,
} from "../systems/battleActions";
import { isCombatantActive, type AttackRange } from "../systems/groupCombat";
import { BattleDecisionMenu, type BattleDecisionMenuRow } from "./battleDecisionMenu";
import type { GridNavigationDirection } from "../systems/layout";

interface BattleHeroDecisionCallbacks {
  acceptsInput(): boolean;
  economy(): BattleActionEconomyState;
  context(): BattleActionExecutionContext;
  chooseEnemy(label: string, range: AttackRange, confirm: (id: string) => void): void;
  execute(plan: BattleActionPlan): void;
  swapWeapon(item: Item): void;
  addLog(message: string): void;
}

type HeroMenuKind = "spells" | "abilities" | "items";

/** Timed-mode menus bind fresh validated targets while retaining hero combat resolvers. */
export class BattleHeroDecisionManager {
  private readonly menu: BattleDecisionMenu;
  private menuKind: HeroMenuKind | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly source: BattleActionSource,
    private readonly callbacks: BattleHeroDecisionCallbacks,
  ) {
    this.menu = new BattleDecisionMenu(scene, "battle-hero-menu", callbacks.acceptsInput);
  }

  get isOpen(): boolean {
    return this.menu.isOpen;
  }

  get debugState(): string {
    return this.menu.debugState;
  }

  navigate(direction: GridNavigationDirection): boolean {
    return this.menu.navigate(direction);
  }

  confirm(): boolean {
    return this.menu.confirm();
  }

  cancel(): boolean {
    if (!this.menu.isOpen) return false;
    if (this.callbacks.acceptsInput()) this.clear();
    return true;
  }

  clear(): void {
    this.menu.clear();
    this.menuKind = null;
  }

  show(kind: HeroMenuKind): void {
    if (!this.callbacks.acceptsInput()) return;
    if (this.menuKind === kind && this.menu.isOpen) {
      this.clear();
      return;
    }
    this.menuKind = kind;
    const rows: BattleDecisionMenuRow[] = [];
    if (kind === "spells") {
      for (const id of this.source.state.knownSpells) {
        const spell = getSpell(id);
        if (!spell || spell.type === "utility") continue;
        const request = { actorId: this.source.combatant.id, kind: "spell", actionId: id } as const;
        rows.push({
          id: `spell-${id}`, label: `${spell.name} (${spell.mpCost} MP)`,
          enabled: this.isValid(request),
          action: () => this.prepareRequest(request, spell.name),
        });
      }
    } else if (kind === "abilities") {
      for (const id of this.source.state.knownAbilities) {
        const ability = getAbility(id);
        if (!ability || ability.type === "utility") continue;
        const request = { actorId: this.source.combatant.id, kind: "ability", actionId: id } as const;
        rows.push({
          id: `ability-${id}`,
          label: `${ability.name}${ability.bonusAction ? " [Bonus]" : ""} (${ability.mpCost} MP)`,
          enabled: this.isValid(request),
          action: () => this.prepareRequest(request, ability.name),
        });
      }
    } else {
      this.source.state.inventory.forEach((item, itemIndex) => {
        if (item.type === "consumable" && item.id !== "chimaeraWing") {
          const request = {
            actorId: this.source.combatant.id, kind: "item", actionId: item.id, itemIndex,
          } as const;
          rows.push({
            id: `item-${itemIndex}`, label: item.name, enabled: this.isValid(request),
            action: () => this.prepareRequest(request, item.name),
          });
        } else if (
          item.type === "weapon"
          && item !== this.source.state.equippedWeapon
          && item !== this.source.state.equippedOffHand
        ) {
          rows.push({
            id: `weapon-${itemIndex}`, label: `Equip ${item.name} [Bonus]`,
            enabled: !this.callbacks.economy().bonusActionUsed,
            action: () => {
              if (!this.source.state.inventory.includes(item)) {
                this.callbacks.addLog("That weapon is no longer available.");
                return;
              }
              this.clear();
              this.callbacks.swapWeapon(item);
            },
          });
        }
      });
    }
    if (rows.length === 0) this.callbacks.addLog(`No battle ${kind} available.`);
    this.menu.show(kind, rows, () => this.clear());
  }

  prepareRequest(request: BattleActionRequest, label: string): void {
    if (!this.callbacks.acceptsInput()) return;
    const descriptor = getBattleActionDescriptor(request, this.resources);
    if (!descriptor) {
      this.callbacks.addLog("That action is unavailable.");
      return;
    }
    this.clear();
    if (descriptor.targetType === "single" || descriptor.targetType === "single_enemy") {
      this.callbacks.chooseEnemy(label, descriptor.range, (preferredTargetId) =>
        this.executeRequest({ ...request, preferredTargetId })
      );
      return;
    }
    if (descriptor.targetType === "single_ally") {
      const rows = this.callbacks.context().combatants.flatMap((actor): BattleDecisionMenuRow[] => {
        const targeted = { ...request, preferredTargetId: actor.id };
        if (!isCombatantActive(actor) || !this.isValid(targeted)) return [];
        return [{
          id: `target-${actor.id}`, label: `${actor.label} HP ${actor.currentHp}/${actor.maxHp}`,
          enabled: true, action: () => this.executeRequest(targeted),
        }];
      });
      this.menu.show("Choose ally", rows, () => this.clear());
      return;
    }
    this.executeRequest(request);
  }

  private get resources(): BattleActionResources {
    return {
      mp: this.source.state.mp, inventory: this.source.state.inventory,
      knownSpellIds: this.source.state.knownSpells,
      knownAbilityIds: this.source.state.knownAbilities,
      economy: this.callbacks.economy(),
    };
  }

  private isValid(request: BattleActionRequest): boolean {
    return validateBattleAction(this.callbacks.context().combatants, request, this.resources).valid;
  }

  private executeRequest(request: BattleActionRequest): void {
    if (!this.callbacks.acceptsInput()) return;
    const validation = validateBattleAction(
      this.callbacks.context().combatants, request, this.resources,
    );
    if (!validation.plan) {
      this.callbacks.addLog(validation.message);
      return;
    }
    this.clear();
    this.callbacks.execute(validation.plan);
  }
}

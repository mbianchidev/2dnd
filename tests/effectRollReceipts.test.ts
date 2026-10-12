import { afterEach, describe, expect, it, vi } from "vitest";
import { Element } from "../src/data/elements";
import { getMonster } from "../src/data/monsters";
import { getTrapDefinition, type DungeonTrap } from "../src/data/traps";
import {
  monsterAttackTarget,
  monsterUseAbilityTarget,
  playerAttack,
  playerCastSpellAtTargets,
  playerOffHandAttack,
  playerUseAbility,
} from "../src/systems/combat";
import {
  castSpellOutsideCombat,
  createPlayer,
  useAbilityOutsideCombat,
  useItem,
  type PlayerState,
} from "../src/systems/player";
import { getItem } from "../src/data/items";
import { getAbility } from "../src/data/abilities";
import { getSpell } from "../src/data/spells";
import { createHeroClassProgression } from "../src/systems/classProgression";
import { normalizeSerializedHeroItem } from "../src/systems/heroItemState";
import { createSoloEncounter } from "../src/data/monsterGroups";
import {
  createBattleActionEconomy,
  createPlayerBattleActionSource,
  executeValidatedBattleAction,
  validateBattleAction,
} from "../src/systems/battleActions";
import { createGroupCombatants, createHeroCombatant } from "../src/systems/groupCombat";
import { rollD20 } from "../src/systems/dice";
import { snapshotEffectRoll } from "../src/systems/rollResults";
import { captureDamageApplication, captureEffectAdjustment, captureEffectApplication, rollEffectDice } from "../src/systems/effectRolls";
import {
  createCombatDicePresentation,
  createD20Presentation,
  createEffectDicePresentation,
  DicePresentationController,
} from "../src/systems/dicePresentation";
import { applyStatusEffect, processStartOfTurn } from "../src/systems/statusEffects";
import { triggerDungeonTrap } from "../src/systems/traps";

function createActor(): PlayerState {
  const actor = createPlayer("Effect fixture", {
    strength: 14, dexterity: 14, constitution: 10,
    intelligence: 14, wisdom: 14, charisma: 10,
  });
  actor.stats = {
    strength: 14, dexterity: 14, constitution: 10,
    intelligence: 14, wisdom: 14, charisma: 10,
  };
  actor.knownTalents = [];
  actor.mp = actor.maxMp = 100;
  actor.hp = actor.maxHp = 30;
  actor.equippedWeapon = {
    id: "fixtureWeapon", name: "Fixture weapon", description: "Mock weapon",
    type: "weapon", effect: 2, cost: 0,
  };
  return actor;
}

afterEach(() => vi.restoreAllMocks());

describe("canonical effect dice receipts", () => {
  it("captures actual critical damage faces and additive bonuses without another roll", () => {
    const actor = createActor();
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);
    const result = playerAttack(actor, getMonster("orc")!);
    expect(result).toMatchObject({
      hit: true, critical: true, damage: 11,
      damageRoll: {
        roll: { sides: 6, naturalRolls: [1, 6], modifier: 4, total: 11 },
        amount: 11, criticalDice: true,
        modifiers: [
          { label: "Weapon", value: 2 },
          { label: "Talents", value: 0 },
          { label: "Strength", value: 2 },
          { label: "Statuses", value: 0 },
        ],
      },
    });
    expect(random).toHaveBeenCalledTimes(3);
    expect(Object.isFrozen(result.damageRoll)).toBe(true);
    expect(Object.isFrozen(result.damageRoll?.roll?.naturalRolls)).toBe(true);
  });

  it("resolves selected disadvantage, signed status modifiers, then floored resistance in order", () => {
    const actor = createActor();
    actor.equippedWeapon!.element = Element.Fire;
    applyStatusEffect(actor.activeEffects, "prone", "Mock source");
    applyStatusEffect(actor.activeEffects, "slow", "Mock source");
    const monster = {
      ...getMonster("orc")!, ac: 1, elementalProfile: { resistances: [Element.Fire] },
    };
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.85)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.7)
      .mockReturnValueOnce(0.25);
    const result = playerAttack(actor, monster);
    expect(result).toMatchObject({
      hit: true, critical: false, damage: 3,
      rollResult: { naturalRolls: [18, 11], selectedIndex: 1, naturalRoll: 11 },
      damageRoll: {
        roll: { sides: 6, naturalRolls: [5], modifier: 2, total: 7 },
        modifiers: [
          { label: "Weapon", value: 2 }, { label: "Talents", value: 0 },
          { label: "Strength", value: 2 }, { label: "Statuses", value: -2 },
        ],
        adjustments: [{ label: "Fire resistance /2 (floor)", amount: 3 }],
        amount: 3,
      },
    });
    expect(random).toHaveBeenCalledTimes(3);
    expect(rollD20().roll).toBe(6);
    expect(random).toHaveBeenCalledTimes(4);
  });

  it("adds no damage roll to misses and preserves each resolver's existing RNG and MP cost", () => {
    for (const kind of ["attack", "offHand", "ability", "spell"] as const) {
      const actor = createActor();
      actor.equippedOffHand = { ...actor.equippedWeapon!, id: "fixtureOffHand" };
      const monster = getMonster("orc")!;
      const random = vi.spyOn(Math, "random")
        .mockReturnValueOnce(0)
        .mockReturnValue(0.5);
      const result = kind === "attack" ? playerAttack(actor, monster)
        : kind === "offHand" ? playerOffHandAttack(actor, monster)
          : kind === "ability" ? playerUseAbility(actor, "shieldBash", monster)
            : playerCastSpellAtTargets(actor, "fireBolt", [{ monster }]).results[0]!;
      expect(result).toMatchObject({ hit: false, fumble: true, damage: 0 });
      expect(result.damageRoll).toBeUndefined();
      expect(random).toHaveBeenCalledTimes(kind === "spell" ? 2 : 1);
      expect(actor.mp).toBe(kind === "ability" ? 98 : 100);
      random.mockRestore();
    }
  });

  it("preserves the starting-source off-hand penalty without silently using another ability", () => {
    const actor = createActor();
    actor.classProgression = createHeroClassProgression("wizard", 1);
    actor.stats.intelligence = 8;
    actor.stats.dexterity = 20;
    actor.equippedOffHand = { ...actor.equippedWeapon!, id: "fixtureOffHand" };
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.85)
      .mockReturnValueOnce(0);
    const result = playerOffHandAttack(actor, { ...getMonster("orc")!, ac: 1 });
    expect(result.damageRoll).toMatchObject({
      roll: { sides: 6, naturalRolls: [1], modifier: 1, total: 2 },
      modifiers: [
        { label: "Off-hand weapon", value: 2 }, { label: "Talents", value: 0 },
        { label: "Primary ability", value: -1 }, { label: "Statuses", value: 0 },
      ],
      amount: 2,
    });
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("doubles real ability dice on a critical without adding an on-hit saving throw", () => {
    const actor = createActor();
    const effects: PlayerState["activeEffects"] = [];
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);
    const result = playerUseAbility(actor, "shieldBash", getMonster("orc")!, 0, effects);
    expect(result).toMatchObject({
      hit: true, critical: true, mpUsed: 2, damage: 9,
      damageRoll: {
        roll: { sides: 8, naturalRolls: [1, 8], modifier: 0, total: 9 },
        amount: 9, criticalDice: true,
      },
    });
    expect(effects.map((effect) => effect.id)).toEqual(["stunned"]);
    expect(actor.mp).toBe(98);
    expect(random).toHaveBeenCalledTimes(3);
  });

  it("does not invent critical spell dice or a Magic Missile attack die", () => {
    const actor = createActor();
    const monster = getMonster("orc")!;
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0);
    const critical = playerCastSpellAtTargets(actor, "fireBolt", [{ monster }]).results[0]!;
    expect(critical.critical).toBe(true);
    expect(critical.damageRoll).toMatchObject({
      roll: { sides: 10, naturalRolls: [1], modifier: 0, total: 1 }, amount: 1,
    });
    expect(critical.damageRoll?.criticalDice).toBeUndefined();
    expect(random).toHaveBeenCalledTimes(2);
    applyStatusEffect(actor.activeEffects, "prone", "Mock source");
    random.mockReset()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.999);
    const missile = playerCastSpellAtTargets(actor, "magicMissile", [{ monster }]).results[0]!;
    expect(missile).toMatchObject({
      autoHit: true, hit: true, damage: 7,
      damageRoll: { roll: { sides: 4, naturalRolls: [1, 2, 4], total: 7 }, amount: 7 },
    });
    expect(missile.rollResult).toBeUndefined();
    expect(actor.mp).toBe(97);
    expect(random).toHaveBeenCalledTimes(3);
  });

  it("shares the actual spell damage roll and records separate elemental outcomes", () => {
    const actor = createActor();
    applyStatusEffect(actor.activeEffects, "inspired", "Mock source");
    const monster = getMonster("orc")!;
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.7)
      .mockReturnValueOnce(0.5);
    const result = playerCastSpellAtTargets(actor, "fireBolt", [
      { monster: { ...monster, elementalProfile: { weaknesses: [Element.Fire] } } },
      { monster: { ...monster, elementalProfile: { resistances: [Element.Fire] } } },
      { monster: { ...monster, elementalProfile: { immunities: [Element.Fire] } } },
    ]);
    expect(result.results).toMatchObject([
      { damage: 16, damageRoll: { roll: { naturalRolls: [6], total: 8 }, amount: 16 } },
      { damage: 4, damageRoll: { roll: { naturalRolls: [6], total: 8 }, amount: 4 } },
      { damage: 0, damageRoll: { roll: { naturalRolls: [6], total: 8 }, amount: 0 } },
    ]);
    expect(random).toHaveBeenCalledTimes(2);
    expect(actor.mp).toBe(100);
    expect(result.results.every((target) => target.damageRoll?.shared === true)).toBe(true);
  });

  it("captures per-target actual HP writes from one validated area roll and one MP charge", () => {
    const actor = createActor();
    actor.knownSpells.push("fireball");
    applyStatusEffect(actor.activeEffects, "inspired", "Mock source");
    const source = createPlayerBattleActionSource(actor);
    const monster = { ...getMonster("orc")!, hp: 10, ac: 1 };
    const enemies = createGroupCombatants({
      id: "effectFixture", name: "Effect fixture", isGroup: true,
      members: [
        { monster: { ...monster, elementalProfile: { weaknesses: [Element.Fire] } }, position: "front" },
        { monster: { ...monster, elementalProfile: { resistances: [Element.Fire] } }, position: "front" },
        { monster: { ...monster, elementalProfile: { immunities: [Element.Fire] } }, position: "back" },
        { monster, position: "back" },
      ],
    });
    const context = { combatants: [source.combatant, ...enemies], enemies, sources: [source] };
    const economy = createBattleActionEconomy(source.combatant.id);
    const validation = validateBattleAction(context.combatants, {
      actorId: source.combatant.id, kind: "spell", actionId: "fireball",
    }, { mp: actor.mp, inventory: actor.inventory, knownSpellIds: actor.knownSpells, economy });
    if (!validation.plan) throw new Error(validation.message);
    const values = [0.7, 0, 0.2, 0.4, 0.5, 0.7, 0.99, 0, 0.2, 0.25];
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      const value = values.shift();
      if (value === undefined) throw new Error("Unexpected extra damage RNG");
      return value;
    });
    const result = executeValidatedBattleAction(source, validation.plan, context);
    expect(result.executed).toBe(true);
    expect(result.mpUsed).toBe(6);
    expect(actor.mp).toBe(94);
    expect(economy.actionUsed).toBe(false);
    expect(enemies.map((enemy) => enemy.currentHp)).toEqual([0, 0, 10, 0]);
    expect(result.diceResults?.map((target) => target.result.damageRoll)).toMatchObject([
      { amount: 52, application: { amount: 10, limit: "Overkill" }, shared: true },
      { amount: 13, application: { amount: 10, limit: "Overkill" }, shared: true },
      { amount: 0, application: { amount: 0 }, shared: true },
      { amount: 26, application: { amount: 10, limit: "Overkill" }, shared: true },
    ]);
    for (const target of result.diceResults ?? []) {
      expect(target.result.damageRoll?.roll).toMatchObject({
        sides: 6, naturalRolls: [1, 2, 3, 4, 5, 6, 1, 2], modifier: 2, total: 26,
      });
    }
    expect(random).toHaveBeenCalledTimes(9);
    expect(rollD20().roll).toBe(6);
    expect(values).toEqual([]);
  });

  it("preserves finite fractional legacy weapon effects and their exact HP deltas", () => {
    const actor = createActor();
    const weapon = normalizeSerializedHeroItem({
      id: "customMockBlade", name: "Mock blade", description: "Serialized mock equipment",
      type: "weapon", cost: 12.5, effect: -0.5, light: true, finesse: true,
      weaponSprite: "dagger", element: Element.Psychic, tags: ["mock", "legacy"],
    });
    if (!weapon) throw new Error("Canonical guard rejected a supported mock legacy item");
    actor.inventory.push(weapon);
    actor.equippedWeapon = weapon;
    const source = createPlayerBattleActionSource(actor);
    const enemies = createGroupCombatants(createSoloEncounter({
      ...getMonster("orc")!, hp: 10, ac: 1, elementalProfile: undefined,
    }));
    const context = { combatants: [source.combatant, ...enemies], enemies, sources: [source] };
    const validation = validateBattleAction(context.combatants, {
      actorId: source.combatant.id, kind: "attack",
    }, { mp: actor.mp, inventory: actor.inventory, economy: createBattleActionEconomy(source.combatant.id) });
    if (!validation.plan) throw new Error(validation.message);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = executeValidatedBattleAction(source, validation.plan, context);
    expect(result.diceResults?.[0]?.result.damageRoll).toMatchObject({
      roll: { sides: 6, naturalRolls: [4], modifier: 1.5, total: 5.5 },
      amount: 5.5, application: { amount: 5.5 },
    });
    expect(enemies[0]?.currentHp).toBe(4.5);
    expect(actor.equippedWeapon).toBe(actor.inventory[actor.inventory.length - 1]);
    expect(actor.equippedWeapon.effect).toBe(-0.5);
    expect(actor.mp).toBe(100);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("captures applied damage before observer hooks while retaining their existing timing", () => {
    const actor = createActor();
    actor.equippedWeapon!.element = Element.Fire;
    const source = createPlayerBattleActionSource(actor);
    const enemies = createGroupCombatants(createSoloEncounter({
      ...getMonster("orc")!, hp: 10, ac: 1, elementalProfile: { weaknesses: [Element.Fire] },
    }));
    const observedHp: number[] = [];
    const context = {
      combatants: [source.combatant, ...enemies], enemies, sources: [source],
      onElementalInteraction: (): void => {
        observedHp.push(enemies[0]!.currentHp);
        enemies[0]!.currentHp = 8;
      },
    };
    const validation = validateBattleAction(context.combatants, {
      actorId: source.combatant.id, kind: "attack",
    }, { mp: actor.mp, inventory: actor.inventory, economy: createBattleActionEconomy(source.combatant.id) });
    if (!validation.plan) throw new Error(validation.message);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = executeValidatedBattleAction(source, validation.plan, context);
    expect(observedHp).toEqual([0]);
    expect(enemies[0]?.currentHp).toBe(8);
    expect(result.diceResults?.[0]?.result.damageRoll).toMatchObject({
      amount: 16, application: { amount: 10, limit: "Overkill" },
    });
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("distinguishes rolled healing from the effective max-HP-limited change", () => {
    const actor = createActor();
    actor.hp = 28;
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = playerCastSpellAtTargets(actor, "cureWounds", []);
    expect(result.healingResults).toMatchObject([{
      healing: 2,
      healingRoll: {
        roll: { sides: 8, naturalRolls: [5], modifier: 0, total: 5 },
        amount: 5,
        application: { amount: 2, limit: "Maximum HP" },
      },
    }]);
    expect(actor.hp).toBe(30);
    expect(actor.mp).toBe(98);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("shares one party healing pool while capturing independent max-HP caps", () => {
    const actor = createActor();
    const targets = [
      { id: "party:hero", label: "Hero", currentHp: 28, maxHp: 30 },
      { id: "party:companion:guardian", label: "Guardian", currentHp: 30, maxHp: 30 },
      { id: "party:companion:mystic", label: "Mystic", currentHp: 1, maxHp: 30 },
    ];
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.4)
      .mockReturnValueOnce(0.999);
    const result = playerCastSpellAtTargets(actor, "massCureWounds", [], targets);
    expect(result.healingResults.map((target) => target.healing)).toEqual([2, 0, 13]);
    expect(targets.map((target) => target.currentHp)).toEqual([30, 30, 14]);
    for (const target of result.healingResults) {
      expect(target.healingRoll).toMatchObject({
        roll: { sides: 8, naturalRolls: [1, 4, 8], modifier: 0, total: 13 },
        amount: 13, shared: true, application: { amount: target.healing },
      });
    }
    expect(actor.mp).toBe(92);
    expect(random).toHaveBeenCalledTimes(3);
  });

  it("retains actual healing components and caps outside combat for both spells and abilities", () => {
    for (const kind of ["spell", "ability"] as const) {
      const actor = createActor();
      actor.hp = 29;
      actor.knownSpells.push("cureWounds");
      actor.knownAbilities.push("secondWind");
      const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
      const result = kind === "spell"
        ? castSpellOutsideCombat(actor, "cureWounds")
        : useAbilityOutsideCombat(actor, "secondWind", true);
      expect(result.success).toBe(true);
      expect(result.healingRoll).toMatchObject({
        roll: { sides: 8, naturalRolls: kind === "spell" ? [5] : [5, 5, 5], modifier: 0 },
        amount: kind === "spell" ? 5 : 15,
        application: { amount: 1, limit: "Maximum HP" },
      });
      expect(actor.hp).toBe(30);
      expect(actor.mp).toBe(100 - (kind === "spell" ? getSpell("cureWounds")! : getAbility("secondWind")!).mpCost);
      expect(random).toHaveBeenCalledTimes(kind === "spell" ? 1 : 3);
      random.mockRestore();
    }
  });

  it("captures enemy critical dice, canonical bonuses, and one overkill-limited HP write", () => {
    const actor = createActor();
    actor.hp = 3;
    const target = createHeroCombatant(actor);
    const effects: PlayerState["activeEffects"] = [];
    applyStatusEffect(effects, "enraged", "Mock source");
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.4)
      .mockReturnValueOnce(0.5);
    const result = monsterAttackTarget(
      { ...getMonster("orc")!, damageCount: 2, damageDie: 6 },
      target, 2, 0, 0, effects, 0, 2,
    );
    expect(result.damageRoll).toMatchObject({
      roll: { sides: 6, naturalRolls: [1, 2, 3, 4], modifier: 5, total: 15 },
      amount: 15, application: { amount: 3, limit: "Overkill" }, criticalDice: true,
    });
    expect(result.critical).toBe(true);
    expect(actor.hp).toBe(0);
    expect(random).toHaveBeenCalledTimes(5);
    const shieldAdjusted = captureEffectAdjustment(result.damageRoll!, "Shield defend -1", 14);
    const applied = captureEffectApplication(shieldAdjusted, 2, "Overkill");
    expect(applied).toMatchObject({
      roll: { total: 15 },
      adjustments: [{ label: "Shield defend -1", amount: 14 }],
      amount: 14, application: { amount: 2, limit: "Overkill" },
    });
    expect(result.damageRoll?.amount).toBe(15);
    expect(random).toHaveBeenCalledTimes(5);
  });

  it("captures damage-only life drain without a fabricated healing or saving throw roll", () => {
    const actor = createActor();
    actor.hp = 3;
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);
    const result = monsterUseAbilityTarget({
      name: "Mock drain", chance: 1, type: "damage", damageCount: 2, damageDie: 6,
      selfHeal: true, statusEffect: "poison",
    }, getMonster("wraith")!, createHeroCombatant(actor));
    expect(result).toMatchObject({
      damage: 7, healing: 7,
      damageRoll: {
        roll: { sides: 6, naturalRolls: [1, 6], total: 7 },
        amount: 7, application: { amount: 3, limit: "Overkill" },
      },
    });
    expect(result.healingRoll).toBeUndefined();
    expect(actor.hp).toBe(0);
    expect(actor.activeEffects.map((effect) => effect.id)).toEqual(["poison"]);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("captures status tick dice before the existing saving throw in the same RNG order", () => {
    const actor = createActor();
    applyStatusEffect(actor.activeEffects, "poison", "Mock source");
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.2);
    const result = processStartOfTurn(actor.activeEffects, actor.stats);
    expect(result).toMatchObject({
      tickDamage: 5,
      damageRolls: [{
        effectId: "poison", label: "Poisoned",
        damageRoll: { roll: { sides: 4, naturalRolls: [3], modifier: 2, total: 5 }, amount: 5 },
      }],
      savingThrows: [{
        success: false, rollResult: { naturalRoll: 5, modifier: 0, total: 5 },
      }],
    });
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("retains multiple tick/save RNG order without inventing per-tick capped HP allocation", () => {
    const actor = createActor();
    applyStatusEffect(actor.activeEffects, "poison", "Mock source");
    applyStatusEffect(actor.activeEffects, "burn", "Mock source");
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);
    const result = processStartOfTurn(actor.activeEffects, actor.stats);
    expect(result.tickDamage).toBe(10);
    expect(result.damageRolls).toMatchObject([
      { effectId: "burn", damageRoll: { roll: { naturalRolls: [4], modifier: 3, total: 7 }, amount: 7 } },
      { effectId: "poison", damageRoll: { roll: { naturalRolls: [1], modifier: 2, total: 3 }, amount: 3 } },
    ]);
    expect(result.savingThrows.map((save) => [save.effectId, save.rollResult.naturalRoll, save.success]))
      .toEqual([["burn", 1, false], ["poison", 20, true]]);
    expect(result.damageRolls.every((tick) => tick.damageRoll.application === undefined)).toBe(true);
    expect(actor.activeEffects.map((effect) => effect.id)).toEqual(["burn"]);
    expect(random).toHaveBeenCalledTimes(4);
  });

  it("preserves exact trap damage and the nonlethal HP limit", () => {
    const actor = createActor();
    actor.hp = 3;
    const definition = getTrapDefinition("spikePit");
    const trap: DungeonTrap = {
      id: "fixture:spikePit", type: "spikePit", dungeonId: "heartlands_dungeon",
      level: 0, x: 5, y: 5, protectsTreasure: false,
      detectionDC: definition.detectionDC, disarmDC: definition.disarmDC,
      rewardXp: definition.rewardXp,
    };
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);
    const result = triggerDungeonTrap(actor, trap);
    expect(result).toMatchObject({
      damage: 2,
      damageRoll: {
        roll: { sides: 6, naturalRolls: [1, 6], modifier: 0, total: 7 },
        amount: 7, application: { amount: 2, limit: "Nonlethal" },
      },
    });
    expect(actor.hp).toBe(1);
    expect(random).toHaveBeenCalledTimes(2);
    expect(triggerDungeonTrap(actor, trap).triggered).toBe(false);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("keeps fixed healing and legacy numeric trap rolls aggregate without consuming RNG", () => {
    const actor = createActor();
    actor.hp = 28;
    actor.inventory.push({ ...getItem("potion")! });
    const index = actor.inventory.length - 1;
    const random = vi.spyOn(Math, "random");
    const item = useItem(actor, index);
    expect(item).toEqual({ used: true, message: "Healed 2 HP!" });
    expect(actor.hp).toBe(30);
    expect(actor.inventory).toHaveLength(index);
    const fixed = rollEffectDice(0, 6, [{ label: "Fixed", value: 4 }]);
    expect(fixed.roll).toBeUndefined();
    expect(fixed.amount).toBe(4);
    const definition = getTrapDefinition("spikePit");
    const trap: DungeonTrap = {
      id: "fixture:numericTrap", type: "spikePit", dungeonId: "heartlands_dungeon",
      level: 0, x: 5, y: 5, protectsTreasure: false,
      detectionDC: definition.detectionDC, disarmDC: definition.disarmDC,
      rewardXp: definition.rewardXp,
    };
    const roller = vi.fn(() => 100);
    const result = triggerDungeonTrap(actor, trap, roller);
    expect(result.damage).toBe(29);
    expect(result.damageRoll).toBeUndefined();
    expect(actor.hp).toBe(1);
    expect(roller).toHaveBeenCalledTimes(1);
    expect(random).not.toHaveBeenCalled();
  });

  it.each([-0.5, 1.5])("preserves a fixed custom healing effect of %s without invented dice", (effect) => {
    const actor = createActor();
    actor.hp = 28;
    const item = normalizeSerializedHeroItem({
      id: "mockRestoration", name: "Mock restoration", description: "Fixed legacy effect",
      type: "consumable", cost: 1.25, effect,
    });
    if (!item) throw new Error("Invalid supported mock restoration fixture");
    actor.inventory.push(item);
    const random = vi.spyOn(Math, "random");
    const result = useItem(actor, actor.inventory.length - 1);
    expect(result).toEqual({ used: true, message: `Healed ${effect} HP!` });
    expect(actor.hp).toBe(28 + effect);
    expect(random).not.toHaveBeenCalled();
    expect(JSON.stringify(actor)).not.toContain('"healingRoll"');
  });

  it("rejects nonfinite evidence and noninteger face/count data instead of silently showing fixed amounts", () => {
    const random = vi.spyOn(Math, "random");
    for (const count of [-1, 1.5, NaN, Infinity]) {
      expect(() => rollEffectDice(count, 6)).toThrow(/dice count/);
    }
    expect(random).not.toHaveBeenCalled();
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => snapshotEffectRoll({
        modifiers: [], adjustments: [], amount: value,
      })).toThrow(/effect evidence/);
      expect(() => snapshotEffectRoll({
        roll: { sides: 6, naturalRolls: [4], modifier: value, total: 4 },
        modifiers: [], adjustments: [], amount: 4,
      })).toThrow(/modifier or total/);
    }
    expect(() => snapshotEffectRoll({
      roll: { sides: 6, naturalRolls: [1.5], modifier: 0, total: 1.5 },
      modifiers: [], adjustments: [], amount: 1.5,
    })).toThrow(/natural dice/);
    expect(() => snapshotEffectRoll({
      roll: { sides: 6.5, naturalRolls: [1], modifier: 0, total: 1 },
      modifiers: [], adjustments: [], amount: 1,
    })).toThrow(/die size/);
  });

  it("labels a capped negative damage amount without calling it overkill or changing it", () => {
    const roll = snapshotEffectRoll({
      roll: { sides: 4, naturalRolls: [1], modifier: -4, total: -3 },
      modifiers: [{ label: "Statuses", value: -4 }], adjustments: [], amount: -3,
    });
    const result = captureDamageApplication({ damage: -3, damageRoll: roll }, 0);
    expect(result.damageRoll).toMatchObject({
      amount: -3, application: { amount: 0, limit: "Maximum HP" },
    });
    expect(roll.application).toBeUndefined();
  });

  it("leaves the whole effect/RNG/resource sequence unchanged in every presentation mode", () => {
    function run(mode: "none" | "all" | "off" | "instant" | "reduced") {
      const actor = createActor();
      const monster = getMonster("orc")!;
      let seed = 165;
      let calls = 0;
      const random = vi.spyOn(Math, "random").mockImplementation(() => {
        calls += 1;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x1_0000_0000;
      });
      const controller = new DicePresentationController({
        record: vi.fn(), show: vi.fn(), settle: vi.fn(), hide: vi.fn(),
        dismiss: vi.fn(), clear: vi.fn(),
        schedule: vi.fn(() => vi.fn()),
      });
      const attack = playerAttack(actor, monster);
      const missile = playerCastSpellAtTargets(actor, "magicMissile", [{ monster }]);
      applyStatusEffect(actor.activeEffects, "poison", "Mock source");
      const status = processStartOfTurn(actor.activeEffects, actor.stats);
      actor.hp = 29;
      const healing = playerCastSpellAtTargets(actor, "cureWounds", []);
      const views = [
        createCombatDicePresentation(attack, { label: "Attack" })!,
        createCombatDicePresentation(missile.results[0]!, { label: "Magic Missile" })!,
        ...status.savingThrows.map((save) => createD20Presentation(save.rollResult, {
          category: "save", label: save.label, outcome: save.success ? "success" : "failure",
        })),
        ...status.damageRolls.map((tick) => createEffectDicePresentation(tick.damageRoll, {
          category: "damage", label: tick.label, outcome: "rolled",
        })),
        createEffectDicePresentation(healing.healingResults[0]!.healingRoll!, {
          category: "healing", label: "Cure Wounds", outcome: "success",
        }),
      ];
      if (mode !== "none") {
        for (const view of views) {
          controller.present(view, {
            frequency: mode === "off" ? "off" : "all",
            speed: mode === "instant" ? "instant" : "normal",
          }, mode === "reduced");
          controller.fastForward();
        }
      }
      controller.cleanup();
      const result = {
        attack, missile, status, healing, hp: actor.hp, mp: actor.mp,
        effects: structuredClone(actor.activeEffects), next: rollD20(), calls,
      };
      random.mockRestore();
      return result;
    }
    const baseline = run("none");
    for (const mode of ["all", "off", "instant", "reduced"] as const) {
      expect(run(mode)).toEqual(baseline);
    }
  });

  it("freezes only copied scalar evidence, not extra actor references", () => {
    const actor = createActor();
    const raw = {
      owner: actor,
      roll: { sides: 6, naturalRolls: [4], modifier: 2, total: 6, owner: actor },
      modifiers: [{ label: "Strength", value: 2, owner: actor }],
      adjustments: [{ label: "Resistance", amount: 3, owner: actor }],
      amount: 3,
      application: { amount: 2, limit: "Overkill", owner: actor },
    };
    const exact = snapshotEffectRoll(raw);
    raw.roll.naturalRolls[0] = 1;
    raw.modifiers[0]!.value = 99;
    raw.application.amount = 0;
    expect(exact).toEqual({
      roll: { sides: 6, naturalRolls: [4], modifier: 2, total: 6 },
      modifiers: [{ label: "Strength", value: 2 }],
      adjustments: [{ label: "Resistance", amount: 3 }],
      amount: 3, application: { amount: 2, limit: "Overkill" },
    });
    expect(JSON.stringify(exact)).not.toContain("owner");
    expect(Object.isFrozen(exact.modifiers[0])).toBe(true);
    expect(Object.isFrozen(exact.adjustments)).toBe(true);
    expect(Object.isFrozen(exact.application)).toBe(true);
    expect(() => snapshotEffectRoll({ ...exact, amount: Infinity })).toThrow(/effect evidence/);
  });
});

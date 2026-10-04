// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ Scene: class { constructor(_config?: unknown) {} } }));

import { BattleScene } from "../src/scenes/Battle";
import { createSoloEncounter } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";
import { getItem } from "../src/data/items";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import {
  createActivePartyCombatants,
  recruitCompanion,
  type CompanionState,
} from "../src/systems/party";
import {
  validateBattleAction,
  type BattleActionEconomyState,
  type BattleActionExecutionContext,
  type BattleActionPlan,
  type BattleActionSource,
} from "../src/systems/battleActions";
import {
  BattleDecisionClock,
  type BattleTimedDecision,
} from "../src/systems/battleTiming";
import type {
  CompanionTurnContext,
  GroupCombatant,
  PartyCombatant,
} from "../src/systems/groupCombat";
import type { BattlePartyManager } from "../src/managers/battleParty";

interface TimingHarness {
  clock: BattleDecisionClock;
  beginTurn(actorId: string, label: string): void;
  endTurn(): void;
  acceptsInput(): boolean;
  destroy(): void;
}

interface SceneHarness {
  player: PlayerState;
  phase: "init" | "playerTurn" | "monsterTurn" | "victory" | "defeat" | "fled";
  heroCombatant: PartyCombatant;
  partyCombatants: PartyCombatant[];
  combatants: GroupCombatant[];
  partyActionSources: BattleActionSource[];
  playerEconomy: BattleActionEconomyState;
  battleTiming: TimingHarness | null;
  battlePartyManager: BattlePartyManager;
  heroExecutionContext: BattleActionExecutionContext;
  pendingTargetAction: { validIndices: number[]; execute(index: number): void } | null;
  doDefend(): void;
  doFlee(): void;
  startPlayerTurn(): void;
  startCompanionTurn(actor: PartyCombatant): void;
  finishCompanionTurn(actor: PartyCombatant): void;
  handleTimedBattleTimeout(decision: Readonly<BattleTimedDecision>): boolean;
  executeTimedHeroPlan(plan: BattleActionPlan): void;
  confirmTargetSelection(): void;
  cleanupBattleTransientState(): void;
}

interface CompanionHarness {
  currentCombatant: PartyCombatant;
  currentCompanion: CompanionState;
  currentContext: CompanionTurnContext;
  economy: BattleActionEconomyState;
}

function scene(timed = true, companionId?: "guardian" | "scout" | "mystic") {
  const battle = new BattleScene();
  const player = createPlayer("TimingSceneHero", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  }, "barbarian");
  player.level = 5;
  player.maxMp = 20;
  player.mp = 20;
  player.knownAbilities = ["rage"];
  player.knownSpells = ["cureWounds"];
  if (timed) player.battleTiming = { mode: "timed", durationSeconds: 15, timeoutAction: "defend" };
  if (companionId) {
    recruitCompanion(player, companionId);
    player.party.companions[0]!.controlMode = "manual";
  }
  battle.init({
    player,
    encounter: createSoloEncounter(getMonster("orc")!),
    defeatedBosses: new Set(),
    codex: createCodex(),
    partyCombatants: createActivePartyCombatants(player.party),
  });
  const harness = battle as unknown as SceneHarness;
  const log = vi.fn();
  const advance = vi.fn();
  const present = vi.fn();
  const scheduled = vi.fn();
  Object.assign(battle, {
    phase: "playerTurn",
    addLog: log,
    updatePlayerStats: vi.fn(),
    updateMonsterDisplay: vi.fn(),
    advanceTurn: advance,
    battlePresentation: {
      presentAction: present, presentFaint: vi.fn(), syncCombatants: vi.fn(), cleanup: vi.fn(),
    },
    battlePartyRenderer: { update: vi.fn(), clear: vi.fn() },
    time: { delayedCall: scheduled },
  });
  const clock = new BattleDecisionClock(player.battleTiming);
  const timing: TimingHarness = {
    clock,
    beginTurn: vi.fn((actorId) => {
      clock.beginTurn(`turn:${actorId}`, actorId);
      clock.advance(0);
    }),
    endTurn: vi.fn(() => clock.endTurn()),
    acceptsInput: () => clock.snapshot.status === "active",
    destroy: vi.fn(() => clock.destroy()),
  };
  if (timed) {
    harness.battleTiming = timing;
    timing.beginTurn(harness.heroCombatant.id, player.name);
  }
  return { battle, harness, player, clock, timing, log, advance, present, scheduled };
}

function plan(harness: SceneHarness, request: Parameters<typeof validateBattleAction>[1]): BattleActionPlan {
  const validation = validateBattleAction(
    harness.heroExecutionContext.combatants,
    request,
    {
      mp: harness.player.mp,
      inventory: harness.player.inventory,
      knownSpellIds: harness.player.knownSpells,
      knownAbilityIds: harness.player.knownAbilities,
      economy: harness.playerEconomy,
    },
  );
  expect(validation.plan).toBeDefined();
  return validation.plan!;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("timed Battle authority contracts", () => {
  it("keeps Standard without a timer and matches its Defend economy, status, and resources", () => {
    const standard = scene(false);
    const timed = scene(true);
    standard.harness.player.activeEffects.push({ id: "haste", remainingTurns: 2, source: "Test" });
    timed.harness.player.activeEffects.push({ id: "haste", remainingTurns: 2, source: "Test" });
    const random = vi.spyOn(Math, "random");
    standard.harness.doDefend();
    timed.clock.advance(15_000);
    expect(timed.harness.handleTimedBattleTimeout(timed.clock.snapshot.decision!)).toBe(true);
    expect(standard.harness.battleTiming).toBeNull();
    expect(timed.harness.heroCombatant.isDefending).toBe(standard.harness.heroCombatant.isDefending);
    expect(timed.harness.playerEconomy).toEqual(standard.harness.playerEconomy);
    expect(timed.player.activeEffects).toEqual(standard.player.activeEffects);
    expect(timed.player.mp).toBe(standard.player.mp);
    expect(timed.player.inventory).toEqual(standard.player.inventory);
    expect(timed.harness.phase).toBe(standard.harness.phase);
    expect(timed.advance).toHaveBeenCalledOnce();
    expect(random).not.toHaveBeenCalled();
  });

  it("cancels unconfirmed targeting and rejects duplicate timeout and target callbacks", () => {
    const { harness, clock, log, advance, present, player } = scene();
    const unconfirmed = vi.fn();
    harness.pendingTargetAction = { validIndices: [0], execute: unconfirmed };
    const mp = player.mp;
    clock.advance(15_000);
    const expired = clock.snapshot.decision!;
    expect(harness.handleTimedBattleTimeout(expired)).toBe(true);
    expect(harness.handleTimedBattleTimeout(expired)).toBe(false);
    harness.confirmTargetSelection();
    expect(harness.pendingTargetAction).toBeNull();
    expect(unconfirmed).not.toHaveBeenCalled();
    expect(player.mp).toBe(mp);
    expect(advance).toHaveBeenCalledOnce();
    expect(present).toHaveBeenCalledOnce();
    expect(log.mock.calls.filter(([message]) => String(message).startsWith("Time expired:")))
      .toHaveLength(1);
  });

  it("keeps bonus-ability time and MP consumption, then spends only one main timeout action", () => {
    const { harness, clock, player, advance } = scene();
    clock.advance(4_000);
    const rage = plan(harness, { actorId: harness.heroCombatant.id, kind: "ability", actionId: "rage" });
    harness.executeTimedHeroPlan(rage);
    expect(player.mp).toBe(15);
    expect(harness.playerEconomy).toMatchObject({ bonusActionUsed: true, actionUsed: false });
    expect(clock.snapshot.decision?.remainingMs).toBe(11_000);
    clock.advance(11_000);
    harness.handleTimedBattleTimeout(clock.snapshot.decision!);
    harness.executeTimedHeroPlan(rage);
    expect(player.mp).toBe(15);
    expect(harness.playerEconomy).toMatchObject({ bonusActionUsed: true, actionUsed: true });
    expect(advance).toHaveBeenCalledOnce();
  });

  it("consumes a targeted hero item once, preserves its ally target and remaining budget", () => {
    const { harness, clock, player, advance } = scene(true, "guardian");
    player.inventory.push({ ...getItem("potion")! });
    const ally = harness.partyCombatants[1]!;
    ally.currentHp = 1;
    clock.advance(3_000);
    const itemPlan = plan(harness, {
      actorId: harness.heroCombatant.id, kind: "item",
      itemIndex: player.inventory.length - 1, preferredTargetId: ally.id,
    });
    harness.executeTimedHeroPlan(itemPlan);
    const healedHp = ally.currentHp;
    expect(healedHp).toBeGreaterThan(1);
    expect(player.inventory.some((item) => item.id === "potion")).toBe(false);
    expect(clock.snapshot.decision?.remainingMs).toBe(12_000);
    expect(harness.phase).toBe("playerTurn");
    clock.advance(12_000);
    harness.handleTimedBattleTimeout(clock.snapshot.decision!);
    harness.executeTimedHeroPlan(itemPlan);
    expect(ally.currentHp).toBe(healedHp);
    expect(harness.playerEconomy).toMatchObject({
      actionUsed: true, bonusActionUsed: true, itemsUsed: 1,
    });
    expect(advance).toHaveBeenCalledOnce();
  });

  it("does not start a budget for a stunned or knocked-out hero", () => {
    const stunned = scene();
    vi.spyOn(Math, "random").mockReturnValue(0);
    stunned.player.activeEffects.push({ id: "stunned", remainingTurns: 1, source: "Test" });
    vi.mocked(stunned.timing.beginTurn).mockClear();
    stunned.harness.startPlayerTurn();
    expect(stunned.timing.beginTurn).not.toHaveBeenCalled();
    expect(stunned.player.activeEffects).toEqual([]);
    expect(stunned.harness.phase).toBe("monsterTurn");

    const knockedOut = scene(true, "guardian");
    knockedOut.player.hp = 0;
    vi.mocked(knockedOut.timing.beginTurn).mockClear();
    knockedOut.harness.startPlayerTurn();
    expect(knockedOut.timing.beginTurn).not.toHaveBeenCalled();
    expect(knockedOut.advance).toHaveBeenCalledWith(0);
  });

  it.each(["guardian", "scout", "mystic"] as const)(
    "times a manual %s turn once and clears its stale menu/context",
    (id) => {
      const { harness, player, timing, clock, advance, present } = scene(true, id);
      const actor = harness.partyCombatants[1]!;
      harness.phase = "monsterTurn";
      timing.endTurn();
      timing.beginTurn(actor.id, actor.label);
      const complete = vi.fn(() => harness.finishCompanionTurn(actor));
      const context: CompanionTurnContext = {
        combatant: actor,
        actors: harness.heroExecutionContext.combatants,
        enemies: harness.combatants,
        weatherPenalty: 0,
        getEnemyDefenseBonus: () => 0,
        recordElementalInteraction: () => undefined,
        addLog: vi.fn(),
        completeTurn: complete,
      };
      const manager = harness.battlePartyManager as unknown as CompanionHarness;
      Object.assign(manager, {
        currentCombatant: actor, currentCompanion: player.party.companions[0]!,
        currentContext: context,
        economy: { actorId: actor.id, actionUsed: false, bonusActionUsed: false, itemsUsed: 0 },
      });
      clock.advance(15_000);
      const expired = clock.snapshot.decision!;
      expect(harness.handleTimedBattleTimeout(expired)).toBe(true);
      expect(harness.handleTimedBattleTimeout(expired)).toBe(false);
      expect(actor.isDefending).toBe(true);
      expect(harness.battlePartyManager.manualActorId).toBeNull();
      expect(complete).toHaveBeenCalledOnce();
      expect(advance).toHaveBeenCalledOnce();
      expect(present).toHaveBeenCalledOnce();
    },
  );

  it("does not give gambits a decision clock or change their normal execution", () => {
    const { harness, player, timing, clock, advance } = scene(true, "guardian");
    player.party.companions[0]!.controlMode = "gambit";
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.mocked(timing.beginTurn).mockClear();
    harness.startCompanionTurn(harness.partyCombatants[1]!);
    expect(timing.beginTurn).not.toHaveBeenCalled();
    expect(clock.snapshot.decision).toBeNull();
    expect(advance).toHaveBeenCalledOnce();
    expect(harness.combatants[0]!.currentHp).toBeLessThan(harness.combatants[0]!.maxHp);
  });

  it("keeps successful Flee hooks/save/scheduling once even if a timeout was ready", () => {
    const { harness, battle, player, clock, scheduled } = scene();
    const resolved = vi.fn();
    Object.assign(battle, { battleHooks: { onBattleResolved: resolved } });
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const expired = clock.snapshot.decision!;
    harness.doFlee();
    harness.doFlee();
    expect(harness.handleTimedBattleTimeout(expired)).toBe(false);
    expect(harness.phase).toBe("fled");
    expect(resolved).toHaveBeenCalledOnce();
    expect(scheduled).toHaveBeenCalledOnce();
    expect(player.inventory).toHaveLength(1);
  });

  it("cleans timing permanently before a battle handoff and rejects old callbacks", () => {
    const { harness, clock, timing, advance } = scene();
    clock.advance(15_000);
    const expired = clock.snapshot.decision!;
    harness.cleanupBattleTransientState();
    expect(timing.destroy).toHaveBeenCalledOnce();
    expect(clock.snapshot.status).toBe("stopped");
    expect(harness.handleTimedBattleTimeout(expired)).toBe(false);
    expect(advance).not.toHaveBeenCalled();
  });
});

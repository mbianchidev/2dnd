import { describe, expect, it } from "vitest";
import { Terrain } from "../src/data/mapTypes";
import {
  WORLD_EVENT_DEFINITIONS,
  WORLD_EVENT_TRIGGER_RULES,
  getWorldEventDefinition,
} from "../src/data/worldEvents";
import {
  IRON_DISPATCH_QUEST_ID,
  MAIN_QUEST_ID,
} from "../src/data/quests";
import {
  CODEX_KNOWLEDGE_ENTRIES,
} from "../src/data/codexKnowledge";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";
import { createCodex } from "../src/systems/codex";
import { createPlayer, type PlayerState } from "../src/systems/player";
import {
  createWorldEventState,
  forceWorldEvent,
  getPendingWorldEventEncounter,
  getWorldEventChance,
  isWorldEventEligible,
  normalizeWorldEventState,
  prepareWorldEventBattle,
  resolveOverworldStepTrigger,
  resolveWorldEventBattle,
  resolveWorldEventChoice,
  rollWorldEvent,
  WORLD_EVENT_LOG_LIMIT,
  type WorldEventContext,
} from "../src/systems/worldEvents";

const BASE_STATS = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createTestPlayer(): PlayerState {
  const player = createPlayer("Event Tester", BASE_STATS);
  player.level = 3;
  player.progression.worldEvents = createWorldEventState(123456);
  return player;
}

function createContext(
  player: PlayerState,
  overrides: Partial<WorldEventContext> = {},
): WorldEventContext {
  return {
    location: {
      chunkX: 4,
      chunkY: 2,
      x: 4,
      y: 4,
      areaName: "Heartlands",
      terrain: Terrain.Grass,
    },
    level: player.level,
    timeStep: 90,
    period: TimePeriod.Day,
    weather: WeatherType.Clear,
    quests: player.progression.quests,
    defeatedBosses: new Set(),
    ...overrides,
  };
}

describe("world event definitions and eligibility", () => {
  it("defines every required campaign-wide family with stable choices", () => {
    expect(new Set(WORLD_EVENT_DEFINITIONS.map((event) => event.family))).toEqual(
      new Set(["shrine", "ambush", "traveler", "discovery", "hazard", "reward"]),
    );
    expect(new Set(WORLD_EVENT_DEFINITIONS.map((event) => event.id)).size).toBe(
      WORLD_EVENT_DEFINITIONS.length,
    );
    for (const event of WORLD_EVENT_DEFINITIONS) {
      expect(event.weight).toBeGreaterThan(0);
      expect(event.cooldownSteps).toBeGreaterThan(0);
      expect(event.choices.length).toBeGreaterThan(0);
      expect(new Set(event.choices.map((choice) => choice.id)).size).toBe(
        event.choices.length,
      );
    }
  });

  it("applies terrain, time, weather, level, area, quest, and repeat rules", () => {
    const player = createTestPlayer();
    const state = player.progression.worldEvents;
    const shrine = getWorldEventDefinition("moonlitShrine")!;
    const storm = getWorldEventDefinition("stormWashedCrossing")!;
    const courier = getWorldEventDefinition("woundedCourier")!;

    expect(isWorldEventEligible(
      shrine,
      state,
      createContext(player, { period: TimePeriod.Night }),
    )).toBe(true);
    expect(isWorldEventEligible(
      shrine,
      state,
      createContext(player, { period: TimePeriod.Day }),
    )).toBe(false);
    expect(isWorldEventEligible(
      storm,
      state,
      createContext(player, { weather: WeatherType.Storm }),
    )).toBe(true);
    expect(isWorldEventEligible(
      storm,
      state,
      createContext(player, { weather: WeatherType.Clear }),
    )).toBe(false);

    const main = player.progression.quests.quests[MAIN_QUEST_ID];
    main.stage = 1;
    expect(isWorldEventEligible(courier, state, createContext(player))).toBe(true);
    player.progression.quests.quests[IRON_DISPATCH_QUEST_ID].status = "active";
    expect(isWorldEventEligible(courier, state, createContext(player))).toBe(false);

    state.repeatCounters[shrine.id] = 1;
    expect(isWorldEventEligible(
      shrine,
      state,
      createContext(player, { period: TimePeriod.Night }),
    )).toBe(false);
  });

  it("bounds event probability independently from the monster encounter cap", () => {
    const player = createTestPlayer();
    const chance = getWorldEventChance(createContext(player, {
      period: TimePeriod.Night,
      weather: WeatherType.Storm,
    }));
    expect(chance).toBeLessThanOrEqual(WORLD_EVENT_TRIGGER_RULES.maxChance);
    expect(chance).toBeCloseTo(0.0648);
  });
});

describe("seeded world event selection and cooldowns", () => {
  it("short-circuits travel flows in event, treasure, skill, encounter order", () => {
    const calls: string[] = [];
    const result = resolveOverworldStepTrigger({
      worldEvent: () => {
        calls.push("event");
        return true;
      },
      treasure: () => {
        calls.push("treasure");
        return true;
      },
      skillCheck: () => {
        calls.push("skill");
        return true;
      },
      encounter: () => {
        calls.push("encounter");
        return true;
      },
    });
    expect(result).toBe("worldEvent");
    expect(calls).toEqual(["event"]);
  });

  it("selects the same event on the same step for the same seed and context", () => {
    const firstPlayer = createTestPlayer();
    const secondPlayer = createTestPlayer();
    const firstState = createWorldEventState(98765);
    const secondState = createWorldEventState(98765);
    const firstContext = createContext(firstPlayer);
    const secondContext = createContext(secondPlayer);
    let firstTrigger: ReturnType<typeof rollWorldEvent> | undefined;
    let secondTrigger: ReturnType<typeof rollWorldEvent> | undefined;

    for (let step = 0; step < 400; step++) {
      firstTrigger = rollWorldEvent(firstState, firstContext);
      secondTrigger = rollWorldEvent(secondState, secondContext);
      if (firstTrigger.triggered || secondTrigger.triggered) break;
    }

    expect(firstTrigger?.triggered).toBe(true);
    expect(secondTrigger?.pending?.eventId).toBe(firstTrigger?.pending?.eventId);
    expect(secondState.rollCounter).toBe(firstState.rollCounter);
  });

  it("does not roll another flow while pending and honors cooldown after resolution", () => {
    const player = createTestPlayer();
    const codex = createCodex();
    const context = createContext(player);
    forceWorldEvent(player.progression.worldEvents, "abandonedSupplyCart", context);
    expect(rollWorldEvent(player.progression.worldEvents, context).chance).toBe(0);
    resolveWorldEventChoice(player, codex, new Set(), "markCart");
    const before = player.progression.worldEvents.cooldownRemaining;
    const result = rollWorldEvent(player.progression.worldEvents, context);
    expect(result.triggered).toBe(false);
    expect(player.progression.worldEvents.cooldownRemaining).toBe(before - 1);
  });
});

describe("world event outcomes", () => {
  it("starts a canonical sidequest through quest APIs and remains idempotent", () => {
    const player = createTestPlayer();
    const codex = createCodex();
    player.progression.quests.quests[MAIN_QUEST_ID].stage = 1;
    const context = createContext(player);
    forceWorldEvent(player.progression.worldEvents, "woundedCourier", context);

    const result = resolveWorldEventChoice(
      player,
      codex,
      new Set(),
      "takeDispatch",
    );
    expect(result.questUpdates.some((update) =>
      update.message === "Quest started: Ironbound Dispatch"
    )).toBe(true);
    expect(
      player.progression.quests.quests[IRON_DISPATCH_QUEST_ID].status,
    ).toBe("active");
    expect(player.inventory.filter((item) => item.id === "sealedDispatch")).toHaveLength(1);

    const log = player.progression.worldEvents.log[0]!;
    player.progression.worldEvents.pending = {
      instanceId: log.instanceId,
      eventId: log.eventId,
      phase: "choice",
      location: log.location,
      timeStep: log.timeStep,
      period: log.period,
      weather: log.weather,
    };
    const replay = resolveWorldEventChoice(
      player,
      codex,
      new Set(),
      "takeDispatch",
    );
    expect(replay.resolved).toBe(false);
    expect(player.inventory.filter((item) => item.id === "sealedDispatch")).toHaveLength(1);
  });

  it("uses the shared skill-check resolver and applies nonlethal hazard damage", () => {
    const player = createTestPlayer();
    const codex = createCodex();
    player.hp = 5;
    const context = createContext(player, {
      weather: WeatherType.Storm,
    });
    forceWorldEvent(
      player.progression.worldEvents,
      "stormWashedCrossing",
      context,
    );
    const result = resolveWorldEventChoice(
      player,
      codex,
      new Set(),
      "crossQuickly",
      () => 1,
    );
    expect(result.resolved).toBe(true);
    expect(player.hp).toBe(1);
    expect(
      player.progression.skillChecks[
        `worldEvent:stormWashedCrossing:1:crossQuickly`
      ],
    ).toMatchObject({
      ability: "dexterity",
      naturalRoll: 1,
      success: false,
    });
  });

  it("persists and reconstructs a pending special Battle encounter", () => {
    const player = createTestPlayer();
    const codex = createCodex();
    forceWorldEvent(
      player.progression.worldEvents,
      "goblinRoadAmbush",
      createContext(player),
    );
    const encounter = prepareWorldEventBattle(player, "fightAmbush");
    const normalized = normalizeWorldEventState(
      structuredClone(player.progression.worldEvents),
    );
    player.progression.worldEvents = normalized;

    expect(encounter.id).toBe("worldEvent:goblinRoadAmbush:1");
    expect(getPendingWorldEventEncounter(player).members[0]!.monster.id).toBe("goblin");
    expect(player.progression.worldEvents.pending?.phase).toBe("battle");

    const resolution = resolveWorldEventBattle(
      player,
      codex,
      new Set(),
      "victory",
    );
    expect(resolution.summary).toContain("ambush is broken");
    expect(player.progression.worldEvents.pending).toBeNull();
    expect(player.progression.worldEvents.log[0]?.outcomeId).toBe("ambushDefeated");
  });

  it("keeps future alignment and reputation hooks transient", () => {
    const player = createTestPlayer();
    const codex = createCodex();
    forceWorldEvent(
      player.progression.worldEvents,
      "abandonedSupplyCart",
      createContext(player),
    );
    const result = resolveWorldEventChoice(
      player,
      codex,
      new Set(),
      "markCart",
    );
    expect(result.futureHooks).toEqual([{
      type: "reputation",
      factionId: "travelers",
      delta: 1,
      reasonId: "abandonedSupplyCart.markCart",
    }]);
    expect(JSON.stringify(player.progression.worldEvents)).not.toContain("reputation");
    expect(JSON.stringify(player.progression.worldEvents)).not.toContain("alignment");
  });

  it("bounds the chronological record and unlocks Codex worldEvent sources", () => {
    const player = createTestPlayer();
    const codex = createCodex();
    const context = createContext(player);
    for (let index = 0; index < WORLD_EVENT_LOG_LIMIT + 5; index++) {
      forceWorldEvent(
        player.progression.worldEvents,
        "abandonedSupplyCart",
        context,
      );
      resolveWorldEventChoice(player, codex, new Set(), "searchCart");
    }
    expect(player.progression.worldEvents.log).toHaveLength(WORLD_EVENT_LOG_LIMIT);
    expect(player.progression.worldEvents.log[0]?.instanceId).toBe(
      "abandonedSupplyCart:6",
    );

    const eventSources = CODEX_KNOWLEDGE_ENTRIES.flatMap((entry) =>
      entry.sources.filter((source) => source.type === "worldEvent")
    );
    expect(eventSources.length).toBeGreaterThan(0);
    for (const source of eventSources) {
      expect(getWorldEventDefinition(source.eventId)).toBeDefined();
    }
  });
});

describe("world event save normalization", () => {
  it("repairs malformed state and clears pending data when the seed is corrupt", () => {
    const normalized = normalizeWorldEventState({
      seed: "bad",
      rollCounter: Number.MAX_SAFE_INTEGER + 1,
      triggerCount: Number.MAX_SAFE_INTEGER + 1,
      cooldownRemaining: 5000,
      pending: {
        instanceId: "goblinRoadAmbush:3",
        eventId: "goblinRoadAmbush",
        phase: "battle",
        selectedChoiceId: "fightAmbush",
      },
      resolvedOutcomeIds: ["ok", 7, "ok"],
      claimedRewardIds: ["claim", null],
      repeatCounters: {
        moonlitShrine: 99,
        unknown: 5,
      },
      log: [{ eventId: "unknown" }],
    });

    expect(normalized.seed).toBeGreaterThan(0);
    expect(normalized.rollCounter).toBe(0);
    expect(normalized.triggerCount).toBe(0);
    expect(normalized.cooldownRemaining).toBe(1000);
    expect(normalized.pending).toBeNull();
    expect(normalized.resolvedOutcomeIds).toEqual(["ok"]);
    expect(normalized.claimedRewardIds).toEqual(["claim"]);
    expect(normalized.repeatCounters).toEqual({ moonlitShrine: 1 });
    expect(normalized.log).toEqual([]);
  });
});

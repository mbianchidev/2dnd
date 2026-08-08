import { Terrain } from "./mapTypes";
import {
  IRON_DISPATCH_QUEST_ID,
  MAIN_QUEST_ID,
  type QuestId,
  type QuestStatus,
} from "./quests";
import { TimePeriod } from "../systems/daynight";
import { WeatherType } from "../systems/weather";
import type { SkillCheckAbility } from "./skillChecks";
import type {
  AlignmentName,
  ReputationTargetKind,
} from "./reputation";

export const WORLD_EVENT_FAMILIES = [
  "shrine",
  "ambush",
  "traveler",
  "discovery",
  "hazard",
  "reward",
] as const;

export type WorldEventFamily = (typeof WORLD_EVENT_FAMILIES)[number];

export type WorldEventFutureHook =
  | {
    readonly type: "alignment";
    readonly axis: "lawChaos" | "goodEvil";
    readonly delta: number;
    readonly reasonId: string;
  }
  | {
    readonly type: "reputation";
    readonly factionId: string;
    readonly delta: number;
    readonly reasonId: string;
  };

export interface WorldEventRewardDefinition {
  readonly id: string;
  readonly type: "gold" | "xp" | "item";
  readonly amount?: number;
  readonly itemId?: string;
  readonly quantity?: number;
}

export interface WorldEventOutcomeDefinition {
  readonly id: string;
  readonly summary: string;
  readonly rewards?: readonly WorldEventRewardDefinition[];
  readonly nonlethalDamage?: number;
  readonly startQuestId?: QuestId;
  readonly futureHooks?: readonly WorldEventFutureHook[];
}

export interface WorldEventQuestCondition {
  readonly questId: QuestId;
  readonly statuses?: readonly QuestStatus[];
  readonly minStage?: number;
  readonly maxStage?: number;
}

export interface WorldEventEligibility {
  readonly terrains?: readonly Terrain[];
  readonly areaPrefixes?: readonly string[];
  readonly periods?: readonly TimePeriod[];
  readonly weather?: readonly WeatherType[];
  readonly minLevel?: number;
  readonly maxLevel?: number;
  readonly questConditions?: readonly WorldEventQuestCondition[];
  readonly requiredDefeatedBossIds?: readonly string[];
  readonly excludedDefeatedBossIds?: readonly string[];
  readonly alignmentNames?: readonly AlignmentName[];
  readonly reputationConditions?: readonly {
    readonly kind: ReputationTargetKind;
    readonly targetId: string;
    readonly minimum: number;
    readonly maximum?: number;
  }[];
}

export interface WorldEventResolveChoice {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly type: "resolve";
  readonly outcome: WorldEventOutcomeDefinition;
}

export interface WorldEventSkillChoice {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly type: "skill";
  readonly ability: SkillCheckAbility;
  readonly dc: number;
  readonly success: WorldEventOutcomeDefinition;
  readonly failure: WorldEventOutcomeDefinition;
}

export interface WorldEventBattleChoice {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly type: "battle";
  readonly monsterId: string;
  readonly victory: WorldEventOutcomeDefinition;
  readonly fled: WorldEventOutcomeDefinition;
  readonly defeat: WorldEventOutcomeDefinition;
}

export type WorldEventChoiceDefinition =
  | WorldEventResolveChoice
  | WorldEventSkillChoice
  | WorldEventBattleChoice;

export interface WorldEventDefinition {
  readonly id: string;
  readonly family: WorldEventFamily;
  readonly title: string;
  readonly source: string;
  readonly prompt: string;
  readonly weight: number;
  readonly cooldownSteps: number;
  readonly maxRepeats?: number;
  readonly eligibility: WorldEventEligibility;
  readonly choices: readonly WorldEventChoiceDefinition[];
}

export const WORLD_EVENT_TRIGGER_RULES = {
  baseChance: 0.045,
  maxChance: 0.08,
  periodMultipliers: {
    [TimePeriod.Dawn]: 1.1,
    [TimePeriod.Day]: 1,
    [TimePeriod.Dusk]: 1.15,
    [TimePeriod.Night]: 1.2,
    [TimePeriod.Dungeon]: 0,
  },
  weatherMultipliers: {
    [WeatherType.Clear]: 1,
    [WeatherType.Rain]: 1.05,
    [WeatherType.Snow]: 1.05,
    [WeatherType.Sandstorm]: 1.15,
    [WeatherType.Storm]: 1.2,
    [WeatherType.Fog]: 1.15,
  },
} as const;

export const WORLD_EVENT_DEFINITIONS: readonly WorldEventDefinition[] = [
  {
    id: "moonlitShrine",
    family: "shrine",
    title: "A Moonlit Shrine",
    source: "Roadside shrine",
    prompt: "Silver runes wake across an old covenant shrine. The air asks for patience, not tribute.",
    weight: 8,
    cooldownSteps: 14,
    maxRepeats: 1,
    eligibility: {
      terrains: [Terrain.Grass, Terrain.Forest, Terrain.DeepForest, Terrain.Path],
      periods: [TimePeriod.Dusk, TimePeriod.Night],
      minLevel: 1,
    },
    choices: [
      {
        id: "studyRunes",
        label: "Study the runes",
        detail: "Wisdom check, DC 12",
        type: "skill",
        ability: "wisdom",
        dc: 12,
        success: {
          id: "shrineInsight",
          summary: "The runes reveal a forgotten road blessing. Gained 90 XP.",
          rewards: [{ id: "insightXp", type: "xp", amount: 90 }],
          futureHooks: [{
            type: "alignment",
            axis: "lawChaos",
            delta: -2,
            reasonId: "moonlitShrine.studyRunes",
          }],
        },
        failure: {
          id: "shrineSilent",
          summary: "The shrine remains silent, but its pattern is now recorded.",
        },
      },
      {
        id: "leaveShrine",
        label: "Leave it undisturbed",
        detail: "Continue the journey",
        type: "resolve",
        outcome: {
          id: "shrineRespected",
          summary: "You leave the old stones undisturbed.",
          futureHooks: [{
            type: "alignment",
            axis: "lawChaos",
            delta: 2,
            reasonId: "moonlitShrine.leaveShrine",
          }],
        },
      },
    ],
  },
  {
    id: "goblinRoadAmbush",
    family: "ambush",
    title: "Roadside Ambush",
    source: "Hidden raiders",
    prompt: "A snapped cord drops brush across the road as a goblin raider steps from cover.",
    weight: 5,
    cooldownSteps: 18,
    maxRepeats: 3,
    eligibility: {
      terrains: [
        Terrain.Grass,
        Terrain.Forest,
        Terrain.DeepForest,
        Terrain.Path,
        Terrain.Canyon,
      ],
      minLevel: 1,
      maxLevel: 8,
    },
    choices: [
      {
        id: "fightAmbush",
        label: "Stand and fight",
        detail: "Enter a normal Battle encounter",
        type: "battle",
        monsterId: "goblin",
        victory: {
          id: "ambushDefeated",
          summary: "The ambush is broken and the road is safe again.",
          futureHooks: [{
            type: "reputation",
            factionId: "roadwardens",
            delta: 4,
            reasonId: "goblinRoadAmbush.victory",
          }, {
            type: "alignment",
            axis: "lawChaos",
            delta: 2,
            reasonId: "goblinRoadAmbush.victory",
          }],
        },
        fled: {
          id: "ambushEscaped",
          summary: "You escape the ambush before it closes around the party.",
        },
        defeat: {
          id: "ambushOverwhelmed",
          summary: "The ambush overwhelms the party before town recovery.",
        },
      },
      {
        id: "avoidAmbush",
        label: "Back away quietly",
        detail: "Avoid combat and surrender the road",
        type: "resolve",
        outcome: {
          id: "ambushAvoided",
          summary: "You find another route and leave the raiders behind.",
          futureHooks: [{
            type: "alignment",
            axis: "lawChaos",
            delta: -3,
            reasonId: "goblinRoadAmbush.avoidAmbush",
          }],
        },
      },
    ],
  },
  {
    id: "woundedCourier",
    family: "traveler",
    title: "The Wounded Courier",
    source: "Ironhold courier",
    prompt: "An injured courier carries Brann's seal and a dispatch meant for Sandport.",
    weight: 10,
    cooldownSteps: 12,
    maxRepeats: 1,
    eligibility: {
      terrains: [Terrain.Grass, Terrain.Path, Terrain.Canyon],
      areaPrefixes: ["Heartlands", "Western", "Eastern", "Sun"],
      questConditions: [
        {
          questId: MAIN_QUEST_ID,
          statuses: ["active", "completed"],
          minStage: 1,
        },
        {
          questId: IRON_DISPATCH_QUEST_ID,
          statuses: ["locked"],
        },
      ],
    },
    choices: [
      {
        id: "takeDispatch",
        label: "Carry the dispatch",
        detail: "Start Ironbound Dispatch through the quest system",
        type: "resolve",
        outcome: {
          id: "dispatchAccepted",
          summary: "You accept Brann's sealed dispatch and promise to reach Sandport.",
          startQuestId: IRON_DISPATCH_QUEST_ID,
          futureHooks: [{
            type: "alignment",
            axis: "goodEvil",
            delta: 5,
            reasonId: "woundedCourier.takeDispatch",
          }, {
            type: "reputation",
            factionId: "heartlandsWardens",
            delta: 5,
            reasonId: "woundedCourier.takeDispatch",
          }],
        },
      },
      {
        id: "treatCourier",
        label: "Treat the courier",
        detail: "Wisdom check, DC 11",
        type: "skill",
        ability: "wisdom",
        dc: 11,
        success: {
          id: "courierStabilized",
          summary: "The courier recovers enough to continue. Gained 60 XP.",
          rewards: [{ id: "courierAidXp", type: "xp", amount: 60 }],
        },
        failure: {
          id: "courierResting",
          summary: "The courier needs rest, but is no longer in immediate danger.",
        },
      },
    ],
  },
  {
    id: "weatheredRoadbook",
    family: "discovery",
    title: "A Weathered Roadbook",
    source: "Abandoned travel journal",
    prompt: "A waxed book lies beneath a milestone, filled with routes omitted from modern maps.",
    weight: 7,
    cooldownSteps: 12,
    maxRepeats: 1,
    eligibility: {
      terrains: [Terrain.Path, Terrain.Grass, Terrain.Sand, Terrain.Tundra],
      periods: [TimePeriod.Dawn, TimePeriod.Day, TimePeriod.Dusk],
      minLevel: 2,
    },
    choices: [
      {
        id: "decodeRoadbook",
        label: "Decode the route notes",
        detail: "Intelligence check, DC 13",
        type: "skill",
        ability: "intelligence",
        dc: 13,
        success: {
          id: "roadbookDecoded",
          summary: "The notes reveal forgotten toll caches. Found 75 gold.",
          rewards: [{ id: "roadbookGold", type: "gold", amount: 75 }],
        },
        failure: {
          id: "roadbookArchived",
          summary: "The damaged route notes are preserved for the Chronicle.",
        },
      },
      {
        id: "leaveRoadbook",
        label: "Leave the book",
        detail: "Do not disturb the record",
        type: "resolve",
        outcome: {
          id: "roadbookLeft",
          summary: "The roadbook remains beneath the milestone.",
        },
      },
    ],
  },
  {
    id: "stormWashedCrossing",
    family: "hazard",
    title: "Storm-Washed Crossing",
    source: "Weather hazard",
    prompt: "Runoff tears across the trail, carrying loose stone and splintered branches.",
    weight: 12,
    cooldownSteps: 10,
    maxRepeats: 4,
    eligibility: {
      terrains: [Terrain.Grass, Terrain.Path, Terrain.Swamp, Terrain.Canyon],
      weather: [WeatherType.Rain, WeatherType.Storm],
    },
    choices: [
      {
        id: "crossQuickly",
        label: "Cross before it rises",
        detail: "Dexterity check, DC 12",
        type: "skill",
        ability: "dexterity",
        dc: 12,
        success: {
          id: "crossingCleared",
          summary: "You clear the torrent before the footing gives way.",
        },
        failure: {
          id: "crossingBruised",
          summary: "The current throws you against the rocks.",
          nonlethalDamage: 8,
        },
      },
      {
        id: "waitOutWater",
        label: "Wait for safer footing",
        detail: "Avoid injury",
        type: "resolve",
        outcome: {
          id: "crossingWaited",
          summary: "You wait until the worst runoff passes.",
        },
      },
    ],
  },
  {
    id: "abandonedSupplyCart",
    family: "reward",
    title: "Abandoned Supply Cart",
    source: "Lost traveler supplies",
    prompt: "A broken cart rests beside the road. One sealed field kit remains dry.",
    weight: 8,
    cooldownSteps: 16,
    maxRepeats: 2,
    eligibility: {
      terrains: [Terrain.Grass, Terrain.Path, Terrain.Sand, Terrain.Tundra],
      minLevel: 1,
    },
    choices: [
      {
        id: "searchCart",
        label: "Search the field kit",
        detail: "Take one usable supply",
        type: "resolve",
        outcome: {
          id: "cartPotion",
          summary: "You recover a Healing Potion from the sealed kit.",
          rewards: [{
            id: "fieldPotion",
            type: "item",
            itemId: "potion",
            quantity: 1,
          }],
          futureHooks: [{
            type: "alignment",
            axis: "goodEvil",
            delta: -4,
            reasonId: "abandonedSupplyCart.searchCart",
          }],
        },
      },
      {
        id: "markCart",
        label: "Mark it for travelers",
        detail: "Leave the supplies",
        type: "resolve",
        outcome: {
          id: "cartMarked",
          summary: "You mark the cart so another traveler can find it.",
          futureHooks: [{
            type: "reputation",
            factionId: "roadwardens",
            delta: 5,
            reasonId: "abandonedSupplyCart.markCart",
          }, {
            type: "alignment",
            axis: "goodEvil",
            delta: 4,
            reasonId: "abandonedSupplyCart.markCart",
          }],
        },
      },
    ],
  },
  {
    id: "roadwardenCouncil",
    family: "traveler",
    title: "A Roadwarden Council",
    source: "Covenant roadwardens",
    prompt: "A roadside council recognizes your service and offers a voice in how the next patrols are governed.",
    weight: 4,
    cooldownSteps: 24,
    maxRepeats: 1,
    eligibility: {
      terrains: [Terrain.Path, Terrain.Grass],
      minLevel: 3,
      reputationConditions: [{
        kind: "faction",
        targetId: "roadwardens",
        minimum: 15,
      }],
    },
    choices: [
      {
        id: "acceptCharter",
        label: "Accept the patrol charter",
        detail: "Bind your service to shared law",
        type: "resolve",
        outcome: {
          id: "charterAccepted",
          summary: "You accept the charter and help set fair patrol duties.",
          futureHooks: [{
            type: "alignment",
            axis: "lawChaos",
            delta: 8,
            reasonId: "roadwardenCouncil.acceptCharter",
          }, {
            type: "alignment",
            axis: "goodEvil",
            delta: 4,
            reasonId: "roadwardenCouncil.acceptCharter",
          }, {
            type: "reputation",
            factionId: "twelvefoldCovenant",
            delta: 10,
            reasonId: "roadwardenCouncil.acceptCharter",
          }],
        },
      },
      {
        id: "keepFreeHand",
        label: "Keep a free hand",
        detail: "Continue serving without formal authority",
        type: "resolve",
        outcome: {
          id: "independentRoadwarden",
          summary: "The council respects your aid, even without an oath.",
          futureHooks: [{
            type: "alignment",
            axis: "lawChaos",
            delta: -8,
            reasonId: "roadwardenCouncil.keepFreeHand",
          }, {
            type: "reputation",
            factionId: "roadwardens",
            delta: 5,
            reasonId: "roadwardenCouncil.keepFreeHand",
          }],
        },
      },
    ],
  },
];

export const WORLD_EVENT_IDS = WORLD_EVENT_DEFINITIONS.map(
  (event) => event.id,
) as readonly string[];

export function getWorldEventDefinition(
  eventId: string,
): WorldEventDefinition | undefined {
  return WORLD_EVENT_DEFINITIONS.find((event) => event.id === eventId);
}

import type { QuestId } from "./quests";
import type { StatusEffectId } from "../systems/statusEffects";

export const DEITY_IDS = ["orivane", "selquor", "tessune"] as const;
export type DeityId = (typeof DEITY_IDS)[number];
export const DEVOTION_SCORE_MAX = 100;
export const DEVOTION_HISTORY_LIMIT = 40;
export const DEVOTION_SAVE_VERSION = 19;

export const DEVOTION_DOMAINS = [
  { id: "making", name: "Making", description: "Useful things shaped without claiming their makers." },
  { id: "shelter", name: "Shelter", description: "Room left for someone whose journey is unfinished." },
  { id: "testimony", name: "Testimony", description: "Accounts preserved even when they are inconvenient." },
  { id: "memory", name: "Memory", description: "Borrowed echoes returned to the people who made them." },
  { id: "passage", name: "Passage", description: "Safe crossings shared with the next traveler." },
  { id: "possibility", name: "Possibility", description: "Routes that leave room to choose another destination." },
] as const;
export type DevotionDomainId = (typeof DEVOTION_DOMAINS)[number]["id"];

export const DEVOTION_TENETS = [
  { id: "mendBeforeDiscard", text: "Mend what can still serve; never demand gratitude for the repair." },
  { id: "leaveAnEmptyPlace", text: "Leave an empty place for the next arrival, whatever their chosen road." },
  { id: "keepTheUnwelcomeAccount", text: "Keep the unwelcome account beside the comfortable one." },
  { id: "returnBorrowedEchoes", text: "Return borrowed knowledge without claiming its voice as your own." },
  { id: "shareTheSafeCrossing", text: "Share the safe crossing instead of selling another traveler into danger." },
  { id: "leaveRoomToTurn", text: "A course is a choice, not a chain; leave room to turn back." },
] as const;
export type DevotionTenetId = (typeof DEVOTION_TENETS)[number]["id"];

export interface DeityDefinition {
  readonly id: DeityId;
  readonly name: string;
  readonly epithet: string;
  readonly description: string;
  readonly domainIds: readonly DevotionDomainId[];
  readonly tenetIds: readonly DevotionTenetId[];
  readonly ending: string;
}

/** Original figures of the fictional Unfinished Constellation, not real-world beliefs. */
export const DEITIES: readonly DeityDefinition[] = [
  {
    id: "orivane", name: "Orivane", epithet: "The Unfinished Span",
    description: "An imagined builder of bridges between drifting fragments of sky. Orivane leaves every span unfinished so another hand can help.",
    domainIds: ["making", "shelter"],
    tenetIds: ["mendBeforeDiscard", "leaveAnEmptyPlace"],
    ending: "At the Span Houses, small unfinished bridges remain open to the next helping hand. Your road carries Orivane's reminder that shelter is offered, never owed.",
  },
  {
    id: "selquor", name: "Selquor", epithet: "The Kept Echo",
    description: "An imagined keeper who catches the echoes falling between moments. Selquor keeps contradictory accounts in separate glass hollows, never erasing a voice to make them agree.",
    domainIds: ["testimony", "memory"],
    tenetIds: ["keepTheUnwelcomeAccount", "returnBorrowedEchoes"],
    ending: "The Echo Rooms keep both the easy account and the difficult one. Your road carries Selquor's reminder that a remembered voice belongs to its speaker.",
  },
  {
    id: "tessune", name: "Tessune", epithet: "The Turning Shoal",
    description: "An imagined navigator of an ocean that rearranges itself whenever a traveler chooses. Tessune marks safe crossings without deciding where anyone must land.",
    domainIds: ["passage", "possibility"],
    tenetIds: ["shareTheSafeCrossing", "leaveRoomToTurn"],
    ending: "The Shoal Rooms set out charts with an unmarked margin. Your road carries Tessune's reminder that safe passage must still leave the traveler free to choose.",
  },
];

export const DEVOTION_TIERS = [
  { id: "listening", name: "Listening", minimum: 0 },
  { id: "attuned", name: "Attuned", minimum: 25 },
  { id: "steadfast", name: "Steadfast", minimum: 50 },
  { id: "resonant", name: "Resonant", minimum: 75 },
] as const;
export type DevotionTierId = (typeof DEVOTION_TIERS)[number]["id"];

export const DEVOTION_QUEST_IDS = [
  "mendTheSpan", "keepTheEcho", "shareTheShoal",
] as const;
export type DevotionQuestId = (typeof DEVOTION_QUEST_IDS)[number];

export const TEMPLE_IDS = [
  "willowdaleSpan", "ironholdSpan", "sandportShoal", "frostheimEcho",
  "dunerestEcho", "ashfallSpan", "shadowfenShoal", "tidehavenShoal",
] as const;
export type TempleId = (typeof TEMPLE_IDS)[number];
export type TempleRiteId = `${TempleId}Thread` | `${TempleId}Respite`;
export type TempleDialogueId = `${TempleId}Conversation`;
export type TempleDialogueChoiceId = `${TempleId}Share` | `${TempleId}Decline`;
export type TempleConversationSourceId = `${TempleId}SharedWork`;

export interface TempleDefinition {
  readonly id: TempleId;
  readonly name: string;
  readonly deityId: DeityId;
  readonly cityId: string;
  readonly cityChunkIndex: number;
  readonly x: number;
  readonly y: number;
  readonly keeper: string;
  readonly dialogueId: TempleDialogueId;
  readonly description: string;
  readonly questId: DevotionQuestId;
}

export const TEMPLES: readonly TempleDefinition[] = [
  {
    id: "willowdaleSpan", name: "Willowdale Span House", deityId: "orivane",
    cityId: "willowdale_city", cityChunkIndex: 1, x: 9, y: 8,
    keeper: "Span Keeper Rovik", dialogueId: "willowdaleSpanConversation",
    description: "Floating model tiles cross a shallow glass bowl. One gap is deliberately left for another builder.",
    questId: "mendTheSpan",
  },
  {
    id: "ironholdSpan", name: "Ironhold Span House", deityId: "orivane",
    cityId: "ironhold_city", cityChunkIndex: 0, x: 9, y: 8,
    keeper: "Span Keeper Pell", dialogueId: "ironholdSpanConversation",
    description: "An unfinished iron span holds a place for a traveler who has not arrived yet.",
    questId: "mendTheSpan",
  },
  {
    id: "sandportShoal", name: "Sandport Shoal Room", deityId: "tessune",
    cityId: "sandport_city", cityChunkIndex: 0, x: 9, y: 1,
    keeper: "Shoal Keeper Dren", dialogueId: "sandportShoalConversation",
    description: "Rearranging glass channels hold three routes and a fourth path no chart names.",
    questId: "shareTheShoal",
  },
  {
    id: "frostheimEcho", name: "Frostheim Echo Room", deityId: "selquor",
    cityId: "frostheim_city", cityChunkIndex: 0, x: 9, y: 1,
    keeper: "Echo Keeper Irrel", dialogueId: "frostheimEchoConversation",
    description: "Hollow ice-glass keeps two different accounts of the same thaw, neither scraped away.",
    questId: "keepTheEcho",
  },
  {
    id: "dunerestEcho", name: "Dunerest Echo Room", deityId: "selquor",
    cityId: "dunerest_city", cityChunkIndex: 1, x: 5, y: 6,
    keeper: "Echo Keeper Vesket", dialogueId: "dunerestEchoConversation",
    description: "Glass hollows in the oasis keep conflicting accounts of the First Choice, awaiting voices still on the road.",
    questId: "keepTheEcho",
  },
  {
    id: "ashfallSpan", name: "Ashfall Span House", deityId: "orivane",
    cityId: "ashfall_city", cityChunkIndex: 0, x: 9, y: 1,
    keeper: "Span Keeper Qorrel", dialogueId: "ashfallSpanConversation",
    description: "Cooling fragments of sky-iron form a shelter that grows only when someone adds a repair.",
    questId: "mendTheSpan",
  },
  {
    id: "shadowfenShoal", name: "Shadowfen Shoal Room", deityId: "tessune",
    cityId: "shadowfen_city", cityChunkIndex: 0, x: 9, y: 1,
    keeper: "Shoal Keeper Ulvek", dialogueId: "shadowfenShoalConversation",
    description: "A shifting fen in miniature offers safe crossings without fences at either end.",
    questId: "shareTheShoal",
  },
  {
    id: "tidehavenShoal", name: "Tidehaven Turning Room", deityId: "tessune",
    cityId: "tidehaven_city", cityChunkIndex: 0, x: 9, y: 6,
    keeper: "Glasskeeper Ossa", dialogueId: "tidehavenShoalConversation",
    description: "Blue tideglass turns a dry channel into a different island route whenever its model boat returns.",
    questId: "shareTheShoal",
  },
];

export interface TempleRiteDefinition {
  readonly id: TempleRiteId;
  readonly templeId: TempleId;
  readonly kind: "blessing" | "rest";
  readonly name: string;
  readonly description: string;
}

export const TEMPLE_RITES: readonly TempleRiteDefinition[] = TEMPLES.flatMap(
  (temple): TempleRiteDefinition[] => [
    {
      id: `${temple.id}Thread`, templeId: temple.id, kind: "blessing",
      name: "Set a traveling thread",
      description: "Link two hovering glass pieces without closing the gap. Once here: +1 AC for three hero turns in the next battle; open to everyone.",
    },
    {
      id: `${temple.id}Respite`, templeId: temple.id, kind: "rest",
      name: "Leave a resting place",
      description: "Set an empty model shelter beside your own. Once here: use one normal short rest; no extra healing or restored rest charges.",
    },
  ],
);

export const BLESSING_IDS = [
  "openRoadThread", "orivaneThread", "selquorThread", "tessuneThread",
] as const;
export type BlessingId = (typeof BLESSING_IDS)[number];
export interface DevotionBlessingDefinition {
  readonly id: BlessingId;
  readonly deityId: DeityId | null;
  readonly name: string;
  readonly statusId: StatusEffectId;
  readonly turns: number;
}
export const DEVOTION_BLESSINGS: readonly DevotionBlessingDefinition[] = [
  { id: "openRoadThread", deityId: null, name: "Open Road Thread", statusId: "templeWard", turns: 3 },
  { id: "orivaneThread", deityId: "orivane", name: "Span Thread", statusId: "templeWard", turns: 3 },
  { id: "selquorThread", deityId: "selquor", name: "Echo Thread", statusId: "templeWard", turns: 3 },
  { id: "tessuneThread", deityId: "tessune", name: "Shoal Thread", statusId: "templeWard", turns: 3 },
];

export interface TempleConversationDefinition {
  readonly id: TempleDialogueId;
  readonly templeId: TempleId;
  readonly prompt: string;
  readonly choices: readonly {
    readonly id: TempleDialogueChoiceId;
    readonly label: string;
    readonly sourceId?: TempleConversationSourceId;
  }[];
}
export const TEMPLE_CONVERSATIONS: readonly TempleConversationDefinition[] =
  TEMPLES.map((temple) => ({
    id: temple.dialogueId,
    templeId: temple.id,
    prompt: `${temple.keeper} asks whether a borrowed model can stay in your keeping until the next traveler returns. No oath or affiliation is asked.`,
    choices: [
      {
        id: `${temple.id}Share`, label: "Keep a place for the next traveler",
        sourceId: `${temple.id}SharedWork`,
      },
      { id: `${temple.id}Decline`, label: "Decline without making a promise" },
    ],
  }));

const STORY_SOURCE_IDS = [
  "covenantReturned", "dispatchKept", "winterShelter",
  "spanMended", "echoKept", "shoalShared",
  "moonPatternRecorded", "driftMarked", "cartMarked",
  "echoRecordReturned", "echoRecordTaken",
  "shoalBeaconShared", "shoalBeaconPocketed", "skySpanRepaired",
] as const;
export type DevotionSourceId =
  | (typeof STORY_SOURCE_IDS)[number]
  | TempleRiteId
  | TempleConversationSourceId;

export type DevotionSourceTrigger =
  | { readonly type: "rite"; readonly riteId: TempleRiteId }
  | { readonly type: "dialogue"; readonly dialogueId: TempleDialogueId }
  | { readonly type: "questCompletion"; readonly questId: QuestId }
  | { readonly type: "worldEventOutcome"; readonly eventId: string; readonly outcomeId: string };

export interface DevotionSourceDefinition {
  readonly id: DevotionSourceId;
  readonly cause: string;
  readonly trigger: DevotionSourceTrigger;
  readonly deltas: Readonly<Record<DeityId, number>>;
}

function commonDeltas(delta: number): Readonly<Record<DeityId, number>> {
  return { orivane: delta, selquor: delta, tessune: delta };
}

export const DEVOTION_SOURCE_DEFINITIONS: readonly DevotionSourceDefinition[] = [
  ...TEMPLE_RITES.map((rite): DevotionSourceDefinition => ({
    id: rite.id, cause: rite.name,
    trigger: { type: "rite", riteId: rite.id },
    deltas: commonDeltas(rite.kind === "blessing" ? 6 : 4),
  })),
  ...TEMPLES.map((temple): DevotionSourceDefinition => ({
    id: `${temple.id}SharedWork`, cause: `${temple.name}: kept a place for another traveler`,
    trigger: { type: "dialogue", dialogueId: temple.dialogueId },
    deltas: commonDeltas(4),
  })),
  {
    id: "covenantReturned", cause: "Returned the renewed covenant to Elowen",
    trigger: { type: "questCompletion", questId: "twelvefoldCovenant" },
    deltas: commonDeltas(8),
  },
  {
    id: "dispatchKept", cause: "Kept the Ironbound Dispatch in trust",
    trigger: { type: "questCompletion", questId: "ironboundDispatch" },
    deltas: { orivane: 6, selquor: 8, tessune: 6 },
  },
  {
    id: "winterShelter", cause: "Shared the winter ward-cloths",
    trigger: { type: "questCompletion", questId: "silkAgainstTheCold" },
    deltas: { orivane: 10, selquor: 6, tessune: 6 },
  },
  {
    id: "spanMended", cause: "Mended the span without claiming its makers",
    trigger: { type: "questCompletion", questId: "mendTheSpan" },
    deltas: { orivane: 14, selquor: 8, tessune: 8 },
  },
  {
    id: "echoKept", cause: "Preserved both accounts of the crossing",
    trigger: { type: "questCompletion", questId: "keepTheEcho" },
    deltas: { orivane: 8, selquor: 14, tessune: 8 },
  },
  {
    id: "shoalShared", cause: "Shared the island passage without a toll",
    trigger: { type: "questCompletion", questId: "shareTheShoal" },
    deltas: { orivane: 8, selquor: 8, tessune: 14 },
  },
  {
    id: "moonPatternRecorded", cause: "Recorded the moonlit pattern without a claim",
    trigger: { type: "worldEventOutcome", eventId: "moonlitShrine", outcomeId: "shrineInsight" },
    deltas: { orivane: 3, selquor: 5, tessune: 3 },
  },
  {
    id: "driftMarked", cause: "Marked the drift for the next convoy",
    trigger: { type: "worldEventOutcome", eventId: "adriftChartCase", outcomeId: "chartCaseMarked" },
    deltas: { orivane: 3, selquor: 3, tessune: 5 },
  },
  {
    id: "cartMarked", cause: "Marked abandoned supplies for their owner",
    trigger: { type: "worldEventOutcome", eventId: "abandonedSupplyCart", outcomeId: "cartMarked" },
    deltas: { orivane: 6, selquor: 4, tessune: 4 },
  },
  {
    id: "echoRecordReturned", cause: "Returned a glass account to its speaker",
    trigger: { type: "worldEventOutcome", eventId: "fallenEchoGlass", outcomeId: "echoGlassReturned" },
    deltas: { orivane: 4, selquor: 8, tessune: 4 },
  },
  {
    id: "echoRecordTaken", cause: "Claimed another speaker's glass account",
    trigger: { type: "worldEventOutcome", eventId: "fallenEchoGlass", outcomeId: "echoGlassTaken" },
    deltas: { orivane: -4, selquor: -12, tessune: -2 },
  },
  {
    id: "shoalBeaconShared", cause: "Shared the shoal's safe beacon",
    trigger: { type: "worldEventOutcome", eventId: "turningShoalBeacon", outcomeId: "beaconShared" },
    deltas: { orivane: 4, selquor: 4, tessune: 8 },
  },
  {
    id: "shoalBeaconPocketed", cause: "Kept the safe beacon from other boats",
    trigger: { type: "worldEventOutcome", eventId: "turningShoalBeacon", outcomeId: "beaconPocketed" },
    deltas: { orivane: -4, selquor: -2, tessune: -12 },
  },
  {
    id: "skySpanRepaired", cause: "Repaired the roadside sky-span",
    trigger: { type: "worldEventOutcome", eventId: "unfinishedSkySpan", outcomeId: "skySpanRepaired" },
    deltas: { orivane: 8, selquor: 4, tessune: 4 },
  },
];

export function isDeityId(value: unknown): value is DeityId {
  return DEITY_IDS.some((id) => id === value);
}

export function isTempleId(value: unknown): value is TempleId {
  return TEMPLE_IDS.some((id) => id === value);
}

export function isDevotionSourceId(value: unknown): value is DevotionSourceId {
  return DEVOTION_SOURCE_DEFINITIONS.some((source) => source.id === value);
}

export function getDeity(id: DeityId): DeityDefinition {
  return DEITIES.find((deity) => deity.id === id)!;
}

export function getTemple(id: TempleId): TempleDefinition {
  return TEMPLES.find((temple) => temple.id === id)!;
}

export function getDevotionSource(id: DevotionSourceId): DevotionSourceDefinition {
  return DEVOTION_SOURCE_DEFINITIONS.find((source) => source.id === id)!;
}

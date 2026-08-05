import { ITEMS, type Item } from "./items";
import {
  QUEST_NPCS,
  type QuestId,
  type QuestNpcId,
} from "./quests";
import type { CutsceneId } from "./cutscenes";
import { Terrain } from "./mapTypes";

export const CODEX_KNOWLEDGE_CATEGORIES = [
  "location",
  "item",
  "character",
  "faction",
  "history",
] as const;

export type CodexKnowledgeCategory =
  (typeof CODEX_KNOWLEDGE_CATEGORIES)[number];

export interface CodexSourceBase {
  readonly label: string;
  readonly hint: string;
}

export interface CodexLocationSource extends CodexSourceBase {
  readonly type: "location";
  readonly locationKind: "city" | "dungeon";
  readonly targetId: string;
}

export interface CodexQuestStageSource extends CodexSourceBase {
  readonly type: "questStage";
  readonly questId: QuestId;
  readonly stageId: string;
}

export interface CodexQuestCompletionSource extends CodexSourceBase {
  readonly type: "questCompletion";
  readonly questId: QuestId;
}

export interface CodexCutsceneSource extends CodexSourceBase {
  readonly type: "cutscene";
  readonly cutsceneId: CutsceneId;
}

export interface CodexItemSource extends CodexSourceBase {
  readonly type: "itemAcquired";
  readonly itemId: string;
}

export interface CodexNpcSource extends CodexSourceBase {
  readonly type: "npcDialogue";
  readonly npcId: QuestNpcId;
}

export interface CodexReadableSource extends CodexSourceBase {
  readonly type: "readable";
  readonly readableId: string;
}

export interface CodexWorldEventSource extends CodexSourceBase {
  readonly type: "worldEvent";
  readonly eventId: string;
}

export interface CodexReputationSource extends CodexSourceBase {
  readonly type: "reputationMilestone";
  readonly factionId: string;
  readonly milestoneId: string;
}

export type CodexUnlockSource =
  | CodexLocationSource
  | CodexQuestStageSource
  | CodexQuestCompletionSource
  | CodexCutsceneSource
  | CodexItemSource
  | CodexNpcSource
  | CodexReadableSource
  | CodexWorldEventSource
  | CodexReputationSource;

export interface CodexKnowledgeEntry {
  readonly id: string;
  readonly category: CodexKnowledgeCategory;
  readonly name: string;
  readonly summary: string;
  readonly details: readonly string[];
  readonly tags: readonly string[];
  readonly sortOrder: number;
  readonly sources: readonly CodexUnlockSource[];
}

export interface CodexReadableDefinition {
  readonly id: string;
  readonly cityId: string;
  readonly cityChunkIndex: number;
  readonly x: number;
  readonly y: number;
  readonly terrain: Terrain.Temple | Terrain.Statue;
  readonly title: string;
  readonly text: readonly string[];
}

interface LocationLore {
  readonly id: string;
  readonly name: string;
  readonly targetId: string;
  readonly summary: string;
  readonly details: readonly string[];
  readonly tags: readonly string[];
}

const LOCATION_LORE: readonly LocationLore[] = [
  {
    id: "willowdale",
    name: "Willowdale",
    targetId: "willowdale_city",
    summary: "The Heartlands archive-city where the covenant's oldest records are kept.",
    details: [
      "Willowdale's bells once marked every renewal of the Twelvefold Covenant.",
      "Archivist Elowen safeguards the surviving sigils and the roadwarden chronicles.",
    ],
    tags: ["heartlands", "archive", "covenant"],
  },
  {
    id: "ironhold",
    name: "Ironhold",
    targetId: "ironhold_city",
    summary: "A fortified city whose oath binds endurance to shared defense.",
    details: [
      "Ironhold measures promises in maintained roads, defended walls, and aid freely given.",
      "Its wardens once guarded the western half of the iron route to Sandport.",
    ],
    tags: ["heartlands", "fortress", "ironRoute"],
  },
  {
    id: "deeproot",
    name: "Deeproot",
    targetId: "deeproot_city",
    summary: "A woodland city grown around roots older than the covenant.",
    details: [
      "Rootspeakers preserve oaths as living memory rather than written law.",
      "The oldest roots reach toward the Heartlands Crypt and recoil from its necrotic seal.",
    ],
    tags: ["forest", "roots", "heartlands"],
  },
  {
    id: "sandport",
    name: "Sandport",
    targetId: "sandport_city",
    summary: "The eastern trade port whose seal carries authority along the Sun Road.",
    details: [
      "Sandport treats open roads as bargains that must protect travelers at both ends.",
      "Its harbormaster's mark is recognized by Canyonwatch's guarded pass.",
    ],
    tags: ["desert", "trade", "sunRoad"],
  },
  {
    id: "frostheim",
    name: "Frostheim",
    targetId: "frostheim_city",
    summary: "A northern city of seers, ward-cloths, and long winter memory.",
    details: [
      "Frostheim's oath demands that whatever survives the winter shelter those who follow.",
      "Its enchanted cloth wards are woven from frost-spider silk.",
    ],
    tags: ["tundra", "seers", "winter"],
  },
  {
    id: "thornvale",
    name: "Thornvale",
    targetId: "thornvale_city",
    summary: "A dark woodland city where every oath is treated as a living thing.",
    details: [
      "Greenwardens renew agreements through stewardship of root, river, and road.",
      "Thornvale's waters run north beneath the Frost Cavern.",
    ],
    tags: ["forest", "greenwardens", "winter"],
  },
  {
    id: "canyonwatch",
    name: "Canyonwatch",
    targetId: "canyonwatch_city",
    summary: "A pass-city that protects the narrow road between coast and desert.",
    details: [
      "Canyonwatch opens its gates only to recognized seals or proven need.",
      "Its renewed oath guarantees that travelers under covenant law do not stand alone.",
    ],
    tags: ["canyon", "marshal", "sunRoad"],
  },
  {
    id: "dunerest",
    name: "Dunerest",
    targetId: "dunerest_city",
    summary: "A desert archive whose lorekeepers preserve the covenant's original intent.",
    details: [
      "Dunerest records that the first covenant was twelve free choices, never twelve chains.",
      "Its oral histories correct many later, more convenient versions of the founding.",
    ],
    tags: ["desert", "lorekeepers", "founding"],
  },
  {
    id: "bogtown",
    name: "Bogtown",
    targetId: "bogtown_city",
    summary: "A marsh settlement built on medicine, poisoncraft, and patient observation.",
    details: [
      "Bogtown's apothecaries preserve dangerous knowledge beside its antidotes.",
      "Its oath promises practical aid without pretending the swamp is harmless.",
    ],
    tags: ["marsh", "alchemy", "medicine"],
  },
  {
    id: "shadowfen",
    name: "Shadowfen",
    targetId: "shadowfen_city",
    summary: "A mist-bound city of ferrymen who read the fen like a ledger.",
    details: [
      "Shadowfen judges travelers by what their passage costs the marsh.",
      "Its ferries carry Bogtown's medicines and the oldest version of the marsh compact.",
    ],
    tags: ["marsh", "ferrymen", "mist"],
  },
  {
    id: "ashfall",
    name: "Ashfall",
    targetId: "ashfall_city",
    summary: "A forge-city built above restless volcanic workings.",
    details: [
      "Ashfall's smiths can hear changes in the Volcanic Forge through their own anvils.",
      "Its oath binds craft to restraint: power must answer to those endangered by it.",
    ],
    tags: ["volcanic", "smiths", "forge"],
  },
  {
    id: "ridgewatch",
    name: "Ridgewatch",
    targetId: "ridgewatch_city",
    summary: "The high sentinel city overlooking the final road to the forge.",
    details: [
      "Ridgewatch watches the mountain glow and marks every safe approach.",
      "Its oath completed the twelve voices needed to challenge the final seal.",
    ],
    tags: ["mountain", "sentinels", "forge"],
  },
  {
    id: "heartlandsCrypt",
    name: "Heartlands Crypt",
    targetId: "heartlands_dungeon",
    summary: "A royal crypt where the first keystone was bound by a dead king.",
    details: [
      "Necrotic commands twisted the crypt's memorial wards into chains.",
      "The Crypt Lich held the Heartlands keystone above its throne.",
    ],
    tags: ["dungeon", "crypt", "keystone"],
  },
  {
    id: "frostCavern",
    name: "Frost Cavern",
    targetId: "frost_cavern",
    summary: "A glacial sanctuary turned prison for the northern keystone.",
    details: [
      "The cavern remembers every winter in layered blue ice.",
      "The Frost Warden mistook preservation for an excuse to stop all change.",
    ],
    tags: ["dungeon", "ice", "keystone"],
  },
  {
    id: "volcanicForge",
    name: "Volcanic Forge",
    targetId: "volcanic_forge",
    summary: "The covenant's deepest forge and the prison of its final keystone.",
    details: [
      "The forge was built to shape shared defenses, not to command the twelve cities.",
      "The Inferno Forgemaster chained its clean flame to a single will.",
    ],
    tags: ["dungeon", "fire", "keystone"],
  },
];

const CHARACTER_DETAILS: Readonly<Record<QuestNpcId, readonly string[]>> = {
  willowdaleArchivist: [
    "Elowen preserves the covenant as a record of choices rather than a claim to rule.",
    "She entrusts the sigil only to a traveler capable of asking every city again.",
  ],
  ironholdWarden: [
    "Brann is responsible for Ironhold's walls and for the roads beyond them.",
    "He values proof expressed through durable public work.",
  ],
  deeprootRootspeaker: [
    "Neris listens to living roots for memories that ink cannot hold.",
    "She recognizes the Crypt Lich's influence as a wound in the Heartlands.",
  ],
  frostheimSeer: [
    "Yrsa reads possible futures in fractured ice.",
    "Her counsel favors preparation over prophecy treated as fate.",
  ],
  thornvaleGreenwarden: [
    "Rowan renews Thornvale's agreements through active stewardship.",
    "He rejects any oath that survives only as ceremony.",
  ],
  sandportHarbormaster: [
    "Sable controls the seals that keep Sandport's roads and docks trusted.",
    "She sees trade and truth as systems that fail when every gate closes.",
  ],
  canyonwatchMarshal: [
    "Tarek protects a narrow pass where mistakes endanger whole caravans.",
    "He accepts recognized proof, but never substitutes it for vigilance.",
  ],
  dunerestLorekeeper: [
    "Zahra safeguards the oldest spoken account of the covenant's founding.",
    "She insists that renewal must remain voluntary to retain meaning.",
  ],
  bogtownApothecary: [
    "Mirel studies the swamp's poisons and cures with equal respect.",
    "Her oath is practical: knowledge must reduce harm before it earns praise.",
  ],
  shadowfenFerryman: [
    "Vey reads current, fog, and silence as signs of what the marsh can bear.",
    "He carries both travelers and the memory of Bogtown's old compact.",
  ],
  ashfallSmith: [
    "Kael hears the Volcanic Forge answering through Ashfall's hammers.",
    "He believes craft is responsible for every consequence it can foresee.",
  ],
  ridgewatchSentinel: [
    "Mira watches the forge road from the highest inhabited ridge.",
    "Her reports distinguish ordinary volcanic change from deliberate threat.",
  ],
  guardian: [
    "Bram Ironward judges courage by where someone chooses to stand.",
    "His shield oath makes him the party's steadfast guardian.",
  ],
  scout: [
    "Kaia Swiftstep reads roads several turns ahead.",
    "She joins travelers who value observation more than reckless speed.",
  ],
  mystic: [
    "Selene Vey studies what flame reveals before it consumes.",
    "She carries a ward shaped from the quieted Volcanic Wyrm's magic.",
  ],
};

const LOCATION_ENTRIES: readonly CodexKnowledgeEntry[] = LOCATION_LORE.map(
  (lore, index): CodexKnowledgeEntry => ({
    id: lore.id,
    category: "location",
    name: lore.name,
    summary: lore.summary,
    details: lore.details,
    tags: lore.tags,
    sortOrder: index,
    sources: [{
      type: "location",
      locationKind: lore.targetId.endsWith("_city") ? "city" : "dungeon",
      targetId: lore.targetId,
      label: `Explore ${lore.name}`,
      hint: `Visit ${lore.name}.`,
    }],
  }),
);

function itemDetails(item: Item): readonly string[] {
  const details = [`Type: ${item.type}. ${item.description}.`];
  if (item.element) details.push(`Its enchantment carries ${item.element} power.`);
  if (item.type === "key") {
    details.push("Key items record access, duty, or proof rather than ordinary wealth.");
  } else if (item.type === "mount") {
    details.push("Mount bonds change overland travel without changing the covenant's laws.");
  } else if (item.cost === 0) {
    details.push("This rare piece is earned or found rather than sold in ordinary shops.");
  }
  return details;
}

const ITEM_ENTRIES: readonly CodexKnowledgeEntry[] = ITEMS.map(
  (item, index): CodexKnowledgeEntry => ({
    id: item.id,
    category: "item",
    name: item.name,
    summary: item.description,
    details: itemDetails(item),
    tags: [item.type, ...(item.element ? [item.element] : [])],
    sortOrder: index,
    sources: [{
      type: "itemAcquired",
      itemId: item.id,
      label: `Acquire ${item.name}`,
      hint: "Find, purchase, or receive this item.",
    }],
  }),
);

const CHARACTER_ENTRIES: readonly CodexKnowledgeEntry[] = Object.values(
  QUEST_NPCS,
).map((npc, index): CodexKnowledgeEntry => ({
  id: npc.id,
  category: "character",
  name: npc.name,
  summary: npc.idleDialogue,
  details: CHARACTER_DETAILS[npc.id],
  tags: [npc.cityId, npc.id],
  sortOrder: index,
  sources: [{
    type: "npcDialogue",
    npcId: npc.id,
    label: `Speak with ${npc.name}`,
    hint: `Find ${npc.name} in their home city.`,
  }],
}));

const FACTION_ENTRIES: readonly CodexKnowledgeEntry[] = [
  {
    id: "twelvefoldCovenant",
    category: "faction",
    name: "The Twelvefold Covenant",
    summary: "A voluntary alliance of twelve city oaths and three shared keystones.",
    details: [
      "The covenant coordinates roads, wards, and mutual defense without replacing local rule.",
      "Its authority comes from renewed consent; the restored sigil records those choices.",
    ],
    tags: ["covenant", "twelveCities"],
    sortOrder: 0,
    sources: [{
      type: "cutscene",
      cutsceneId: "campaign.opening",
      label: "The opening chronicle",
      hint: "Witness the campaign opening.",
    }],
  },
  {
    id: "heartlandsWardens",
    category: "faction",
    name: "Heartlands Wardens",
    summary: "The road and wall defenders centered on Ironhold.",
    details: [
      "Wardens treat public safety as a promise measured in maintained defenses.",
      "Bram Ironward's companion oath follows this tradition beyond the city walls.",
    ],
    tags: ["ironhold", "guardian"],
    sortOrder: 1,
    sources: [{
      type: "npcDialogue",
      npcId: "ironholdWarden",
      label: "Warden Brann",
      hint: "Speak with Warden Brann.",
    }],
  },
  {
    id: "rootspeakers",
    category: "faction",
    name: "The Rootspeakers",
    summary: "Deeproot keepers who preserve agreements in living memory.",
    details: [
      "Rootspeakers compare written records against changes carried through old root systems.",
      "Their testimony revealed the Crypt Lich's pressure on the Heartlands.",
    ],
    tags: ["deeproot", "forest"],
    sortOrder: 2,
    sources: [{
      type: "npcDialogue",
      npcId: "deeprootRootspeaker",
      label: "Rootspeaker Neris",
      hint: "Speak with Rootspeaker Neris.",
    }],
  },
  {
    id: "winterWitnesses",
    category: "faction",
    name: "The Winter Witnesses",
    summary: "Frostheim seers and ward-weavers who prepare the north for hard seasons.",
    details: [
      "They preserve many possible futures instead of claiming certainty.",
      "Their ward-cloths bind frost-spider silk into communal protection.",
    ],
    tags: ["frostheim", "winter"],
    sortOrder: 3,
    sources: [{
      type: "questCompletion",
      questId: "silkAgainstTheCold",
      label: "Silk Against the Cold",
      hint: "Restore Frostheim's ward-cloths.",
    }],
  },
  {
    id: "sunRoadCompact",
    category: "faction",
    name: "The Sun Road Compact",
    summary: "The trade and protection agreement linking Sandport, Canyonwatch, and Dunerest.",
    details: [
      "Sandport authenticates passage, Canyonwatch protects the pass, and Dunerest preserves its law.",
      "The compact works only while each city can renew or challenge its terms.",
    ],
    tags: ["sandport", "canyonwatch", "dunerest"],
    sortOrder: 4,
    sources: [{
      type: "questStage",
      questId: "twelvefoldCovenant",
      stageId: "sunRoad",
      label: "The Sun Road",
      hint: "Reach the Sun Road chapter.",
    }],
  },
  {
    id: "marshCompact",
    category: "faction",
    name: "The Marsh Compact",
    summary: "Bogtown healers and Shadowfen ferrymen sharing safe passage through the marsh.",
    details: [
      "The compact combines medicine, route knowledge, and limits on harmful harvesting.",
      "It is renewed through practical cooperation rather than a single written charter.",
    ],
    tags: ["bogtown", "shadowfen", "marsh"],
    sortOrder: 5,
    sources: [{
      type: "readable",
      readableId: "shadowfenMarshLedger",
      label: "The Marsh Ledger",
      hint: "Read the ferrymen's ledger in Shadowfen.",
    }],
  },
  {
    id: "ashenWatch",
    category: "faction",
    name: "The Ashen Watch",
    summary: "Ashfall smiths and Ridgewatch sentinels monitoring the Volcanic Forge.",
    details: [
      "Smiths detect changes through the mountain's hammers; sentinels verify them from the ridge.",
      "Together they keep the last forge road open only when its danger can be measured.",
    ],
    tags: ["ashfall", "ridgewatch", "forge"],
    sortOrder: 6,
    sources: [{
      type: "questStage",
      questId: "twelvefoldCovenant",
      stageId: "ashenWatch",
      label: "The Ashen Watch",
      hint: "Reach the Ashen Watch chapter.",
    }],
  },
  {
    id: "roadwardens",
    category: "faction",
    name: "The Roadwardens",
    summary: "Traveling guardians empowered to carry covenant duties between cities.",
    details: [
      "Roadwardens hold no city throne and cannot replace local consent.",
      "Their charge is to keep communication, passage, and mutual aid possible.",
    ],
    tags: ["covenant", "postGame"],
    sortOrder: 7,
    sources: [{
      type: "questCompletion",
      questId: "twelvefoldCovenant",
      label: "Restore the covenant",
      hint: "Complete the Twelvefold Covenant.",
    }],
  },
];

const HISTORY_ENTRIES: readonly CodexKnowledgeEntry[] = [
  {
    id: "foundingOfTheCovenant",
    category: "history",
    name: "Founding of the Covenant",
    summary: "Twelve cities chose shared roads, wards, and defense without surrendering local rule.",
    details: [
      "Three keystones anchored the work in the Heartlands, the north, and the final forge.",
      "The founding text requires each oath to be freely renewed.",
    ],
    tags: ["founding", "covenant"],
    sortOrder: 0,
    sources: [{
      type: "readable",
      readableId: "willowdaleFoundingVolume",
      label: "The Founding Volume",
      hint: "Read the founding volume in Willowdale.",
    }],
  },
  {
    id: "theThreeKeystones",
    category: "history",
    name: "The Three Keystones",
    summary: "Shared anchors that stabilize the covenant's protective works.",
    details: [
      "No single keystone commands the others; their balance mirrors the covenant's distributed authority.",
      "Each was hidden behind a test when the old alliance fractured.",
    ],
    tags: ["keystones", "covenant"],
    sortOrder: 1,
    sources: [{
      type: "cutscene",
      cutsceneId: "campaign.dungeon.heartlandsCrypt.reveal",
      label: "The first keystone trail",
      hint: "Reveal the Heartlands Crypt.",
    }],
  },
  {
    id: "twelveFreeChoices",
    category: "history",
    name: "Twelve Free Choices",
    summary: "The covenant's first law was that no city's oath could be compelled.",
    details: [
      "Dunerest's oldest inscription names each founding city as a chooser, not a subject.",
      "An oath extracted by force cannot carry covenant authority.",
    ],
    tags: ["dunerest", "founding", "consent"],
    sortOrder: 2,
    sources: [{
      type: "readable",
      readableId: "dunerestFirstChoiceInscription",
      label: "The First Choice inscription",
      hint: "Read the old inscription in Dunerest.",
    }],
  },
  {
    id: "fallOfTheCryptKing",
    category: "history",
    name: "Fall of the Crypt King",
    summary: "A Heartlands ruler bound memory and oath into necrotic obedience.",
    details: [
      "The dead king's final commands endured as the Crypt Lich.",
      "Its defeat freed the first keystone from a law no living city had renewed.",
    ],
    tags: ["heartlandsCrypt", "cryptLich"],
    sortOrder: 3,
    sources: [{
      type: "cutscene",
      cutsceneId: "boss.cryptLich.post",
      label: "Defeat the Crypt Lich",
      hint: "Defeat the guardian of the first keystone.",
    }],
  },
  {
    id: "theUnbrokenWinter",
    category: "history",
    name: "The Unbroken Winter",
    summary: "The Frost Warden preserved one winter until protection became imprisonment.",
    details: [
      "The Warden's ice stopped decay, travel, growth, and eventually choice.",
      "Reclaiming the northern keystone allowed the cavern to thaw without forgetting.",
    ],
    tags: ["frostCavern", "frostWarden"],
    sortOrder: 4,
    sources: [{
      type: "cutscene",
      cutsceneId: "boss.frostWarden.post",
      label: "Defeat the Frost Warden",
      hint: "Reclaim the northern keystone.",
    }],
  },
  {
    id: "chainsOfTheForgemaster",
    category: "history",
    name: "Chains of the Forgemaster",
    summary: "The final forge's shared flame was chained to one master's command.",
    details: [
      "The forge answered every hammer in Ashfall because its bindings reached through the mountain.",
      "When the Forgemaster fell, clean fire returned without erasing the forge's power.",
    ],
    tags: ["volcanicForge", "infernoForgemaster"],
    sortOrder: 5,
    sources: [{
      type: "cutscene",
      cutsceneId: "boss.infernoForgemaster.post",
      label: "Defeat the Inferno Forgemaster",
      hint: "Silence the final forge's chains.",
    }],
  },
  {
    id: "theIronRoute",
    category: "history",
    name: "The Iron Route",
    summary: "An old supply road between Ironhold and Sandport restored by a sealed message.",
    details: [
      "The route failed when trust between its endpoints stopped being renewed.",
      "Brann and Sable reopened it through proof carried in both directions.",
    ],
    tags: ["ironhold", "sandport", "sideQuest"],
    sortOrder: 6,
    sources: [{
      type: "questCompletion",
      questId: "ironboundDispatch",
      label: "Ironbound Dispatch",
      hint: "Reopen the iron route.",
    }],
  },
  {
    id: "theWardCloths",
    category: "history",
    name: "Frostheim's Ward-Cloths",
    summary: "Community protections woven from enchanted frost-spider silk.",
    details: [
      "The cloth holds warmth by distributing cold instead of merely resisting it.",
      "Its repair is a recurring duty, not a permanent reward.",
    ],
    tags: ["frostheim", "frostSilkBundle"],
    sortOrder: 7,
    sources: [{
      type: "questCompletion",
      questId: "silkAgainstTheCold",
      label: "Silk Against the Cold",
      hint: "Restore Frostheim's ward-cloths.",
    }],
  },
  {
    id: "theRenewedCovenant",
    category: "history",
    name: "The Renewed Covenant",
    summary: "Twelve renewed oaths and three reclaimed keystones restored the old alliance.",
    details: [
      "The restoration did not recreate an ancient government; it reopened a shared practice.",
      "Its future depends on continued consent, travel, and honest records.",
    ],
    tags: ["ending", "covenant"],
    sortOrder: 8,
    sources: [{
      type: "cutscene",
      cutsceneId: "campaign.twelvefoldCovenant.epilogue",
      label: "The campaign epilogue",
      hint: "Complete the covenant epilogue.",
    }],
  },
];

export const CODEX_READABLES: readonly CodexReadableDefinition[] = [
  {
    id: "willowdaleFoundingVolume",
    cityId: "willowdale_city",
    cityChunkIndex: 0,
    x: 9,
    y: 5,
    terrain: Terrain.Statue,
    title: "The Founding Volume",
    text: [
      "The weathered volume names twelve cities and three shared keystones.",
      "Its margin repeats one warning: a promise commanded is no promise at all.",
    ],
  },
  {
    id: "dunerestFirstChoiceInscription",
    cityId: "dunerest_city",
    cityChunkIndex: 0,
    x: 9,
    y: 1,
    terrain: Terrain.Statue,
    title: "The First Choice",
    text: [
      "The inscription lists twelve choices, each carved in a different hand.",
      "No city is named first, and none is named last.",
    ],
  },
  {
    id: "shadowfenMarshLedger",
    cityId: "shadowfen_city",
    cityChunkIndex: 1,
    x: 9,
    y: 2,
    terrain: Terrain.Temple,
    title: "The Marsh Ledger",
    text: [
      "The ledger balances medicine, safe passage, and what may be taken from the fen.",
      "Every page is signed once in Bogtown and once in Shadowfen.",
    ],
  },
];

export const CODEX_KNOWLEDGE_ENTRIES: readonly CodexKnowledgeEntry[] = [
  ...LOCATION_ENTRIES,
  ...ITEM_ENTRIES,
  ...CHARACTER_ENTRIES,
  ...FACTION_ENTRIES,
  ...HISTORY_ENTRIES,
];

const ENTRY_BY_ID = new Map(
  CODEX_KNOWLEDGE_ENTRIES.map((entry) => [entry.id, entry] as const),
);

export function getCodexKnowledgeEntry(
  id: string,
): CodexKnowledgeEntry | undefined {
  return ENTRY_BY_ID.get(id);
}

export function isCodexKnowledgeId(value: unknown): value is string {
  return typeof value === "string" && ENTRY_BY_ID.has(value);
}

export function getAdjacentCodexReadable(
  cityId: string,
  cityChunkIndex: number,
  x: number,
  y: number,
): CodexReadableDefinition | undefined {
  return CODEX_READABLES.find((readable) =>
    readable.cityId === cityId
    && readable.cityChunkIndex === cityChunkIndex
    && Math.abs(readable.x - x) + Math.abs(readable.y - y) === 1
  );
}

import type {
  CutsceneActorCue,
  CutsceneBackdrop,
  CutsceneDefinition,
  CutsceneEffect,
  CutsceneTriggerDefinition,
} from "./cutsceneTypes";

export const BOSS_CUTSCENE_IDS = [
  "boss.troll.pre",
  "boss.troll.post",
  "boss.dragon.pre",
  "boss.dragon.post",
  "boss.frostGiant.pre",
  "boss.frostGiant.post",
  "boss.swampHydra.pre",
  "boss.swampHydra.post",
  "boss.volcanicWyrm.pre",
  "boss.volcanicWyrm.post",
  "boss.canyonDrake.pre",
  "boss.canyonDrake.post",
  "boss.cryptLich.pre",
  "boss.cryptLich.post",
  "boss.frostWarden.pre",
  "boss.frostWarden.post",
  "boss.infernoForgemaster.pre",
  "boss.infernoForgemaster.post",
  "boss.kraken.pre",
  "boss.kraken.post",
] as const;

export type BossCutsceneId = (typeof BOSS_CUTSCENE_IDS)[number];

interface BossStory {
  readonly id: string;
  readonly name: string;
  readonly pre: BossCutsceneId;
  readonly post: BossCutsceneId;
  readonly color: number;
  readonly backdrop: CutsceneBackdrop;
  readonly effect: CutsceneEffect;
  readonly biome: string;
  readonly challenge: string;
  readonly defeat: string;
}

const BOSS_STORIES: readonly BossStory[] = [
  {
    id: "troll",
    name: "Cave Troll",
    pre: "boss.troll.pre",
    post: "boss.troll.post",
    color: 0x447744,
    backdrop: "forest",
    effect: "shake",
    biome: "forest",
    challenge: "The cave mouth shudders as the troll rises, blocking the road with stone and scarred muscle.",
    defeat: "The troll falls. Dust rolls through the cave, and the road beyond grows quiet.",
  },
  {
    id: "dragon",
    name: "Young Red Dragon",
    pre: "boss.dragon.pre",
    post: "boss.dragon.post",
    color: 0xcc2222,
    backdrop: "forge",
    effect: "embers",
    biome: "volcanic",
    challenge: "A red shadow crosses the firelit ground. The dragon lands between you and the open sky.",
    defeat: "The dragon's flame gutters. Heat leaves the broken earth in slow, wavering breaths.",
  },
  {
    id: "frostGiant",
    name: "Frost Giant",
    pre: "boss.frostGiant.pre",
    post: "boss.frostGiant.post",
    color: 0x90caf9,
    backdrop: "frost",
    effect: "snow",
    biome: "tundra",
    challenge: "A giant silhouette steps through the whiteout, each footfall cracking the frozen ground.",
    defeat: "The giant kneels and the storm loosens, revealing a pale horizon beyond the snow.",
  },
  {
    id: "swampHydra",
    name: "Swamp Hydra",
    pre: "boss.swampHydra.pre",
    post: "boss.swampHydra.post",
    color: 0x558b2f,
    backdrop: "marsh",
    effect: "mist",
    biome: "swamp",
    challenge: "One head breaks the black water, then another, until the whole marsh seems to be watching.",
    defeat: "The hydra sinks beneath still water. For the first time in years, the marsh insects begin to sing.",
  },
  {
    id: "volcanicWyrm",
    name: "Volcanic Wyrm",
    pre: "boss.volcanicWyrm.pre",
    post: "boss.volcanicWyrm.post",
    color: 0xbf360c,
    backdrop: "forge",
    effect: "embers",
    biome: "volcanic",
    challenge: "The ridge splits with a roar. A wyrm coils out of the molten seam and turns its furnace gaze upon you.",
    defeat: "The wyrm's glow fades to dark stone, leaving only sparks drifting over the ridge.",
  },
  {
    id: "canyonDrake",
    name: "Canyon Drake",
    pre: "boss.canyonDrake.pre",
    post: "boss.canyonDrake.post",
    color: 0xa1887f,
    backdrop: "canyon",
    effect: "sand",
    biome: "canyon",
    challenge: "A drake dives between the canyon walls, scattering stone as it claims the narrow pass.",
    defeat: "The drake crashes beyond the ledge. Wind returns to the canyon and carries the dust away.",
  },
  {
    id: "cryptLich",
    name: "Crypt Lich",
    pre: "boss.cryptLich.pre",
    post: "boss.cryptLich.post",
    color: 0x4a148c,
    backdrop: "crypt",
    effect: "runes",
    biome: "dungeon",
    challenge: "The dead king opens empty eyes. Necrotic runes bind the first keystone above its throne.",
    defeat: "The lich's crown splits. Its last command dissolves into dust, and the crypt releases its stolen light.",
  },
  {
    id: "frostWarden",
    name: "Frost Warden",
    pre: "boss.frostWarden.pre",
    post: "boss.frostWarden.post",
    color: 0x80deea,
    backdrop: "frost",
    effect: "snow",
    biome: "dungeon",
    challenge: "The Warden steps from the glacier, armored in centuries of unbroken winter.",
    defeat: "Cracks race across the Warden's armor. The cavern exhales, and ancient ice begins to thaw.",
  },
  {
    id: "infernoForgemaster",
    name: "Inferno Forgemaster",
    pre: "boss.infernoForgemaster.pre",
    post: "boss.infernoForgemaster.post",
    color: 0xbf360c,
    backdrop: "forge",
    effect: "embers",
    biome: "dungeon",
    challenge: "The Forgemaster raises a white-hot hammer. Every chain in the forge pulls taut at once.",
    defeat: "The hammer falls silent. Clean fire moves through the forge, no longer bound to the Forgemaster's will.",
  },
  {
    id: "kraken",
    name: "Deepwake Kraken",
    pre: "boss.kraken.pre",
    post: "boss.kraken.post",
    color: 0x311b92,
    backdrop: "marsh",
    effect: "mist",
    biome: "sea",
    challenge: "The sea folds inward. Tentacles rise around the boat as an ancient eye opens beneath the wake.",
    defeat: "The Kraken releases the hull and sinks into the deep. Dawn reaches water no chart had ever named.",
  },
];

function hero(): CutsceneActorCue {
  return {
    role: "hero",
    id: "hero",
    label: "{hero}",
    slot: "left",
    entrance: "left",
  };
}

function boss(story: BossStory): CutsceneActorCue {
  return {
    role: "boss",
    id: story.id,
    label: story.name,
    color: story.color,
    slot: "right",
    scale: 1.35,
    entrance: "right",
  };
}

export const BOSS_CUTSCENE_DEFINITIONS:
readonly CutsceneDefinition<BossCutsceneId>[] = BOSS_STORIES.flatMap(
  (story): readonly CutsceneDefinition<BossCutsceneId>[] => [
    {
      id: story.pre,
      title: `${story.name}: Challenge`,
      category: "bossPre",
      chronicle: true,
      completion: {
        type: "bossBattle",
        bossId: story.id,
        biome: story.biome,
      },
      steps: [
        {
          type: "narration",
          heading: story.name,
          text: story.challenge,
          presentation: {
            backdrop: story.backdrop,
            actors: [hero(), boss(story)],
            camera: { focus: "right", zoom: 1.16, durationMs: 650 },
            effect: story.effect,
            audioCue: "bossReveal",
            fade: "in",
          },
        },
        {
          type: "dialogue",
          speaker: story.name,
          text: "Turn back, or be broken here.",
          presentation: {
            backdrop: story.backdrop,
            actors: [hero(), boss(story)],
            camera: { focus: "right", zoom: 1.22, durationMs: 450 },
            effect: story.effect,
            audioCue: "bossReveal",
            fade: "cross",
          },
        },
      ],
    },
    {
      id: story.post,
      title: `${story.name}: Defeated`,
      category: "bossPost",
      chronicle: true,
      steps: [
        {
          type: "narration",
          heading: "Victory",
          text: story.defeat,
          presentation: {
            backdrop: story.backdrop,
            actors: [{ ...hero(), slot: "center" }],
            camera: { focus: "center", zoom: 1.08, durationMs: 500 },
            effect: "flash",
            audioCue: "bossDefeat",
            fade: "cross",
          },
        },
      ],
    },
  ],
);

export const BOSS_CUTSCENES: Readonly<
Record<string, { readonly pre: BossCutsceneId; readonly post: BossCutsceneId }>
> = Object.freeze(Object.fromEntries(
  BOSS_STORIES.map((story) => [
    story.id,
    { pre: story.pre, post: story.post },
  ]),
));

export const BOSS_CUTSCENE_TRIGGERS:
readonly CutsceneTriggerDefinition<BossCutsceneId>[] = BOSS_STORIES.flatMap(
  (story): readonly CutsceneTriggerDefinition<BossCutsceneId>[] => [
    {
      id: `boss.${story.id}.pre`,
      cutsceneId: story.pre,
      priority: 10,
      condition: {
        type: "event",
        event: "bossPre",
        targetId: story.id,
      },
    },
    {
      id: `boss.${story.id}.post`,
      cutsceneId: story.post,
      priority: 10,
      condition: {
        type: "bossDefeated",
        bossId: story.id,
      },
    },
  ],
);

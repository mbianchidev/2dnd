import { MAIN_QUEST_ID } from "./quests";
import type {
  CutsceneActorCue,
  CutsceneBackdrop,
  CutsceneDefinition,
  CutsceneEffect,
  CutscenePresentation,
  CutsceneTriggerDefinition,
} from "./cutsceneTypes";

export const CAMPAIGN_EPILOGUE_CUTSCENE_ID =
  "campaign.twelvefoldCovenant.epilogue" as const;

export const CAMPAIGN_CUTSCENE_IDS = [
  "campaign.opening",
  "campaign.stage.firstSeal",
  "campaign.stage.stoneAndRoot",
  "campaign.stage.winterWitness",
  "campaign.stage.sunRoad",
  "campaign.stage.marshCovenant",
  "campaign.stage.ashenWatch",
  "campaign.stage.lastForge",
  "campaign.oath.willowdale",
  "campaign.oath.ironhold",
  "campaign.oath.deeproot",
  "campaign.oath.frostheim",
  "campaign.oath.thornvale",
  "campaign.oath.sandport",
  "campaign.oath.canyonwatch",
  "campaign.oath.dunerest",
  "campaign.oath.bogtown",
  "campaign.oath.shadowfen",
  "campaign.oath.ashfall",
  "campaign.oath.ridgewatch",
  "campaign.dungeon.heartlandsCrypt.reveal",
  "campaign.dungeon.frostCavern.reveal",
  "campaign.dungeon.volcanicForge.reveal",
  "campaign.keystone.heartlands",
  "campaign.keystone.frost",
  "campaign.keystone.forge",
  "campaign.companion.guardian",
  "campaign.companion.scout",
  "campaign.companion.mystic",
  "campaign.route.canyonwatch",
  "campaign.route.ashfall",
  "campaign.route.volcanicForge",
  "campaign.finalReturn",
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
] as const;

export type CampaignCutsceneId = (typeof CAMPAIGN_CUTSCENE_IDS)[number];

const HERO: CutsceneActorCue = {
  role: "hero",
  id: "hero",
  label: "{hero}",
  slot: "left",
  entrance: "left",
};

function npc(
  id: string,
  label: string,
  color: number,
  slot: CutsceneActorCue["slot"] = "right",
): CutsceneActorCue {
  return {
    role: "character",
    id,
    label,
    color,
    slot,
    entrance: "right",
  };
}

function presentation(
  backdrop: CutsceneBackdrop,
  effect: CutsceneEffect,
  actors: readonly CutsceneActorCue[],
  audioCue: NonNullable<CutscenePresentation["audioCue"]>,
  focus: NonNullable<CutscenePresentation["camera"]>["focus"] = "center",
): CutscenePresentation {
  return {
    backdrop,
    effect,
    actors,
    audioCue,
    camera: { focus, zoom: 1.08, durationMs: 550 },
    fade: "cross",
  };
}

interface StageStory {
  readonly id: string;
  readonly cutsceneId: CampaignCutsceneId;
  readonly title: string;
  readonly heading: string;
  readonly text: string;
  readonly backdrop: CutsceneBackdrop;
  readonly effect: CutsceneEffect;
}

const STAGE_STORIES: readonly StageStory[] = [
  {
    id: "firstSeal",
    cutsceneId: "campaign.stage.firstSeal",
    title: "The First Seal",
    heading: "A Fading Promise",
    text: "Willowdale's oldest bells fall silent. Somewhere beyond its walls, twelve promises wait to be spoken again.",
    backdrop: "heartlands",
    effect: "runes",
  },
  {
    id: "stoneAndRoot",
    cutsceneId: "campaign.stage.stoneAndRoot",
    title: "Stone and Root",
    heading: "Two Voices Below",
    text: "Ironhold's stone and Deeproot's living roots guard the road to the first lost keystone.",
    backdrop: "forest",
    effect: "leaves",
  },
  {
    id: "winterWitness",
    cutsceneId: "campaign.stage.winterWitness",
    title: "The Winter Witness",
    heading: "The North Remembers",
    text: "The covenant's second echo waits where Frostheim's ice meets Thornvale's dark boughs.",
    backdrop: "frost",
    effect: "snow",
  },
  {
    id: "sunRoad",
    cutsceneId: "campaign.stage.sunRoad",
    title: "The Sun Road",
    heading: "A Sealed Pass",
    text: "Sandport's mark can open the canyon road, but every gate beyond it demands a promise freely renewed.",
    backdrop: "desert",
    effect: "sand",
  },
  {
    id: "marshCovenant",
    cutsceneId: "campaign.stage.marshCovenant",
    title: "The Marsh Covenant",
    heading: "Voices in the Mist",
    text: "Bogtown and Shadowfen keep their words beneath black water, old medicine, and older memory.",
    backdrop: "marsh",
    effect: "mist",
  },
  {
    id: "ashenWatch",
    cutsceneId: "campaign.stage.ashenWatch",
    title: "The Ashen Watch",
    heading: "The Twelfth Voice",
    text: "Ashfall's hammers and Ridgewatch's sentinels stand between the covenant and the last burning road.",
    backdrop: "mountain",
    effect: "embers",
  },
  {
    id: "lastForge",
    cutsceneId: "campaign.stage.lastForge",
    title: "The Last Forge",
    heading: "Three Flames, One Choice",
    text: "All twelve voices have answered. Only the Inferno Forgemaster and the final keystone remain.",
    backdrop: "forge",
    effect: "embers",
  },
];

interface OathStory {
  readonly cutsceneId: CampaignCutsceneId;
  readonly objectiveId: string;
  readonly city: string;
  readonly speaker: string;
  readonly speakerId: string;
  readonly line: string;
  readonly color: number;
  readonly backdrop: CutsceneBackdrop;
  readonly effect: CutsceneEffect;
}

const OATH_STORIES: readonly OathStory[] = [
  {
    cutsceneId: "campaign.oath.willowdale",
    objectiveId: "speakElowen",
    city: "Willowdale",
    speaker: "Archivist Elowen",
    speakerId: "elowen",
    line: "Carry the sigil openly. Let every city choose whether the old promise still deserves a voice.",
    color: 0x9575cd,
    backdrop: "city",
    effect: "runes",
  },
  {
    cutsceneId: "campaign.oath.ironhold",
    objectiveId: "ironholdOath",
    city: "Ironhold",
    speaker: "Warden Brann",
    speakerId: "brann",
    line: "Ironhold gives its word in iron: we endure together, or not at all.",
    color: 0x90a4ae,
    backdrop: "city",
    effect: "flash",
  },
  {
    cutsceneId: "campaign.oath.deeproot",
    objectiveId: "deeprootOath",
    city: "Deeproot",
    speaker: "Rootspeaker Neris",
    speakerId: "neris",
    line: "Deeproot gives its word in living wood. May the covenant grow without becoming a chain.",
    color: 0x66bb6a,
    backdrop: "forest",
    effect: "leaves",
  },
  {
    cutsceneId: "campaign.oath.frostheim",
    objectiveId: "frostheimOath",
    city: "Frostheim",
    speaker: "Seer Yrsa",
    speakerId: "yrsa",
    line: "Frostheim bears witness. What survives the winter must shelter those who follow.",
    color: 0x80deea,
    backdrop: "frost",
    effect: "snow",
  },
  {
    cutsceneId: "campaign.oath.thornvale",
    objectiveId: "thornvaleOath",
    city: "Thornvale",
    speaker: "Greenwarden Rowan",
    speakerId: "rowan",
    line: "Thornvale gives its living word. Root, river, and road will answer together.",
    color: 0x43a047,
    backdrop: "forest",
    effect: "leaves",
  },
  {
    cutsceneId: "campaign.oath.sandport",
    objectiveId: "sandportPass",
    city: "Sandport",
    speaker: "Harbormaster Sable",
    speakerId: "sable",
    line: "Sandport marks your sigil. Trade and truth both fail when every gate is closed.",
    color: 0xffb74d,
    backdrop: "desert",
    effect: "sand",
  },
  {
    cutsceneId: "campaign.oath.canyonwatch",
    objectiveId: "canyonwatchOath",
    city: "Canyonwatch",
    speaker: "Marshal Tarek",
    speakerId: "tarek",
    line: "Canyonwatch gives its word. No traveler under covenant law stands alone.",
    color: 0xbcaaa4,
    backdrop: "canyon",
    effect: "flash",
  },
  {
    cutsceneId: "campaign.oath.dunerest",
    objectiveId: "dunerestOath",
    city: "Dunerest",
    speaker: "Lorekeeper Zahra",
    speakerId: "zahra",
    line: "Dunerest renews its promise freely, as our ancestors intended.",
    color: 0xffcc80,
    backdrop: "desert",
    effect: "runes",
  },
  {
    cutsceneId: "campaign.oath.bogtown",
    objectiveId: "bogtownOath",
    city: "Bogtown",
    speaker: "Apothecary Mirel",
    speakerId: "mirel",
    line: "Bogtown gives its word: every poison has a cure, and every city owes the search.",
    color: 0x8bc34a,
    backdrop: "marsh",
    effect: "mist",
  },
  {
    cutsceneId: "campaign.oath.shadowfen",
    objectiveId: "shadowfenOath",
    city: "Shadowfen",
    speaker: "Ferryman Vey",
    speakerId: "vey",
    line: "Shadowfen gives its word. Even hidden roads must lead somewhere worth reaching.",
    color: 0x7e57c2,
    backdrop: "marsh",
    effect: "mist",
  },
  {
    cutsceneId: "campaign.oath.ashfall",
    objectiveId: "ashfallOath",
    city: "Ashfall",
    speaker: "Smith Kael",
    speakerId: "kael",
    line: "Ashfall gives its word in tempered steel. Fire should shape a future, not consume it.",
    color: 0xef6c00,
    backdrop: "forge",
    effect: "embers",
  },
  {
    cutsceneId: "campaign.oath.ridgewatch",
    objectiveId: "ridgewatchOath",
    city: "Ridgewatch",
    speaker: "Sentinel Mira",
    speakerId: "mira",
    line: "Ridgewatch gives the twelfth word. The road to the forge is yours.",
    color: 0xffd54f,
    backdrop: "mountain",
    effect: "stars",
  },
];

interface MilestoneStory {
  readonly cutsceneId: CampaignCutsceneId;
  readonly title: string;
  readonly heading: string;
  readonly text: string;
  readonly backdrop: CutsceneBackdrop;
  readonly effect: CutsceneEffect;
  readonly trigger: CutsceneTriggerDefinition<CampaignCutsceneId>["condition"];
  readonly priority: number;
  readonly cue: NonNullable<CutscenePresentation["audioCue"]>;
}

const MILESTONE_STORIES: readonly MilestoneStory[] = [
  {
    cutsceneId: "campaign.dungeon.heartlandsCrypt.reveal",
    title: "Heartlands Crypt",
    heading: "The First Depth",
    text: "The crypt seal yields. Cold air carries the scrape of stone and the whisper of a stolen keystone.",
    backdrop: "crypt",
    effect: "mist",
    trigger: { type: "dungeonEntered", dungeonId: "heartlands_dungeon" },
    priority: 20,
    cue: "dungeon",
  },
  {
    cutsceneId: "campaign.dungeon.frostCavern.reveal",
    title: "Frost Cavern",
    heading: "Beneath the Ice",
    text: "Blue light moves through the cavern walls like a sleeping pulse. The second keystone is near.",
    backdrop: "frost",
    effect: "snow",
    trigger: { type: "dungeonEntered", dungeonId: "frost_cavern" },
    priority: 20,
    cue: "dungeon",
  },
  {
    cutsceneId: "campaign.dungeon.volcanicForge.reveal",
    title: "Volcanic Forge",
    heading: "The Furnace Opens",
    text: "The final seal breaks. Ancient hammers answer from below, each strike bright enough to stain the dark.",
    backdrop: "forge",
    effect: "embers",
    trigger: { type: "dungeonEntered", dungeonId: "volcanic_forge" },
    priority: 20,
    cue: "dungeon",
  },
  {
    cutsceneId: "campaign.keystone.heartlands",
    title: "Heartlands Keystone",
    heading: "Stone Remembers",
    text: "The first keystone rises from the Crypt Lich's ruin and answers the renewed oaths of stone and root.",
    backdrop: "crypt",
    effect: "runes",
    trigger: { type: "bossDefeated", bossId: "cryptLich" },
    priority: 20,
    cue: "keystone",
  },
  {
    cutsceneId: "campaign.keystone.frost",
    title: "Frost Keystone",
    heading: "Winter Bears Witness",
    text: "The second keystone thaws in your hands, carrying Frostheim's witness and Thornvale's living word.",
    backdrop: "frost",
    effect: "flash",
    trigger: { type: "bossDefeated", bossId: "frostWarden" },
    priority: 20,
    cue: "keystone",
  },
  {
    cutsceneId: "campaign.keystone.forge",
    title: "Forge Keystone",
    heading: "The Third Flame",
    text: "The final keystone cools from white fire to gold. Twelve voices now speak through one restored sigil.",
    backdrop: "forge",
    effect: "flash",
    trigger: { type: "bossDefeated", bossId: "infernoForgemaster" },
    priority: 20,
    cue: "keystone",
  },
  {
    cutsceneId: "campaign.companion.guardian",
    title: "The Ironward Oath",
    heading: "A Shield Joins the Road",
    text: "Bram Ironward sets his shield beside yours. The party gains a guardian who will not yield the line.",
    backdrop: "city",
    effect: "flash",
    trigger: { type: "companionRecruited", companionId: "guardian" },
    priority: 20,
    cue: "recruitment",
  },
  {
    cutsceneId: "campaign.companion.scout",
    title: "The Swiftstep Trail",
    heading: "Eyes on the Horizon",
    text: "Kaia Swiftstep takes the forward path. The party gains a scout who reads danger before it arrives.",
    backdrop: "canyon",
    effect: "sand",
    trigger: { type: "companionRecruited", companionId: "scout" },
    priority: 20,
    cue: "recruitment",
  },
  {
    cutsceneId: "campaign.companion.mystic",
    title: "The Veiled Flame",
    heading: "A Ward Beside You",
    text: "Selene Vey binds the quiet flame to her staff. The party gains a mystic who walks between omen and spell.",
    backdrop: "forge",
    effect: "runes",
    trigger: { type: "companionRecruited", companionId: "mystic" },
    priority: 20,
    cue: "recruitment",
  },
  {
    cutsceneId: "campaign.route.canyonwatch",
    title: "The Canyonwatch Gate",
    heading: "The Sun Road Opens",
    text: "Sandport's mark catches the light. Far to the east, the Canyonwatch barricade is raised.",
    backdrop: "canyon",
    effect: "sand",
    trigger: {
      type: "questGate",
      questId: MAIN_QUEST_ID,
      stageId: "sunRoad",
      objectiveIds: ["sandportPass"],
    },
    priority: 30,
    cue: "routeOpen",
  },
  {
    cutsceneId: "campaign.route.ashfall",
    title: "The Ashfall Road",
    heading: "Mist Gives Way to Smoke",
    text: "With the marsh oaths renewed, the western barricade falls and the Ashfall road opens.",
    backdrop: "mountain",
    effect: "embers",
    trigger: {
      type: "questGate",
      questId: MAIN_QUEST_ID,
      stageId: "ashenWatch",
    },
    priority: 30,
    cue: "routeOpen",
  },
  {
    cutsceneId: "campaign.route.volcanicForge",
    title: "The Volcanic Forge Road",
    heading: "Twelve Voices Answer",
    text: "Ridgewatch's final oath reaches the sigil. The forge road opens beneath a sky of sparks.",
    backdrop: "forge",
    effect: "embers",
    trigger: {
      type: "questGate",
      questId: MAIN_QUEST_ID,
      stageId: "lastForge",
    },
    priority: 30,
    cue: "routeOpen",
  },
];

const OPENING: CutsceneDefinition<CampaignCutsceneId> = {
  id: "campaign.opening",
  title: "The Road Before You",
  category: "opening",
  chronicle: true,
  steps: [
    {
      type: "narration",
      heading: "A Quiet Morning",
      text: "Before the first oath, before the first monster, {hero} steps onto a road whose old promises are beginning to fail.",
      presentation: presentation("heartlands", "stars", [HERO], "opening", "left"),
    },
    {
      type: "narration",
      heading: "Willowdale",
      text: "An archivist waits beneath silent bells. Beyond her, twelve cities and three buried keystones hold the shape of the world to come.",
      presentation: presentation("city", "runes", [HERO], "opening", "center"),
    },
  ],
};

const STAGE_DEFINITIONS = STAGE_STORIES.map(
  (story): CutsceneDefinition<CampaignCutsceneId> => ({
    id: story.cutsceneId,
    title: story.title,
    category: "questStage",
    chronicle: true,
    steps: [
      {
        type: "narration",
        heading: story.heading,
        text: story.text,
        presentation: presentation(
          story.backdrop,
          story.effect,
          [HERO],
          "stage",
          "center",
        ),
      },
      {
        type: "narration",
        text: "The next chapter is written on the road ahead.",
        presentation: presentation(
          story.backdrop,
          story.effect,
          [{ ...HERO, slot: "center" }],
          "stage",
          "center",
        ),
      },
    ],
  }),
);

const OATH_DEFINITIONS = OATH_STORIES.map(
  (story): CutsceneDefinition<CampaignCutsceneId> => {
    const witness = npc(
      story.speakerId,
      story.speaker,
      story.color,
    );
    return {
      id: story.cutsceneId,
      title: `${story.city}'s Covenant`,
      category: "covenant",
      chronicle: true,
      steps: [
        {
          type: "dialogue",
          speaker: story.speaker,
          text: story.line,
          presentation: presentation(
            story.backdrop,
            story.effect,
            [HERO, witness],
            "oath",
            "right",
          ),
        },
        {
          type: "narration",
          heading: `${story.city} Answers`,
          text: `The Covenant Sigil records ${story.city}'s voice in a ring of living light.`,
          presentation: presentation(
            story.backdrop,
            "runes",
            [
              { ...HERO, slot: "center" },
              { ...witness, slot: "farRight" },
            ],
            "oath",
            "center",
          ),
        },
      ],
    };
  },
);

const MILESTONE_DEFINITIONS = MILESTONE_STORIES.map(
  (story): CutsceneDefinition<CampaignCutsceneId> => ({
    id: story.cutsceneId,
    title: story.title,
    category: story.cutsceneId.includes(".dungeon.")
      ? "dungeonReveal"
      : story.cutsceneId.includes(".keystone.")
        ? "keystone"
        : story.cutsceneId.includes(".companion.")
          ? "companion"
          : "route",
    chronicle: true,
    steps: [
      {
        type: "narration",
        heading: story.heading,
        text: story.text,
        presentation: presentation(
          story.backdrop,
          story.effect,
          [{ ...HERO, slot: "center" }],
          story.cue,
          "center",
        ),
      },
    ],
  }),
);

const FINAL_RETURN: CutsceneDefinition<CampaignCutsceneId> = {
  id: "campaign.finalReturn",
  title: "The Final Return",
  category: "finale",
  chronicle: true,
  steps: [
    {
      type: "dialogue",
      speaker: "Archivist Elowen",
      text: "The sigil is whole. Every city chose its promise again, and you carried each voice home.",
      presentation: presentation(
        "city",
        "runes",
        [HERO, npc("elowen", "Archivist Elowen", 0x9575cd)],
        "finale",
        "right",
      ),
    },
    {
      type: "narration",
      heading: "Roadwarden",
      text: "Elowen raises the restored sigil. Twelve bells answer across the realm before Willowdale's own bell finally rings.",
      presentation: presentation(
        "stars",
        "stars",
        [{ ...HERO, slot: "center" }],
        "finale",
        "center",
      ),
    },
  ],
};

export const CAMPAIGN_EPILOGUE_CUTSCENE:
CutsceneDefinition<CampaignCutsceneId> = {
  id: CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  title: "The Covenant Restored",
  category: "epilogue",
  chronicle: true,
  steps: [
    {
      type: "narration",
      heading: "The Twelvefold Covenant",
      text: "Twelve oaths answer as one. The three keystones blaze, and the fire beneath the Volcanic Forge burns clean once more.",
      presentation: presentation(
        "stars",
        "stars",
        [{ ...HERO, slot: "center" }],
        "finale",
        "center",
      ),
    },
    {
      type: "dialogue",
      speaker: "Archivist Elowen",
      text: "The covenant names you its roadwarden. Its promise is restored, but its roads still need a guardian. Go freely - the world you saved remains yours to explore.",
    },
    {
      type: "narration",
      heading: "A New Road",
      text: "Across the realm, sealed gates open, old bells ring, and the twelve cities renew the promises that bound them together.",
    },
    {
      type: "summary",
      heading: "Your Chronicle",
    },
    {
      type: "credits",
      lines: [
        "2D&D",
        "Created by the 2D&D project contributors",
        "Built with Phaser",
        "Procedural art and synthesized audio",
        "Thank you for playing",
      ],
    },
  ],
};

export const CAMPAIGN_CUTSCENE_DEFINITIONS:
readonly CutsceneDefinition<CampaignCutsceneId>[] = [
  OPENING,
  ...STAGE_DEFINITIONS,
  ...OATH_DEFINITIONS,
  ...MILESTONE_DEFINITIONS,
  FINAL_RETURN,
  CAMPAIGN_EPILOGUE_CUTSCENE,
];

export const MAIN_QUEST_STAGE_CUTSCENES: Readonly<Record<string, CampaignCutsceneId>> =
  Object.freeze(Object.fromEntries(
    STAGE_STORIES.map((story) => [story.id, story.cutsceneId]),
  ));

export const CAMPAIGN_CUTSCENE_TRIGGERS:
readonly CutsceneTriggerDefinition<CampaignCutsceneId>[] = [
  {
    id: "event.newGame.opening",
    cutsceneId: "campaign.opening",
    priority: 0,
    condition: { type: "event", event: "newGame" },
  },
  ...STAGE_STORIES.map((story) => ({
    id: `stage.${story.id}`,
    cutsceneId: story.cutsceneId,
    priority: 40,
    condition: {
      type: "questStage" as const,
      questId: MAIN_QUEST_ID,
      stageId: story.id,
    },
  })),
  ...OATH_STORIES.map((story) => ({
    id: `objective.${story.objectiveId}`,
    cutsceneId: story.cutsceneId,
    priority: 20,
    condition: {
      type: "questObjective" as const,
      questId: MAIN_QUEST_ID,
      objectiveId: story.objectiveId,
    },
  })),
  ...MILESTONE_STORIES.map((story) => ({
    id: `milestone.${story.cutsceneId}`,
    cutsceneId: story.cutsceneId,
    priority: story.priority,
    condition: story.trigger,
  })),
  {
    id: "quest.main.completed.finalReturn",
    cutsceneId: "campaign.finalReturn",
    priority: 20,
    condition: {
      type: "questCompleted",
      questId: MAIN_QUEST_ID,
    },
  },
  {
    id: "quest.main.completed.epilogue",
    cutsceneId: CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    priority: 100,
    condition: {
      type: "questCompleted",
      questId: MAIN_QUEST_ID,
    },
  },
];

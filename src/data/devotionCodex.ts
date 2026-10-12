import { DEITIES, TEMPLES } from "./devotion";
import type { CodexKnowledgeEntry } from "./codexKnowledge";

const DEITY_LORE_IDS = {
  orivane: "devotionOrivane",
  selquor: "devotionSelquor",
  tessune: "devotionTessune",
} as const;

export const DEVOTION_CODEX_ENTRIES: readonly CodexKnowledgeEntry[] = [
  {
    id: "unfinishedConstellation", category: "history",
    name: "The Unfinished Constellation",
    summary: "Three imagined figures accompany chosen roads; none commands the covenant.",
    details: [
      "Orivane builds unfinished sky-spans, Selquor keeps contradictory echoes, and Tessune marks a turning ocean's open crossings.",
      "These original fictional stories ask no affiliation of visitors. Town standing and moral outlook remain separate from devotion.",
      "A traveling thread is the same small, temporary ward for every visitor, including those who follow no figure.",
    ],
    tags: ["devotion", "fictional", "optional", "constellation"], sortOrder: 990,
    sources: TEMPLES.map((temple) => ({
      type: "devotionTemple", templeId: temple.id,
      label: `Visit ${temple.name}`, hint: "Approach a marked temple or model site in a city.",
    })),
  },
  ...DEITIES.map((deity, index): CodexKnowledgeEntry => ({
    id: DEITY_LORE_IDS[deity.id], category: "history",
    name: `${deity.name}, ${deity.epithet}`,
    summary: deity.description,
    details: [
      "Affiliation is a voluntary roleplay choice, never a campaign requirement.",
      "Rites and keeper choices record their causes once. Repeating them cannot buy or farm devotion.",
      deity.ending,
    ],
    tags: ["devotion", "fictional", deity.id, ...deity.domainIds],
    sortOrder: 991 + index,
    sources: [
      {
        type: "devotionAffiliation", deityId: deity.id,
        label: `Choose ${deity.name}`, hint: "Make an explicit affiliation choice at a temple.",
      },
      ...TEMPLES.filter((temple) => temple.deityId === deity.id).map((temple) => ({
        type: "devotionTemple" as const, templeId: temple.id,
        label: `Visit ${temple.name}`, hint: "Visitors need no affiliation to learn this story.",
      })),
    ],
  })),
  {
    id: "historyUnfinishedSpan", category: "history", name: "A Span with Two Makers",
    summary: "An unfinished model passes between Willowdale and Ironhold without becoming either city's possession.",
    details: ["The span's joining piece leaves room for a third maker; its history belongs to neither keeper alone."],
    tags: ["devotion", "orivane", "makers"], sortOrder: 994,
    sources: [{ type: "questCompletion", questId: "mendTheSpan",
      label: "Mend the Unfinished Span", hint: "Help the Span House's two makers." }],
  },
  {
    id: "historyUnwelcomeEcho", category: "history", name: "Both Crossing Accounts",
    summary: "Dunerest and Shadowfen preserve the safe passage and the lost boat in the same record.",
    details: ["Neither account must erase the other to be heard in Selquor's Echo Rooms."],
    tags: ["devotion", "selquor", "testimony"], sortOrder: 995,
    sources: [{ type: "questCompletion", questId: "keepTheEcho",
      label: "Keep the Unwelcome Echo", hint: "Return a crossing's second voice." }],
  },
  {
    id: "historyTurningShoal", category: "history", name: "The Open Island Chart",
    summary: "Sandport and Tidehaven share a safe crossing account with an unmarked margin.",
    details: ["Tessune's model names a way through the shoal without deciding where travelers must land."],
    tags: ["devotion", "tessune", "island", "passage"], sortOrder: 996,
    sources: [{ type: "questCompletion", questId: "shareTheShoal",
      label: "Share the Turning Shoal", hint: "Carry the open chart to Tidehaven." },
    { type: "worldEvent", eventId: "turningShoalBeacon",
      label: "The Turning Shoal Beacon", hint: "Find the blueglass channel while sailing." }],
  },
  {
    id: "historyFallenEchoGlass", category: "history", name: "The Fallen Echo Glass",
    summary: "A hollow glass account can be returned to its speaker or sold under a stranger's name.",
    details: ["The choice belongs to the traveler, and its moral and devotion consequences are recorded independently."],
    tags: ["devotion", "selquor", "worldEvent"], sortOrder: 997,
    sources: [{ type: "worldEvent", eventId: "fallenEchoGlass",
      label: "The Fallen Echo Glass", hint: "Meet an account carrier along a road." }],
  },
];

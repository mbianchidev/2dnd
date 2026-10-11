import { PRESTIGE_PATHS } from "./prestige";
import type { CodexKnowledgeEntry } from "./codexKnowledge";

export const PRESTIGE_LORE: readonly CodexKnowledgeEntry[] = PRESTIGE_PATHS.map((path, index) => ({
  id: `historyPrestige${path.pathId[0]!.toUpperCase()}${path.pathId.slice(1)}`,
  category: "history",
  name: path.label,
  summary: path.description,
  details: [
    path.tradeoff, path.equipmentNotes,
    "A freely chosen five-rank tradition, not a replacement for the starting class.",
    "Earned ranks remain valid after later social changes. No affiliation is required.",
  ],
  tags: ["prestige", path.archetype, "optional", "unaffiliated"],
  sortOrder: 1100 + index,
  sources: [{
    type: "prestigeRank", trackId: path.id, minimumRank: 1,
    label: `Earn ${path.label} rank 1`,
    hint: "Reach total level 6, meet the listed entry conditions, then choose a path rank at rest.",
  }],
}));

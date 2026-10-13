import { QUESTS } from "./quests";

export const NEW_GAME_PLUS_SAVE_VERSION = 27;
export const NEW_GAME_PLUS_POLICY_VERSION = 1;
export const MAX_NEW_GAME_PLUS_CYCLE = 99;
export const NEW_GAME_PLUS_SCALE_CAP = 5;
export const NEW_GAME_PLUS_RESET_ITEM_IDS: readonly string[] = Object.freeze([
  "covenantSigil", "sealedDispatch", "frostSilkBundle", "dungeonKey",
]);

/** Unique permanent grants are lineage-owned, even after transfer, upgrade or sale. */
export const NEW_GAME_PLUS_LIFETIME_REWARD_IDS: readonly string[] = Object.freeze(
  Object.values(QUESTS).flatMap((quest) => [
    ...(quest.startRewards ?? []),
    ...quest.stages.flatMap((stage) => stage.rewards ?? []),
    ...(quest.completionRewards ?? []),
  ].filter((reward) => reward.type === "item" && reward.unique
    && !NEW_GAME_PLUS_RESET_ITEM_IDS.includes(reward.itemId))
    .map((reward) => `${quest.id}/${reward.id}`)),
);

export const NEW_GAME_PLUS_CARRY_SUMMARY: readonly string[] = Object.freeze([
  "Carry: identity, earned ranks, XP, rested choices, stats, gear, bags, materials, gold and bank.",
  "Carry: recruited companions, order, control and gambits; restore HP/MP, clear combat effects.",
  "Carry: Codex, titles, achievements and debug provenance, recipes and gathering knowledge/records.",
  "Carry: boats, current hull, upgrades/cosmetics; devotion, consumed rites, activity records/claims.",
  "Carry: difficulty history and timing; shared audio, accessibility and inventory preferences stay separate.",
  "Reset: quests, bosses, story keys, chests, treasure, fog, travel discovery, checks and traps.",
  "Reset: story scenes, world events, gathering nodes, nautical outcomes/statistics and all pending play.",
  "Reset: town/faction standing, current position, bank day and playtime; character alignment stays.",
  "Unique permanent rewards never repeat; ordinary XP/gold and world rewards pay once in each cycle.",
  "Epic: NG+ only, levels 21-30 through Roadwarden ranks; d8/CON HP, shared INT MP; ASIs 22/26/30.",
  "XP includes stockpiled XP. Newly eligible levels require rest; creation never applies a level or boon.",
  "Autosave becomes the active NG+ run. The completed manual source stays unchanged.",
]);

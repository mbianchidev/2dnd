import { getAbility } from "../data/abilities";
import { getPrestigePath } from "../data/prestige";
import { getSpell } from "../data/spells";
import { getTalent } from "../data/talents";
import {
  getProgressionRequirementStatus, getTrackLevel,
  getProgressionTracks, previewHeroLevelUp,
  type ProgressionRequirementStatus,
} from "./classProgression";
import { createHeroProgressionContext } from "./classProgressionContext";
import type { PlayerState } from "./player";

function requirementLines(status: ProgressionRequirementStatus, indent = ""): string[] {
  return [
    `${indent}${status.met ? "[met]" : "[missing]"} ${status.description}; current: ${status.current}`,
    ...status.children.flatMap((child) => requirementLines(child, `${indent}  `)),
  ];
}

/** Pure five-rank table, live qualification evidence and explicit opportunity costs. */
export function buildPrestigeDetails(player: PlayerState, id: string): string {
  const path = getPrestigePath(id);
  if (!path) return "Unknown prestige path.";
  const context = createHeroProgressionContext(() => player);
  const owned = getTrackLevel(player, path.id);
  const lines = [
    `${path.label} (${path.archetype}) ${owned}/${path.maxRank}`,
    path.description,
    `Casting: ${path.primaryStat.toUpperCase()}; HP d${path.hpGrowth.hitDie}; one shared INT-grown MP pool.`,
    `Tradeoff: ${path.tradeoff}`,
    path.equipmentNotes,
    "Optional. Entry-only conditions: earned ranks remain valid after later stat or social changes.",
    "Each rank spends one rested total level; cap 20. No extra proficiency, ASI or action.",
  ];
  for (let rank = 1; rank <= path.maxRank; rank++) {
    const features = path.grants.filter((grant) => grant.rank === rank).map((grant) => {
      const feature = grant.kind === "spell" ? getSpell(grant.id)
        : grant.kind === "ability" ? getAbility(grant.id) : getTalent(grant.id);
      if (!feature) throw new Error(`[prestige] Unknown ${grant.kind} ${grant.id}`);
      return `${feature.name}: ${feature.description}`
        + ("mpCost" in feature ? ` (${feature.mpCost} MP)` : "");
    });
    lines.push(`Rank ${rank}: ${features.join("; ") || "normal growth only"}; one normal HP/MP step.`);
  }
  if (player.classProgression.pendingLevel) {
    lines.push("Alternative base-class gains at this same total level:");
    for (const track of getProgressionTracks(player).filter((entry) => entry.kind === "base")) {
      const alternative = previewHeroLevelUp(player, track.id, context);
      if (!alternative.ok) continue;
      const preview = alternative.preview;
      const features = [...preview.newSpells, ...preview.newAbilities, ...preview.newTalents]
        .map((feature) => feature.name).join(", ");
      lines.push(`${preview.label} ${preview.trackLevel}: +${preview.hpGain} HP, +${preview.mpGain} MP;`
        + ` ${features || "normal growth only"}.`);
    }
  }
  lines.push(owned > 0 ? "Joining requirements (not rechecked for earned ranks):" : "Joining requirements:");
  for (const requirement of path.entryRequirements) {
    lines.push(...requirementLines(getProgressionRequirementStatus(player, requirement, context)));
  }
  return lines.join("\n");
}

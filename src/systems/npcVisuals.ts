import { CITY_NPCS, getNpcColors, getNpcTemplate } from "../data/npcs";
import { QUEST_NPCS } from "../data/quests";
import type { NpcTemplate } from "../data/npcs";
import type { QuestNpcId } from "../data/quests";

export interface NpcVisualDescriptor {
  readonly template: NpcTemplate;
  readonly skinColor: number;
  readonly hairColor: number;
  readonly dressColor: number;
}

/** Resolve the same deterministic instance palette in exploration and story scenes. */
export function resolveNpcVisual(cityId: string, index: number): NpcVisualDescriptor {
  const instance = CITY_NPCS[cityId]?.[index];
  const template = instance ? getNpcTemplate(instance.templateId) : undefined;
  if (!instance || !template) throw new Error(`[NPC] Unknown visual instance ${cityId}:${index}.`);
  const colors = getNpcColors(cityId, index);
  return {
    template,
    ...colors,
    hairColor: template.id.includes("elder") ? 0xaaaaaa : colors.hairColor,
  };
}

export function resolveNamedNpcVisual(npcId: QuestNpcId): NpcVisualDescriptor {
  const definition = QUEST_NPCS[npcId];
  const index = CITY_NPCS[definition.cityId]?.findIndex((npc) => npc.questNpcId === npcId) ?? -1;
  return resolveNpcVisual(definition.cityId, index);
}

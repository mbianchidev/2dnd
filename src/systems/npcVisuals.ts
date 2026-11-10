import { CITY_NPCS, getNpcColors, getNpcTemplate } from "../data/npcs";
import { QUEST_NPCS } from "../data/quests";
import type { CityData, CityShopData } from "../data/mapTypes";
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

/** Moving a merchant indoors retains their original palette; district clerks are deterministic too. */
export function resolveCityShopkeeperVisual(
  city: CityData, chunkIndex: number, shop: CityShopData,
): NpcVisualDescriptor {
  const source = shop.source ?? { chunkIndex, x: shop.x, y: shop.y };
  const shopIndex = city.shops.findIndex((entry) => entry.x === source.x && entry.y === source.y);
  const npcIndex = source.chunkIndex === 0 && shopIndex >= 0
    ? CITY_NPCS[city.id]?.findIndex((npc) => npc.shopIndex === shopIndex) ?? -1 : -1;
  if (npcIndex >= 0) return resolveNpcVisual(city.id, npcIndex);
  const template = getNpcTemplate(shop.type === "inn" ? "female_stout" : "male_tall");
  if (!template) throw new Error(`[NPC] Missing service clerk template for ${city.id}:${shop.name}.`);
  return {
    template,
    ...getNpcColors(`${city.id}:shop:${source.chunkIndex}:${shop.type}:${source.x},${source.y}`, 0),
  };
}

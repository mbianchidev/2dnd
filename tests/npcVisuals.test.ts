import { describe, expect, it, vi } from "vitest";
import { CITY_NPCS, getNpcColors } from "../src/data/npcs";
import { QUEST_NPCS } from "../src/data/quests";
import { CUTSCENES } from "../src/data/cutscenes";
import { getMonster } from "../src/data/monsters";
import { resolveNamedNpcVisual, resolveNpcVisual } from "../src/systems/npcVisuals";

describe("shared NPC appearance", () => {
  it("uses the same canonical instance and separate skin, hair and clothing colors in town and story scenes", () => {
    for (const npc of Object.values(QUEST_NPCS)) {
      const index = CITY_NPCS[npc.cityId].findIndex((instance) => instance.questNpcId === npc.id);
      const world = resolveNpcVisual(npc.cityId, index);
      expect(resolveNamedNpcVisual(npc.id)).toEqual(world);
      expect(world.template.id).toBe(CITY_NPCS[npc.cityId][index].templateId);
      expect(world.skinColor).toBe(getNpcColors(npc.cityId, index).skinColor);
      expect(world.dressColor).toBe(getNpcColors(npc.cityId, index).dressColor);
      if (world.template.id.includes("elder")) expect(world.hairColor).toBe(0xaaaaaa);
    }
  });

  it("resolves every cutscene character and boss to actual procedural actor art", () => {
    let characters = 0;
    let bosses = 0;
    for (const definition of Object.values(CUTSCENES)) {
      for (const step of definition.steps) {
        for (const actor of step.presentation?.actors ?? []) {
          if (actor.role === "character") {
            expect(resolveNamedNpcVisual(actor.npcId).template).toBeDefined();
            expect(actor).not.toHaveProperty("color");
            characters++;
          } else if (actor.role === "boss") {
            expect(getMonster(actor.id)?.isBoss, actor.id).toBe(true);
            bosses++;
          }
        }
      }
    }
    expect(characters).toBeGreaterThanOrEqual(24);
    expect(bosses).toBeGreaterThanOrEqual(10);
  });

  it("is deterministic, does not consume RNG and rejects an invalid canonical instance", () => {
    const random = vi.spyOn(Math, "random");
    try {
      expect(resolveNamedNpcVisual("willowdaleArchivist"))
        .toEqual(resolveNamedNpcVisual("willowdaleArchivist"));
      expect(random).not.toHaveBeenCalled();
      expect(() => resolveNpcVisual("missing_city", 0)).toThrow(/NPC/);
      expect(() => resolveNpcVisual("willowdale_city", -1)).toThrow(/NPC/);
    } finally {
      random.mockRestore();
    }
  });
});

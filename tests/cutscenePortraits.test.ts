import { describe, expect, it, vi } from "vitest";
import { CUTSCENE_IDS, getCutsceneDefinition } from "../src/data/cutscenes";
import { resolveCutscenePortraits } from "../src/systems/cutscenePortraits";
import { createHeroPortraitArt, createNpcPortraitArt } from "../src/systems/portraitArt";
import { resolveHeroVisualDescriptor } from "../src/systems/heroVisuals";
import { createCustomAppearance } from "../src/systems/appearance";
import { getPlayerClass } from "../src/systems/classes";
import { createPlayer } from "../src/systems/player";
import { resolveNamedNpcVisual } from "../src/systems/npcVisuals";
import type { CutsceneDialogueStep } from "../src/data/cutsceneTypes";

const player = () => createPlayer("Fixture", {
  strength: 12, dexterity: 12, constitution: 12, intelligence: 12, wisdom: 12, charisma: 12,
}, "bard", createCustomAppearance(getPlayerClass("bard")));

describe("canonical cutscene portraits", () => {
  it("binds every dialogue speaker to a stable staged actor and includes the actual hero", () => {
    const hero = player();
    for (const id of CUTSCENE_IDS) {
      for (const step of getCutsceneDefinition(id).steps) {
        if (step.type !== "dialogue") continue;
        const portraits = resolveCutscenePortraits(step, hero);
        expect(portraits.some((portrait) => portrait.actorId === step.speakerActorId && portrait.speaking), id).toBe(true);
        expect(portraits.some(({ kind }) => kind === "hero"), id).toBe(true);
        expect(portraits.filter(({ speaking }) => speaking)).toHaveLength(1);
        for (const portrait of portraits) {
          if (portrait.kind === "npc") expect(portrait.visual).toEqual(resolveNamedNpcVisual(portrait.npcId));
        }
      }
    }
  });

  it("uses the current hero cosmetics and canonical NPC palette with no invented player snapshot or RNG", () => {
    const hero = player();
    const beforeStats = JSON.stringify(hero.stats);
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Shared RNG used."); });
    try {
      const first = createHeroPortraitArt(resolveHeroVisualDescriptor(hero));
      hero.customAppearance = { ...hero.customAppearance!, hairStyle: 7, eyeColor: 0x78a799, headwear: false };
      expect(createHeroPortraitArt(resolveHeroVisualDescriptor(hero)).pixels).not.toEqual(first.pixels);
      const npc = resolveNamedNpcVisual("willowdaleArchivist");
      const portrait = createNpcPortraitArt(npc);
      expect(portrait.width).toBe(48);
      expect(portrait.height).toBe(48);
      expect(createNpcPortraitArt({ ...npc, skinColor: 0x76513b }).pixels).not.toEqual(portrait.pixels);
      expect(JSON.stringify(hero.stats)).toBe(beforeStats);
    } finally { random.mockRestore(); }
  });

  it("supports real hero dialogue IDs and rejects missing or mismatched speaker references", () => {
    const hero = player();
    const step: CutsceneDialogueStep = {
      type: "dialogue", speaker: "{hero}", speakerActorId: "hero", text: "Ready.",
      presentation: { backdrop: "city", actors: [{ role: "hero", id: "hero", label: "{hero}", slot: "left" }] },
    };
    expect(resolveCutscenePortraits(step, hero)).toEqual([
      expect.objectContaining({ kind: "hero", actorId: "hero", label: hero.name, speaking: true }),
    ]);
    expect(() => resolveCutscenePortraits({ ...step, speakerActorId: "unknown" }, hero)).toThrow("speaker");
  });
});

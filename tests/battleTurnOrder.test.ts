import { describe, expect, it, vi } from "vitest";
import { createBattleTurnOrderView } from "../src/systems/battleTurnOrder";
import { createHeroCombatant, createGroupCombatants } from "../src/systems/groupCombat";
import { createPlayer } from "../src/systems/player";
import { createSoloEncounter } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";

function fixture() {
  const hero = createHeroCombatant(createPlayer("Fixture", {
    strength: 12, dexterity: 12, constitution: 12, intelligence: 12, wisdom: 12, charisma: 12,
  }));
  const enemies = createGroupCombatants(createSoloEncounter(getMonster("slime")!));
  const first = enemies[0]!;
  const second = { ...first, id: "enemy:second", label: "Slime B", effects: [] };
  first.label = "Slime A";
  const actors = [hero, first, second];
  const order = [
    { combatantId: hero.id, initiative: 22 },
    { combatantId: first.id, initiative: 15 },
    { combatantId: second.id, initiative: 10 },
  ];
  return { hero, first, second, actors, order };
}

describe("visible battle order", () => {
  it("shows the current actor followed by the actual upcoming stable-ID initiative order", () => {
    const { actors, order, hero, first, second } = fixture();
    const view = createBattleTurnOrderView(order, actors, 1);
    expect(view.map(({ id }) => id)).toEqual([first.id, second.id, hero.id]);
    expect(view.map(({ current }) => current)).toEqual([true, false, false]);
    expect(view.map(({ label }) => label)).toEqual(["Slime A", "Slime B", "Fixture"]);
    expect(view.every((entry) => !("initiative" in entry) && !("currentHp" in entry))).toBe(true);
  });

  it("immediately removes killed monsters without splicing or advancing the canonical initiative chain", () => {
    const { actors, order, hero, first, second } = fixture();
    const before = JSON.stringify(order);
    first.currentHp = 0;
    first.isAlive = false;
    expect(createBattleTurnOrderView(order, actors, 0).map(({ id }) => id)).toEqual([hero.id, second.id]);
    expect(createBattleTurnOrderView(order, actors, 1).map(({ id }) => id)).toEqual([second.id, hero.id]);
    expect(createBattleTurnOrderView(order, actors, 1).some(({ current }) => current)).toBe(false);
    expect(JSON.stringify(order)).toBe(before);
  });

  it("excludes HP-zero and KO party actors and respects a remaining surprise queue", () => {
    const { actors, order, hero, first, second } = fixture();
    hero.currentHp = 0;
    expect(createBattleTurnOrderView(order, actors, 0).map(({ id }) => id)).toEqual([first.id, second.id]);
    const surprised = createBattleTurnOrderView(order, actors, 0, [second.id, first.id]);
    expect(surprised.map(({ id }) => id)).toEqual([second.id, first.id]);
    expect(surprised.map(({ current }) => current)).toEqual([true, false]);
    second.isKnockedOut = true;
    expect(createBattleTurnOrderView(order, actors, 0, [second.id, first.id]).map(({ id }) => id)).toEqual([first.id]);
  });

  it("never rolls or mutates actors and handles the legitimate pre-initiative empty state", () => {
    const { actors, order } = fixture();
    const before = JSON.stringify(actors);
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Shared RNG used."); });
    try {
      expect(createBattleTurnOrderView([], actors, 0)).toEqual([]);
      expect(createBattleTurnOrderView(order, actors, 0)).toEqual(createBattleTurnOrderView(order, actors, 0));
      expect(JSON.stringify(actors)).toBe(before);
      expect(() => createBattleTurnOrderView(order, actors, -1)).toThrow("initiative");
    } finally { random.mockRestore(); }
  });

  it("supports all eight actors while omitting KO companions and retaining duplicate monster letters", () => {
    const { hero, first, second } = fixture();
    const companions = ["Bram", "Kaia", "Selene"].map((label, index) => ({
      ...hero, id: `party:companion:${index}`, actorKind: "companion" as const, label,
    }));
    const enemies = [first, second,
      { ...first, id: "enemy:third", label: "Slime C" }, { ...first, id: "enemy:fourth", label: "Slime D" }];
    const actors = [hero, ...companions, ...enemies];
    const order = actors.map((actor, index) => ({ combatantId: actor.id, initiative: 30 - index }));
    expect(createBattleTurnOrderView(order, actors, 7)).toHaveLength(8);
    companions[1]!.isKnockedOut = true;
    expect(createBattleTurnOrderView(order, actors, 7).map(({ label }) => label))
      .toEqual(["Slime D", "Fixture", "Bram", "Selene", "Slime A", "Slime B", "Slime C"]);
  });
});

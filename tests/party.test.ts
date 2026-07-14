import { describe, expect, it } from "vitest";
import { getItem } from "../src/data/items";
import {
  applyKnockoutXpPenalty,
  createActivePartyCombatants,
  createPartyActionSources,
  createPartyState,
  recruitCompanion,
  setCompanionActive,
  transferPartyItem,
  xpFloorForLevel,
} from "../src/systems/party";
import { createPlayer, type PlayerStats } from "../src/systems/player";

const stats: PlayerStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createHero(level = 1) {
  const player = createPlayer("Hero", stats);
  player.level = level;
  player.xp = xpFloorForLevel(level);
  return player;
}

describe("party system", () => {
  it("creates an empty party for a new player", () => {
    const player = createHero();
    expect(player.party).toEqual(createPartyState());
    expect(player.party.companions).toEqual([]);
    expect(player.party.activeCompanionIds).toEqual([]);
  });

  it("recruits idempotently and activates the companion", () => {
    const player = createHero(5);
    const first = recruitCompanion(player, "guardian");
    const second = recruitCompanion(player, "guardian");

    expect(first.recruited).toBe(true);
    expect(second.recruited).toBe(false);
    expect(player.party.companions).toHaveLength(1);
    expect(player.party.activeCompanionIds).toEqual(["guardian"]);
    expect(first.companion?.level).toBe(5);
    expect(first.companion?.xp).toBe(xpFloorForLevel(5));
    expect(first.companion?.controlMode).toBe("manual");
  });

  it("matches recruitment stats deterministically without sharing inventory", () => {
    const firstPlayer = createHero(9);
    const secondPlayer = createHero(9);
    const first = recruitCompanion(firstPlayer, "mystic").companion!;
    const second = recruitCompanion(secondPlayer, "mystic").companion!;

    expect(first.maxHp).toBe(second.maxHp);
    expect(first.maxMp).toBe(second.maxMp);
    expect(first.knownSpells).toEqual(second.knownSpells);
    expect(first.inventory).not.toBe(second.inventory);
    expect(first.inventory[0]).not.toBe(second.inventory[0]);
  });

  it("rejects an unknown quest completion target", () => {
    const player = createHero();
    const result = recruitCompanion(player, "unknown");
    expect(result.recruited).toBe(false);
    expect(player.party.companions).toEqual([]);
  });

  it("maintains unique active IDs and enforces recruited membership", () => {
    const player = createHero();
    recruitCompanion(player, "guardian");
    recruitCompanion(player, "scout");
    recruitCompanion(player, "mystic");

    expect(player.party.activeCompanionIds).toEqual([
      "guardian",
      "scout",
      "mystic",
    ]);
    expect(setCompanionActive(player.party, "guardian", false).changed).toBe(
      true,
    );
    expect(setCompanionActive(player.party, "guardian", true).changed).toBe(
      true,
    );
    expect(new Set(player.party.activeCompanionIds).size).toBe(3);
    expect(setCompanionActive(player.party, "unknown", true).changed).toBe(
      false,
    );
  });

  it("transfers eligible items between separate bags", () => {
    const player = createHero();
    recruitCompanion(player, "guardian");
    player.inventory.push({ ...getItem("potion")! });
    const potionIndex = player.inventory.findIndex(
      (item) => item.id === "potion",
    );

    const result = transferPartyItem(
      player,
      "hero",
      "guardian",
      potionIndex,
    );
    const guardian = player.party.companions[0]!;

    expect(result.transferred).toBe(true);
    expect(player.inventory.some((item) => item.id === "potion")).toBe(false);
    expect(guardian.inventory.some((item) => item.id === "potion")).toBe(true);
  });

  it("does not transfer equipped, key, or mount items", () => {
    const player = createHero();
    recruitCompanion(player, "guardian");

    expect(
      transferPartyItem(player, "hero", "guardian", 0).transferred,
    ).toBe(false);

    player.inventory.push({ ...getItem("dungeonKey")! });
    expect(
      transferPartyItem(
        player,
        "hero",
        "guardian",
        player.inventory.length - 1,
      ).transferred,
    ).toBe(false);

    player.inventory.push({ ...getItem("mountHorse")! });
    expect(
      transferPartyItem(
        player,
        "hero",
        "guardian",
        player.inventory.length - 1,
      ).transferred,
    ).toBe(false);
  });

  it("creates accessor-backed combatants and action sources", () => {
    const player = createHero();
    const guardian = recruitCompanion(player, "guardian").companion!;
    const combatants = createActivePartyCombatants(player.party);
    const sources = createPartyActionSources(player.party, combatants);

    expect(combatants).toHaveLength(1);
    expect(sources).toHaveLength(1);
    combatants[0]!.currentHp -= 3;
    expect(guardian.hp).toBe(guardian.maxHp - 3);
    sources[0]!.state.mp -= 1;
    expect(guardian.mp).toBe(guardian.maxMp - 1);
  });

  it("resets knockout XP to the current-level floor exactly", () => {
    const player = createHero(5);
    const companion = recruitCompanion(player, "scout").companion!;
    companion.xp += 900;
    companion.pendingLevelUps = 2;

    applyKnockoutXpPenalty(companion);
    expect(companion.xp).toBe(xpFloorForLevel(5));
    expect(companion.pendingLevelUps).toBe(0);

    const levelOne = recruitCompanion(createHero(), "guardian").companion!;
    levelOne.xp = 350;
    applyKnockoutXpPenalty(levelOne);
    expect(levelOne.xp).toBe(0);
  });
});

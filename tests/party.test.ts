import { describe, expect, it } from "vitest";
import { getItem } from "../src/data/items";
import {
  applyPartyDefeat,
  applyKnockoutXpPenalty,
  createActivePartyCombatants,
  createPartyActionSources,
  createPartyState,
  distributePartyVictory,
  recruitCompanion,
  restPartyAtInn,
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

  it("awards living actors while penalizing a knocked-out hero", () => {
    const player = createHero(5);
    const companion = recruitCompanion(player, "guardian").companion!;
    const heroXp = player.xp + 700;
    player.xp = heroXp;
    const companionXp = companion.xp;
    const gold = player.gold;

    const result = distributePartyVictory(player, {
      outcome: "victory",
      defeatedEnemyIds: ["enemy"],
      survivingPartyIds: ["party:companion:guardian"],
      knockedOutPartyIds: ["party:hero"],
      rewards: { xp: 120, gold: 35 },
      droppedItemIds: [],
    });

    expect(player.gold).toBe(gold + 35);
    expect(player.xp).toBe(xpFloorForLevel(5));
    expect(companion.xp).toBe(companionXp + 120);
    expect(result.penalizedIds).toEqual(["party:hero"]);
    expect(result.xpRecipientIds).toEqual(["party:companion:guardian"]);
  });

  it("applies one full-party defeat recovery at the last town", () => {
    const player = createHero(5);
    const companion = recruitCompanion(player, "scout").companion!;
    player.gold = 100;
    player.xp += 500;
    companion.xp += 500;
    player.hp = 0;
    player.mp = 0;
    companion.hp = 0;
    companion.mp = 0;
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";
    player.lastTownX = 4;
    player.lastTownY = 5;
    player.lastTownChunkX = 6;
    player.lastTownChunkY = 7;

    applyPartyDefeat(player, [
      "party:hero",
      "party:companion:scout",
    ]);

    expect(player.gold).toBe(70);
    expect(player.hp).toBe(Math.max(1, Math.floor(player.maxHp / 2)));
    expect(companion.hp).toBe(
      Math.max(1, Math.floor(companion.maxHp / 2)),
    );
    expect(player.mp).toBe(Math.floor(player.maxMp / 2));
    expect(companion.mp).toBe(Math.floor(companion.maxMp / 2));
    expect(player.xp).toBe(xpFloorForLevel(5));
    expect(companion.xp).toBe(xpFloorForLevel(5));
    expect(player.position).toMatchObject({
      x: 4,
      y: 5,
      chunkX: 6,
      chunkY: 7,
      inDungeon: false,
      dungeonId: "",
    });
  });

  it("revives and restores every recruited member at an inn", () => {
    const player = createHero();
    const guardian = recruitCompanion(player, "guardian").companion!;
    const scout = recruitCompanion(player, "scout").companion!;
    player.hp = 1;
    player.mp = 0;
    guardian.hp = 0;
    guardian.mp = 0;
    scout.hp = 2;
    scout.mp = 1;

    restPartyAtInn(player);

    expect(player.hp).toBe(player.maxHp);
    expect(player.mp).toBe(player.maxMp);
    expect(guardian.hp).toBe(guardian.maxHp);
    expect(guardian.mp).toBe(guardian.maxMp);
    expect(scout.hp).toBe(scout.maxHp);
    expect(scout.mp).toBe(scout.maxMp);
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAIN_QUEST_ID } from "../src/data/quests";
import { getItem } from "../src/data/items";
import { getMonster } from "../src/data/monsters";
import { WeatherType } from "../src/systems/weather";
import { TimePeriod } from "../src/systems/daynight";
import { Terrain } from "../src/data/mapTypes";
import { PORTS } from "../src/data/nautical";
import { buildNewGamePlus } from "../src/systems/newGamePlus";
import { normalizeSaveData, createCurrentSaveData } from "../src/systems/save";
import { createCodex, recordDefeat } from "../src/systems/codex";
import { awardXP, xpForLevel } from "../src/systems/player";
import { prepareHeroLevelUp } from "../src/systems/classProgression";
import { recruitCompanion } from "../src/systems/party";
import { createDefaultGambitRule } from "../src/systems/gambits";
import { applyDevotionSource } from "../src/systems/devotion";
import { performTempleRite, visitDevotionTemple } from "../src/systems/devotionTemples";
import { reconcileAchievements } from "../src/systems/achievements";
import { startMinigame } from "../src/systems/minigames";
import { acquireBoat } from "../src/systems/nauticalOwnership";
import { createWorldEventState, forceWorldEvent } from "../src/systems/worldEvents";
import { createGatheringState, movePlayerNearGatheringNode, startGathering } from "../src/systems/gathering";
import { createHeroProgressionContext } from "../src/systems/classProgressionContext";
import { completeCampaignThroughOwners, createCompletedCampaign } from "./helpers/campaign";
import { reconcileQuestState } from "../src/systems/quests";
import { prestigeFixture, advancePrestige } from "./helpers/prestige";
import { playerAt, startRequest } from "./helpers/minigames";
import type { SaveData } from "../src/systems/save";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

function richCompletedSource(): SaveData {
  const player = prestigeFixture("prismScribe");
  advancePrestige(player, "prismScribe");
  const bosses = new Set<string>();
  completeCampaignThroughOwners(player, bosses);
  player.classProgression.debugTrackIds = ["prestige:prismScribe"];
  player.classProgression.legacyGrants.abilities = ["shieldBash"];
  player.knownAbilities.push("shieldBash");
  player.knownSpells = player.knownSpells.filter((id) => id !== "fireball");
  player.classProgression.deferredLegacyGrants = { spells: ["fireball"], abilities: [], talents: [] };
  player.customAppearance = { skinColor: 0xab9876, hairStyle: 2, hairColor: 0xabcdef };
  player.bankBalance = 321;
  player.lastBankDay = 4;
  player.progression.tutorial.completed = true;
  player.progression.trapGuidance = true;
  player.progression.openedChests = ["willow_chest"];
  player.progression.collectedTreasures = ["4,2,3,3"];
  player.progression.exploredTiles = { "4,2,3,3": true };
  player.progression.trapStates = { "fixture-trap": "disarmed" };
  const original = { ...player.inventory[0]!, id: "mockTwinStaff", name: "Mock staff", cost: 20 };
  const equipped = { ...original, name: "Mock inscribed staff", effect: original.effect + 2 };
  player.inventory.push(original, equipped, structuredClone(getItem("ironOre")!));
  player.equippedWeapon = equipped;
  for (const id of ["guardian", "scout", "mystic"] as const) {
    recruitCompanion(player, id);
    const member = player.party.companions.find((entry) => entry.id === id)!;
    member.hp = 0;
    member.mp = 0;
    member.controlMode = "gambit";
    member.gambits = [createDefaultGambitRule(`${id}-attack`, 1)];
    member.dialogueCursor = 3;
  }
  Object.assign(player.position, playerAt("willowInnTable").position);
  startMinigame(player, startRequest(player, "willowInnTable"));
  acquireBoat(player.progression.nautical, "merchantSloop");
  player.progression.nautical.ownedBoats[0]!.condition = 37;
  player.progression.nautical.ownedBoats[0]!.upgradeIds = ["reinforcedHull"];
  player.progression.nautical.discoveredPortIds = [PORTS[0].id];
  player.progression.nautical.stats.seaSteps = 20;
  player.progression.nautical.discoveredSeaTiles = ["s:covenantStrait,8,6,1,1"];
  Object.assign(player.position, { cityId: "willowdale_city", cityChunkIndex: 1, x: 10, y: 8 });
  player.progression.devotion.deityId = "orivane";
  visitDevotionTemple(player, "willowdaleSpan");
  performTempleRite(player, "willowdaleSpanThread");
  applyDevotionSource(player, "dispatchKept");
  player.progression.gathering = createGatheringState(123);
  Object.assign(player.position, { inCity: false, cityId: "", cityChunkIndex: 0 });
  const node = movePlayerNearGatheringNode(player, "mining");
  if (!node) throw new Error("Missing canonical mining fixture");
  startGathering(player, node, { timeStep: 90, weather: WeatherType.Clear, reducedMotion: true });
  player.progression.gathering.discoveredResourceIds = ["ironOre"];
  player.progression.gathering.claimedOutcomeIds = ["old-canonical-outcome"];
  player.progression.worldEvents = createWorldEventState(321);
  forceWorldEvent(player.progression.worldEvents, "moonlitShrine", {
    location: { chunkX: 4, chunkY: 2, x: 3, y: 3, terrain: Terrain.Grass, areaName: "Heartlands" },
    level: player.level, timeStep: 270, period: TimePeriod.Night, weather: WeatherType.Clear,
    quests: player.progression.quests, defeatedBosses: bosses, social: player.progression.social,
  });
  const codex = createCodex();
  recordDefeat(codex, getMonster("slime")!, true, []);
  reconcileAchievements({ player, defeatedBosses: bosses, codex }, { notify: false });
  awardXP(player, xpForLevel(20) - player.xp);
  prepareHeroLevelUp(player, () => 0.35);
  const source = normalizeSaveData(createCurrentSaveData(player, bosses, codex, player.appearanceId, 1500));
  if (!source) throw new Error("Invalid rich synthetic source");
  return source;
}

describe("explicit carry/reset across every campaign domain", () => {
  it("carries character authority and deep equipment links, without rest/reward/source mutations", () => {
    const source = richCompletedSource();
    const before = structuredClone(source);
    const random = vi.spyOn(Math, "random");
    random.mockClear();
    const built = buildNewGamePlus(source, "carry-matrix", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    const child = built.data;
    const hero = child.player;
    for (const key of ["name", "level", "xp", "stats", "classProgression", "pendingStatPoints",
      "appearanceId", "customAppearance", "bankBalance", "gold", "knownSpells", "knownAbilities",
      "knownTalents", "battleTiming", "difficulty"] as const) {
      expect(hero[key], key).toEqual(source.player[key]);
    }
    expect(hero.equippedWeapon).toBe(hero.inventory[hero.inventory.length - 2]);
    expect(hero.equippedWeapon).not.toBe(source.player.equippedWeapon);
    expect(hero.inventory[hero.inventory.length - 1]?.material)
      .not.toBe(source.player.inventory[source.player.inventory.length - 1]?.material);
    expect(hero.classProgression.pendingLevel).toEqual(source.player.classProgression.pendingLevel);
    expect(hero.classProgression.readyLevelUps).toBe(source.player.classProgression.readyLevelUps);
    for (const id of ["guardian", "scout", "mystic"] as const) {
      const carried = hero.party.companions.find((entry) => entry.id === id)!;
      const original = source.player.party.companions.find((entry) => entry.id === id)!;
      for (const key of ["level", "xp", "stats", "inventory", "controlMode", "gambits", "customAppearance"] as const) {
        expect(carried[key]).toEqual(original[key]);
      }
      expect(carried.hp).toBe(carried.maxHp);
      expect(carried.mp).toBe(carried.maxMp);
      expect(carried.activeEffects).toEqual([]);
      expect(carried.dialogueCursor).toBe(0);
      expect(carried.equippedWeapon).toBe(carried.inventory.find((item) => item.id === carried.equippedWeapon?.id));
      expect(hero.progression.seenCutsceneIds).toContain(`campaign.companion.${id}`);
    }
    expect(hero.party.activeCompanionIds).toEqual(source.player.party.activeCompanionIds);
    expect(child.codex).toEqual(source.codex);
    expect(hero.progression.devotion).toEqual(source.player.progression.devotion);
    expect(hero.progression.crafting).toEqual(source.player.progression.crafting);
    expect(hero.progression.gathering.stats).toEqual(source.player.progression.gathering.stats);
    expect(hero.progression.gathering.discoveredResourceIds).toEqual(source.player.progression.gathering.discoveredResourceIds);
    expect(hero.progression.gathering.claimedOutcomeIds).toEqual(source.player.progression.gathering.claimedOutcomeIds);
    expect(hero.progression.nautical.ownedBoats).toEqual(source.player.progression.nautical.ownedBoats);
    expect(hero.progression.minigames).toEqual({
      ...source.player.progression.minigames, pending: null,
      settledSequence: source.player.progression.minigames.sequence,
    });
    expect(hero.progression.social.alignment).toEqual(source.player.progression.social.alignment);
    expect(hero.progression.social.townReputation).toEqual({});
    expect(hero.progression.social.factionReputation).toEqual({});
    expect(hero.progression.social.appliedSourceIds).toEqual([]);
    expect(hero.progression.achievements.earned).toEqual(source.player.progression.achievements.earned);
    expect(hero.progression.achievements.unlockedTitleIds).toEqual(source.player.progression.achievements.unlockedTitleIds);
    expect(hero.progression.achievements.pendingNotificationIds).toEqual([]);
    expect(hero.progression.discoveredFeatureIds).toEqual(source.player.progression.discoveredFeatureIds);
    expect(hero.progression.pendingFeatureRevealIds).toEqual([]);
    expect(hero.hp).toBe(hero.maxHp);
    expect(hero.mp).toBe(hero.maxMp);
    expect(hero.activeEffects).toEqual([]);
    expect(hero.progression.trapGuidance).toBe(true);
    expect(hero.progression.tutorial.completed).toBe(true);
    expect(hero.lastBankDay).toBe(0);
    expect(child.timeStep).toBe(0);
    expect(child.playtimeSeconds).toBe(0);
    expect(child.defeatedBosses).toEqual([]);
    expect(hero.progression.openedChests).toEqual([]);
    expect(hero.progression.collectedTreasures).toEqual([]);
    expect(hero.progression.exploredTiles).toEqual({});
    expect(hero.progression.discoveredCities).toEqual([]);
    expect(hero.progression.skillChecks).toEqual({});
    expect(hero.progression.trapStates).toEqual({});
    expect(hero.progression.worldEvents.pending).toBeNull();
    expect(hero.progression.worldEvents.log).toEqual([]);
    expect(hero.progression.gathering.pending).toBeNull();
    expect(hero.progression.gathering.nodeStates).toEqual({});
    expect(hero.progression.nautical.sailing).toBe(false);
    expect(hero.progression.nautical.discoveredSeaTiles).toEqual([]);
    expect(hero.progression.nautical.stats.seaSteps).toBe(0);
    expect(hero.progression.quests.quests[MAIN_QUEST_ID].stage).toBe(0);
    expect(source).toEqual(before);
    expect(random).not.toHaveBeenCalled();
    const oldContext = createHeroProgressionContext(() => source.player);
    expect(oldContext).not.toBe(createHeroProgressionContext(() => hero));
    expect(applyDevotionSource(hero, "dispatchKept").changed).toBe(false);
    expect(hero.progression.devotion.score).toBe(source.player.progression.devotion.score);
  });

  it("renews the real campaign through 99 cycles without recreating sold or transferred unique grants", () => {
    let source = createCompletedCampaign("knight", 20);
    source.player.inventory = source.player.inventory.filter((item) =>
      item.id !== "dawnforgedBlade" && item.id !== "mountShadowSteed");
    for (let cycle = 1; cycle <= 99; cycle++) {
      const built = buildNewGamePlus(source, `multi-cycle-${cycle}`, 1000 + cycle, "1234abcd");
      if (!built.ok) throw new Error(built.message);
      expect(built.data.player.newGamePlus?.cycle).toBe(cycle);
      expect(built.data.player.progression.quests.quests[MAIN_QUEST_ID].status).toBe("active");
      const bosses = new Set<string>();
      completeCampaignThroughOwners(built.data.player, bosses);
      expect(built.data.player.progression.quests.quests[MAIN_QUEST_ID].status).toBe("completed");
      expect(built.data.player.inventory.map((item) => item.id)).not.toContain("dawnforgedBlade");
      expect(built.data.player.inventory.map((item) => item.id)).not.toContain("mountShadowSteed");
      const wallet = built.data.player.gold;
      reconcileQuestState(built.data.player, bosses);
      expect(built.data.player.gold).toBe(wallet);
      built.data.defeatedBosses = [...bosses];
      source = built.data;
    }
    expect(buildNewGamePlus(source, "beyond-cap", 2000, "1234abcd").ok).toBe(false);
  });
});

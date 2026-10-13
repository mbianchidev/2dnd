import { expect, type Page } from "@playwright/test";
import { CITY_NPCS } from "../../src/data/npcs";
import { MAIN_QUEST_ID, QUESTS, QUEST_NPCS } from "../../src/data/quests";
import { DUNGEONS, Terrain, getCity, getDungeonLevelMap, isWalkable } from "../../src/data/map";
import { getItem } from "../../src/data/items";
import { getSpell } from "../../src/data/spells";
import { EPIC_TRACK_ID } from "../../src/data/epicProgression";
import { createCampaignDifficulty, type DifficultySelection } from "../../src/systems/difficulty";
import { objectiveRequired } from "../../src/systems/quests";
import { allocateStatPoint, awardXP, xpForLevel } from "../../src/systems/player";
import { commitHeroLevelUp, prepareHeroLevelUp, prepareNextHeroLevelUp } from "../../src/systems/classProgression";
import { createHeroProgressionContext } from "../../src/systems/classProgressionContext";
import { buildNewGamePlus } from "../../src/systems/newGamePlus";
import { createCompanionState, restPartyAtInn } from "../../src/systems/party";
import { createDefaultGambitRule } from "../../src/systems/gambits";
import { createCompletedCampaign, completeCampaignThroughOwners } from "../../tests/helpers/campaign";
import type { PlayerPosition } from "../../src/systems/player";
import type { SaveData } from "../../src/systems/save";
import { clickLayoutItem, readLayoutReport } from "./layout";

const checkpointPages = new WeakSet<Page>();

export async function holdJourneyKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(90);
  await page.keyboard.up(key);
  await page.waitForTimeout(90);
}

/** Keep both edges in the renderer so runner/CDP latency cannot repeat a grid step. */
export async function stepJourneySouth(page: Page, position: string): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    const key = { key: "s", code: "KeyS", keyCode: 83, which: 83, bubbles: true };
    requestAnimationFrame(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", key));
      requestAnimationFrame(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", key));
        resolve();
      });
    });
  }));
  await expect(page.locator("#debug-state")).toContainText(position);
  await expect(page.locator("#debug-state")).toContainText("Move: ready");
}

export async function readJourneySave(page: Page): Promise<SaveData> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("2dnd_save");
    if (!raw) throw new Error("Missing actual journey autosave");
    return JSON.parse(raw) as SaveData;
  });
}

/** Synthetic completed source; XP/rest/grants use real owners, not edited rank or completion flags. */
export function createJourneySource(selection: DifficultySelection, parentCycle = 0): SaveData {
  const startingClass = selection.profileId === "legendary" ? "wizard" : "knight";
  let source = createCompletedCampaign(startingClass, 20);
  source.player.progression.tutorial.completed = true;
  for (let cycle = 1; cycle <= parentCycle; cycle++) {
    const built = buildNewGamePlus(source, `journey-parent-${cycle}`, 1000 + cycle, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    source = built.data;
    if (source.player.level < 30) {
      awardXP(source.player, xpForLevel(30) - source.player.xp);
      const context = createHeroProgressionContext(() => source.player);
      const prepared = prepareHeroLevelUp(source.player, () => 0.5);
      if (!prepared.ok) throw new Error(prepared.message);
      while (source.player.level < 30) {
        const applied = commitHeroLevelUp(source.player, {
          trackId: EPIC_TRACK_ID, expectedTotalLevel: source.player.level,
        }, context);
        if (!applied.ok) throw new Error(applied.message);
        if (source.player.level < 30) prepareNextHeroLevelUp(source.player, () => 0.5);
      }
    }
    const bosses = new Set<string>();
    completeCampaignThroughOwners(source.player, bosses);
    source.defeatedBosses = [...bosses];
  }
  const hero = source.player;
  while (hero.pendingStatPoints > 0) {
    const primary = startingClass === "wizard" ? "intelligence" : "strength";
    if (!allocateStatPoint(hero, hero.stats[primary] < 30 ? primary : "constitution")) {
      throw new Error("Cannot allocate source's actually earned ability point");
    }
  }
  hero.difficulty = createCampaignDifficulty(selection);
  hero.equippedWeapon = hero.inventory.find((item) => item.id === "dawnforgedBlade") ?? hero.equippedWeapon;
  for (const [id, slot] of [["plateArmor", "equippedArmor"], ["towerShield", "equippedShield"]] as const) {
    const item = getItem(id);
    if (!item) throw new Error(`Missing canonical synthetic owned gear ${id}`);
    const owned = structuredClone(item);
    hero.inventory.push(owned);
    hero[slot] = owned;
  }
  for (const id of ["guardian", "scout", "mystic"] as const) {
    const member = createCompanionState(id, 1, hero);
    awardXP(member, xpForLevel(hero.level));
    member.controlMode = "gambit";
    member.gambits = [createDefaultGambitRule(`${id}-journey-attack`, 3)];
    if (id === "mystic") {
      member.gambits.unshift({
        id: "journey-mass-heal", rank: 1, enabled: true,
        subject: { kind: "anyPartyMember" },
        condition: { kind: "resource", resource: "hp", scale: "percent", comparison: "<", value: 65 },
        action: { kind: "spell", spellId: "massHeal" }, target: { kind: "automatic" },
      }, {
        ...createDefaultGambitRule("journey-thunder", 2),
        action: { kind: "spell", spellId: "destructiveWave" },
      });
    }
    hero.party.companions.push(member);
    hero.party.activeCompanionIds.push(id);
  }
  const previousRandom = Math.random;
  try {
    Math.random = () => 0.5;
    restPartyAtInn(hero, true);
  } finally {
    Math.random = previousRandom;
  }
  for (const member of hero.party.companions) {
    const primary = member.id === "guardian" ? "strength" : member.id === "scout" ? "dexterity" : "wisdom";
    while (member.pendingStatPoints > 0) {
      const stat = member.stats[primary] < 30 ? primary : member.id === "mystic" ? "intelligence" : "constitution";
      if (!allocateStatPoint(member, stat)) throw new Error("Cannot allocate actually earned companion points");
    }
    const armor = structuredClone(getItem("plateArmor")!);
    member.inventory.push(armor);
    member.equippedArmor = armor;
  }
  return source;
}

function emptyInterior(position: PlayerPosition): PlayerPosition {
  return { ...position, inCity: false, cityId: "", cityChunkIndex: 0,
    inDungeon: false, dungeonId: "", dungeonLevel: 0 };
}

function npcCheckpoint(save: SaveData, targetId: string): PlayerPosition {
  const definition = Object.values(QUEST_NPCS).find((npc) => npc.id === targetId);
  const city = definition ? getCity(definition.cityId) : undefined;
  const npc = definition ? CITY_NPCS[definition.cityId]?.find((entry) => entry.questNpcId === targetId) : undefined;
  if (!city || !npc) throw new Error(`Missing live city NPC ${targetId}`);
  const adjacent = [[npc.x, npc.y + 1], [npc.x + 1, npc.y], [npc.x - 1, npc.y], [npc.x, npc.y - 1]]
    .find(([x, y]) => isWalkable(city.mapData[y!]?.[x!] ?? Terrain.CityWall));
  if (!adjacent) throw new Error(`No safe real approach to ${targetId}`);
  return { ...emptyInterior(save.player.position), inCity: true, cityId: city.id,
    chunkX: city.chunkX, chunkY: city.chunkY, x: adjacent[0]!, y: adjacent[1]! };
}

function bossCheckpoint(save: SaveData, bossId: string): PlayerPosition {
  const dungeon = DUNGEONS.find((entry) => entry.bossId === bossId);
  if (!dungeon) throw new Error(`Missing canonical keystone dungeon ${bossId}`);
  const level = dungeon.levels?.length ?? 0;
  const map = getDungeonLevelMap(dungeon, level);
  let tile: { x: number; y: number } | null = null;
  for (let y = 0; y < map.length; y++) {
    const x = map[y]!.indexOf(Terrain.DungeonBoss);
    if (x >= 0) { tile = { x, y }; break; }
  }
  if (!tile) throw new Error(`Missing actual boss tile ${bossId}`);
  return { ...emptyInterior(save.player.position), inDungeon: true, dungeonId: dungeon.id,
    dungeonLevel: level, chunkX: dungeon.entranceChunkX, chunkY: dungeon.entranceChunkY, ...tile };
}

/** Accelerate travel only; never edit quests, boss HP, rewards, actor resources or ending state. */
async function relocateCheckpoint(page: Page, position: PlayerPosition): Promise<void> {
  if (!checkpointPages.has(page)) {
    await page.addInitScript(() => {
      const pending = sessionStorage.getItem("ng-journey-next-position");
      if (!pending) return;
      const raw = localStorage.getItem("2dnd_save");
      if (!raw) throw new Error("Missing travel checkpoint");
      const save = JSON.parse(raw) as SaveData;
      save.player.position = JSON.parse(pending) as PlayerPosition;
      localStorage.setItem("2dnd_save", JSON.stringify(save));
      sessionStorage.removeItem("ng-journey-next-position");
    });
    checkpointPages.add(page);
  }
  await page.evaluate((next) => {
    sessionStorage.setItem("ng-journey-next-position", JSON.stringify(next));
  }, position);
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await drainJourneyScenes(page);
}

export async function drainJourneyScenes(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD") || state.includes("BATTLE") || state.includes("ENDING")) return;
    if (state.includes("CUTSCENE")) await holdJourneyKey(page, "Escape");
    else await page.waitForTimeout(100);
  }
  throw new Error(`Canonical scene queue did not finish: ${await page.locator("#debug-state").textContent()}`);
}

async function restAtActualInn(page: Page): Promise<void> {
  const save = await readJourneySave(page);
  const city = getCity("willowdale_city");
  const inn = city?.shops.find((shop) => shop.type === "inn");
  if (!city || !inn) throw new Error("Missing canonical recovery inn");
  const adjacent = [[inn.x, inn.y + 1], [inn.x + 1, inn.y], [inn.x - 1, inn.y], [inn.x, inn.y - 1]]
    .find(([x, y]) => isWalkable(city.mapData[y!]?.[x!] ?? Terrain.CityWall));
  if (!adjacent) throw new Error("No safe inn approach");
  await relocateCheckpoint(page, { ...emptyInterior(save.player.position), inCity: true,
    cityId: city.id, chunkX: city.chunkX, chunkY: city.chunkY, x: adjacent[0]!, y: adjacent[1]! });
  await holdJourneyKey(page, "Space");
  await page.waitForTimeout(400);
  const bounds = await page.locator("#game-container canvas").boundingBox();
  if (!bounds) throw new Error("Missing actual inn canvas");
  await page.mouse.click(bounds.x + 320 / 640 * bounds.width, bounds.y + 224 / 528 * bounds.height);
  await expect.poll(async () => {
    const restored = await readJourneySave(page);
    return restored.player.party.companions.every((member) => member.hp === member.maxHp && member.mp === member.maxMp)
      && restored.player.hp === restored.player.maxHp && restored.player.mp === restored.player.maxMp;
  }, { message: "Actual paid inn restores the entire party" }).toBe(true);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await page.locator("#debug-state").textContent())?.includes("[PROGRESSION:")) break;
    await holdJourneyKey(page, "Escape");
  }
}

async function winActualKeystoneBattle(page: Page, bossId: string): Promise<void> {
  await holdJourneyKey(page, "Space");
  await drainJourneyScenes(page);
  await expect(page.locator("#debug-state")).toContainText("BATTLE");
  const deadline = Date.now() + 150_000;
  const wizard = (await readJourneySave(page)).player.classProgression.startingClassId === "wizard";
  let acceptedDecisions = 0;
  while (Date.now() < deadline && acceptedDecisions < 160) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (!state.includes("BATTLE")) {
      await drainJourneyScenes(page);
      expect((await readJourneySave(page)).defeatedBosses).toContain(bossId);
      return;
    }
    if (state.includes("Phase: playerTurn")) {
      if (wizard && state.includes("[TARGET:-]")) {
        await clickLayoutItem(page, "battle-action-spells");
        const spellId = bossId === "frostWarden" ? "fireball"
          : bossId === "infernoForgemaster" ? "coneOfCold" : "disintegrate";
        const rowId = `battle-spell-${spellId}`;
        const knownRows = (await readJourneySave(page)).player.knownSpells
          .filter((id) => getSpell(id)?.type !== "utility").map((id) => `battle-spell-${id}`);
        const visibleRows = async (): Promise<string[]> => Object.values((await readLayoutReport(page)).groups)
          .flatMap((group) => group.items.map((item) => item.id)).filter((id) => knownRows.includes(id));
        await expect.poll(visibleRows, { message: "Fresh spell menu starts on its canonical first page" })
          .toContain(knownRows[0]);
        for (let menuPage = 0; menuPage < knownRows.length; menuPage++) {
          const ids = await visibleRows();
          if (ids.includes(rowId)) break;
          expect(ids, `Reached the final spell page without ${spellId}`).not.toContain(knownRows[knownRows.length - 1]);
          await clickLayoutItem(page, "battle-spell-next");
          await expect.poll(visibleRows, { message: "Accept the actual next page before reading its rows" })
            .not.toEqual(ids);
        }
        await clickLayoutItem(page, rowId);
      } else await holdJourneyKey(page, "Enter");
      acceptedDecisions++;
    }
    else await page.waitForTimeout(100);
  }
  throw new Error(`Actual keystone battle exceeded bounded decisions: ${bossId}; `
    + `${await page.locator("#debug-state").textContent()}`);
}

/** Play all required chapter objectives through actual dialogue and battle/ending controls. */
export async function playCanonicalNgCampaign(
  page: Page,
): Promise<{ talkNpcIds: string[]; defeatedBossIds: string[] }> {
  const talkNpcIds: string[] = [];
  const defeatedBossIds: string[] = [];
  await drainJourneyScenes(page);
  for (let objectiveIndex = 0; objectiveIndex < 40; objectiveIndex++) {
    const save = await readJourneySave(page);
    const progress = save.player.progression.quests.quests[MAIN_QUEST_ID];
    if (progress.status === "completed") {
      await drainJourneyScenes(page);
      await expect(page.locator("#debug-state")).toContainText("ENDING");
      return { talkNpcIds, defeatedBossIds };
    }
    const stage = QUESTS[MAIN_QUEST_ID].stages[progress.stage];
    const objective = stage?.objectives.find((entry) =>
      (progress.objectives[entry.id] ?? 0) < objectiveRequired(entry));
    if (!objective) throw new Error(`No unmet canonical objective at stage ${progress.stage}`);
    if (objective.type === "defeat") {
      if (defeatedBossIds.length > 0) await restAtActualInn(page);
      await relocateCheckpoint(page, bossCheckpoint(await readJourneySave(page), objective.targetId));
      await winActualKeystoneBattle(page, objective.targetId);
      defeatedBossIds.push(objective.targetId);
    } else {
      await relocateCheckpoint(page, npcCheckpoint(save, objective.targetId));
      for (let pageIndex = 0; pageIndex < 8; pageIndex++) {
        await holdJourneyKey(page, "Space");
        const latest = await readJourneySave(page);
        if ((latest.player.progression.quests.quests[MAIN_QUEST_ID].objectives[objective.id] ?? 0)
          >= objectiveRequired(objective)) break;
      }
      await expect.poll(async () =>
        (await readJourneySave(page)).player.progression.quests.quests[MAIN_QUEST_ID].objectives[objective.id] ?? 0,
      { message: `Real dialogue ${objective.id} at ${objective.targetId}` },
      ).toBeGreaterThanOrEqual(objectiveRequired(objective));
      talkNpcIds.push(objective.targetId);
      await drainJourneyScenes(page);
    }
  }
  throw new Error("Canonical NG+ chapter sequence did not reach final Elowen interaction");
}

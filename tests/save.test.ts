// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { saveGame, loadGame, deleteSave } from "../src/systems/save";
import { createPlayer } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createWeatherState } from "../src/systems/weather";
import { LEGACY_TRAP_SEED } from "../src/data/traps";
import { recruitCompanion } from "../src/systems/party";
import { getItem } from "../src/data/items";
import { QUEST_IDS } from "../src/data/quests";

describe("save system - PlayerState composition migration", () => {
  beforeEach(() => {
    deleteSave();
  });

  afterEach(() => {
    deleteSave();
  });

  it("saves PlayerState with nested position and progression", () => {
    const player = createPlayer("TestHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    
    // Modify some position fields
    player.position.x = 5;
    player.position.y = 7;
    player.position.chunkX = 2;
    player.position.chunkY = 3;
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";
    
    // Modify some progression fields
    player.progression.openedChests.push("chest1", "chest2");
    player.progression.collectedTreasures.push("2,3,5,7");
    player.progression.exploredTiles["2,3,5,7"] = true;
    player.progression.quests.ashenRoad.stage = 2;
    player.progression.skillChecks["shop:city:willowdale_city:0:0"] = {
      ability: "charisma",
      naturalRoll: 15,
      modifier: 1,
      total: 16,
      dc: 12,
      success: true,
      optionId: "persuade",
    };
    player.progression.trapSeed = 424242;
    player.progression.trapStates["heartlands:0:5,5:spikePit"] = "detected";
    player.progression.trapGuidance = true;
    
    const bestiary = createCodex();
    const weatherState = createWeatherState();
    
    saveGame(player, new Set(), bestiary, "knight", 100, weatherState);
    
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position.x).toBe(5);
    expect(loaded!.player.position.y).toBe(7);
    expect(loaded!.player.position.chunkX).toBe(2);
    expect(loaded!.player.position.chunkY).toBe(3);
    expect(loaded!.player.position.inDungeon).toBe(true);
    expect(loaded!.player.position.dungeonId).toBe("heartlands_dungeon");
    expect(loaded!.player.progression.openedChests).toEqual(["chest1", "chest2"]);
    expect(loaded!.player.progression.collectedTreasures).toEqual(["2,3,5,7"]);
    expect(loaded!.player.progression.exploredTiles["2,3,5,7"]).toBe(true);
    expect(loaded!.player.progression.quests.ashenRoad.stage).toBe(2);
    expect(loaded!.version).toBe(6);
    expect(loaded!.player.progression.skillChecks["shop:city:willowdale_city:0:0"]).toEqual({
      ability: "charisma",
      naturalRoll: 15,
      modifier: 1,
      total: 16,
      dc: 12,
      success: true,
      optionId: "persuade",
    });
    expect(loaded!.player.progression.trapSeed).toBe(424242);
    expect(loaded!.player.progression.trapStates).toEqual({
      "heartlands:0:5,5:spikePit": "detected",
    });
    expect(loaded!.player.progression.trapGuidance).toBe(true);
  });

  it("migrates old flat structure to new nested structure on load", () => {
    // Simulate an old save format with flat structure
    const oldSaveData = {
      version: 1,
      player: {
        name: "OldHero",
        level: 5,
        xp: 500,
        hp: 50,
        maxHp: 60,
        mp: 20,
        maxMp: 25,
        stats: {
          strength: 12,
          dexterity: 10,
          constitution: 14,
          intelligence: 10,
          wisdom: 10,
          charisma: 8,
        },
        pendingStatPoints: 0,
        gold: 100,
        inventory: [],
        knownSpells: ["shortRest"],
        knownAbilities: [],
        knownTalents: [],
        equippedWeapon: null,
        equippedArmor: null,
        equippedShield: null,
        appearanceId: "knight",
        // Old flat structure
        x: 8,
        y: 9,
        chunkX: 3,
        chunkY: 4,
        inDungeon: true,
        dungeonId: "heartlands_dungeon",
        inCity: false,
        cityId: "",
        openedChests: ["oldChest1", "oldChest2"],
        collectedTreasures: ["3,4,8,9"],
        exploredTiles: { "3,4,8,9": true },
        lastTownX: 2,
        lastTownY: 2,
        lastTownChunkX: 4,
        lastTownChunkY: 2,
        bankBalance: 0,
        lastBankDay: 0,
        mountId: "",
        shortRestsRemaining: 2,
        pendingLevelUps: 0,
      },
      defeatedBosses: [],
      bestiary: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
      timeStep: 50,
      weatherState: createWeatherState(),
    };
    
    // Save the old format directly to localStorage
    localStorage.setItem("2dnd_save", JSON.stringify(oldSaveData));
    
    // Load should migrate to new format
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    
    // Check that position fields are now nested
    expect(loaded!.player.position).toBeDefined();
    expect(loaded!.player.position.x).toBe(8);
    expect(loaded!.player.position.y).toBe(9);
    expect(loaded!.player.position.chunkX).toBe(3);
    expect(loaded!.player.position.chunkY).toBe(4);
    expect(loaded!.player.position.inDungeon).toBe(true);
    expect(loaded!.player.position.dungeonId).toBe("heartlands_dungeon");
    expect(loaded!.player.position.inCity).toBe(false);
    expect(loaded!.player.position.cityId).toBe("");
    
    // Check that progression fields are now nested
    expect(loaded!.player.progression).toBeDefined();
    expect(loaded!.player.progression.openedChests).toEqual(["oldChest1", "oldChest2"]);
    expect(loaded!.player.progression.collectedTreasures).toEqual(["3,4,8,9"]);
    expect(loaded!.player.progression.exploredTiles["3,4,8,9"]).toBe(true);
    expect(loaded!.player.progression.skillChecks).toEqual({});
    expect(loaded!.player.progression.quests.ashenRoad).toEqual({
      status: "active",
      stage: 0,
      rewardGranted: false,
    });
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
    
    // Check that old flat fields are removed
    const playerRecord = loaded!.player as unknown as Record<string, unknown>;
    expect(playerRecord["x"]).toBeUndefined();
    expect(playerRecord["y"]).toBeUndefined();
    expect(playerRecord["chunkX"]).toBeUndefined();
    expect(playerRecord["chunkY"]).toBeUndefined();
    expect(playerRecord["inDungeon"]).toBeUndefined();
    expect(playerRecord["dungeonId"]).toBeUndefined();
    expect(playerRecord["inCity"]).toBeUndefined();
    expect(playerRecord["cityId"]).toBeUndefined();
    expect(playerRecord["openedChests"]).toBeUndefined();
    expect(playerRecord["collectedTreasures"]).toBeUndefined();
    expect(playerRecord["exploredTiles"]).toBeUndefined();
  });

  it("handles missing position fields in old saves with defaults", () => {
    const oldSaveData = {
      version: 1,
      player: {
        name: "MinimalHero",
        level: 1,
        xp: 0,
        hp: 30,
        maxHp: 30,
        mp: 10,
        maxMp: 10,
        stats: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        pendingStatPoints: 0,
        gold: 50,
        inventory: [],
        knownSpells: [],
        knownAbilities: [],
        knownTalents: [],
        equippedWeapon: null,
        equippedArmor: null,
        equippedShield: null,
        appearanceId: "knight",
        // No position or progression fields at all
        lastTownX: 2,
        lastTownY: 2,
        lastTownChunkX: 4,
        lastTownChunkY: 2,
        bankBalance: 0,
        lastBankDay: 0,
        mountId: "",
        shortRestsRemaining: 2,
        pendingLevelUps: 0,
      },
      defeatedBosses: [],
      bestiary: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
    };
    
    localStorage.setItem("2dnd_save", JSON.stringify(oldSaveData));
    
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    
    // Should use default values
    expect(loaded!.player.position.x).toBe(3);
    expect(loaded!.player.position.y).toBe(3);
    expect(loaded!.player.position.chunkX).toBe(4);
    expect(loaded!.player.position.chunkY).toBe(2);
    expect(loaded!.player.position.inDungeon).toBe(false);
    expect(loaded!.player.position.dungeonId).toBe("");
    expect(loaded!.player.position.inCity).toBe(false);
    expect(loaded!.player.position.cityId).toBe("");
    
    expect(loaded!.player.progression.openedChests).toEqual([]);
    expect(loaded!.player.progression.collectedTreasures).toEqual([]);
    expect(loaded!.player.progression.exploredTiles).toEqual({});
    expect(loaded!.player.progression.quests.wardensDispatch.status).toBe("locked");
    expect(loaded!.player.progression.skillChecks).toEqual({});
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
  });

  it("clears unknown locations and restores a safe overworld position", () => {
    const player = createPlayer("LostHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.position = {
      x: 999,
      y: 999,
      chunkX: 999,
      chunkY: 999,
      inDungeon: true,
      dungeonId: "missing_dungeon",
      dungeonLevel: 99,
      inCity: true,
      cityId: "missing_city",
      cityChunkIndex: 99,
    };

    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position).toEqual({
      x: 3,
      y: 3,
      chunkX: 4,
      chunkY: 2,
      inDungeon: false,
      dungeonId: "",
      dungeonLevel: 0,
      inCity: false,
      cityId: "",
      cityChunkIndex: 0,
    });
  });

  it("clamps dungeon levels and moves blocked positions to the level spawn", () => {
    const player = createPlayer("DeepHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";
    player.position.dungeonLevel = 99;
    player.position.x = 0;
    player.position.y = 0;

    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position.dungeonLevel).toBe(1);
    expect(loaded!.player.position.x).toBe(1);
    expect(loaded!.player.position.y).toBe(13);
  });

  it("clamps city chunks and moves blocked positions to the district spawn", () => {
    const player = createPlayer("CityHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";
    player.position.cityChunkIndex = 99;
    player.position.x = 0;
    player.position.y = 0;

    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position.cityChunkIndex).toBe(1);
    expect(loaded!.player.position.x).toBe(10);
    expect(loaded!.player.position.y).toBe(1);
  });

  it("persists and normalizes active status effects", () => {
    const player = createPlayer("StatusHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.activeEffects = [
      { id: "poison", remainingTurns: 2, source: "Slime" },
    ];
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: { activeEffects: unknown[] };
    };
    stored.player.activeEffects = [
      ...stored.player.activeEffects,
      { id: "poison", remainingTurns: 5, source: "Spider" },
      { id: "burn", remainingTurns: "invalid" },
      { id: "unknown", remainingTurns: 3 },
    ];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.activeEffects).toEqual([
      { id: "poison", remainingTurns: 5, source: "Spider" },
      { id: "burn", remainingTurns: 3, source: "unknown" },
    ]);
  });

  it("normalizes malformed quest state without resetting valid progress", () => {
    const player = createPlayer("QuestSaver", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.quests.ashenRoad.stage = 2;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: {
        progression: {
          quests: Record<string, unknown>;
        };
      };
    };
    stored.player.progression.quests = {
      ashenRoad: {
        status: "active",
        stage: 2,
        rewardGranted: false,
      },
      wardensDispatch: {
        status: "completed",
        stage: "invalid",
        rewardGranted: false,
      },
      unknownQuest: {
        status: "active",
        stage: 1,
      },
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.quests.ashenRoad).toEqual({
      status: "active",
      stage: 2,
      rewardGranted: false,
    });
    expect(loaded!.player.progression.quests.wardensDispatch).toEqual({
      status: "completed",
      stage: 1,
      rewardGranted: true,
    });
    expect(Object.keys(loaded!.player.progression.quests)).toEqual(QUEST_IDS);
  });

  it("adds missing skill-check progression to older saves", () => {
    const player = createPlayer("LegacyChecks", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      version: number;
      player: { progression: Record<string, unknown> };
    };
    stored.version = 2;
    delete stored.player.progression["skillChecks"];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(6);
    expect(loaded!.player.progression.skillChecks).toEqual({});
    expect(loaded!.player.progression.quests.ashenRoad.status).toBe("active");
  });

  it("adds quest progression to schema-v3 skill-check saves", () => {
    const player = createPlayer("V3SkillHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.skillChecks["npc:willowdale:rumor"] = {
      ability: "wisdom",
      naturalRoll: 14,
      modifier: 1,
      total: 15,
      dc: 13,
      success: true,
    };
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      version: number;
      player: { progression: Record<string, unknown> };
    };
    stored.version = 3;
    delete stored.player.progression["quests"];
    delete stored.player.progression["trapSeed"];
    delete stored.player.progression["trapStates"];
    delete stored.player.progression["trapGuidance"];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(6);
    expect(loaded!.player.progression.quests.ashenRoad).toEqual({
      status: "active",
      stage: 0,
      rewardGranted: false,
    });
    expect(loaded!.player.progression.skillChecks["npc:willowdale:rumor"]).toEqual({
      ability: "wisdom",
      naturalRoll: 14,
      modifier: 1,
      total: 15,
      dc: 13,
      success: true,
    });
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
  });
  it("repairs valid skill-check totals and discards malformed records", () => {
    const player = createPlayer("CheckRepair", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: { progression: Record<string, unknown> };
    };
    stored.player.progression["skillChecks"] = {
      valid: {
        ability: "wisdom",
        naturalRoll: 15,
        modifier: 2,
        total: -99,
        dc: 14,
        success: false,
        optionId: " search ",
      },
      invalidAbility: {
        ability: "strength",
        naturalRoll: 10,
        modifier: 0,
        total: 10,
        dc: 10,
        success: true,
      },
      invalidRoll: {
        ability: "dexterity",
        naturalRoll: 21,
        modifier: 0,
        total: 21,
        dc: 10,
        success: true,
      },
      invalidModifier: {
        ability: "charisma",
        naturalRoll: 12,
        modifier: "2",
        total: 14,
        dc: 12,
        success: true,
      },
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.skillChecks).toEqual({
      valid: {
        ability: "wisdom",
        naturalRoll: 15,
        modifier: 2,
        total: 17,
        dc: 14,
        success: true,
        optionId: "search",
      },
    });
    expect(loaded!.player.progression.quests.ashenRoad.status).toBe("active");
  });

  it("adds trap progression to schema-v4 quest saves", () => {
    const player = createPlayer("V4QuestHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.quests.ashenRoad.stage = 2;
    player.progression.skillChecks["npc:willowdale:rumor"] = {
      ability: "wisdom",
      naturalRoll: 14,
      modifier: 1,
      total: 15,
      dc: 13,
      success: true,
    };
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      version: number;
      player: { progression: Record<string, unknown> };
    };
    stored.version = 4;
    delete stored.player.progression["trapSeed"];
    delete stored.player.progression["trapStates"];
    delete stored.player.progression["trapGuidance"];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(6);
    expect(loaded!.player.progression.quests.ashenRoad.stage).toBe(2);
    expect(loaded!.player.progression.skillChecks["npc:willowdale:rumor"])
      .toBeDefined();
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
  });

  it("preserves valid trap progression and filters invalid states", () => {
    const player = createPlayer("ValidTrap", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.trapSeed = 424242;
    player.progression.trapStates = {
      detectedTrap: "detected",
      triggeredTrap: "triggered",
    };
    player.progression.trapGuidance = true;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: { progression: Record<string, unknown> };
    };
    stored.player.progression["trapStates"] = {
      detectedTrap: "detected",
      triggeredTrap: "triggered",
      unknownTrap: "unknown",
      numericTrap: 4,
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.trapSeed).toBe(424242);
    expect(loaded!.player.progression.trapStates).toEqual({
      detectedTrap: "detected",
      triggeredTrap: "triggered",
    });
    expect(loaded!.player.progression.trapGuidance).toBe(true);
  });

  it("clears trap states when a malformed seed is replaced", () => {
    const player = createPlayer("CorruptTrap", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: { progression: Record<string, unknown> };
    };
    stored.player.progression["trapSeed"] = -10;
    stored.player.progression["trapStates"] = {
      staleTrap: "disarmed",
    };
    stored.player.progression["trapGuidance"] = "yes";
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
  });

  it("migrates rejected interim trap records and guidance item into v5 fields", () => {
    const player = createPlayer("InterimTrap", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      version: number;
      player: {
        inventory: unknown[];
        progression: Record<string, unknown>;
      };
    };
    stored.version = 3;
    delete stored.player.progression["trapSeed"];
    delete stored.player.progression["trapStates"];
    delete stored.player.progression["trapGuidance"];
    stored.player.progression["skillChecks"] = {
      "trap:layout": {
        ability: "wisdom",
        naturalRoll: 2,
        modifier: 0,
        total: 2,
        dc: 1,
        success: true,
        optionId: "layout:424242",
      },
      "trap:legacyDetected": {
        ability: "intelligence",
        naturalRoll: 20,
        modifier: 3,
        total: 23,
        dc: 13,
        success: true,
        optionId: "detect",
      },
      "trap:legacyTriggered": {
        ability: "dexterity",
        naturalRoll: 1,
        modifier: 2,
        total: 3,
        dc: 12,
        success: false,
        optionId: "triggered:disarm",
      },
      "npc:willowdale:rumor": {
        ability: "wisdom",
        naturalRoll: 14,
        modifier: 1,
        total: 15,
        dc: 13,
        success: true,
      },
    };
    stored.player.inventory.push({
      id: "adventurerTrapNotes",
      name: "Adventurer's Trap Notes",
      description: "Legacy guidance",
      type: "key",
      cost: 0,
      effect: 0,
      trapDetectionBonus: 2,
      trapDisarmBonus: 1,
    });
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(6);
    expect(loaded!.player.progression.trapSeed).toBe(424242);
    expect(loaded!.player.progression.trapStates).toEqual({
      legacyDetected: "detected",
      legacyTriggered: "triggered",
    });
    expect(loaded!.player.progression.trapGuidance).toBe(true);
    expect(
      loaded!.player.inventory.some(
        (item) => item.id === "adventurerTrapNotes",
      ),
    ).toBe(false);
    expect(loaded!.player.progression.skillChecks).toEqual({
      "npc:willowdale:rumor": {
        ability: "wisdom",
        naturalRoll: 14,
        modifier: 1,
        total: 15,
        dc: 13,
        success: true,
      },
    });
  });

  it("round-trips party state and persisted gambits in schema v6", () => {
    const player = createPlayer("PartySave", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    const guardian = recruitCompanion(player, "guardian").companion!;
    guardian.controlMode = "gambit";
    guardian.gambits.push({
      id: "heal-lowest",
      rank: 1,
      enabled: true,
      subject: { kind: "anyPartyMember" },
      condition: {
        kind: "resource",
        resource: "hp",
        scale: "percent",
        comparison: "<",
        value: 50,
      },
      action: { kind: "spell", spellId: "cureWounds" },
      target: { kind: "matchedSubject" },
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(6);
    expect(loaded!.player.party.activeCompanionIds).toEqual(["guardian"]);
    expect(loaded!.player.party.companions[0]!.controlMode).toBe("gambit");
    expect(loaded!.player.party.companions[0]!.gambits).toEqual(
      guardian.gambits,
    );
    expect(
      loaded!.player.party.companions[0]!.equippedWeapon,
    ).toBe(
      loaded!.player.party.companions[0]!.inventory.find(
        (item) => item.id === guardian.equippedWeapon?.id,
      ),
    );
  });

  it("adds an empty party to schema-v5 saves without changing prior domains", () => {
    const player = createPlayer("V5PartyMigration", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.quests.ashenRoad.stage = 2;
    player.progression.skillChecks["npc:test"] = {
      ability: "wisdom",
      naturalRoll: 12,
      modifier: 1,
      total: 13,
      dc: 10,
      success: true,
    };
    player.progression.trapSeed = 777;
    player.progression.trapStates.testTrap = "disarmed";
    player.progression.trapGuidance = true;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );
    const stored = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      version: number;
      player: Record<string, unknown>;
    };
    stored.version = 5;
    delete stored.player["party"];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(6);
    expect(loaded!.player.party).toEqual({
      companions: [],
      activeCompanionIds: [],
    });
    expect(loaded!.player.progression.quests.ashenRoad.stage).toBe(2);
    expect(loaded!.player.progression.skillChecks["npc:test"]).toBeDefined();
    expect(loaded!.player.progression.trapSeed).toBe(777);
    expect(loaded!.player.progression.trapStates.testTrap).toBe("disarmed");
    expect(loaded!.player.progression.trapGuidance).toBe(true);
  });

  it("repairs malformed party state and removes unknown nested IDs", () => {
    const player = createPlayer("CorruptParty", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    const guardian = recruitCompanion(player, "guardian").companion!;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );
    const stored = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      player: { party: Record<string, unknown> };
    };
    stored.player.party = {
      companions: [
        {
          ...guardian,
          hp: 9999,
          mp: -20,
          controlMode: "invalid",
          inventory: [
            { ...getItem("potion")! },
            { id: "unknownItem" },
          ],
          knownSpells: ["cureWounds", "unknownSpell"],
          knownAbilities: ["layOnHands", "unknownAbility"],
          knownTalents: ["toughness", "unknownTalent"],
          equippedWeapon: { id: "startSword" },
          activeEffects: [
            { id: "poison", remainingTurns: 2, source: "Slime" },
            { id: "unknown", remainingTurns: 99, source: "Bad" },
          ],
          gambits: [
            {
              id: "valid",
              rank: 8,
              enabled: true,
              subject: { kind: "self" },
              condition: { kind: "state", state: "alive" },
              action: { kind: "defend" },
              target: { kind: "self" },
            },
            {
              id: "bad",
              rank: 1,
              enabled: true,
              subject: { kind: "self" },
              condition: { kind: "state", state: "alive" },
              action: { kind: "spell", spellId: "unknownSpell" },
              target: { kind: "self" },
            },
          ],
        },
        guardian,
        { id: "unknownCompanion" },
      ],
      activeCompanionIds: [
        "guardian",
        "guardian",
        "unknownCompanion",
        "scout",
      ],
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.party.companions).toHaveLength(1);
    const repaired = loaded!.player.party.companions[0]!;
    expect(repaired.hp).toBe(repaired.maxHp);
    expect(repaired.mp).toBe(0);
    expect(repaired.controlMode).toBe("manual");
    expect(repaired.inventory.map((item) => item.id)).toEqual(["potion"]);
    expect(repaired.knownSpells).toEqual(["cureWounds"]);
    expect(repaired.knownAbilities).toEqual(["layOnHands"]);
    expect(repaired.knownTalents).toEqual(["toughness"]);
    expect(repaired.activeEffects).toEqual([
      { id: "poison", remainingTurns: 2, source: "Slime" },
    ]);
    expect(repaired.gambits).toHaveLength(1);
    expect(repaired.gambits[0]!.rank).toBe(1);
    expect(loaded!.player.party.activeCompanionIds).toEqual(["guardian"]);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { saveGame, loadGame, deleteSave } from "../src/systems/save";
import { createPlayer } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createWeatherState } from "../src/systems/weather";

// @vitest-environment happy-dom

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
    player.position.dungeonId = "testDungeon";
    
    // Modify some progression fields
    player.progression.openedChests.push("chest1", "chest2");
    player.progression.collectedTreasures.push("2,3,5,7");
    player.progression.exploredTiles["2,3,5,7"] = true;
    
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
    expect(loaded!.player.position.dungeonId).toBe("testDungeon");
    expect(loaded!.player.progression.openedChests).toEqual(["chest1", "chest2"]);
    expect(loaded!.player.progression.collectedTreasures).toEqual(["2,3,5,7"]);
    expect(loaded!.player.progression.exploredTiles["2,3,5,7"]).toBe(true);
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
        dungeonId: "oldDungeon",
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
    expect(loaded!.player.position.dungeonId).toBe("oldDungeon");
    expect(loaded!.player.position.inCity).toBe(false);
    expect(loaded!.player.position.cityId).toBe("");
    
    // Check that progression fields are now nested
    expect(loaded!.player.progression).toBeDefined();
    expect(loaded!.player.progression.openedChests).toEqual(["oldChest1", "oldChest2"]);
    expect(loaded!.player.progression.collectedTreasures).toEqual(["3,4,8,9"]);
    expect(loaded!.player.progression.exploredTiles["3,4,8,9"]).toBe(true);
    
    // Check that old flat fields are removed
    const playerAny = loaded!.player as any;
    expect(playerAny.x).toBeUndefined();
    expect(playerAny.y).toBeUndefined();
    expect(playerAny.chunkX).toBeUndefined();
    expect(playerAny.chunkY).toBeUndefined();
    expect(playerAny.inDungeon).toBeUndefined();
    expect(playerAny.dungeonId).toBeUndefined();
    expect(playerAny.inCity).toBeUndefined();
    expect(playerAny.cityId).toBeUndefined();
    expect(playerAny.openedChests).toBeUndefined();
    expect(playerAny.collectedTreasures).toBeUndefined();
    expect(playerAny.exploredTiles).toBeUndefined();
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
  });
});

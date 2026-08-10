// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCodex } from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";
import { deleteSave, loadGame, saveGame } from "../src/systems/save";
import {
  acquireBoat,
  createNauticalState,
  discoverPort,
} from "../src/systems/nautical";
import { createWeatherState } from "../src/systems/weather";

function createTestPlayer(): ReturnType<typeof createPlayer> {
  return createPlayer("Sea Saver", {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
}

function readRawSave(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem("2dnd_save")!) as Record<string, unknown>;
}

describe("schema-v16 nautical persistence", () => {
  beforeEach(() => deleteSave());
  afterEach(() => deleteSave());

  it("round-trips boat state, discoveries, statistics, and a valid sea location", () => {
    const player = createTestPlayer();
    const state = player.progression.nautical;
    acquireBoat(state, "merchantSloop");
    discoverPort(state, "sandportHarbor");
    state.sailing = true;
    state.heading = "north";
    state.stats.seaSteps = 14;
    player.position.chunkX = 4;
    player.position.chunkY = 2;
    player.position.x = 6;
    player.position.y = 0;

    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      120,
      createWeatherState(),
    );
    expect(readRawSave()["version"]).toBe(16);

    const loaded = loadGame()!;
    expect(loaded.player.progression.nautical).toMatchObject({
      activeBoatId: "merchantSloop",
      sailing: true,
      heading: "north",
    });
    expect(loaded.player.progression.nautical.discoveredPortIds).toContain(
      "sandportHarbor",
    );
    expect(loaded.player.progression.nautical.stats.seaSteps).toBe(14);
    expect(loaded.player.position).toMatchObject({
      chunkX: 4,
      chunkY: 2,
      x: 6,
      y: 0,
    });
  });

  it("migrates schema-v15 saves to a safe empty nautical state", () => {
    const player = createTestPlayer();
    saveGame(player, new Set(), createCodex(), "knight");
    const raw = readRawSave();
    raw["version"] = 15;
    const rawPlayer = raw["player"] as Record<string, unknown>;
    const progression = rawPlayer["progression"] as Record<string, unknown>;
    delete progression["nautical"];
    localStorage.setItem("2dnd_save", JSON.stringify(raw));

    const loaded = loadGame()!;
    expect(loaded.version).toBe(16);
    expect(loaded.player.progression.nautical).toEqual(createNauticalState());
  });

  it("removes unknown IDs and recovers malformed sailing to a safe port", () => {
    const player = createTestPlayer();
    saveGame(player, new Set(), createCodex(), "knight");
    const raw = readRawSave();
    const rawPlayer = raw["player"] as Record<string, unknown>;
    const progression = rawPlayer["progression"] as Record<string, unknown>;
    progression["nautical"] = {
      ownedBoats: [{
        id: "missingBoat",
        condition: -20,
        upgradeIds: ["missingUpgrade"],
      }],
      activeBoatId: "missingBoat",
      sailing: true,
      discoveredPortIds: ["missingPort"],
      discoveredRouteIds: ["missingRoute"],
      pendingHazard: { hazardId: "missingHazard" },
    };
    const position = rawPlayer["position"] as Record<string, unknown>;
    Object.assign(position, {
      chunkX: 0,
      chunkY: 0,
      x: 0,
      y: 0,
      inCity: false,
      inDungeon: false,
    });
    localStorage.setItem("2dnd_save", JSON.stringify(raw));

    const loaded = loadGame()!;
    expect(loaded.player.progression.nautical).toEqual(createNauticalState());
    expect(loaded.player.position).toMatchObject({
      chunkX: 4,
      chunkY: 2,
      x: 3,
      y: 3,
    });
  });

  it("recovers a valid boat from an invalid sea tile to the last known port", () => {
    const player = createTestPlayer();
    acquireBoat(player.progression.nautical, "merchantSloop");
    discoverPort(player.progression.nautical, "sandportHarbor");
    player.progression.nautical.sailing = true;
    player.position.chunkX = 4;
    player.position.chunkY = 2;
    player.position.x = 0;
    player.position.y = 0;
    saveGame(player, new Set(), createCodex(), "knight");

    const loaded = loadGame()!;
    expect(loaded.player.progression.nautical.sailing).toBe(false);
    expect(loaded.player.position).toMatchObject({
      chunkX: 5,
      chunkY: 2,
      x: 12,
      y: 6,
    });
  });
});

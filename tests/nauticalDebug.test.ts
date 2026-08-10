// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { createPlayer } from "../src/systems/player";
import { registerNauticalDebugCommands } from "../src/systems/nauticalDebug";
import type { Monster } from "../src/data/monsters";

function createHarness(): {
  player: ReturnType<typeof createPlayer>;
  commands: Map<string, (args: string) => void>;
  battles: Monster[];
} {
  const player = createPlayer("Debug Captain", {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
  const commands = new Map<string, (args: string) => void>();
  const battles: Monster[] = [];
  registerNauticalDebugCommands(commands, player, {
    autoSave: () => undefined,
    refreshWorld: () => undefined,
    startBattle: (monster) => battles.push(monster),
  });
  return { player, commands, battles };
}

describe("nautical debug commands", () => {
  it("registers validated boat, port, route, sailing, island, and sea commands", () => {
    const { commands } = createHarness();
    expect([...commands.keys()]).toEqual(expect.arrayContaining([
      "boat",
      "port",
      "route",
      "sail",
      "sea",
      "kraken",
      "island",
    ]));
  });

  it("mutates only known nautical IDs and starts canonical encounters", () => {
    const { player, commands, battles } = createHarness();
    commands.get("boat")!("merchantSloop");
    commands.get("port")!("sandportHarbor");
    commands.get("route")!("sandportTidehavenRun");
    commands.get("sail")!("on");
    commands.get("island")!("tideglassIsle");
    commands.get("kraken")!("");

    expect(player.progression.nautical.activeBoatId).toBe("merchantSloop");
    expect(player.progression.nautical.discoveredPortIds).toContain(
      "sandportHarbor",
    );
    expect(player.progression.nautical.discoveredRouteIds).toContain(
      "sandportTidehavenRun",
    );
    expect(player.progression.nautical.discoveredIslandIds).toContain(
      "tideglassIsle",
    );
    expect(battles.map((monster) => monster.id)).toEqual(["kraken"]);
  });
});

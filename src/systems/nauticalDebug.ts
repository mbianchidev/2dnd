import { debugPanelLog } from "../config";
import {
  BOATS,
  ISLANDS,
  MERCHANT_ROUTES,
  PORTS,
  SEA_DAY_MONSTERS,
  SEA_NIGHT_MONSTERS,
  getPort,
  isBoatId,
  isIslandId,
  isMerchantRouteId,
  isPortId,
} from "../data/nautical";
import { getMonster, type Monster } from "../data/monsters";
import type { PlayerState } from "./player";
import {
  acquireBoat,
  discoverPort,
  getActiveBoatState,
} from "./nautical";

type DebugCommand = (args: string) => void;

export interface NauticalDebugCallbacks {
  autoSave(): void;
  refreshWorld(): void;
  startBattle(monster: Monster): void;
}

function logLines(lines: readonly string[]): void {
  for (const line of lines) debugPanelLog(`[SEA] ${line}`, true);
}

export function registerNauticalDebugCommands(
  commands: Map<string, DebugCommand>,
  player: PlayerState,
  callbacks: NauticalDebugCallbacks,
): void {
  commands.set("boat", (args) => {
    const command = args.trim();
    if (!command || command === "list") {
      logLines(BOATS.map((boat) =>
        `${boat.id}: ${boat.name}, ${boat.price}g, deep=${boat.deepWaterCapable}`
      ));
      return;
    }
    if (command === "status") {
      const boat = getActiveBoatState(player.progression.nautical);
      logLines([
        `active=${boat?.id ?? "none"}`,
        `condition=${boat?.condition ?? 0}`,
        `upgrades=${boat?.upgradeIds.join(",") || "none"}`,
      ]);
      return;
    }
    if (!isBoatId(command)) {
      debugPanelLog(`[SEA] Unknown boat: ${command}`, true);
      return;
    }
    const result = acquireBoat(player.progression.nautical, command);
    player.progression.nautical.activeBoatId = command;
    callbacks.autoSave();
    callbacks.refreshWorld();
    debugPanelLog(
      `[SEA] ${result.acquired ? "Acquired" : "Selected"} ${command}`,
      true,
    );
  });

  commands.set("port", (args) => {
    const command = args.trim();
    if (!command || command === "list") {
      logLines(PORTS.map((port) => `${port.id}: ${port.name}`));
      return;
    }
    if (!isPortId(command)) {
      debugPanelLog(`[SEA] Unknown port: ${command}`, true);
      return;
    }
    discoverPort(player.progression.nautical, command);
    callbacks.autoSave();
    debugPanelLog(`[SEA] Discovered ${command}`, true);
  });

  commands.set("route", (args) => {
    const command = args.trim();
    if (!command || command === "list") {
      logLines(MERCHANT_ROUTES.map((route) =>
        `${route.id}: ${route.portIds.join(" ↔ ")} (${route.fee}g)`
      ));
      return;
    }
    if (!isMerchantRouteId(command)) {
      debugPanelLog(`[SEA] Unknown route: ${command}`, true);
      return;
    }
    if (!player.progression.nautical.discoveredRouteIds.includes(command)) {
      player.progression.nautical.discoveredRouteIds.push(command);
    }
    callbacks.autoSave();
    debugPanelLog(`[SEA] Discovered route ${command}`, true);
  });

  commands.set("sail", (args) => {
    const command = args.trim().toLowerCase();
    if (command === "on") {
      if (!getActiveBoatState(player.progression.nautical)) {
        acquireBoat(player.progression.nautical, "reedSkiff");
      }
      const port = getPort("tidehavenPort");
      Object.assign(player.position, {
        inCity: false,
        cityId: "",
        cityChunkIndex: 0,
        inDungeon: false,
        dungeonId: "",
        dungeonLevel: 0,
        chunkX: port.location.chunkX,
        chunkY: port.location.chunkY,
        x: port.location.tileX,
        y: port.location.tileY,
      });
      player.progression.nautical.sailing = true;
    } else if (command === "off") {
      player.progression.nautical.sailing = false;
      Object.assign(player.position, {
        chunkX: 4,
        chunkY: 2,
        x: 6,
        y: 1,
      });
    } else {
      debugPanelLog("[SEA] Usage: /sail on|off", true);
      return;
    }
    callbacks.autoSave();
    callbacks.refreshWorld();
    debugPanelLog(`[SEA] Sailing ${command}`, true);
  });

  commands.set("sea", (args) => {
    const command = args.trim();
    if (!command || command === "status") {
      const state = player.progression.nautical;
      logLines([
        `sailing=${state.sailing}`,
        `ports=${state.discoveredPortIds.length}/${PORTS.length}`,
        `routes=${state.discoveredRouteIds.length}/${MERCHANT_ROUTES.length}`,
        `islands=${state.discoveredIslandIds.length}/${ISLANDS.length}`,
        `steps=${state.stats.seaSteps}`,
      ]);
      return;
    }
    const monster = getMonster(command);
    const validSeaIds = [
      ...SEA_DAY_MONSTERS,
      ...SEA_NIGHT_MONSTERS,
      "kraken",
    ];
    if (!monster || !validSeaIds.includes(command)) {
      debugPanelLog(`[SEA] Unknown sea encounter: ${command}`, true);
      return;
    }
    callbacks.startBattle(monster);
  });

  commands.set("kraken", () => {
    const kraken = getMonster("kraken");
    if (kraken) callbacks.startBattle(kraken);
  });

  commands.set("island", (args) => {
    const command = args.trim();
    if (!command || command === "list") {
      logLines(ISLANDS.map((island) => `${island.id}: ${island.name}`));
      return;
    }
    if (!isIslandId(command)) {
      debugPanelLog(`[SEA] Unknown island: ${command}`, true);
      return;
    }
    const island = ISLANDS.find((candidate) => candidate.id === command)!;
    Object.assign(player.position, {
      inCity: false,
      cityId: "",
      inDungeon: false,
      dungeonId: "",
      chunkX: island.location.chunkX,
      chunkY: island.location.chunkY,
      x: island.location.tileX,
      y: island.location.tileY,
    });
    if (!player.progression.nautical.discoveredIslandIds.includes(command)) {
      player.progression.nautical.discoveredIslandIds.push(command);
    }
    callbacks.autoSave();
    callbacks.refreshWorld();
  });
}

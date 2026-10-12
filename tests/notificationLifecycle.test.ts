import * as Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AchievementNotificationManager } from "../src/managers/achievementNotifications";
import { CodexDiscoveryManager } from "../src/managers/codexDiscovery";
import { ShopScene } from "../src/scenes/Shop";
import { getItem } from "../src/data/items";
import { getCodexKnowledgeEntry } from "../src/data/codexKnowledge";
import { createCodex } from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";
import { reconcileAchievements, recordAchievementEvent } from "../src/systems/achievements";
import { createWeatherState } from "../src/systems/weather";
import type { NotificationPanelOptions } from "../src/renderers/notification";
import type { SavedSpecialNpc } from "../src/data/npcs";

const harness = vi.hoisted(() => {
  const containers: Container[] = [];
  const timers: Timer[] = [];
  const tweens: TweenOptions[] = [];
  const panels: NotificationPanelOptions[] = [];
  const state = { motion: false };
  class Container {
    destroyed = false;
    constructor() { containers.push(this); }
    setDepth(_depth: number): this { return this; }
    setAlpha(_alpha: number): this { return this; }
    destroy(_children = true): void { this.destroyed = true; }
  }
  class Timer {
    removed = false;
    constructor(readonly callback: () => void) { timers.push(this); }
    remove(_dispatch: boolean): void { this.removed = true; }
    fire(): void { this.callback(); }
  }
  interface TweenOptions {
    targets: Container;
    duration: number;
    alpha: number;
    onComplete?: () => void;
  }
  class Scene {
    readonly time = { delayedCall: (_duration: number, callback: () => void) => new Timer(callback) };
    readonly tweens = {
      add: (options: TweenOptions) => { tweens.push(options); },
      killTweensOf: vi.fn(),
    };
  }
  return { Scene, Container, containers, timers, tweens, panels, state };
});

vi.mock("phaser", () => ({ Scene: harness.Scene }));
vi.mock("../src/renderers/notification", () => ({
  renderNotificationPanel: (_scene: Phaser.Scene, options: NotificationPanelOptions) => {
    harness.panels.push(options);
    return new harness.Container();
  },
}));
vi.mock("../src/systems/accessibility", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/systems/accessibility")>(),
  getMotionDuration: (duration: number): number => harness.state.motion ? duration : 0,
}));
vi.mock("../src/config", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/config")>(),
  debugPanelLog: vi.fn(),
}));

function createContext(canShow = (): boolean => true): {
  manager: AchievementNotificationManager;
  player: ReturnType<typeof createPlayer>;
  acknowledged: ReturnType<typeof vi.fn>;
} {
  const player = createPlayer("Mock Notice", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  recordAchievementEvent(player, {
    type: "battleResolved",
    sourceId: "fixture:notice:oneHit",
    outcome: "victory",
    oneHitDefeats: 1,
    debug: false,
  });
  reconcileAchievements({ player, codex: createCodex(), defeatedBosses: new Set() }, {
    sourceId: "fixture:notice:oneHit", unlockedAt: 100,
  });
  const acknowledged = vi.fn();
  return {
    player,
    acknowledged,
    manager: new AchievementNotificationManager(new Phaser.Scene(), player, acknowledged, canShow),
  };
}

beforeEach(() => {
  harness.containers.length = 0;
  harness.timers.length = 0;
  harness.tweens.length = 0;
  harness.panels.length = 0;
  harness.state.motion = false;
});

describe("achievement notification ownership", () => {
  it("does not create a popup while a menu owns the screen", () => {
    const { manager, player, acknowledged } = createContext();
    manager.update(false);
    expect(harness.containers).toHaveLength(0);
    expect(player.progression.achievements.pendingNotificationIds).toEqual(["singleStroke"]);
    expect(acknowledged).not.toHaveBeenCalled();
  });

  it("removes an already visible popup when a menu opens without consuming it", () => {
    const { manager, player, acknowledged } = createContext();
    const before = structuredClone(player.progression.achievements);
    manager.update(true);
    manager.update(false);
    expect(harness.containers[0]!.destroyed).toBe(true);
    expect(harness.timers[0]!.removed).toBe(true);
    expect(player.progression.achievements).toEqual(before);
    expect(acknowledged).not.toHaveBeenCalled();
  });

  it("resumes the same earned notice and acknowledges it exactly once", () => {
    const { manager, player, acknowledged } = createContext();
    const before = structuredClone(player.progression.achievements);
    manager.update(true);
    manager.update(false);
    harness.timers[0]!.fire();
    expect(player.progression.achievements).toEqual(before);
    manager.update(true);
    expect(harness.containers).toHaveLength(2);
    harness.timers[0]!.fire();
    expect(acknowledged).not.toHaveBeenCalled();
    harness.timers[1]!.fire();
    harness.timers[1]!.fire();
    expect(player.progression.achievements).toEqual({
      ...before, pendingNotificationIds: [],
    });
    expect(acknowledged).toHaveBeenCalledTimes(1);
  });

  it("rejects a stale fade completion after interruption or replacement", () => {
    harness.state.motion = true;
    const { manager, player, acknowledged } = createContext();
    manager.update(true);
    harness.timers[0]!.fire();
    const fade = harness.tweens.find((tween) => tween.alpha === 0);
    expect(fade?.onComplete).toBeDefined();
    manager.update(false);
    fade!.onComplete!();
    expect(player.progression.achievements.pendingNotificationIds).toEqual(["singleStroke"]);
    expect(acknowledged).not.toHaveBeenCalled();
    manager.update(true);
    fade!.onComplete!();
    expect(harness.containers[1]!.destroyed).toBe(false);
  });

  it("checks live ownership when a menu opens on the dismissal frame", () => {
    let safe = true;
    const { manager, player, acknowledged } = createContext(() => safe);
    manager.update(true);
    safe = false;
    harness.timers[0]!.fire();
    expect(harness.containers[0]!.destroyed).toBe(true);
    expect(player.progression.achievements.pendingNotificationIds).toEqual(["singleStroke"]);
    expect(acknowledged).not.toHaveBeenCalled();
  });

  it("cleans up a shutdown without acknowledging queued feedback", () => {
    const { manager, player, acknowledged } = createContext();
    manager.update(true);
    manager.clear();
    harness.timers[0]!.fire();
    expect(harness.containers[0]!.destroyed).toBe(true);
    expect(harness.timers[0]!.removed).toBe(true);
    expect(player.progression.achievements.pendingNotificationIds).toEqual(["singleStroke"]);
    expect(acknowledged).not.toHaveBeenCalled();
  });
});

describe("Codex notice ownership", () => {
  const first = getCodexKnowledgeEntry("startSword");
  const second = getCodexKnowledgeEntry("heartlandsCrypt");
  if (!first || !second) throw new Error("Missing canonical Codex notice fixtures");

  it("retains immediate non-blocking presentation for Battle callers", () => {
    const manager = new CodexDiscoveryManager(new Phaser.Scene());
    manager.show([first]);
    expect(manager.isShowing()).toBe(true);
    expect(harness.panels[0]!.message).toContain(first.name);
    harness.timers[0]!.fire();
    expect(manager.isShowing()).toBe(false);
  });

  it("defers an interrupted notice until menus close and ignores its old timer", () => {
    const manager = new CodexDiscoveryManager(new Phaser.Scene());
    manager.show([first]);
    manager.update(false);
    expect(manager.isShowing()).toBe(false);
    expect(harness.containers[0]!.destroyed).toBe(true);
    expect(harness.timers[0]!.removed).toBe(true);
    harness.timers[0]!.fire();
    manager.update(true);
    expect(manager.isShowing()).toBe(true);
    expect(harness.panels[1]!.message).toBe(harness.panels[0]!.message);
    harness.timers[0]!.fire();
    expect(manager.isShowing()).toBe(true);
    harness.timers[1]!.fire();
    manager.update(true);
    expect(manager.isShowing()).toBe(false);
  });

  it("keeps the latest pending batch without rendering over an open menu", () => {
    const manager = new CodexDiscoveryManager(new Phaser.Scene());
    const snapshot = structuredClone([first, second]);
    manager.update(false);
    manager.show([first]);
    manager.show([second]);
    expect(harness.containers).toHaveLength(0);
    manager.update(true);
    expect(harness.panels[0]!.message).toContain(second.name);
    expect([first, second]).toEqual(snapshot);
  });

  it("cannot clear a resumed notice with a stale fade callback", () => {
    harness.state.motion = true;
    const manager = new CodexDiscoveryManager(new Phaser.Scene());
    manager.show([first]);
    harness.timers[0]!.fire();
    const fade = harness.tweens.find((tween) => tween.alpha === 0);
    expect(fade?.onComplete).toBeDefined();
    manager.update(false);
    manager.update(true);
    fade!.onComplete!();
    expect(manager.isShowing()).toBe(true);
    manager.clear();
    manager.update(true);
    expect(manager.isShowing()).toBe(false);
    expect(harness.containers).toHaveLength(2);
  });

  it("defers both creation and dismissal against the current menu owner", () => {
    let safe = false;
    const manager = new CodexDiscoveryManager(new Phaser.Scene(), () => safe);
    manager.show([first]);
    expect(manager.isShowing()).toBe(false);
    safe = true;
    manager.update(true);
    expect(manager.isShowing()).toBe(true);
    safe = false;
    harness.timers[0]!.fire();
    expect(manager.isShowing()).toBe(false);
    safe = true;
    manager.update(true);
    expect(manager.isShowing()).toBe(true);
  });
});

describe("Shop notice handoff", () => {
  function shopContext(): {
    shop: ShopScene;
    item: NonNullable<ReturnType<typeof getItem>>;
    shared: {
      player: ReturnType<typeof createPlayer>;
      codex: ReturnType<typeof createCodex>;
      defeatedBosses: Set<string>;
      timeStep: number;
      weatherState: ReturnType<typeof createWeatherState>;
      savedSpecialNpcs: SavedSpecialNpc[];
    };
    start: ReturnType<typeof vi.fn>;
    complete(): void;
  } {
    const shop = new ShopScene();
    const item = getItem("potion");
    if (!item) throw new Error("Missing canonical shop notice fixture");
    const player = createPlayer("Mock Buyer", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.gold = 100;
    const savedSpecialNpcs: SavedSpecialNpc[] = [{ kind: "hermit", x: 4, y: 6, interactions: 1 }];
    const shared = {
      player, codex: createCodex(), defeatedBosses: new Set(["cryptLich"]),
      timeStep: 45, weatherState: createWeatherState(),
      savedSpecialNpcs,
    };
    shop.init({ ...shared, townName: "Mock Shop", shopItemIds: [item.id] });
    const start = vi.fn();
    let handoff: (() => void) | undefined;
    Object.assign(shop, {
      setMessage: vi.fn(), updateDisplay: vi.fn(), renderItems: vi.fn(),
      scene: { start },
      sceneTransitions: {
        startWithFade: (callback: () => void): boolean => {
          handoff = callback;
          return true;
        },
      },
    });
    return {
      shop, item, shared, start,
      complete: () => {
        if (!handoff) throw new Error("The shop handoff was not queued");
        handoff();
      },
    };
  }

  it("keeps lore off shop menus and carries exact new IDs with the full shared state", () => {
    const { shop, item, shared, start, complete } = shopContext();
    const count = shared.player.inventory.length;
    shop["purchaseItem"](item);
    shop["purchaseItem"](item);
    expect(shared.player.gold).toBe(100 - item.cost * 2);
    expect(shared.player.inventory).toHaveLength(count + 2);
    expect(shared.codex.unlockedEntryIds).toContain(item.id);
    expect(harness.panels).toHaveLength(0);
    shop["leaveShop"]();
    expect(start).not.toHaveBeenCalled();
    complete();
    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith("OverworldScene", {
      ...shared, codexDiscoveryIds: [item.id],
    });
  });

  it("does not queue lore or charge for a rejected purchase", () => {
    const { shop, item, shared, start, complete } = shopContext();
    shared.player.gold = 0;
    const inventory = [...shared.player.inventory];
    shop["purchaseItem"](item);
    expect(shared.player.gold).toBe(0);
    expect(shared.player.inventory).toEqual(inventory);
    expect(shared.codex.unlockedEntryIds).not.toContain(item.id);
    shop["leaveShop"]();
    complete();
    expect(start).toHaveBeenCalledWith("OverworldScene", shared);
  });

  it("resets runtime notices when a Shop scene is reused", () => {
    const { shop, item, shared, start, complete } = shopContext();
    shop["purchaseItem"](item);
    shop.init({ ...shared, townName: "Mock Return", shopItemIds: [item.id] });
    shop["leaveShop"]();
    complete();
    expect(start).toHaveBeenCalledWith("OverworldScene", shared);
  });
});

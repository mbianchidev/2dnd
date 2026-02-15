/**
 * SpecialNpcManager — manages rare special NPCs that spawn on the overworld.
 *
 * Handles spawning, wandering, interaction, persistence across scene
 * transitions, and despawning of traveler, adventurer, wandering merchant,
 * and hermit NPCs.
 */

import {
  getNpcTemplate,
  getSpecialNpcDialogue,
  rollSpecialNpcSpawns,
  SPECIAL_NPC_DEFS,
  SPECIAL_NPC_FAREWELLS,
  NPC_SKIN_COLORS,
  type SavedSpecialNpc,
  type SpecialNpcKind,
  type SpecialNpcDef,
} from "../data/npcs";
import { MAP_WIDTH, MAP_HEIGHT, isWalkable, type WorldChunk } from "../data/map";
import { CYCLE_LENGTH } from "../systems/daynight";
import { audioEngine } from "../systems/audio";
import { debugPanelLog, TILE_SIZE } from "../config";
import type { CityRenderer } from "../renderers/city";
import type { DialogueSystem } from "./dialogue";

/** Callbacks the caller (OverworldScene) provides so the manager can trigger auto-saves and shop transitions. */
export interface SpecialNpcCallbacks {
  autoSave: () => void;
  startShopScene: (config: {
    townName: string;
    shopItemIds: string[];
    discount: number;
    savedSpecialNpcs: SavedSpecialNpc[];
  }) => void;
}

export class SpecialNpcManager {
  private scene: Phaser.Scene;
  specialNpcSprites: Phaser.GameObjects.Sprite[] = [];
  specialNpcTimers: Phaser.Time.TimerEvent[] = [];
  specialNpcDefs: { def: SpecialNpcDef; x: number; y: number; interactions: number }[] = [];
  pendingSpecialSpawns: SpecialNpcKind[] = [];
  savedSpecialNpcs: SavedSpecialNpc[] = [];
  lastSpecialSpawnDay = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Spawn rare special NPCs on the overworld (traveler, adventurer,
   * wandering merchant, hermit).  Restores saved NPCs from scene
   * transitions, uses forced queues, or rolls random spawns.
   */
  spawnSpecialNpcs(
    chunk: WorldChunk,
    timeStep: number,
    cityRenderer: CityRenderer,
    showMessage: (text: string, color?: string) => void,
    isExplored: (x: number, y: number) => boolean,
  ): void {
    // If we have saved special NPCs from a scene transition, restore them.
    if (this.savedSpecialNpcs.length > 0) {
      for (const saved of this.savedSpecialNpcs) {
        const def = SPECIAL_NPC_DEFS[saved.kind];
        this.placeSpecialNpcSprite(def, chunk, saved.x, saved.y, saved.interactions, cityRenderer);
      }
      this.savedSpecialNpcs = [];
      return;
    }

    // Determine which specials to spawn — use forced queue or random roll
    let toSpawn: SpecialNpcKind[];
    if (this.pendingSpecialSpawns.length > 0) {
      toSpawn = [...this.pendingSpecialSpawns];
      this.pendingSpecialSpawns = [];
    } else {
      // After a special NPC spawns, drop chance to 0 until the next day
      const currentDay = Math.floor(timeStep / CYCLE_LENGTH);
      const multiplier = currentDay === this.lastSpecialSpawnDay ? 0 : 1;
      toSpawn = rollSpecialNpcSpawns(multiplier);
      if (toSpawn.length > 0) {
        this.lastSpecialSpawnDay = currentDay;
      }
    }
    if (toSpawn.length === 0) return;

    // Find walkable positions that aren't occupied by towns, bosses, etc.
    const occupied = new Set<string>();
    for (const town of chunk.towns) occupied.add(`${town.x},${town.y}`);
    for (const boss of chunk.bosses) occupied.add(`${boss.x},${boss.y}`);
    const walkable: { x: number; y: number }[] = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        if (
          isWalkable(chunk.mapData[y][x]) &&
          !occupied.has(`${x},${y}`) &&
          isExplored(x, y)
        ) {
          walkable.push({ x, y });
        }
      }
    }
    if (walkable.length === 0) return;

    for (const kind of toSpawn) {
      const def = SPECIAL_NPC_DEFS[kind];

      // Pick a random spawn position
      const posIdx = Math.floor(Math.random() * walkable.length);
      const pos = walkable[posIdx];
      walkable.splice(posIdx, 1);

      this.placeSpecialNpcSprite(def, chunk, pos.x, pos.y, 0, cityRenderer);
      showMessage(`A ${def.label} has appeared!`, "#4dd0e1");
      if (walkable.length === 0) break;
    }
  }

  /**
   * Find a special NPC adjacent to or on the given player position.
   */
  findAdjacentSpecialNpc(playerX: number, playerY: number): { index: number; def: SpecialNpcDef } | null {
    const px = playerX;
    const py = playerY;
    const checks = [
      { x: px, y: py },
      { x: px - 1, y: py }, { x: px + 1, y: py },
      { x: px, y: py - 1 }, { x: px, y: py + 1 },
    ];

    for (let i = 0; i < this.specialNpcDefs.length; i++) {
      const spr = this.specialNpcSprites[i];
      if (!spr || !spr.active) continue;
      const nx = Math.floor(spr.x / TILE_SIZE);
      const ny = Math.floor(spr.y / TILE_SIZE);
      for (const c of checks) {
        if (c.x === nx && c.y === ny) {
          return { index: i, def: this.specialNpcDefs[i].def };
        }
      }
    }
    return null;
  }

  /**
   * Show dialogue for a special NPC; despawn after all unique lines are
   * exhausted.  Wandering merchants open the shop scene on interaction.
   */
  interactSpecialNpc(
    index: number,
    dialogueSystem: DialogueSystem,
    callbacks: SpecialNpcCallbacks,
    regionName: string,
  ): void {
    const entry = this.specialNpcDefs[index];
    if (!entry) return;

    const line = getSpecialNpcDialogue(entry.def.kind, entry.interactions);
    const farewell = SPECIAL_NPC_FAREWELLS[entry.def.kind];
    const isFarewell = line === farewell;
    entry.interactions++;

    if (audioEngine.initialized) audioEngine.playDialogueBlips(line);

    // If this is the farewell line, show it then despawn after a short delay.
    if (isFarewell) {
      // Wandering merchant still opens shop on farewell, but despawns after.
      if (entry.def.kind === "wanderingMerchant") {
        dialogueSystem.showSpecialDialogue(entry.def.label, line);
        this.scene.time.delayedCall(800, () => {
          dialogueSystem.dismissDialogue();
          callbacks.autoSave();
          callbacks.startShopScene({
            townName: `${regionName} - Wandering Merchant`,
            shopItemIds: entry.def.shopItems ?? ["potion", "ether"],
            discount: 0.2,
            savedSpecialNpcs: this.snapshotSpecialNpcs().filter((s) => s.kind !== entry.def.kind),
          });
        });
        return;
      }

      dialogueSystem.showSpecialDialogue(entry.def.label, line);
      this.scene.time.delayedCall(1500, () => {
        dialogueSystem.dismissDialogue();
        const spr = this.specialNpcSprites[index];
        if (spr && spr.active) {
          this.scene.tweens.add({
            targets: spr,
            alpha: 0,
            duration: 600,
            onComplete: () => spr.destroy(),
          });
        }
      });
      return;
    }

    // Wandering merchant — show dialogue then open shop (preserving special NPCs)
    if (entry.def.kind === "wanderingMerchant") {
      dialogueSystem.showSpecialDialogue(entry.def.label, line);
      this.scene.time.delayedCall(800, () => {
        dialogueSystem.dismissDialogue();
        callbacks.autoSave();
        callbacks.startShopScene({
          townName: `${regionName} - Wandering Merchant`,
          shopItemIds: entry.def.shopItems ?? ["potion", "ether"],
          discount: 0.2,
          savedSpecialNpcs: this.snapshotSpecialNpcs(),
        });
      });
      return;
    }

    // Regular dialogue for traveler / adventurer / hermit
    dialogueSystem.showSpecialDialogue(entry.def.label, line);
  }

  /** Snapshot active special NPCs so they survive scene transitions. */
  snapshotSpecialNpcs(): SavedSpecialNpc[] {
    return this.specialNpcDefs
      .filter((_entry, i) => {
        const spr = this.specialNpcSprites[i];
        return spr && spr.active;
      })
      .map((entry) => ({
        kind: entry.def.kind,
        x: entry.x,
        y: entry.y,
        interactions: entry.interactions,
      }));
  }

  /** Destroy all special NPC sprites, timers, and reset tracking arrays. */
  clearAll(): void {
    for (const spr of this.specialNpcSprites) {
      if (spr && spr.active) spr.destroy();
    }
    for (const timer of this.specialNpcTimers) {
      timer.remove();
    }
    this.specialNpcSprites = [];
    this.specialNpcTimers = [];
    this.specialNpcDefs = [];
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /** Create a special NPC sprite + wander logic at the given tile position. */
  private placeSpecialNpcSprite(
    def: SpecialNpcDef,
    chunk: WorldChunk,
    tx: number,
    ty: number,
    interactions: number,
    cityRenderer?: CityRenderer,
  ): void {
    const tpl = getNpcTemplate(def.templateId);
    if (!tpl) return;
    debugPanelLog(`[NPC] Spawned ${def.kind} at (${tx},${ty})`, true);

    const specialSkin = NPC_SKIN_COLORS[Math.abs(def.kind.length * 7) % NPC_SKIN_COLORS.length];
    const texKey = cityRenderer
      ? cityRenderer.getOrCreateNpcTexture(tpl, specialSkin, 0x5d4037, def.tintColor)
      : `npc_${tpl.id}_${specialSkin.toString(16)}_${(0x5d4037).toString(16)}_${def.tintColor.toString(16)}`;
    const sprite = this.scene.add.sprite(
      tx * TILE_SIZE + TILE_SIZE / 2,
      ty * TILE_SIZE + TILE_SIZE / 2,
      texKey,
    );
    sprite.setDepth(11);

    this.specialNpcSprites.push(sprite);
    this.specialNpcDefs.push({ def, x: tx, y: ty, interactions });

    if (def.moves) {
      const wander = (): void => {
        const dirs = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        ];
        const pick = dirs[Math.floor(Math.random() * dirs.length)];
        const curTileX = Math.floor(sprite.x / TILE_SIZE);
        const curTileY = Math.floor(sprite.y / TILE_SIZE);
        const nx = curTileX + pick.dx;
        const ny = curTileY + pick.dy;
        if (
          nx >= 1 && nx < MAP_WIDTH - 1 &&
          ny >= 1 && ny < MAP_HEIGHT - 1 &&
          isWalkable(chunk.mapData[ny][nx])
        ) {
          this.scene.tweens.add({
            targets: sprite,
            x: nx * TILE_SIZE + TILE_SIZE / 2,
            y: ny * TILE_SIZE + TILE_SIZE / 2,
            duration: 800 + Math.random() * 400,
            ease: "Sine.easeInOut",
            onUpdate: () => {
              if (pick.dx !== 0) sprite.setFlipX(pick.dx < 0);
            },
          });
        }
      };
      const delay = 2000 + Math.random() * 2000;
      const timer = this.scene.time.addEvent({ delay, callback: wander, loop: true });
      this.specialNpcTimers.push(timer);
    } else {
      this.scene.tweens.add({
        targets: sprite,
        scaleY: 0.97,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }
}

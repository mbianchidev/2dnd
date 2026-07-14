import * as Phaser from "phaser";
import { TILE_SIZE } from "../config";
import { getCompanionDefinition } from "../data/companions";
import type { CompanionId } from "../data/companions";
import {
  generateCompanionTexture,
} from "../renderers/characterTextures";
import {
  getCompanion,
  type CompanionState,
  type PartyState,
} from "../systems/party";
import type { PlayerState } from "../systems/player";

export interface FollowerTile {
  x: number;
  y: number;
}

export function advanceFollowerTrail(
  current: FollowerTile[],
  leaderPrevious: FollowerTile,
  followerCount: number,
): FollowerTile[] {
  if (followerCount <= 0) return [];
  const next: FollowerTile[] = [{ ...leaderPrevious }];
  for (let index = 1; index < followerCount; index++) {
    next.push({ ...(current[index - 1] ?? leaderPrevious) });
  }
  return next;
}

export class CompanionFollowerManager {
  private readonly scene: Phaser.Scene;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private trail: FollowerTile[] = [];
  private activeIds: CompanionId[] = [];
  private onInteract: ((companion: CompanionState) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  render(
    player: PlayerState,
    onInteract: (companion: CompanionState) => void,
  ): void {
    this.clear();
    this.onInteract = onInteract;
    const companions = this.getActiveCompanions(player.party);
    this.activeIds = companions.map((companion) => companion.id);
    this.trail = companions.map(() => ({
      x: player.position.x,
      y: player.position.y,
    }));
    companions.forEach((companion, index) => {
      const textureKey = generateCompanionTexture(this.scene, companion);
      const sprite = this.scene.add.sprite(
        player.position.x * TILE_SIZE + TILE_SIZE / 2 + (index + 1) * 4,
        player.position.y * TILE_SIZE + TILE_SIZE / 2 + (index + 1) * 3,
        textureKey,
      ).setDepth(9 - index)
        .setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => this.onInteract?.(companion));
      this.sprites.set(companion.id, sprite);
    });
  }

  sync(
    player: PlayerState,
    onInteract: (companion: CompanionState) => void,
  ): void {
    const activeIds = this.getActiveCompanions(player.party)
      .map((companion) => companion.id);
    if (
      activeIds.length !== this.activeIds.length
      || activeIds.some((id, index) => id !== this.activeIds[index])
    ) {
      this.render(player, onInteract);
    }
  }

  followStep(
    leaderPrevious: FollowerTile,
    duration: number,
    dx: number,
  ): void {
    this.trail = advanceFollowerTrail(
      this.trail,
      leaderPrevious,
      this.activeIds.length,
    );
    this.activeIds.forEach((companionId, index) => {
      const sprite = this.sprites.get(companionId);
      const target = this.trail[index];
      if (!sprite || !target) return;
      if (dx !== 0) sprite.setFlipX(dx < 0);
      this.scene.tweens.add({
        targets: sprite,
        x: target.x * TILE_SIZE + TILE_SIZE / 2,
        y: target.y * TILE_SIZE + TILE_SIZE / 2,
        duration,
      });
    });
  }

  findAdjacentCompanion(
    party: PartyState,
    playerX: number,
    playerY: number,
  ): CompanionState | undefined {
    for (let index = 0; index < this.activeIds.length; index++) {
      const tile = this.trail[index];
      if (!tile) continue;
      const distance = Math.abs(tile.x - playerX) + Math.abs(tile.y - playerY);
      if (distance > 1) continue;
      const companionId = this.activeIds[index];
      const companion = companionId
        ? getCompanion(party, companionId)
        : undefined;
      if (companion) return companion;
    }
    return undefined;
  }

  getDialogueLine(companion: CompanionState): string {
    const definition = getCompanionDefinition(companion.id);
    if (!definition || definition.dialogue.length === 0) {
      return `${companion.name} is ready to travel.`;
    }
    const line = definition.dialogue[
      companion.dialogueCursor % definition.dialogue.length
    ]!;
    companion.dialogueCursor++;
    return line;
  }

  clear(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.trail = [];
    this.activeIds = [];
  }

  private getActiveCompanions(party: PartyState): CompanionState[] {
    return party.activeCompanionIds.flatMap((companionId) => {
      const companion = getCompanion(party, companionId);
      return companion && companion.hp > 0 ? [companion] : [];
    });
  }
}

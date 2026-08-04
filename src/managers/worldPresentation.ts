import * as Phaser from "phaser";
import { createActorTextureFamily } from "../renderers/actorTextures";
import type { CompanionId } from "../data/companions";
import { isReducedMotionEnabled } from "../systems/accessibility";
import {
  ActorAnimationDirector,
} from "./actorAnimation";

const HERO_ACTOR_ID = "overworld:hero";

export class WorldPresentationDirector {
  private readonly actors: ActorAnimationDirector;
  private mountActorId: string | null = null;
  private followerActorIds = new Map<CompanionId, string>();
  private readonly eventHistory: string[] = [];
  private lastEvent = "idle";

  public constructor(private readonly scene: Phaser.Scene) {
    this.actors = new ActorAnimationDirector(scene);
  }

  public bindPlayer(
    sprite: Phaser.GameObjects.Sprite,
    appearanceId: string,
  ): void {
    this.actors.bind({
      id: HERO_ACTOR_ID,
      role: "hero",
      target: sprite,
      textureFamily: createActorTextureFamily({
        id: `hero.${appearanceId}`,
        role: "hero",
        fallbackTextureKey: sprite.texture.key,
        framePrefix: `player_${appearanceId}_world`,
      }),
    });
  }

  public bindMount(
    sprite: Phaser.GameObjects.Sprite | null,
    mountId: string,
  ): void {
    if (this.mountActorId) this.actors.unbind(this.mountActorId);
    this.mountActorId = null;
    if (!sprite || !mountId) return;
    const actorId = `overworld:mount:${mountId}`;
    this.mountActorId = actorId;
    this.actors.bind({
      id: actorId,
      role: "mount",
      target: sprite,
      textureFamily: createActorTextureFamily({
        id: `mount.${mountId}`,
        role: "mount",
        fallbackTextureKey: sprite.texture.key,
        framePrefix: `mount_${mountId}_world`,
      }),
    });
  }

  public bindFollower(
    companionId: CompanionId,
    sprite: Phaser.GameObjects.Sprite,
  ): void {
    this.unbindFollower(companionId);
    const actorId = `overworld:companion:${companionId}`;
    this.followerActorIds.set(companionId, actorId);
    this.actors.bind({
      id: actorId,
      role: "companion",
      target: sprite,
      textureFamily: createActorTextureFamily({
        id: `companion.${companionId}`,
        role: "companion",
        fallbackTextureKey: sprite.texture.key,
        framePrefix: `companion_${companionId}_world`,
      }),
    });
    this.presentFollowerStep(companionId, 1);
  }

  public unbindFollower(companionId: CompanionId): void {
    const actorId = this.followerActorIds.get(companionId);
    if (!actorId) return;
    this.actors.unbind(actorId);
    this.followerActorIds.delete(companionId);
  }

  public presentPlayerStep(dx: number): void {
    const direction: -1 | 1 = dx < 0 ? -1 : 1;
    this.recordEvent(
      `${HERO_ACTOR_ID}:walk`
      + (isReducedMotionEnabled() ? ":immediate" : ""),
    );
    this.actors.play(HERO_ACTOR_ID, "walk", {
      direction,
      restorePosition: false,
    });
    if (this.mountActorId) {
      this.actors.play(this.mountActorId, "walk", {
        direction,
        restorePosition: false,
      });
      this.recordEvent(
        `${this.mountActorId}:walk`
        + (isReducedMotionEnabled() ? ":immediate" : ""),
      );
    }
  }

  public presentFollowerStep(companionId: CompanionId, dx: number): void {
    const actorId = this.followerActorIds.get(companionId);
    if (!actorId) return;
    this.actors.play(actorId, "walk", {
      direction: dx < 0 ? -1 : 1,
      restorePosition: false,
    });
    this.recordEvent(
      `${actorId}:walk`
      + (isReducedMotionEnabled() ? ":immediate" : ""),
    );
  }

  public completePlayerStep(): void {
    this.actors.refreshBase(HERO_ACTOR_ID);
    if (this.mountActorId) this.actors.refreshBase(this.mountActorId);
  }

  public completeFollowerStep(companionId: CompanionId): void {
    const actorId = this.followerActorIds.get(companionId);
    if (actorId) this.actors.refreshBase(actorId);
  }

  public get debugState(): string {
    if (this.eventHistory.length > 0) return this.eventHistory.join(">");
    return this.lastEvent === "idle" ? this.actors.state : this.lastEvent;
  }

  public cleanup(): void {
    this.actors.cleanup();
    this.mountActorId = null;
    this.followerActorIds.clear();
    this.eventHistory.length = 0;
    this.lastEvent = "clean";
  }

  private recordEvent(event: string): void {
    this.lastEvent = event;
    this.eventHistory.push(event);
    if (this.eventHistory.length > 6) this.eventHistory.shift();
  }
}

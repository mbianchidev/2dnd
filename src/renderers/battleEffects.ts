/**
 * Pure rendering functions extracted from BattleScene for sky, celestial bodies,
 * terrain foreground, day/night tint, and weather particle effects.
 */

import type Phaser from "phaser";
import { getTimePeriod, TimePeriod, PERIOD_TINT } from "../systems/daynight";
import { WeatherType, type WeatherState } from "../systems/weather";

/**
 * Draw a time-dependent sky gradient over the sky portion of the battle background.
 * This replaces the static baked-in sky color with one that reflects the current
 * time of day (blue morning, dark blue night, orange dawn/dusk, etc.).
 */
export function drawTimeSky(scene: Phaser.Scene, biome: string, timeStep: number): void {
  if (biome === "dungeon") return;

  const w = scene.cameras.main.width;
  const skyH = scene.cameras.main.height * 0.45;
  const period = getTimePeriod(timeStep);
  const gfx = scene.add.graphics();
  gfx.setDepth(0.4); // below celestial body (0.5), above bg image (0)

  // Top and bottom gradient colors for each time period
  let topColor: number;
  let botColor: number;
  let alpha = 0.85;

  switch (period) {
    case TimePeriod.Dawn:
      topColor = 0x4466aa; botColor = 0xffa858; break;
    case TimePeriod.Day:
      topColor = 0x5588cc; botColor = 0x87ceeb; break;
    case TimePeriod.Dusk:
      topColor = 0x2a2a55; botColor = 0xff6633; break;
    case TimePeriod.Night:
      topColor = 0x0a0a1a; botColor = 0x1a2244; alpha = 0.92; break;
    default:
      return; // Dungeon handled above
  }

  gfx.fillGradientStyle(topColor, topColor, botColor, botColor, alpha);
  gfx.fillRect(0, 0, w, skyH);
}

/**
 * Draw a sun or moon in the sky area of the battle background.
 * Positioned on the LEFT side of the sky to avoid overlapping the monster
 * sprite (centered ~55% x, ~32% y) and the HP info box (top-right).
 *   Dawn  → sun low-left (rising)
 *   Day   → sun upper-left
 *   Dusk  → sun mid-left (setting)
 *   Night → moon upper-left + stars
 */
export function drawCelestialBody(scene: Phaser.Scene, biome: string, timeStep: number): void {
  // Skip for dungeons — no sky visible
  if (biome === "dungeon") return;

  const w = scene.cameras.main.width;
  const skyH = scene.cameras.main.height * 0.45; // sky occupies roughly top 45%
  const period = getTimePeriod(timeStep);
  const gfx = scene.add.graphics();
  gfx.setDepth(0.5); // above bg image, below sprites

  switch (period) {
    case TimePeriod.Dawn: {
      // Sun rising — low left
      const sx = w * 0.12;
      const sy = skyH * 0.78;
      gfx.fillStyle(0xffcc66, 0.15);
      gfx.fillCircle(sx, sy, 50);
      gfx.fillStyle(0xffaa33, 0.2);
      gfx.fillCircle(sx, sy, 30);
      gfx.fillStyle(0xffdd44, 1);
      gfx.fillCircle(sx, sy, 16);
      gfx.fillStyle(0xffee88, 1);
      gfx.fillCircle(sx - 3, sy - 3, 10);
      break;
    }
    case TimePeriod.Day: {
      // Sun high — upper-left quadrant
      const sx = w * 0.22;
      const sy = skyH * 0.18;
      gfx.fillStyle(0xffffcc, 0.12);
      gfx.fillCircle(sx, sy, 60);
      gfx.fillStyle(0xffff88, 0.18);
      gfx.fillCircle(sx, sy, 35);
      gfx.fillStyle(0xffee44, 1);
      gfx.fillCircle(sx, sy, 18);
      gfx.fillStyle(0xffff99, 1);
      gfx.fillCircle(sx - 3, sy - 3, 12);
      gfx.lineStyle(1.5, 0xffee44, 0.3);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        gfx.lineBetween(
          sx + Math.cos(a) * 22, sy + Math.sin(a) * 22,
          sx + Math.cos(a) * 40, sy + Math.sin(a) * 40,
        );
      }
      break;
    }
    case TimePeriod.Dusk: {
      // Sun setting — mid-left, dropping lower
      const sx = w * 0.15;
      const sy = skyH * 0.72;
      gfx.fillStyle(0xff6633, 0.15);
      gfx.fillCircle(sx, sy, 55);
      gfx.fillStyle(0xff8844, 0.2);
      gfx.fillCircle(sx, sy, 32);
      gfx.fillStyle(0xff7733, 1);
      gfx.fillCircle(sx, sy, 17);
      gfx.fillStyle(0xffaa55, 1);
      gfx.fillCircle(sx - 2, sy - 2, 11);
      break;
    }
    case TimePeriod.Night: {
      // Moon — upper-left area (well away from monster at top-right)
      const mx = w * 0.18;
      const my = skyH * 0.2;
      gfx.fillStyle(0xaabbdd, 0.1);
      gfx.fillCircle(mx, my, 45);
      gfx.fillStyle(0xccddff, 0.12);
      gfx.fillCircle(mx, my, 28);
      gfx.fillStyle(0xe8eeff, 1);
      gfx.fillCircle(mx, my, 14);
      gfx.fillStyle(0x0a0a1a, 1);
      gfx.fillCircle(mx + 6, my - 4, 11);
      // Stars — scattered across sky but avoiding monster area (right 60-90% x)
      gfx.fillStyle(0xffffff, 0.7);
      const starPositions = [
        [w * 0.05, skyH * 0.12], [w * 0.15, skyH * 0.42],
        [w * 0.28, skyH * 0.08], [w * 0.38, skyH * 0.3],
        [w * 0.42, skyH * 0.05], [w * 0.08, skyH * 0.28],
        [w * 0.32, skyH * 0.4], [w * 0.48, skyH * 0.15],
      ];
      for (const [sx, sy] of starPositions) {
        gfx.fillCircle(sx, sy, 1.5);
      }
      gfx.fillStyle(0xccccee, 0.4);
      gfx.fillCircle(w * 0.03, skyH * 0.35, 1);
      gfx.fillCircle(w * 0.25, skyH * 0.48, 1);
      gfx.fillCircle(w * 0.45, skyH * 0.38, 1);
      gfx.fillCircle(w * 0.35, skyH * 0.18, 1);
      break;
    }
  }
}

/**
 * Draw biome-specific foreground terrain elements for DQ-style depth.
 * These are drawn at depth 1.2, between monster (1.0) and player (1.5),
 * creating a sense of perspective and grounding.
 */
export function drawTerrainForeground(scene: Phaser.Scene, biome: string): void {
  const w = scene.cameras.main.width;
  const h = scene.cameras.main.height;
  const gfx = scene.add.graphics();
  gfx.setDepth(1.2);

  switch (biome) {
    case "grass": {
      // Grass tufts and small flowers along the midground
      gfx.fillStyle(0x3a7c2f, 0.6);
      for (let i = 0; i < 12; i++) {
        const gx = (i * 53 + 10) % w;
        const gy = h * 0.58 + (i * 17) % 30;
        gfx.fillTriangle(gx, gy, gx + 4, gy - 12, gx + 8, gy);
        gfx.fillTriangle(gx + 5, gy, gx + 9, gy - 10, gx + 13, gy);
      }
      // Small rocks
      gfx.fillStyle(0x888877, 0.5);
      gfx.fillCircle(w * 0.08, h * 0.62, 4);
      gfx.fillCircle(w * 0.82, h * 0.60, 5);
      gfx.fillCircle(w * 0.45, h * 0.65, 3);
      break;
    }
    case "forest":
    case "deep_forest": {
      // Tree silhouettes on edges for depth framing
      const isDeep = biome === "deep_forest";
      const trunkColor = isDeep ? 0x1a0f08 : 0x3d2b1a;
      const leafColor = isDeep ? 0x0a3a06 : 0x1d6b18;
      // Left tree
      gfx.fillStyle(trunkColor, 0.7);
      gfx.fillRect(w * 0.02, h * 0.20, 12, h * 0.50);
      gfx.fillStyle(leafColor, 0.6);
      gfx.fillCircle(w * 0.03, h * 0.22, 35);
      gfx.fillCircle(w * 0.01, h * 0.30, 25);
      // Right tree
      gfx.fillStyle(trunkColor, 0.7);
      gfx.fillRect(w * 0.92, h * 0.25, 12, h * 0.45);
      gfx.fillStyle(leafColor, 0.6);
      gfx.fillCircle(w * 0.93, h * 0.27, 32);
      gfx.fillCircle(w * 0.95, h * 0.34, 22);
      // Forest floor debris
      gfx.fillStyle(0x2a1a0a, 0.4);
      for (let i = 0; i < 8; i++) {
        gfx.fillCircle((i * 83 + 30) % w, h * 0.60 + (i * 11) % 20, 3);
      }
      break;
    }
    case "sand": {
      // Foreground dune ridges
      gfx.fillStyle(0xddb060, 0.5);
      gfx.fillCircle(w * 0.15, h * 0.62, 60);
      gfx.fillCircle(w * 0.75, h * 0.60, 50);
      // Sand ripples
      gfx.fillStyle(0xc09040, 0.3);
      for (let i = 0; i < 6; i++) {
        gfx.fillRect(w * 0.1 + i * 50, h * 0.58 + i * 5, 40, 2);
      }
      break;
    }
    case "tundra": {
      // Snow mounds
      gfx.fillStyle(0xf0f0ff, 0.4);
      gfx.fillCircle(w * 0.1, h * 0.60, 40);
      gfx.fillCircle(w * 0.85, h * 0.58, 35);
      // Ice crystals
      gfx.fillStyle(0xaaddff, 0.3);
      gfx.fillCircle(w * 0.05, h * 0.55, 5);
      gfx.fillCircle(w * 0.90, h * 0.54, 4);
      gfx.fillCircle(w * 0.50, h * 0.62, 3);
      break;
    }
    case "swamp": {
      // Murky foreground puddles
      gfx.fillStyle(0x556b3a, 0.4);
      gfx.fillCircle(w * 0.10, h * 0.62, 30);
      gfx.fillCircle(w * 0.80, h * 0.60, 25);
      // Dead twigs
      gfx.fillStyle(0x2d401a, 0.6);
      gfx.fillRect(w * 0.05, h * 0.50, 4, h * 0.18);
      gfx.fillRect(w * 0.88, h * 0.48, 4, h * 0.20);
      break;
    }
    case "volcanic": {
      // Foreground rocks with lava glow
      gfx.fillStyle(0x1a0a0a, 0.6);
      gfx.fillCircle(w * 0.08, h * 0.60, 20);
      gfx.fillCircle(w * 0.85, h * 0.58, 18);
      gfx.fillStyle(0xff4400, 0.3);
      gfx.fillCircle(w * 0.5, h * 0.63, 15);
      // Ember particles
      gfx.fillStyle(0xff6600, 0.35);
      for (let i = 0; i < 6; i++) {
        gfx.fillCircle((i * 107 + 20) % w, h * 0.40 + (i * 31) % (h * 0.25), 2);
      }
      break;
    }
    case "canyon": {
      // Canyon wall edges
      gfx.fillStyle(0x8b4513, 0.5);
      gfx.fillRect(0, h * 0.15, 35, h * 0.55);
      gfx.fillRect(w - 35, h * 0.18, 35, h * 0.52);
      // Small boulders
      gfx.fillStyle(0x885533, 0.4);
      gfx.fillCircle(w * 0.12, h * 0.60, 8);
      gfx.fillCircle(w * 0.78, h * 0.58, 10);
      gfx.fillCircle(w * 0.50, h * 0.64, 6);
      break;
    }
    case "dungeon": {
      // Stone pillar edges
      gfx.fillStyle(0x333344, 0.5);
      gfx.fillRect(0, h * 0.10, 25, h * 0.60);
      gfx.fillRect(w - 25, h * 0.12, 25, h * 0.58);
      // Debris
      gfx.fillStyle(0x222233, 0.4);
      gfx.fillCircle(w * 0.10, h * 0.62, 5);
      gfx.fillCircle(w * 0.85, h * 0.60, 4);
      break;
    }
  }
}

/** Blend two 0xRRGGBB colors — 70% first, 30% second. */
export function blendTints(a: number, b: number): number {
  const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
  const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;
  const r = Math.round(rA * 0.7 + rB * 0.3);
  const g = Math.round(gA * 0.7 + gB * 0.3);
  const bl = Math.round(bA * 0.7 + bB * 0.3);
  return (r << 16) | (g << 8) | bl;
}

/** Apply day/night tint to the battle background, monster, and player sprites. */
export function applyBattleDayNightTint(
  scene: Phaser.Scene,
  biome: string,
  timeStep: number,
  bgImage: Phaser.GameObjects.Image | null,
  monsterSprite: Phaser.GameObjects.Sprite,
  monsterColor: number,
  playerSprite: Phaser.GameObjects.Sprite,
): void {
  const period = biome === "dungeon" ? TimePeriod.Dungeon : getTimePeriod(timeStep);
  const tint = PERIOD_TINT[period];
  // Tint the background image
  if (bgImage) {
    bgImage.setTint(tint);
  }
  // Tint monster sprite (blend with its color tint)
  if (tint !== 0xffffff) {
    // Blend the monster's base color with the time-of-day tint
    const blended = blendTints(monsterColor, tint);
    monsterSprite.setTint(blended);
    // Player sprite gets pure time tint
    playerSprite.setTint(tint);
  }
}

/** Create weather particle effects for the battle scene. Returns new particles and timer. */
export function createBattleWeatherParticles(
  scene: Phaser.Scene,
  weatherState: WeatherState,
  existingParticles: Phaser.GameObjects.Particles.ParticleEmitter | null,
  existingTimer: Phaser.Time.TimerEvent | null,
): { particles: Phaser.GameObjects.Particles.ParticleEmitter | null; timer: Phaser.Time.TimerEvent | null } {
  if (existingParticles) {
    existingParticles.destroy();
  }
  if (existingTimer) {
    existingTimer.destroy();
  }

  let particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  let timer: Phaser.Time.TimerEvent | null = null;

  const w = scene.cameras.main.width;
  const h = scene.cameras.main.height;
  const weather = weatherState.current;

  if (weather === WeatherType.Clear) return { particles, timer };

  const configs: Record<string, () => Phaser.GameObjects.Particles.ParticleEmitter> = {
    [WeatherType.Rain]: () => scene.add.particles(0, -10, "particle_rain", {
      x: { min: 0, max: w },
      quantity: 3,
      lifespan: 1800,
      speedY: { min: 220, max: 380 },
      speedX: { min: -20, max: -40 },
      scale: { start: 1, end: 0.5 },
      alpha: { start: 0.7, end: 0.15 },
      frequency: 25,
    }),
    [WeatherType.Snow]: () => scene.add.particles(0, -10, "particle_snow", {
      x: { min: 0, max: w },
      quantity: 1,
      lifespan: 5000,
      speedY: { min: 25, max: 70 },
      speedX: { min: -25, max: 25 },
      scale: { start: 1, end: 0.3 },
      alpha: { start: 0.8, end: 0.1 },
      frequency: 70,
    }),
    [WeatherType.Sandstorm]: () => scene.add.particles(w + 10, 0, "particle_sand", {
      y: { min: 0, max: h },
      quantity: 5,
      lifespan: 2200,
      speedX: { min: -420, max: -260 },
      speedY: { min: -20, max: 30 },
      scale: { start: 1.3, end: 0.5 },
      alpha: { start: 0.9, end: 0.15 },
      frequency: 14,
    }),
    [WeatherType.Storm]: () => scene.add.particles(0, -10, "particle_storm", {
      x: { min: 0, max: w },
      quantity: 5,
      lifespan: 1200,
      speedY: { min: 380, max: 520 },
      speedX: { min: -70, max: -110 },
      scale: { start: 1, end: 0.5 },
      alpha: { start: 0.85, end: 0.2 },
      frequency: 14,
    }),
    [WeatherType.Fog]: () => scene.add.particles(0, 0, "particle_fog", {
      x: { min: 0, max: w },
      y: { min: 0, max: h },
      quantity: 2,
      lifespan: 5000,
      speedX: { min: 5, max: 15 },
      speedY: { min: -5, max: 5 },
      scale: { start: 2.5, end: 5 },
      alpha: { start: 0.35, end: 0.04 },
      frequency: 140,
    }),
  };

  const factory = configs[weather];
  if (factory) {
    particles = factory();
    particles.setDepth(5);
  }

  // Sporadic lightning flashes during storms
  if (weather === WeatherType.Storm) {
    const scheduleFlash = (): void => {
      timer = scene.time.delayedCall(
        2000 + Math.random() * 6000,
        () => {
          scene.cameras.main.flash(120, 255, 255, 255, true);
          scheduleFlash();
        },
      );
    };
    scheduleFlash();
  }

  return { particles, timer };
}

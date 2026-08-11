import * as Phaser from "phaser";
import type { Monster } from "../data/monsters";
import {
  getTimePeriod,
  PERIOD_TINT,
  TimePeriod,
} from "../systems/daynight";
import { isReducedMotionEnabled } from "../systems/accessibility";
import { WeatherType } from "../systems/weather";
import { isLocalDev } from "../config";
import {
  BATTLE_BACKDROP_LAYER_IDS,
  BATTLE_DEPTH,
  getBattleBackdropLayout,
  normalizeBattleBiome,
  type BattleBackdropInspection,
  type BattleBackdropLayerId,
  type BattleBackdropLayout,
  type BattleBiome,
} from "./battleDepth";

export interface BattleBackdropConfig {
  readonly biome: string;
  readonly timeStep: number;
  readonly weather: WeatherType;
  readonly primaryMonster: Monster;
}

interface BackdropLayer {
  readonly container: Phaser.GameObjects.Container;
  readonly graphics: Phaser.GameObjects.Graphics;
}

const ENCLOSED_BOSS_IDS = new Set([
  "troll",
  "cryptLich",
  "frostWarden",
  "infernoForgemaster",
]);

export function applyBattleActorTint(
  biome: string,
  timeStep: number,
  sprites: readonly Phaser.GameObjects.Sprite[],
): void {
  const period = normalizeBattleBiome(biome) === "dungeon"
    ? TimePeriod.Dungeon
    : getTimePeriod(timeStep);
  const tint = PERIOD_TINT[period];
  for (const sprite of sprites) {
    sprite.clearTint();
    if (tint !== 0xffffff) sprite.setTint(tint);
  }
}

export class BattleBackdropRenderer {
  private readonly layers = new Map<BattleBackdropLayerId, BackdropLayer>();
  private readonly inspectionLabels: Phaser.GameObjects.Text[] = [];
  private frontWeather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private lightningTimer: Phaser.Time.TimerEvent | null = null;
  private config: BattleBackdropConfig | null = null;
  private destroyed = false;
  private labelsVisible = false;

  public constructor(private readonly scene: Phaser.Scene) {
    for (const id of BATTLE_BACKDROP_LAYER_IDS) {
      this.layers.set(id, this.createLayer(id));
    }
  }

  public render(config: BattleBackdropConfig): void {
    this.config = config;
    this.clearWeather();
    for (const layer of this.layers.values()) layer.graphics.clear();

    const layout = getBattleBackdropLayout(
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
    );
    for (const layer of this.layers.values()) {
      layer.container.setSize(layout.width, layout.height);
    }
    const biome = this.resolveArenaBiome(
      normalizeBattleBiome(config.biome),
      config.primaryMonster.id,
    );
    const skyVisible = this.isSkyVisible(biome, config.primaryMonster.id);

    this.drawSky(layout, biome, config.timeStep, skyVisible);
    this.drawCelestial(layout, config.timeStep, skyVisible);
    this.drawClouds(layout, biome, config.weather, skyVisible);
    this.drawDistantScenery(layout, biome, config.primaryMonster.id);
    this.drawGround(layout, biome);
    this.drawMidgroundProps(layout, biome, config.primaryMonster.id);
    this.drawForegroundProps(layout, biome, config.primaryMonster.id);
    this.drawWeather(layout, config.weather);
    if (this.labelsVisible) this.refreshInspectionLabels();
    this.syncDebugDataset();
  }

  public addActorShadow(
    actorId: string,
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
  ): Phaser.GameObjects.Ellipse {
    const layer = this.requireLayer("actorShadows");
    const shadow = this.scene.add.ellipse(
      x,
      y,
      radiusX * 2,
      radiusY * 2,
      0x05070d,
      0.42,
    );
    shadow.setName(`battle-shadow:${actorId}`);
    shadow.setScrollFactor(0);
    layer.container.add(shadow);
    this.syncDebugDataset();
    return shadow;
  }

  public setInspectionLabels(visible: boolean): void {
    this.labelsVisible = visible;
    this.refreshInspectionLabels();
    this.syncDebugDataset();
  }

  public stopDynamicEffects(): void {
    this.clearWeather();
    this.syncDebugDataset();
  }

  public getInspection(): readonly BattleBackdropInspection[] {
    return BATTLE_BACKDROP_LAYER_IDS.map((id) => {
      const layer = this.requireLayer(id);
      return {
        id,
        depth: BATTLE_DEPTH[id],
        bounds: {
          x: Math.round(layer.container.x),
          y: Math.round(layer.container.y),
          width: Math.round(layer.container.width),
          height: Math.round(layer.container.height),
        },
        childCount: layer.container.length,
        scrollFactorX: layer.container.scrollFactorX,
        scrollFactorY: layer.container.scrollFactorY,
      };
    });
  }

  public getInspectionReport(): string {
    return this.getInspection()
      .map((layer) =>
        `${layer.id}@${layer.depth}`
        + ` [${layer.bounds.x},${layer.bounds.y},${layer.bounds.width},${layer.bounds.height}]`
        + ` children=${layer.childCount}`
      )
      .join(" | ");
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const lightningTimer = this.lightningTimer;
    this.clearWeather();
    this.clearInspectionLabels();
    for (const layer of this.layers.values()) {
      for (const child of [...layer.container.list]) child.destroy();
      layer.container.removeAll(false);
      layer.container.destroy();
    }
    this.layers.clear();
    this.config = null;
    if (isLocalDev()) {
      delete this.scene.game.canvas.dataset.battleBackdrop;
      const activeWeatherEmitters = this.scene.children.list.filter(
        (child) => child.active && child.name === "battle-weather:front",
      ).length;
      const activeLightningTimers = lightningTimer
        && lightningTimer.getOverallRemaining() > 0
        ? 1
        : 0;
      this.scene.game.canvas.dataset.battleBackdropCleanup = JSON.stringify({
        containers: 0,
        children: 0,
        weatherEmitters: activeWeatherEmitters,
        lightningTimers: activeLightningTimers,
        labels: 0,
      });
    }
  }

  private createLayer(id: BattleBackdropLayerId): BackdropLayer {
    const container = this.scene.add.container(0, 0);
    container
      .setName(`battle-layer:${id}`)
      .setDepth(BATTLE_DEPTH[id])
      .setScrollFactor(0);
    container.setData("battleLayerId", id);
    container.setData("battleLayerDepth", BATTLE_DEPTH[id]);
    const graphics = this.scene.add.graphics();
    graphics.setName(`battle-layer-graphics:${id}`).setScrollFactor(0);
    container.add(graphics);
    return { container, graphics };
  }

  private requireLayer(id: BattleBackdropLayerId): BackdropLayer {
    const layer = this.layers.get(id);
    if (!layer) throw new Error(`[BattleBackdrop] Missing layer ${id}`);
    return layer;
  }

  private isSkyVisible(biome: BattleBiome, bossId: string): boolean {
    return biome !== "dungeon" && !ENCLOSED_BOSS_IDS.has(bossId);
  }

  private resolveArenaBiome(
    biome: BattleBiome,
    bossId: string,
  ): BattleBiome {
    if (bossId === "troll" || bossId === "cryptLich") return "dungeon";
    if (bossId === "frostWarden") return "tundra";
    if (bossId === "infernoForgemaster") return "volcanic";
    if (bossId === "kraken") return "sea";
    return biome;
  }

  private drawSky(
    layout: BattleBackdropLayout,
    biome: BattleBiome,
    timeStep: number,
    skyVisible: boolean,
  ): void {
    const graphics = this.requireLayer("farSky").graphics;
    const period = getTimePeriod(timeStep);
    if (!skyVisible) {
      const top = biome === "dungeon"
        ? 0x10101a
        : biome === "volcanic"
          ? 0x250b0b
          : biome === "tundra"
            ? 0x25354b
            : 0x132016;
      graphics.fillStyle(top, 1);
      graphics.fillRect(0, 0, layout.width, layout.height);
      return;
    }

    const palette = this.getSkyPalette(period, biome);
    graphics.fillStyle(palette.bottom, 1);
    graphics.fillRect(0, 0, layout.width, layout.height);
    graphics.fillGradientStyle(
      palette.top,
      palette.top,
      palette.bottom,
      palette.bottom,
      1,
    );
    graphics.fillRect(0, 0, layout.width, layout.skyBottom + 2);
  }

  private getSkyPalette(
    period: TimePeriod,
    biome: BattleBiome,
  ): { readonly top: number; readonly bottom: number } {
    if (period === TimePeriod.Night) {
      return { top: 0x070b1c, bottom: biome === "sea" ? 0x182b4d : 0x20264d };
    }
    if (period === TimePeriod.Dawn) {
      return { top: 0x536aa0, bottom: biome === "sand" ? 0xffb45f : 0xff9f68 };
    }
    if (period === TimePeriod.Dusk) {
      return { top: 0x29264f, bottom: biome === "volcanic" ? 0xa73722 : 0xf06b49 };
    }
    if (biome === "tundra") return { top: 0x7895b4, bottom: 0xb8d1df };
    if (biome === "sand" || biome === "canyon") {
      return { top: 0x5f91c5, bottom: 0xf2bd72 };
    }
    if (biome === "swamp") return { top: 0x45665d, bottom: 0x7e8b69 };
    if (biome === "volcanic") return { top: 0x49212a, bottom: 0x9b4a35 };
    if (biome === "sea") return { top: 0x3f78b5, bottom: 0x8dcde1 };
    return { top: 0x4f83c4, bottom: 0x91d4ec };
  }

  private drawCelestial(
    layout: BattleBackdropLayout,
    timeStep: number,
    skyVisible: boolean,
  ): void {
    if (!skyVisible) return;
    const period = getTimePeriod(timeStep);
    const stars = this.requireLayer("stars").graphics;
    const celestial = this.requireLayer("celestial").graphics;

    if (period === TimePeriod.Night) {
      stars.fillStyle(0xffffff, 0.82);
      const positions = [
        [0.05, 0.10], [0.13, 0.32], [0.23, 0.16], [0.34, 0.35],
        [0.45, 0.08], [0.57, 0.26], [0.69, 0.12], [0.82, 0.31],
        [0.92, 0.16], [0.75, 0.39], [0.50, 0.41], [0.29, 0.43],
      ] as const;
      for (const [x, y] of positions) {
        stars.fillCircle(layout.width * x, layout.skyBottom * y, 1.4);
      }
      const x = layout.width * 0.18;
      const y = layout.skyBottom * 0.22;
      celestial.fillStyle(0xc7d8ff, 0.15);
      celestial.fillCircle(x, y, 38);
      celestial.fillStyle(0xf2f4ff, 1);
      celestial.fillCircle(x, y, 15);
      celestial.fillStyle(0x101936, 1);
      celestial.fillCircle(x + 6, y - 4, 12);
      return;
    }

    const sunPosition = period === TimePeriod.Day
      ? { x: 0.20, y: 0.18 }
      : period === TimePeriod.Dawn
        ? { x: 0.14, y: 0.72 }
        : { x: 0.16, y: 0.68 };
    const x = layout.width * sunPosition.x;
    const y = layout.skyBottom * sunPosition.y;
    const core = period === TimePeriod.Dusk ? 0xff6d36 : 0xffe56c;
    celestial.fillStyle(core, 0.14);
    celestial.fillCircle(x, y, 48);
    celestial.fillStyle(core, 0.24);
    celestial.fillCircle(x, y, 29);
    celestial.fillStyle(core, 1);
    celestial.fillCircle(x, y, 16);
  }

  private drawClouds(
    layout: BattleBackdropLayout,
    biome: BattleBiome,
    weather: WeatherType,
    skyVisible: boolean,
  ): void {
    if (!skyVisible) return;
    const graphics = this.requireLayer("clouds").graphics;
    const stormy = weather === WeatherType.Storm || weather === WeatherType.Rain;
    const alpha = stormy ? 0.72 : biome === "sand" ? 0.18 : 0.34;
    const color = stormy ? 0x37455d : 0xe9f2f5;
    graphics.fillStyle(color, alpha);
    const clouds = [
      [0.10, 0.18, 44],
      [0.48, 0.24, 56],
      [0.80, 0.13, 38],
    ] as const;
    for (const [x, y, radius] of clouds) {
      const cx = layout.width * x;
      const cy = layout.skyBottom * y;
      graphics.fillCircle(cx, cy, radius * 0.45);
      graphics.fillCircle(cx + radius * 0.35, cy + 3, radius * 0.34);
      graphics.fillCircle(cx - radius * 0.30, cy + 5, radius * 0.30);
      graphics.fillRect(
        cx - radius * 0.48,
        cy,
        radius * 0.96,
        radius * 0.28,
      );
    }
  }

  private drawDistantScenery(
    layout: BattleBackdropLayout,
    biome: BattleBiome,
    bossId: string,
  ): void {
    const graphics = this.requireLayer("distantScenery").graphics;
    const horizon = layout.horizonY;
    if (biome === "sea") {
      graphics.fillStyle(0x214f72, 1);
      graphics.fillRect(0, horizon, layout.width, layout.height - horizon);
      graphics.fillStyle(0x75b9ce, 0.45);
      for (let index = 0; index < 8; index += 1) {
        graphics.fillRect(index * 92 - 30, horizon + 18 + index % 2 * 9, 74, 3);
      }
      graphics.fillStyle(0x263b35, 0.9);
      graphics.fillTriangle(
        layout.width * 0.72,
        horizon + 4,
        layout.width * 0.82,
        horizon - 35,
        layout.width * 0.92,
        horizon + 4,
      );
      return;
    }
    if (biome === "dungeon") {
      graphics.fillStyle(0x292a36, 1);
      graphics.fillRect(0, 0, layout.width, layout.height);
      graphics.lineStyle(2, 0x14151d, 0.8);
      for (let y = 10; y < layout.groundTop; y += 38) {
        graphics.lineBetween(0, y, layout.width, y);
      }
      for (let x = 0; x < layout.width; x += 64) {
        graphics.lineBetween(x, 0, x, layout.groundTop);
      }
      return;
    }

    const distantColor = biome === "volcanic"
      ? 0x35191b
      : biome === "canyon"
        ? 0x8d4b31
        : biome === "tundra"
          ? 0x8299aa
          : biome === "swamp"
            ? 0x263d2b
            : 0x355b43;
    graphics.fillStyle(distantColor, 1);
    for (let index = 0; index < 7; index += 1) {
      const x = index * (layout.width / 6);
      const peak = horizon - 30 - (index % 3) * 24;
      graphics.fillTriangle(
        x - 90,
        horizon + 20,
        x,
        peak,
        x + 110,
        horizon + 20,
      );
    }
    if (bossId === "volcanicWyrm") {
      graphics.fillStyle(0xff5722, 0.8);
      graphics.fillCircle(layout.width * 0.5, horizon - 80, 16);
      graphics.fillTriangle(
        layout.width * 0.48,
        horizon - 76,
        layout.width * 0.43,
        horizon + 34,
        layout.width * 0.52,
        horizon + 34,
      );
    }
  }

  private drawGround(
    layout: BattleBackdropLayout,
    biome: BattleBiome,
  ): void {
    const graphics = this.requireLayer("ground").graphics;
    const color = {
      grass: 0x4b8741,
      forest: 0x294521,
      deep_forest: 0x172416,
      sand: 0xd6ae67,
      tundra: 0xdce7ee,
      swamp: 0x465b38,
      volcanic: 0x291d1d,
      canyon: 0xa45d3d,
      dungeon: 0x30313b,
      city: 0x8e8171,
      sea: 0x214f72,
    }[biome];
    graphics.fillStyle(color, 1);
    graphics.fillRect(
      0,
      layout.groundTop,
      layout.width,
      layout.height - layout.groundTop,
    );
    graphics.fillStyle(0xffffff, biome === "sea" ? 0.12 : 0.05);
    for (let index = 0; index < 12; index += 1) {
      const y = layout.groundTop + 12 + index * 24;
      graphics.fillRect((index * 47) % 110, y, layout.width * 0.38, 2);
    }
  }

  private drawMidgroundProps(
    layout: BattleBackdropLayout,
    biome: BattleBiome,
    bossId: string,
  ): void {
    const graphics = this.requireLayer("midgroundProps").graphics;
    const baseY = layout.groundTop + 10;
    if (biome === "forest" || biome === "deep_forest" || biome === "swamp") {
      const trunk = biome === "swamp" ? 0x27341f : 0x332519;
      const leaves = biome === "deep_forest" ? 0x123411 : 0x22601f;
      for (let index = 0; index < 7; index += 1) {
        const x = 36 + index * (layout.width - 72) / 6;
        graphics.fillStyle(trunk, 1);
        graphics.fillRect(x - 5, layout.horizonY - 72, 10, 84);
        if (biome !== "swamp") {
          graphics.fillStyle(leaves, 0.95);
          graphics.fillCircle(x, layout.horizonY - 76, 28);
          graphics.fillCircle(x - 17, layout.horizonY - 58, 20);
          graphics.fillCircle(x + 17, layout.horizonY - 58, 20);
        } else {
          graphics.lineStyle(4, trunk, 1);
          graphics.lineBetween(x, layout.horizonY - 52, x - 18, layout.horizonY - 72);
          graphics.lineBetween(x, layout.horizonY - 42, x + 20, layout.horizonY - 62);
        }
      }
    } else if (biome === "city") {
      graphics.fillStyle(0x5f554c, 1);
      for (let index = 0; index < 5; index += 1) {
        const x = index * 140 - 10;
        graphics.fillRect(x, layout.horizonY - 70 - index % 2 * 20, 112, 82);
        graphics.fillStyle(0xc69a51, 0.82);
        graphics.fillRect(x + 18, layout.horizonY - 42, 14, 18);
        graphics.fillRect(x + 70, layout.horizonY - 42, 14, 18);
        graphics.fillStyle(0x5f554c, 1);
      }
    } else if (biome === "dungeon") {
      graphics.fillStyle(0x3b3b48, 1);
      graphics.fillRect(26, 48, 34, baseY - 48);
      graphics.fillRect(layout.width - 60, 48, 34, baseY - 48);
      graphics.fillStyle(0xff7a24, 0.22);
      graphics.fillCircle(78, layout.horizonY - 20, 48);
      graphics.fillCircle(layout.width - 78, layout.horizonY - 20, 48);
      graphics.fillStyle(0xff9a35, 1);
      graphics.fillCircle(78, layout.horizonY - 20, 6);
      graphics.fillCircle(layout.width - 78, layout.horizonY - 20, 6);
    } else if (biome === "sea") {
      graphics.fillStyle(0xf0f2e8, 0.75);
      for (let index = 0; index < 5; index += 1) {
        graphics.fillRect(
          index * 142 - 30,
          baseY + index % 2 * 12,
          100,
          3,
        );
      }
    }

    if (bossId === "canyonDrake") {
      graphics.fillStyle(0x795036, 1);
      graphics.fillRect(55, layout.horizonY - 86, layout.width - 110, 24);
      graphics.fillRect(20, layout.horizonY - 100, 70, 118);
      graphics.fillRect(layout.width - 90, layout.horizonY - 100, 70, 118);
    }
    if (bossId === "cryptLich") {
      graphics.fillStyle(0x5a2d77, 0.38);
      graphics.fillCircle(layout.width * 0.5, layout.horizonY - 20, 92);
    }
    if (bossId === "infernoForgemaster") {
      graphics.fillStyle(0xff4a1f, 0.32);
      graphics.fillCircle(layout.width * 0.5, layout.horizonY, 120);
    }
    if (bossId === "troll") {
      graphics.fillStyle(0x15151a, 1);
      for (let index = 0; index < 9; index += 1) {
        const x = 26 + index * 74;
        graphics.fillTriangle(
          x,
          0,
          x - 13,
          58 + index % 3 * 15,
          x + 13,
          58 + index % 3 * 15,
        );
      }
    }
    if (bossId === "frostWarden") {
      graphics.fillStyle(0xb8dcf2, 0.58);
      for (let index = 0; index < 5; index += 1) {
        const x = 42 + index * 138;
        graphics.fillTriangle(
          x,
          0,
          x - 12,
          82 + index % 2 * 24,
          x + 12,
          82 + index % 2 * 24,
        );
      }
    }
    if (bossId === "infernoForgemaster") {
      graphics.lineStyle(5, 0x3b2c28, 0.9);
      for (const x of [86, layout.width - 86]) {
        graphics.lineBetween(x, 0, x, layout.horizonY + 34);
        graphics.lineBetween(x - 18, 22, x + 18, 22);
      }
    }
  }

  private drawForegroundProps(
    layout: BattleBackdropLayout,
    biome: BattleBiome,
    bossId: string,
  ): void {
    const graphics = this.requireLayer("foregroundProps").graphics;
    if (biome === "forest" || biome === "deep_forest") {
      const trunk = biome === "deep_forest" ? 0x17110d : 0x362318;
      const leaves = biome === "deep_forest" ? 0x0d2d0c : 0x1e551c;
      for (const x of [18, layout.width - 30]) {
        graphics.fillStyle(trunk, 1);
        graphics.fillRect(x, layout.height * 0.18, 16, layout.height * 0.55);
        graphics.fillStyle(leaves, 0.96);
        graphics.fillCircle(x + 8, layout.height * 0.19, 42);
        graphics.fillCircle(x + (x < layout.width / 2 ? 24 : -8), layout.height * 0.28, 30);
      }
    } else if (biome === "canyon") {
      graphics.fillStyle(0x6f3829, 0.95);
      graphics.fillRect(0, layout.height * 0.22, 30, layout.height * 0.54);
      graphics.fillRect(layout.width - 30, layout.height * 0.18, 30, layout.height * 0.58);
    } else if (biome === "volcanic") {
      graphics.fillStyle(0x140d0d, 0.95);
      graphics.fillCircle(35, layout.actorBaseline, 24);
      graphics.fillCircle(layout.width - 42, layout.actorBaseline - 8, 28);
      graphics.fillStyle(0xff4b1f, 0.42);
      graphics.fillCircle(layout.width * 0.5, layout.height * 0.72, 18);
    } else if (biome === "sea") {
      graphics.fillStyle(0xe8f6f7, 0.7);
      graphics.fillRect(0, layout.height * 0.70, layout.width * 0.18, 4);
      graphics.fillRect(layout.width * 0.82, layout.height * 0.68, layout.width * 0.18, 4);
    } else {
      graphics.fillStyle(
        biome === "tundra" ? 0xf4fbff : biome === "sand" ? 0xc38f4d : 0x59634f,
        0.7,
      );
      graphics.fillCircle(34, layout.actorBaseline, 10);
      graphics.fillCircle(layout.width - 38, layout.actorBaseline - 7, 13);
    }

    if (bossId === "kraken") {
      graphics.lineStyle(12, 0x2d1759, 0.88);
      graphics.beginPath();
      graphics.moveTo(18, layout.height);
      graphics.lineTo(54, layout.height * 0.60);
      graphics.lineTo(30, layout.height * 0.42);
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(layout.width - 18, layout.height);
      graphics.lineTo(layout.width - 54, layout.height * 0.58);
      graphics.lineTo(layout.width - 28, layout.height * 0.40);
      graphics.strokePath();
    }
  }

  private drawWeather(
    layout: BattleBackdropLayout,
    weather: WeatherType,
  ): void {
    const rear = this.requireLayer("rearWeather").graphics;
    if (weather === WeatherType.Clear) return;

    if (weather === WeatherType.Fog) {
      rear.fillStyle(0xd8e0df, 0.16);
      rear.fillRect(0, layout.horizonY - 30, layout.width, 74);
      rear.fillStyle(0xf0f4f2, 0.10);
      rear.fillRect(0, layout.groundTop + 28, layout.width, 58);
    } else if (weather === WeatherType.Sandstorm) {
      rear.fillStyle(0xc99a55, 0.13);
      rear.fillRect(0, 0, layout.width, layout.height);
    } else if (weather === WeatherType.Storm) {
      rear.fillStyle(0x18243a, 0.18);
      rear.fillRect(0, 0, layout.width, layout.skyBottom);
    }

    if (isReducedMotionEnabled()) {
      this.drawStaticWeather(rear, layout, weather);
      return;
    }
    this.frontWeather = this.createWeatherEmitter(layout, weather);
    this.frontWeather
      ?.setName("battle-weather:front")
      .setDepth(BATTLE_DEPTH.frontWeather)
      .setScrollFactor(0);
    if (weather === WeatherType.Storm) this.scheduleLightning();
  }

  private drawStaticWeather(
    graphics: Phaser.GameObjects.Graphics,
    layout: BattleBackdropLayout,
    weather: WeatherType,
  ): void {
    const count = weather === WeatherType.Sandstorm ? 22 : 16;
    const color = weather === WeatherType.Snow
      ? 0xffffff
      : weather === WeatherType.Sandstorm
        ? 0xe1b66c
        : 0x8fc8ee;
    graphics.lineStyle(weather === WeatherType.Snow ? 2 : 1, color, 0.62);
    for (let index = 0; index < count; index += 1) {
      const x = (index * 47 + 13) % layout.width;
      const y = (index * 83 + 29) % layout.height;
      if (weather === WeatherType.Snow) {
        graphics.strokeCircle(x, y, 2);
      } else if (weather !== WeatherType.Fog) {
        const length = weather === WeatherType.Sandstorm ? 22 : 10;
        graphics.lineBetween(x, y, x - length, y + (weather === WeatherType.Sandstorm ? 2 : 18));
      }
    }
  }

  private createWeatherEmitter(
    layout: BattleBackdropLayout,
    weather: WeatherType,
  ): Phaser.GameObjects.Particles.ParticleEmitter | null {
    if (weather === WeatherType.Rain) {
      return this.scene.add.particles(0, -10, "particle_rain", {
        x: { min: 0, max: layout.width },
        quantity: 3,
        lifespan: 1800,
        speedY: { min: 220, max: 380 },
        speedX: { min: -40, max: -20 },
        alpha: { start: 0.68, end: 0.12 },
        frequency: 25,
      });
    }
    if (weather === WeatherType.Snow) {
      return this.scene.add.particles(0, -10, "particle_snow", {
        x: { min: 0, max: layout.width },
        quantity: 1,
        lifespan: 5000,
        speedY: { min: 25, max: 70 },
        speedX: { min: -25, max: 25 },
        alpha: { start: 0.8, end: 0.1 },
        frequency: 70,
      });
    }
    if (weather === WeatherType.Sandstorm) {
      return this.scene.add.particles(
        layout.width + 10,
        0,
        "particle_sand",
        {
          y: { min: 0, max: layout.height },
          quantity: 5,
          lifespan: 2200,
          speedX: { min: -420, max: -260 },
          speedY: { min: -20, max: 30 },
          alpha: { start: 0.78, end: 0.12 },
          frequency: 14,
        },
      );
    }
    if (weather === WeatherType.Storm) {
      return this.scene.add.particles(0, -10, "particle_storm", {
        x: { min: 0, max: layout.width },
        quantity: 5,
        lifespan: 1200,
        speedY: { min: 380, max: 520 },
        speedX: { min: -110, max: -70 },
        alpha: { start: 0.82, end: 0.18 },
        frequency: 14,
      });
    }
    if (weather === WeatherType.Fog) {
      return this.scene.add.particles(0, 0, "particle_fog", {
        x: { min: 0, max: layout.width },
        y: { min: layout.horizonY - 20, max: layout.height },
        quantity: 1,
        lifespan: 5000,
        speedX: { min: 5, max: 15 },
        speedY: { min: -3, max: 3 },
        scale: { start: 2.2, end: 4.2 },
        alpha: { start: 0.22, end: 0.03 },
        frequency: 180,
      });
    }
    return null;
  }

  private scheduleLightning(): void {
    this.lightningTimer?.remove(false);
    this.lightningTimer = this.scene.time.delayedCall(2600, () => {
      if (this.destroyed || this.config?.weather !== WeatherType.Storm) return;
      this.scene.cameras.main.flash(110, 230, 238, 255, true);
      this.scheduleLightning();
    });
  }

  private clearWeather(): void {
    this.frontWeather?.destroy();
    this.frontWeather = null;
    this.lightningTimer?.remove(false);
    this.lightningTimer = null;
  }

  private refreshInspectionLabels(): void {
    this.clearInspectionLabels();
    if (!this.labelsVisible) return;
    for (const [index, layer] of this.getInspection().entries()) {
      const label = this.scene.add.text(
        4,
        4 + index * 13,
        `${layer.id} depth=${layer.depth} `
          + `${layer.bounds.width}x${layer.bounds.height}`,
        {
          fontSize: "9px",
          fontFamily: "monospace",
          color: "#ffffff",
          backgroundColor: "#000000cc",
          padding: { x: 2, y: 1 },
        },
      );
      label.setDepth(BATTLE_DEPTH.inspection).setScrollFactor(0);
      this.inspectionLabels.push(label);
    }
  }

  private clearInspectionLabels(): void {
    for (const label of this.inspectionLabels) label.destroy();
    this.inspectionLabels.length = 0;
  }

  private syncDebugDataset(): void {
    if (!isLocalDev() || this.destroyed) return;
    const inspection = this.getInspection();
    this.scene.game.canvas.dataset.battleBackdrop = JSON.stringify({
      biome: this.config?.biome ?? "",
      timeStep: this.config?.timeStep ?? 0,
      weather: this.config?.weather ?? WeatherType.Clear,
      layers: inspection,
      containers: inspection.length,
      children: inspection.reduce((sum, layer) => sum + layer.childCount, 0),
      weatherEmitters: this.frontWeather ? 1 : 0,
      lightningTimers: this.lightningTimer ? 1 : 0,
      labels: this.inspectionLabels.length,
    });
    delete this.scene.game.canvas.dataset.battleBackdropCleanup;
  }
}

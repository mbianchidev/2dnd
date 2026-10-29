import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { CUTSCENE_PALETTES, CUTSCENE_SCENERY } from "../data/cutsceneScenery";
import { createSeededRandom, hashString } from "../utils/seededRandom";
import type { CutsceneBackdrop, CutsceneId } from "../data/cutscenes";
import type { CutsceneSceneryDefinition, CutsceneSceneryPalette } from "../data/cutsceneScenery";

export type SceneryLayer = "sky" | "distant" | "ground" | "landmark" | "foreground";

interface SceneryPaint {
  readonly layer: SceneryLayer;
  readonly color: number;
  readonly alpha: number;
}

interface SceneryBox extends SceneryPaint {
  readonly kind: "rect" | "ellipse";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SceneryPolygon extends SceneryPaint {
  readonly kind: "polygon";
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

export type SceneryPrimitive = SceneryBox | SceneryPolygon;

export interface CutsceneSceneryPlan {
  readonly cutsceneId: CutsceneId;
  readonly backdrop: CutsceneBackdrop;
  readonly landmark: string;
  readonly primitives: readonly SceneryPrimitive[];
}

const LEFT = -GAME_WIDTH / 2;
const RIGHT = GAME_WIDTH * 1.5;

/** Static, replay-stable illustrated scenery. No actors, campaign data, timers or shared RNG. */
export function buildCutsceneScenery(
  cutsceneId: CutsceneId,
  backdrop: CutsceneBackdrop,
): CutsceneSceneryPlan {
  const definition = CUTSCENE_SCENERY[cutsceneId];
  if (!definition) throw new Error(`[cutscene] Missing scenery for ${cutsceneId}.`);
  const builder = new SceneryBuilder(
    definition, backdrop, createSeededRandom(hashString(cutsceneId), `scenery:${backdrop}`),
  );
  builder.draw();
  return { cutsceneId, backdrop, landmark: definition.landmark, primitives: builder.primitives };
}

class SceneryBuilder {
  readonly primitives: SceneryPrimitive[] = [];
  private layer: SceneryLayer = "sky";
  private readonly colors: CutsceneSceneryPalette;
  private readonly center: number;
  private readonly indoor: boolean;

  constructor(
    private readonly definition: CutsceneSceneryDefinition,
    private readonly backdrop: CutsceneBackdrop,
    private readonly random: () => number,
  ) {
    this.colors = CUTSCENE_PALETTES[backdrop];
    this.center = Math.round(260 + random() * 120);
    this.indoor = definition.interior && backdrop !== "stars";
  }

  draw(): void {
    this.drawSky();
    this.layer = "distant";
    this.drawDistance();
    this.layer = "ground";
    this.drawGround();
    this.layer = "landmark";
    this.drawLandmark();
    this.layer = "foreground";
    this.drawForeground();
  }

  private rect(color: number, x: number, y: number, width: number, height: number, alpha = 1): void {
    this.primitives.push({
      kind: "rect", layer: this.layer, color, alpha,
      x: Math.round(x), y: Math.round(y),
      width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)),
    });
  }

  private oval(color: number, x: number, y: number, width: number, height: number, alpha = 1): void {
    this.primitives.push({
      kind: "ellipse", layer: this.layer, color, alpha,
      x: Math.round(x), y: Math.round(y),
      width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)),
    });
  }

  private polygon(color: number, points: readonly (readonly [number, number])[], alpha = 1): void {
    this.primitives.push({
      kind: "polygon", layer: this.layer, color, alpha,
      points: points.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y) })),
    });
  }

  private drawSky(): void {
    const { sky } = this.colors;
    const night = this.definition.period === "night" || this.backdrop === "stars";
    this.rect(sky[0], LEFT, -64, RIGHT - LEFT, GAME_HEIGHT + 128);
    for (let band = 0; band < 12; band++) {
      const progress = band / 11;
      const color = progress < 0.5
        ? mixColor(sky[0], sky[1], progress * 2)
        : mixColor(sky[1], sky[2], (progress - 0.5) * 2);
      this.rect(night ? mixColor(color, 0x101b37, 0.35) : color, LEFT, -64 + band * 24, RIGHT - LEFT, 25);
    }
    if (this.indoor) return;
    if (night) {
      for (let index = 0; index < 38; index++) {
        this.rect(index % 3 === 0 ? this.definition.accent : 0xe1e7d8,
          LEFT + this.random() * (RIGHT - LEFT), 12 + this.random() * 148, index % 7 === 0 ? 3 : 2, 2, 0.8);
      }
    }
    const sunX = 64 + this.random() * 510;
    const sunY = this.definition.period === "day" ? 65 : 112;
    const light = night ? 0xdce9e4 : 0xffe6a9;
    this.rect(light, sunX - 18, sunY - 24, 36, 48, 0.85);
    this.rect(light, sunX - 24, sunY - 18, 48, 36, 0.85);
    this.rect(light, sunX - 28, sunY - 8, 56, 16, 0.85);
    for (let cloud = 0; cloud < 7; cloud++) {
      const x = LEFT + cloud * 190 + this.random() * 50;
      const y = 44 + this.random() * 78;
      this.rect(night ? 0x65738e : 0xe6e1d3, x, y, 100, 10, 0.45);
      this.rect(night ? 0x8290a4 : 0xf7ecda, x + 20, y - 9, 56, 9, 0.4);
    }
    if (this.backdrop === "sea" && this.definition.state === "threat") {
      for (let cloud = 0; cloud < 8; cloud++) {
        this.rect(0x26374d, LEFT + cloud * 178, 68 + (cloud % 3) * 13, 184, 27, 0.8);
      }
    }
    if (this.backdrop === "stars") {
      this.oval(0x6a4899, 200, 80, 310, 92, 0.3);
      this.oval(0x3575a2, 420, 108, 340, 80, 0.3);
      for (let index = 0; index < 12; index++) {
        const angle = index * Math.PI / 6;
        const x = 320 + Math.cos(angle) * 142;
        const y = 82 + Math.sin(angle) * 45;
        this.ribbon(0x8ba9ce, x, y,
          320 + Math.cos(angle + Math.PI / 6) * 142, 82 + Math.sin(angle + Math.PI / 6) * 45, 2, 0.55);
        this.rect(index % 3 === 0 ? 0xefbd7a : index % 3 === 1 ? 0x89cdd1 : 0xc3a3db, x - 3, y - 3, 6, 6);
      }
      for (const [offset, color] of [[-36, 0xefbd7a], [0, 0x89cdd1], [36, 0xc3a3db]] as const) {
        this.polygon(color, [[320 + offset, 61], [332 + offset, 79], [320 + offset, 99], [308 + offset, 79]], 0.9);
      }
    }
  }

  private drawDistance(): void {
    const c = this.colors;
    if (this.indoor) {
      for (let row = 0; row < 6; row++) {
        for (let column = 0; column < 14; column++) {
          this.rect(mixColor(c.stone, c.near, 0.42 + this.random() * 0.2),
            LEFT + column * 96 - (row % 2) * 48, row * 37, 92, 33);
        }
      }
      for (let x = LEFT + 28; x < RIGHT; x += 144) {
        this.rect(c.near, x, 38, 28, 202);
        this.rect(c.stone, x + 4, 42, 7, 192);
        this.polygon(c.far, [[x - 6, 42], [x + 14, 14], [x + 36, 42]]);
      }
      this.oval(mixColor(this.definition.accent, c.near, 0.6), this.center, 116, 132, 156);
      this.rect(c.near, this.center - 48, 82, 96, 142);
      this.rect(this.definition.accent, this.center - 34, 96, 68, 96, 0.34);
      for (const x of [70, 570]) {
        this.rect(c.wood, x - 4, 201, 8, 24);
        this.flame(x, 202, 20);
      }
      return;
    }
    if (this.backdrop === "sea") {
      this.rect(c.far, LEFT, 216, RIGHT - LEFT, 13);
      this.rect(c.water, LEFT, 229, RIGHT - LEFT, 10);
      for (let wave = 0; wave < 8; wave++) {
        this.rect(0xa6c9cd, LEFT + wave * 172 + this.random() * 36, 226, 85, 2, 0.5);
      }
      return;
    }
    for (let layer = 0; layer < 2; layer++) {
      for (let index = 0; index < 9; index++) {
        const x = LEFT + index * 166 + (layer ? -50 : 0);
        const peak = 124 + this.random() * 72 + layer * 24;
        const color = layer ? c.near : c.far;
        this.polygon(color, [[x - 50, 246], [x + 65, peak], [x + 215, 246]]);
        if (this.backdrop === "frost" || this.backdrop === "mountain") {
          this.polygon(0xc9d8d8, [[x + 35, peak + 38], [x + 65, peak], [x + 100, peak + 38], [x + 67, peak + 27]]);
        }
      }
    }
    if (this.backdrop === "city" || this.backdrop === "heartlands") {
      for (let index = 0; index < 9; index++) {
        const x = LEFT + index * 160 + this.random() * 30;
        this.house(x, 227, 62, 42 + this.random() * 24, c.far, c.roof);
      }
    } else if (this.backdrop === "forest" || this.backdrop === "marsh") {
      for (let index = 0; index < 15; index++) this.tree(LEFT + index * 92, 234, 45 + this.random() * 48);
    }
  }

  private drawGround(): void {
    const c = this.colors;
    const water = this.backdrop === "sea" || this.backdrop === "marsh"
      || this.definition.structure === "harbor" || this.definition.structure === "ferry";
    this.rect(water ? c.water : c.ground, LEFT, 236, RIGHT - LEFT, GAME_HEIGHT - 172);
    if (water) {
      for (let index = 0; index < 44; index++) {
        this.rect(index % 3 === 0 ? 0xafd0c4 : c.near,
          LEFT + this.random() * (RIGHT - LEFT), 240 + this.random() * 88, 8 + this.random() * 66, 2, 0.55);
      }
    } else {
      this.polygon(c.path, [[this.center - 12, 236], [this.center + 16, 236], [540, 348], [80, 348]]);
      for (let row = 0; row < 7; row++) {
        const y = 241 + row * 13;
        this.rect(mixColor(c.path, c.ground, 0.45), LEFT, y, RIGHT - LEFT, 2, 0.65);
        if (this.indoor) {
          for (let column = 0; column < 7; column++) {
            this.rect(c.near, column * 110 - row * 8, y + 3, 2, 9, 0.7);
          }
        }
      }
    }
    this.rect(mixColor(c.ground, 0x111a26, 0.5), LEFT, 337, RIGHT - LEFT, GAME_HEIGHT - 273);
  }

  private drawLandmark(): void {
    const c = this.colors;
    const x = this.center;
    const accent = this.definition.accent;
    const restored = this.definition.state === "restored";
    if (this.backdrop === "stars") {
      this.arch(x, 254, 158, 118, c.stone);
      this.oval(c.water, x, 254, 216, 26);
      for (let index = 0; index < 7; index++) {
        this.rect(accent, x - 90 + index * 30, 246, 4, 4, 0.85);
      }
      return;
    }
    switch (this.definition.structure) {
      case "road": case "iceRoad": case "reedRoad": case "forgeRoad": case "ashRoad":
        this.arch(x + 95, 249, 112, 124, c.stone);
        this.rect(accent, x + 72, 166, 46, 8);
        this.waystone(x - 138, 256, accent);
        this.waystone(x + 196, 256, accent);
        if (this.definition.structure === "reedRoad") this.dock(x - 115, 264, 230);
        if (this.definition.structure === "ashRoad") this.brokenBarrier(x, 246);
        break;
      case "bells": case "watch": case "beacon":
        this.house(x - 38, 250, 76, 158, c.stone, c.roof);
        this.rect(c.near, x - 20, 111, 40, 35);
        this.oval(accent, x, 133, 22, 22);
        this.rect(accent, x - 14, 139, 28, 4);
        for (const side of [-1, 1]) {
          this.house(x + side * 115 - 34, 250, 68, 56, c.stone, c.roof);
        }
        if (this.definition.structure === "beacon") this.flame(x, 89, 32);
        break;
      case "archive": case "library": case "keep": case "covenantHall": case "restoredTown":
        this.house(x - 111, 252, 222, this.definition.structure === "keep" ? 142 : 110, c.stone, c.roof);
        this.arch(x, 252, 62, 82, c.path);
        for (const side of [-1, 1]) {
          this.house(x + side * 153 - 27, 252, 54, 152, c.stone, c.roof);
          this.rect(accent, x + side * 147 - 9, 155, 18, 48);
        }
        if (this.definition.structure === "library") {
          for (let index = 0; index < 6; index++) this.rect(c.path, x - 95 + index * 36, 174, 9, 72);
        }
        if (this.definition.structure === "restoredTown") {
          for (let index = 0; index < 5; index++) this.rect(accent, x - 92 + index * 46, 104 + (index % 2) * 10, 12, 18);
        }
        break;
      case "rootBridge": case "bridge": case "chainBridge": case "raisedGate":
        this.dock(x - 190, 245, 380);
        for (const side of [-1, 1]) {
          this.rect(c.stone, x + side * 180 - 12, 152, 24, 114);
          this.polygon(c.wood, [[x + side * 180, 161], [x, 195], [x + side * 180, 166]]);
        }
        if (this.definition.structure === "rootBridge") {
          this.tree(x - 200, 254, 138);
          this.tree(x + 200, 254, 138);
          this.polygon(c.wood, [[x - 212, 177], [x - 40, 140], [x + 70, 159], [x + 200, 176], [x + 185, 190], [x - 40, 157]]);
        } else if (this.definition.structure === "raisedGate") {
          this.arch(x, 244, 170, 140, c.stone);
          this.rect(accent, x - 64, 107, 128, 12);
        } else if (this.definition.structure === "chainBridge") {
          this.flame(x - 176, 150, 18);
          this.flame(x + 176, 150, 18);
        }
        break;
      case "sunArch": case "cryptDoor": case "forgeGate":
        this.arch(x, 254, 190, 156, c.stone);
        for (let index = 0; index < 7; index++) this.rect(accent, x - 76 + index * 24, 147 - Math.abs(index - 3) * 9, 8, 8);
        for (let step = 0; step < 4; step++) this.rect(c.path, x - 95 - step * 12, 243 + step * 6, 190 + step * 24, 5);
        if (this.definition.structure === "forgeGate") this.chains(x, restored);
        break;
      case "rootHall": case "shrine":
        if (this.definition.structure === "rootHall") {
          this.tree(x, 252, 204);
          this.arch(x, 252, 84, 100, c.wood);
          this.oval(c.near, x, 228, 62, 70);
        } else {
          this.oval(c.path, x, 249, 250, 36);
          for (let index = 0; index < 7; index++) this.waystone(x - 126 + index * 42, 247 - (index % 2) * 18, accent);
        }
        this.flame(x - 113, 212, 18);
        this.flame(x + 113, 212, 18);
        break;
      case "iceHall": case "iceCavern": case "wardenGate": case "giantPass":
        for (const side of [-1, 1]) {
          this.polygon(c.stone, [[x + side * 82, 260], [x + side * 170, 77], [x + side * 228, 255]]);
          this.polygon(0xd9f0e9, [[x + side * 122, 200], [x + side * 170, 77], [x + side * 179, 222]], 0.8);
          this.rect(accent, x + side * 155 - 5, 194, 10, 46);
        }
        this.oval(c.water, x, 259, restored ? 230 : 130, 24);
        if (this.definition.structure !== "giantPass") {
          this.arch(x, 253, 150, 143, c.stone);
          for (let index = 0; index < (restored ? 4 : 9); index++) {
            this.polygon(0xb5e1e9, [[x - 72 + index * 18, 118], [x - 64 + index * 18, 156 + this.random() * 18], [x - 56 + index * 18, 118]]);
          }
        } else this.waystone(x + 15, 250, accent);
        break;
      case "harbor": case "ferry": case "stilts": case "hydraPool": case "krakenWake":
        this.drawWaterLandmark(x, restored);
        break;
      case "foundry": case "greatAnvil":
        this.house(x - 120, 254, 240, 106, c.stone, c.roof);
        for (const side of [-1, 1]) this.rect(c.near, x + side * 85 - 13, 69, 26, 111);
        this.arch(x, 254, 112, 100, c.path);
        this.flame(x, 228, restored ? 42 : 62);
        this.chains(x, restored);
        this.polygon(c.near, [[x - 70, 237], [x + 72, 237], [x + 47, 253], [x - 43, 253]]);
        this.rect(c.stone, x - 20, 252, 40, 18);
        break;
      case "altar": case "observatory": case "lichThrone":
        this.drawSanctum(x, restored);
        break;
      case "yard": case "camp":
        this.house(x + 48, 248, 112, 78, c.stone, c.roof);
        this.dock(x - 200, 252, 126);
        for (let index = 0; index < 4; index++) {
          this.rect(c.wood, x - 185 + index * 29, 194, 5, 52);
          this.oval(accent, x - 182 + index * 29, 211, 20, 25);
        }
        this.polygon(accent, [[x - 48, 249], [x - 5, 183], [x + 33, 249]]);
        this.flame(x + 25, 253, 18);
        break;
      case "trollCave": case "dragonCrater": case "wyrmRift": case "drakeLedge":
        this.drawArena(x, restored);
        break;
    }
  }

  private drawWaterLandmark(x: number, restored: boolean): void {
    const c = this.colors;
    const accent = this.definition.accent;
    switch (this.definition.structure) {
      case "harbor": case "ferry":
        this.dock(x - 228, 264, 456);
        for (let index = 0; index < (this.definition.structure === "harbor" ? 3 : 1); index++) {
          const mast = x - 126 + index * 122;
          this.rect(c.wood, mast, 126, 5, 129);
          this.polygon(accent, [[mast + 7, 137], [mast + 73, 198], [mast + 7, 198]]);
          this.polygon(c.near, [[mast - 40, 242], [mast + 75, 242], [mast + 51, 261], [mast - 20, 261]]);
        }
        break;
      case "stilts":
        for (let index = 0; index < 3; index++) {
          const left = x - 175 + index * 125;
          this.house(left, 230, 92, 64, c.wood, c.roof);
          this.rect(c.wood, left + 9, 228, 6, 40);
          this.rect(c.wood, left + 78, 228, 6, 40);
        }
        this.dock(x - 210, 265, 420);
        break;
      case "hydraPool":
        this.oval(c.near, x, 251, 342, 50);
        this.oval(c.water, x, 246, 300, 39);
        for (let index = 0; index < 7; index++) {
          const root = x - 172 + index * 57;
          this.rect(c.wood, root, 176 + (index % 2) * 21, 8, 74);
          this.polygon(c.wood, [[root, 215], [root - 23, 186], [root + 5, 206], [root + 23, 183], [root + 11, 222]]);
          if (restored) this.oval(accent, root + 17, 246, 20, 7);
        }
        break;
      default:
        for (let ring = 0; ring < (restored ? 3 : 7); ring++) {
          this.oval(ring % 2 ? c.near : c.water, x + 70, 244,
            272 - ring * 30, 56 - ring * 5);
        }
        this.dock(x - 300, 294, 338);
        this.rect(c.wood, x - 213, 94, 7, 185);
        this.polygon(accent, [[x - 205, 108], [x - 112, 189], [x - 205, 189]]);
        if (restored) {
          this.polygon(c.foliage, [[x + 190, 231], [x + 226, 204], [x + 290, 231]]);
          for (let bird = 0; bird < 4; bird++) this.polygon(0xe9e9d8,
            [[x + 100 + bird * 26, 95], [x + 108 + bird * 26, 100], [x + 116 + bird * 26, 95], [x + 108 + bird * 26, 103]]);
        }
    }
  }

  private drawSanctum(x: number, restored: boolean): void {
    const c = this.colors;
    const accent = this.definition.accent;
    for (let step = 0; step < 4; step++) this.rect(c.stone, x - 100 + step * 14, 260 - step * 10, 200 - step * 28, 9);
    for (const side of [-1, 1]) {
      this.rect(c.near, x + side * 125 - 12, 93, 24, 161);
      this.rect(accent, x + side * 125 - 4, 110, 8, 120, 0.55);
    }
    if (this.definition.structure === "lichThrone") {
      this.rect(c.near, x - 54, 135, 108, 108);
      this.polygon(c.stone, [[x - 62, 139], [x - 32, 82], [x, 110], [x + 32, 82], [x + 62, 139]]);
      this.rect(c.path, x - 46, 219, 92, 12);
      if (!restored) this.polygon(accent, [[x - 23, 115], [x - 18, 92], [x - 4, 108], [x + 8, 87], [x + 22, 115]]);
      else for (let piece = 0; piece < 5; piece++) this.rect(accent, x - 57 + piece * 28, 247 + (piece % 2) * 5, 12, 4);
    } else {
      this.polygon(accent, [[x, 144], [x + 24, 172], [x, 205], [x - 24, 172]]);
      this.polygon(0xe6f4df, [[x, 147], [x + 9, 173], [x, 195]], 0.85);
      for (let rune = 0; rune < 8; rune++) {
        this.rect(accent, x - 87 + rune * 25, 105 + Math.abs(rune - 3.5) * 11, 5, 7);
      }
      if (this.definition.structure === "observatory") this.arch(x, 244, 242, 170, c.stone);
    }
  }

  private drawArena(x: number, restored: boolean): void {
    const c = this.colors;
    if (this.definition.structure === "trollCave") {
      this.polygon(c.stone, [[x - 190, 259], [x - 134, 140], [x - 44, 99], [x + 100, 121], [x + 182, 259]]);
      this.oval(c.near, x, 205, 216, 125);
      this.oval(restored ? c.path : 0x18272a, x, 218, 142, 110);
      for (let rock = 0; rock < (restored ? 5 : 10); rock++) this.oval(c.far,
        x - 153 + rock * 34, 248 + (rock % 2) * 7, 36, 22);
      this.tree(x - 198, 250, 135);
    } else if (this.definition.structure === "drakeLedge") {
      this.polygon(c.stone, [[x - 186, 257], [x - 121, 113], [x - 28, 106], [x + 65, 257]]);
      this.rect(c.path, x - 154, 122, 153, 12);
      for (let twig = 0; twig < (restored ? 5 : 9); twig++) this.polygon(c.wood,
        [[x - 143 + twig * 12, 119], [x - 118 + twig * 12, 105], [x - 116 + twig * 12, 109]]);
      this.arch(x + 127, 256, 116, 114, c.stone);
    } else {
      this.oval(c.near, x, 254, 370, 66);
      const lava = restored ? c.stone : c.water;
      this.polygon(lava, [[x - 165, 247], [x - 95, 227], [x - 26, 241], [x + 63, 209], [x + 157, 241], [x + 74, 257], [x - 51, 253]]);
      for (let spire = 0; spire < 7; spire++) {
        const left = x - 190 + spire * 62;
        this.polygon(c.stone, [[left, 250], [left + 17, 158 + this.random() * 53], [left + 40, 250]]);
      }
      if (!restored) {
        for (const side of [-1, 1]) this.flame(x + side * 77, 247, this.definition.structure === "wyrmRift" ? 60 : 34);
      } else {
        for (let fragment = 0; fragment < 9; fragment++) this.rect(c.path, x - 140 + fragment * 34, 250 + (fragment % 2) * 9, 14, 5);
      }
    }
  }

  private drawForeground(): void {
    const c = this.colors;
    if (this.backdrop === "sea") this.dock(LEFT, 315, RIGHT - LEFT);
    if (this.definition.structure === "harbor" || this.definition.structure === "ferry") {
      this.dock(LEFT, 298, RIGHT - LEFT);
    }
    for (let index = 0; index < 18; index++) {
      const x = LEFT + index * 75 + this.random() * 24;
      const y = 272 + this.random() * 48;
      if (this.backdrop === "sea") {
        this.rect(0xafd0c4, x, y, 18 + this.random() * 20, 2, 0.6);
      } else if (this.definition.structure === "harbor" || this.definition.structure === "ferry") {
        if (index % 3 === 0) {
          this.oval(c.wood, x, 295, 18, 24);
          this.rect(c.path, x - 8, 288, 16, 2);
          this.rect(c.path, x - 8, 300, 16, 2);
        }
      } else if (this.indoor) {
        this.rect(c.stone, x, y, 14 + this.random() * 16, 5);
        this.rect(c.path, x + 3, y - 2, 8, 2);
      } else {
        this.rect(c.foliage, x, y - 13, 3, 20);
        this.rect(c.foliage, x - 6, y - 5, 14, 3);
        if (this.definition.state === "restored") {
          this.rect(this.definition.accent, x - 3, y - 15, 8, 5);
        } else {
          this.rect(c.stone, x + 12, y + 4, 14, 6);
        }
      }
    }
    for (const side of [LEFT + 70, RIGHT - 100]) {
      if (!this.indoor && this.backdrop !== "sea") this.tree(side, 323, 150);
      else {
        this.rect(c.near, side, 43, 30, 285);
        this.rect(c.stone, side + 5, 54, 6, 264);
      }
    }
    this.rect(0x101823, LEFT, 327, RIGHT - LEFT, 10, 0.35);
  }

  private house(x: number, base: number, width: number, height: number, wall: number, roof: number): void {
    this.rect(wall, x, base - height, width, height);
    this.rect(mixColor(wall, 0x182432, 0.3), x + width - 9, base - height, 9, height);
    this.polygon(roof, [[x - 8, base - height], [x + width / 2, base - height - 31], [x + width + 8, base - height]]);
    this.rect(this.colors.near, x + width / 2 - 9, base - 34, 18, 34);
    for (let window = 0; window < 3; window++) {
      this.rect(this.definition.accent, x + 12 + window * (width - 30) / 3, base - height + 24, 9, 13);
    }
  }

  private tree(x: number, base: number, height: number): void {
    this.rect(this.colors.wood, x - 8, base - height * 0.7, 16, height * 0.7);
    for (let crown = 0; crown < 3; crown++) {
      this.polygon(crown === 1 ? this.colors.foliage : this.colors.near, [
        [x - height * (0.32 - crown * 0.04), base - height * (0.35 + crown * 0.18)],
        [x, base - height * (0.72 + crown * 0.14)],
        [x + height * (0.32 - crown * 0.04), base - height * (0.35 + crown * 0.18)],
      ]);
    }
  }

  private arch(x: number, base: number, width: number, height: number, color: number): void {
    for (const side of [-1, 1]) {
      this.rect(color, x + side * width / 2 - 13, base - height + 32, 26, height - 32);
      this.rect(this.colors.path, x + side * width / 2 - 9, base - height + 38, 6, height - 39);
    }
    this.polygon(color, [[x - width / 2 - 18, base - height + 37], [x - width / 2 + 8, base - height], [x + width / 2 - 8, base - height], [x + width / 2 + 18, base - height + 37]]);
    this.rect(this.definition.accent, x - 12, base - height + 8, 24, 16);
  }

  private dock(x: number, y: number, width: number): void {
    this.rect(this.colors.wood, x, y, width, 15);
    for (let plank = x + 4; plank < x + width; plank += 27) {
      this.rect(this.colors.path, plank, y + 2, 2, 11, 0.7);
    }
    for (const side of [x + 12, x + width - 18]) this.rect(this.colors.near, side, y - 17, 7, 42);
  }

  private waystone(x: number, base: number, accent: number): void {
    this.rect(this.colors.stone, x - 12, base - 42, 24, 42);
    this.polygon(this.colors.path, [[x - 12, base - 42], [x, base - 55], [x + 12, base - 42]]);
    this.rect(accent, x - 4, base - 31, 8, 12);
  }

  private flame(x: number, base: number, size: number): void {
    this.rect(this.colors.near, x - size / 2, base, size, 8);
    this.polygon(0xe8854d, [[x - size / 2, base], [x - 7, base - size], [x, base - size * 0.6], [x + size / 2, base]]);
    this.polygon(this.definition.accent, [[x - size / 4, base], [x + 3, base - size * 0.7], [x + size / 4, base]]);
  }

  private chains(x: number, broken: boolean): void {
    for (const side of [-1, 1]) {
      for (let link = 0; link < (broken ? 3 : 10); link++) {
        this.rect(this.colors.path, x + side * 68 - (link % 2) * 3, 64 + link * 16, 7, 11);
      }
    }
  }

  private brokenBarrier(x: number, base: number): void {
    for (const side of [-1, 1]) {
      this.rect(this.colors.wood, x + side * 69, base - 32, 7, 39);
      this.polygon(this.colors.wood, [[x + side * 76, base - 23], [x + side * 150, base - 9], [x + side * 150, base - 3], [x + side * 76, base - 17]]);
    }
  }

  private ribbon(
    color: number, x1: number, y1: number, x2: number, y2: number, width: number, alpha: number,
  ): void {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const dx = (y2 - y1) / length * width / 2;
    const dy = (x2 - x1) / length * width / 2;
    this.polygon(color, [[x1 - dx, y1 + dy], [x2 - dx, y2 + dy], [x2 + dx, y2 - dy], [x1 + dx, y1 - dy]], alpha);
  }
}

function mixColor(from: number, to: number, amount: number): number {
  const channel = (shift: number): number =>
    Math.round(((from >> shift) & 255) * (1 - amount) + ((to >> shift) & 255) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

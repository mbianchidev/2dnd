import { forEachEllipseSpan, forEachPolygonSpan } from "../systems/pixelArt";
import type { PixelPoint } from "../systems/pixelArt";

interface RasterGraphicsTarget {
  fillStyle(color: number, alpha?: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
}

/** The same hard-edged raster grid used for world art, without flattening scene depth bands. */
export class PixelSceneryGraphics {
  private fillColor = 0xffffff;
  private fillAlpha = 1;
  private strokeColor = 0xffffff;
  private strokeAlpha = 1;
  private thickness = 1;
  private path: PixelPoint[] = [];

  constructor(
    private readonly graphics: RasterGraphicsTarget,
    readonly pixelSize = 2,
  ) {
    if (!Number.isInteger(pixelSize) || pixelSize < 1 || pixelSize > 4) {
      throw new Error("[scenery] Pixel size must be an integer from 1 to 4.");
    }
  }

  fillStyle(color: number, alpha = 1): this {
    this.fillColor = color;
    this.fillAlpha = alpha;
    this.graphics.fillStyle(color, alpha);
    return this;
  }

  fillRect(x: number, y: number, width: number, height: number): this {
    if (width <= 0 || height <= 0) return this;
    const step = this.pixelSize;
    const left = Math.round(x / step) * step;
    const top = Math.round(y / step) * step;
    this.graphics.fillRect(left, top, Math.max(step, Math.round(width / step) * step),
      Math.max(step, Math.round(height / step) * step));
    return this;
  }

  fillEllipse(x: number, y: number, width: number, height: number): this {
    const step = this.pixelSize;
    const rx = width / (2 * step);
    const ry = height / (2 * step);
    const cx = Math.round(x / step);
    const cy = Math.round(y / step);
    forEachEllipseSpan(cx, cy, rx, ry, (left, top, w, h) => this.graphics.fillRect(left * step, top * step, w * step, h * step));
    return this;
  }

  fillCircle(x: number, y: number, radius: number): this {
    return this.fillEllipse(x, y, radius * 2, radius * 2);
  }

  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    return this.beginPath().moveTo(x1, y1).lineTo(x2, y2).lineTo(x3, y3).closePath().fillPath();
  }

  beginPath(): this { this.path = []; return this; }
  moveTo(x: number, y: number): this { this.path.push({ x, y }); return this; }
  lineTo(x: number, y: number): this { this.path.push({ x, y }); return this; }
  closePath(): this {
    if (this.path[0]) this.path.push(this.path[0]);
    return this;
  }

  fillPath(): this {
    const step = this.pixelSize;
    if (this.path.length < 3) throw new Error("[scenery] A polygon needs at least three points.");
    const points = this.path.map(({ x, y }) => ({ x: Math.round(x / step), y: Math.round(y / step) }));
    forEachPolygonSpan(points, (x, y, w, h) => this.graphics.fillRect(x * step, y * step, w * step, h * step));
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1): this {
    this.thickness = width;
    this.strokeColor = color;
    this.strokeAlpha = alpha;
    return this;
  }

  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / this.pixelSize));
    this.graphics.fillStyle(this.strokeColor, this.strokeAlpha);
    for (let index = 0; index <= count; index++) {
      this.fillRect(x1 + (x2 - x1) * index / count, y1 + (y2 - y1) * index / count,
        this.thickness, this.thickness);
    }
    this.graphics.fillStyle(this.fillColor, this.fillAlpha);
    return this;
  }

  strokePath(): this {
    for (let index = 1; index < this.path.length; index++) {
      const a = this.path[index - 1]!;
      const b = this.path[index]!;
      this.lineBetween(a.x, a.y, b.x, b.y);
    }
    return this;
  }

  strokeCircle(x: number, y: number, radius: number): this {
    this.beginPath();
    for (let index = 0; index <= 16; index++) {
      const angle = index * Math.PI / 8;
      this.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    return this.strokePath();
  }
}

export interface SceneryPainter {
  fillStyle(color: number, alpha?: number): SceneryPainter;
  fillRect(x: number, y: number, width: number, height: number): SceneryPainter;
  lineStyle(width: number, color: number, alpha?: number): SceneryPainter;
  lineBetween(x1: number, y1: number, x2: number, y2: number): SceneryPainter;
  beginPath(): SceneryPainter;
  moveTo(x: number, y: number): SceneryPainter;
  lineTo(x: number, y: number): SceneryPainter;
  closePath(): SceneryPainter;
  fillPath(): SceneryPainter;
}

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

export function shadePixelColor(color: number, amount: number): number {
  const channel = (value: number): number => Math.max(0, Math.min(255, value + amount));
  return (channel((color >> 16) & 255) << 16)
    | (channel((color >> 8) & 255) << 8) | channel(color & 255);
}

/** Coordinate noise is independent of gameplay RNG and stable across tile boundaries. */
export function artNoise(x: number, y: number, seed = 0): number {
  let value = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

/** Small integer-raster painter shared by procedural terrain, people and creatures. */
export class PixelSurface {
  readonly pixels: Uint8ClampedArray;

  constructor(readonly width: number, readonly height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height)
      || width < 1 || height < 1 || width > 512 || height > 512) {
      throw new Error("Pixel-art dimensions must be integers from 1 to 512.");
    }
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }

  pixel(x: number, y: number, color: number, alpha = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (y * this.width + x) * 4;
    this.pixels[index] = (color >> 16) & 255;
    this.pixels[index + 1] = (color >> 8) & 255;
    this.pixels[index + 2] = color & 255;
    this.pixels[index + 3] = alpha;
  }

  rect(x: number, y: number, width: number, height: number, color: number, alpha = 255): void {
    const right = Math.min(this.width, Math.ceil(x + width));
    const bottom = Math.min(this.height, Math.ceil(y + height));
    for (let row = Math.max(0, Math.floor(y)); row < bottom; row++) {
      for (let column = Math.max(0, Math.floor(x)); column < right; column++) {
        this.pixel(column, row, color, alpha);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: number, alpha = 255): void {
    if (rx <= 0 || ry <= 0) return;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)));
      this.rect(Math.ceil(cx - span), y, span * 2 + 1, 1, color, alpha);
    }
  }

  polygon(points: readonly PixelPoint[], color: number, alpha = 255): void {
    if (points.length < 3) return;
    const top = Math.max(0, Math.ceil(Math.min(...points.map((point) => point.y))));
    const bottom = Math.min(this.height - 1, Math.floor(Math.max(...points.map((point) => point.y))));
    for (let y = top; y <= bottom; y++) {
      const crossings: number[] = [];
      for (let index = 0; index < points.length; index++) {
        const a = points[index]!;
        const b = points[(index + 1) % points.length]!;
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          crossings.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let index = 0; index + 1 < crossings.length; index += 2) {
        const left = Math.ceil(crossings[index]!);
        this.rect(left, y, Math.floor(crossings[index + 1]!) - left + 1, 1, color, alpha);
      }
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, color: number, thickness = 1): void {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
    for (let step = 0; step <= steps; step++) {
      this.rect(Math.round(x1 + (x2 - x1) * step / steps),
        Math.round(y1 + (y2 - y1) * step / steps), thickness, thickness, color);
    }
  }

  volume(cx: number, cy: number, rx: number, ry: number, color: number, outline = 0x20252b): void {
    this.ellipse(cx, cy, rx + 1, ry + 1, outline);
    this.ellipse(cx, cy, rx, ry, shadePixelColor(color, -28));
    this.ellipse(cx - rx * 0.13, cy - ry * 0.15, rx * 0.87, ry * 0.83, color);
    this.ellipse(cx - rx * 0.27, cy - ry * 0.35, rx * 0.51, ry * 0.45, shadePixelColor(color, 29));
  }

  texture(color: number, seed: number, density = 10, amount = 13): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const noise = artNoise(x, y, seed);
        if (noise % density === 0 && this.pixels[(y * this.width + x) * 4 + 3] === 255) {
          this.pixel(x, y, shadePixelColor(color, noise % 2 === 0 ? amount : -amount));
        }
      }
    }
  }
}

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const ICON_SIZES = Object.freeze([16, 32, 48, 64, 128, 256, 512, 1024]);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const COLORS = Object.freeze({
  transparent: [0, 0, 0, 0],
  background: [13, 16, 36, 255],
  backgroundLight: [26, 31, 62, 255],
  gold: [255, 215, 0, 255],
  goldLight: [255, 239, 139, 255],
  ink: [5, 7, 18, 255],
});
const GLYPHS = Object.freeze({
  "2": ["111", "001", "111", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const rowLength = size * 4;
  const filtered = Buffer.alloc((rowLength + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const targetOffset = y * (rowLength + 1);
    filtered[targetOffset] = 0;
    pixels.copy(
      filtered,
      targetOffset + 1,
      y * rowLength,
      (y + 1) * rowLength,
    );
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk("IHDR", header),
    createPngChunk("IDAT", deflateSync(filtered, { level: 9 })),
    createPngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || x >= 32 || y < 0 || y >= 32) return;
  const offset = (y * 32 + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function fillPolygon(pixels, points, color) {
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      let inside = false;
      for (
        let current = 0, previous = points.length - 1;
        current < points.length;
        previous = current, current += 1
      ) {
        const [currentX, currentY] = points[current];
        const [previousX, previousY] = points[previous];
        const crosses = (currentY > y) !== (previousY > y)
          && x < (
            (previousX - currentX) * (y - currentY)
            / (previousY - currentY)
            + currentX
          );
        if (crosses) inside = !inside;
      }
      if (inside) setPixel(pixels, x, y, color);
    }
  }
}

function drawLine(pixels, startX, startY, endX, endY, color) {
  const deltaX = Math.abs(endX - startX);
  const deltaY = -Math.abs(endY - startY);
  const stepX = startX < endX ? 1 : -1;
  const stepY = startY < endY ? 1 : -1;
  let error = deltaX + deltaY;
  let x = startX;
  let y = startY;
  while (true) {
    setPixel(pixels, x, y, color);
    if (x === endX && y === endY) return;
    const doubled = 2 * error;
    if (doubled >= deltaY) {
      error += deltaY;
      x += stepX;
    }
    if (doubled <= deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}

function drawGlyph(pixels, glyph, startX, startY, scale, color) {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let column = 0; column < glyph[row].length; column += 1) {
      if (glyph[row][column] !== "1") continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          setPixel(
            pixels,
            startX + column * scale + x,
            startY + row * scale + y,
            color,
          );
        }
      }
    }
  }
}

function createBasePixels() {
  const pixels = Buffer.alloc(32 * 32 * 4);
  for (let y = 1; y < 31; y += 1) {
    for (let x = 1; x < 31; x += 1) {
      const cornerDistance = Math.hypot(
        Math.max(0, 5 - Math.min(x, 31 - x)),
        Math.max(0, 5 - Math.min(y, 31 - y)),
      );
      if (cornerDistance <= 5) {
        setPixel(
          pixels,
          x,
          y,
          x <= 2 || x >= 29 || y <= 2 || y >= 29
            ? COLORS.gold
            : COLORS.background,
        );
      }
    }
  }

  const die = [
    [16, 4],
    [27, 10],
    [27, 21],
    [16, 28],
    [5, 21],
    [5, 10],
  ];
  fillPolygon(pixels, die, COLORS.backgroundLight);
  for (let index = 0; index < die.length; index += 1) {
    const [startX, startY] = die[index];
    const [endX, endY] = die[(index + 1) % die.length];
    drawLine(pixels, startX, startY, endX, endY, COLORS.goldLight);
  }
  drawLine(pixels, 16, 4, 16, 28, COLORS.gold);
  drawLine(pixels, 5, 10, 27, 21, COLORS.gold);
  drawLine(pixels, 27, 10, 5, 21, COLORS.gold);
  drawGlyph(pixels, GLYPHS["2"], 9, 11, 2, COLORS.goldLight);
  drawGlyph(pixels, GLYPHS.D, 18, 11, 2, COLORS.goldLight);
  return pixels;
}

function scalePixels(basePixels, size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.min(31, Math.floor((x / size) * 32));
      const sourceY = Math.min(31, Math.floor((y / size) * 32));
      const sourceOffset = (sourceY * 32 + sourceX) * 4;
      const targetOffset = (y * size + x) * 4;
      basePixels.copy(pixels, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return pixels;
}

function createIco(images) {
  const selectedSizes = [16, 32, 48, 64, 128, 256];
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(selectedSizes.length, 4);
  const directory = Buffer.alloc(selectedSizes.length * 16);
  let offset = header.length + directory.length;
  const payloads = [];
  selectedSizes.forEach((size, index) => {
    const image = images.get(size);
    const entryOffset = index * 16;
    directory[entryOffset] = size === 256 ? 0 : size;
    directory[entryOffset + 1] = size === 256 ? 0 : size;
    directory[entryOffset + 2] = 0;
    directory[entryOffset + 3] = 0;
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(image.length, entryOffset + 8);
    directory.writeUInt32LE(offset, entryOffset + 12);
    offset += image.length;
    payloads.push(image);
  });
  return Buffer.concat([header, directory, ...payloads]);
}

function createIcns(images) {
  const chunks = [
    ["icp4", 16],
    ["icp5", 32],
    ["icp6", 64],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
    ["ic11", 32],
    ["ic12", 64],
    ["ic13", 256],
    ["ic14", 512],
  ].map(([type, size]) => {
    const image = images.get(size);
    const header = Buffer.alloc(8);
    header.write(type, 0, "ascii");
    header.writeUInt32BE(image.length + 8, 4);
    return Buffer.concat([header, image]);
  });
  const totalLength = chunks.reduce(
    (length, chunk) => length + chunk.length,
    8,
  );
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(totalLength, 4);
  return Buffer.concat([header, ...chunks]);
}

const buildDirectory = resolve(process.cwd(), "build");
const linuxDirectory = resolve(buildDirectory, "icons");
await mkdir(linuxDirectory, { recursive: true });

const basePixels = createBasePixels();
const images = new Map();
for (const size of ICON_SIZES) {
  const png = encodePng(size, scalePixels(basePixels, size));
  images.set(size, png);
  await writeFile(resolve(linuxDirectory, `${size}x${size}.png`), png);
}
await writeFile(resolve(buildDirectory, "icon.png"), images.get(1024));
await writeFile(resolve(buildDirectory, "icon.ico"), createIco(images));
await writeFile(resolve(buildDirectory, "icon.icns"), createIcns(images));
process.stdout.write(
  `[desktop] Generated ${ICON_SIZES.length} procedural icon sizes in build/\n`,
);

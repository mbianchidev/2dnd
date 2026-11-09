import { MAP_HEIGHT, MAP_WIDTH, Terrain } from "./mapTypes";
import type { CityChunk, CityData, CityInteriorData, CityShopData, InteriorPropData } from "./mapTypes";
import { INTERIOR_PRIMER_ID, INTERIOR_PRIMER_TEXT, INTERIOR_STUDIES } from "./interiorBooks";

function createRoom(
  city: CityData,
  interior: Omit<CityInteriorData, "bounds" | "props">,
  shop?: CityShopData,
): CityChunk {
  const map = Array.from({ length: MAP_HEIGHT }, () => Array<Terrain>(MAP_WIDTH).fill(Terrain.DungeonWall));
  for (let y = 2; y <= 13; y++) {
    for (let x = 2; x <= 17; x++) {
      map[y]![x] = x === 2 || x === 17 || y === 2 || y === 13 ? Terrain.CityWall : Terrain.ShopFloor;
    }
  }
  map[13]![10] = Terrain.CityGate;
  const props: InteriorPropData[] = [];
  const prop = (kind: InteriorPropData["kind"], label: string, x: number, y: number,
    reward?: InteriorPropData["reward"], text?: readonly string[]): void => {
    const width = kind === "rug" ? 3 : ["sack", "plant", "window", "candle", "chair", "barrel"].includes(kind) ? 1 : 2;
    const height = ["bookshelf", "rack", "pantry", "bed", "hearth", "rug", "window"].includes(kind) ? 2 : 1;
    props.push({ id: `interior:${city.id}:${interior.id}:${kind}:${x},${y}`, kind, label, x, y, width, height, reward, text });
    if (kind !== "rug") {
      for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) {
        map[row]![column] = Terrain.CityWall;
      }
    }
  };
  const library = interior.kind === "library";
  if (library) {
    for (const x of [4, 6, 8, 13, 15]) prop("bookshelf", "Library shelves", x, 4);
    prop("book", `${city.name} travel journal`, 6, 7, { knowledgeId: INTERIOR_PRIMER_ID }, INTERIOR_PRIMER_TEXT);
    prop("table", "Reading table", 10, 8);
    prop("plant", "Potted fern", 15, 11);
    prop("chair", "Reading chair", 8, 8);
    prop("chair", "Reading chair", 13, 9);
    prop("barrel", "Scroll case", 3, 10);
    const study = INTERIOR_STUDIES.find((entry) => entry.cityId === city.id);
    if (study) prop("book", study.label, 14, 7, { studyId: study.id }, [
      `A carefully annotated manuscript explains ${study.label.toLowerCase()}.`,
      `Its exercises require ${study.classIds.join(" / ")} rank ${study.minimumRank} and ${study.stat.toUpperCase()} 13.`,
    ]);
  } else if (interior.kind === "home") {
    prop("hearth", "Warm hearth", 4, 4);
    prop("bed", "Guest bed", 14, 4);
    prop("table", "Kitchen table", 10, 8);
    prop("pantry", "Offered pantry supplies", 4, 9, { itemId: "wildHerbs" });
    prop("sack", "Traveler's purse", 15, 10, { gold: 4 });
    prop("bookshelf", "Household journal", 4, 6);
    prop("chair", "Kitchen chair", 9, 8);
    prop("chair", "Kitchen chair", 13, 8);
    prop("plant", "Kitchen herbs", 8, 4);
    prop("barrel", "Water barrel", 16, 8);
  } else {
    prop("counter", shop?.name ?? "Shop counter", 10, 5);
    prop("rack", shop?.type === "weapon" ? "Weapon rack" : shop?.type === "armor" ? "Armor display" : "Stock shelves", 4, 4);
    prop("rack", "Stock shelves", 6, 4);
    prop("hearth", "Hearth", 15, 4);
    prop("table", "Workshop table", 14, 8);
    prop("sack", "Offered travel coins", 4, 10, { gold: 3 });
    if (shop?.type === "inn" || shop?.type === "general") {
      prop("pantry", "Offered pantry supplies", 15, 10, { itemId: "wildHerbs" });
      prop("bed", "Resting alcove", 5, 7);
    } else prop("plant", "Potted fern", 4, 7);
    prop("bookshelf", "Shopkeeper's journal", 8, 3);
    prop("chair", "Workshop stool", 14, 9);
    prop("plant", "Counter flowers", 8, 6);
    map[6]![10] = Terrain.Carpet;
  }
  for (let y = 3; y < 10; y++) if (y !== 7 && y !== 8) map[y]![12] = Terrain.CityWall;
  prop("rug", library ? "Reading-room rug" : "Woven rug", 9, 10);
  prop("window", "Leadlight window", 2, 4);
  prop("window", "Leadlight window", 17, 4);
  prop("painting", library ? "Map of the Twelve Cities" : "Framed landscape", 6, 2);
  prop("painting", "Woven wall hanging", 13, 2);
  prop("candle", "Brass candle stand", 3, 12);
  prop("candle", "Brass candle stand", 16, 12);
  const name = shop?.name ?? (library ? "Library" : "Guesthouse");
  return {
    name, mapData: map, spawnX: 10, spawnY: 12,
    shops: shop ? [{ ...shop, x: 10, y: 6,
      source: { chunkIndex: interior.sourceChunkIndex, x: shop.x, y: shop.y } }] : [],
    interior: { ...interior, bounds: { x: 2, y: 2, width: 16, height: 12 }, props },
  };
}

/** Append rooms without renumbering any existing street, district, shop or fog identity. */
export function addCityInteriors(source: CityData): CityData {
  const primary: CityChunk = {
    name: source.name, mapData: source.mapData.map((row) => [...row]),
    spawnX: source.spawnX, spawnY: source.spawnY, shops: source.shops,
  };
  const streets = [primary, ...(source.chunks ?? []).map((chunk) => ({
    ...chunk, mapData: chunk.mapData.map((row) => [...row]),
  }))];
  const rooms: CityChunk[] = [];
  const connections = [...source.connections];
  const appendRoom = (sourceChunkIndex: number, x: number, y: number, kind: CityInteriorData["kind"], shopIndex?: number): void => {
    const street = streets[sourceChunkIndex]!;
    const shop = shopIndex === undefined ? undefined : street.shops[shopIndex];
    const id = shop ? `shop:${sourceChunkIndex}:${shop.type}:${shop.x},${shop.y}` : kind;
    const destination = streets.length + rooms.length;
    street.mapData[y]![x] = Terrain.CityGate;
    rooms.push(createRoom(source, {
      id, kind, sourceChunkIndex, sourceShopIndex: shopIndex, sourceX: x, sourceY: y,
    }, shop));
    connections.push(
      { fromChunkIndex: sourceChunkIndex, fromX: x, fromY: y, toChunkIndex: destination, toX: 10, toY: 12 },
      { fromChunkIndex: destination, fromX: 10, fromY: 13, toChunkIndex: sourceChunkIndex, toX: x, toY: y },
    );
  };
  streets.forEach((street, chunkIndex) => {
    street.shops.forEach((shop, index) => {
      if (shop.type !== "stable") appendRoom(chunkIndex, shop.x, shop.y, "shop", index);
    });
  });
  const districtIndex = streets.length > 1 ? 1 : 0;
  const district = streets[districtIndex]!;
  const candidates: Array<{ x: number; y: number }> = [];
  const isBuildingGround = (terrain: Terrain | undefined): boolean => terrain === Terrain.CityFloor || terrain === Terrain.Grass;
  for (let y = 12; y >= 5; y--) {
    for (const x of [4, 15, 6, 13, 8, 11, 7, 12, 3, 16, 5, 14, 9, 17]) {
      const terrain = district.mapData[y]?.[x];
      if ((isBuildingGround(terrain) || terrain === Terrain.CityPath)
        && !district.shops.some((shop) => Math.abs(shop.x - x) + Math.abs(shop.y - y) < 3)
        && !connections.some((entry) => entry.fromChunkIndex === districtIndex
          && entry.fromX === x && entry.fromY === y)) candidates.push({ x, y });
    }
  }
  const placeBuilding = (kind: "library" | "home" | "residence"): void => {
    const width = kind === "library" ? 4 : 3;
    const site = candidates.find(({ x, y }) => {
      if (!isBuildingGround(district.mapData[y + 1]?.[x])) return false;
      for (let row = y - 2; row <= y; row++) {
        for (let column = x - 1; column < x - 1 + width; column++) {
          if (!isBuildingGround(district.mapData[row]?.[column])) return false;
          if (column === district.spawnX && row === district.spawnY) return false;
        }
      }
      return true;
    });
    if (!site) throw new Error(`[interiors] ${source.id} needs a safe ${width}x3 ${kind} footprint.`);
    const { x, y } = site;
    for (let row = y - 2; row <= y; row++) {
      for (let column = x - 1; column < x - 1 + width; column++) district.mapData[row]![column] = Terrain.House;
    }
    district.buildings = [...(district.buildings ?? []), {
      id: `${source.id}:${kind}`, kind, x: x - 1, y: y - 2, width, height: 3,
      ...(kind === "residence" ? {} : { door: { x, y } }),
    }];
    if (kind !== "residence") appendRoom(districtIndex, x, y, kind);
  };
  placeBuilding("library");
  placeBuilding("home");
  placeBuilding("residence");
  return { ...source, mapData: primary.mapData, buildings: primary.buildings,
    chunks: [...streets.slice(1), ...rooms], connections };
}

export function getInteriorForShop(city: CityData, chunkIndex: number, shop: CityShopData): CityChunk | undefined {
  return city.chunks?.find((chunk) => chunk.interior?.kind === "shop"
    && chunk.interior.sourceChunkIndex === chunkIndex && chunk.interior.sourceX === shop.x
    && chunk.interior.sourceY === shop.y);
}

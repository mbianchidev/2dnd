import { getCityChunk, getCityConnectionAt } from "../data/cities";
import type { CityData, CityShopData } from "../data/mapTypes";
import { getTimePeriod, TimePeriod } from "./daynight";

const SERVICE_LABELS: Readonly<Record<CityShopData["type"], string>> = {
  weapon: "WEAPONS",
  armor: "ARMOR",
  magic: "MAGIC / POTIONS",
  inn: "INN 24H",
  bank: "BANK",
  general: "GENERAL",
  stable: "MOUNTS",
};

/** Service hours apply equally to doorways, clerks and special shipwright work. */
export function isCityShopOpen(shop: Pick<CityShopData, "type">, timeStep: number): boolean {
  return shop.type === "inn" || getTimePeriod(timeStep) !== TimePeriod.Night;
}

export function getCityShopSignLabel(shop: CityShopData): string {
  return shop.name === "Tidehaven Shipwright" ? "SHIPWRIGHT" : SERVICE_LABELS[shop.type];
}

/** Only an actual service-room connection owns a doorway's opening hours. */
export function getCityShopForEntrance(
  city: CityData, chunkIndex: number, x: number, y: number,
): CityShopData | undefined {
  const connection = getCityConnectionAt(city, chunkIndex, x, y);
  const destination = connection ? getCityChunk(city, connection.toChunkIndex) : undefined;
  return destination?.interior?.kind === "shop" ? destination.shops[0] : undefined;
}

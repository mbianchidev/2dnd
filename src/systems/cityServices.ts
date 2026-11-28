import { getCityChunk, getCityConnectionAt } from "../data/cities";
import type { CityData, CityShopData } from "../data/mapTypes";
import { getTimePeriod, TimePeriod } from "./daynight";

export type CityServiceId = CityShopData["type"] | "shipwright";

const SERVICE_LABELS: Readonly<Record<CityServiceId, string>> = {
  weapon: "WEAPONS",
  armor: "ARMOR",
  magic: "MAGIC / POTIONS",
  inn: "INN 24H",
  bank: "BANK",
  general: "GENERAL",
  stable: "MOUNTS",
  shipwright: "SHIPWRIGHT",
};

/** Service hours apply equally to doorways, clerks and special shipwright work. */
export function isCityShopOpen(shop: Pick<CityShopData, "type">, timeStep: number): boolean {
  return shop.type === "inn" || getTimePeriod(timeStep) !== TimePeriod.Night;
}

export function getCityServiceId(shop: CityShopData): CityServiceId {
  return shop.name === "Tidehaven Shipwright" ? "shipwright" : shop.type;
}

export function getCityShopSignLabel(shop: CityShopData): string {
  return SERVICE_LABELS[getCityServiceId(shop)];
}

/** Provide text alternatives for explored pictograms without exposing hidden services. */
export function getVisibleCityServiceDescriptions(
  shops: readonly CityShopData[], isExplored: (x: number, y: number) => boolean,
): string[] {
  return shops.filter((shop) => isExplored(shop.x, shop.y)).map((shop) =>
    `${getCityShopSignLabel(shop)}: ${shop.name} at tile ${shop.x + 1}, ${shop.y + 1}`);
}

/** Only an actual service-room connection owns a doorway's opening hours. */
export function getCityShopForEntrance(
  city: CityData, chunkIndex: number, x: number, y: number,
): CityShopData | undefined {
  const connection = getCityConnectionAt(city, chunkIndex, x, y);
  const destination = connection ? getCityChunk(city, connection.toChunkIndex) : undefined;
  return destination?.interior?.kind === "shop" ? destination.shops[0] : undefined;
}

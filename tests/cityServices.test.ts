import { describe, expect, it } from "vitest";
import { CITIES, getCityChunk, getCityChunkCount } from "../src/data/cities";
import {
  getCityShopForEntrance, getCityShopSignLabel, isCityShopOpen,
} from "../src/systems/cityServices";

describe("city service contracts", () => {
  it("keeps every inn open all day and closes every other service only during Night", () => {
    for (const city of CITIES) {
      for (let index = 0; index < getCityChunkCount(city); index++) {
        for (const shop of getCityChunk(city, index)!.shops) {
          for (const step of [0, 44, 45, 219, 220, 264, 360, 624]) {
            expect(isCityShopOpen(shop, step), `${city.id}:${shop.name}:${step}`).toBe(true);
          }
          for (const step of [265, 300, 359, 625, 719]) {
            expect(isCityShopOpen(shop, step), `${city.id}:${shop.name}:${step}`).toBe(shop.type === "inn");
          }
        }
      }
    }
  });

  it("identifies each exterior doorway by its actual destination, not a neighboring shop", () => {
    for (const city of CITIES) {
      for (const connection of city.connections) {
        const destination = getCityChunk(city, connection.toChunkIndex)!;
        const service = getCityShopForEntrance(city, connection.fromChunkIndex, connection.fromX, connection.fromY);
        expect(service, `${city.id}:${connection.fromChunkIndex}:${connection.fromX},${connection.fromY}`)
          .toBe(destination.interior?.kind === "shop" ? destination.shops[0] : undefined);
      }
    }
  });

  it("gives every service an explicit exterior category, including shipwrights and magic supplies", () => {
    const signs = new Set<string>();
    for (const city of CITIES) {
      for (let index = 0; index < getCityChunkCount(city); index++) {
        for (const shop of getCityChunk(city, index)!.shops) {
          const label = getCityShopSignLabel(shop);
          expect(label.length).toBeGreaterThan(2);
          expect(label.length).toBeLessThanOrEqual(16);
          signs.add(label);
        }
      }
    }
    for (const label of ["WEAPONS", "ARMOR", "MAGIC / POTIONS", "GENERAL", "INN 24H", "BANK", "MOUNTS", "SHIPWRIGHT"]) {
      expect(signs.has(label), label).toBe(true);
    }
  });
});

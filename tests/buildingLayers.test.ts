import * as Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { renderCityBuildings } from "../src/renderers/buildings";

const harness = vi.hoisted(() => {
  class Graphics {
    readonly setName = vi.fn((): this => this);
    readonly setDepth = vi.fn((): this => this);
    readonly fillStyle = vi.fn((): this => this);
    readonly fillRect = vi.fn((): this => this);
    readonly beginPath = vi.fn((): this => this);
    readonly moveTo = vi.fn((): this => this);
    readonly lineTo = vi.fn((): this => this);
    readonly closePath = vi.fn((): this => this);
    readonly fillPath = vi.fn((): this => this);
  }
  return { Graphics, Scene: class {} };
});

vi.mock("phaser", () => ({ Scene: harness.Scene, GameObjects: { Graphics: harness.Graphics } }));

describe("city building layer ownership", () => {
  it("keeps doorway facades below actors and pitched roofs above them using two owned buffers", () => {
    const facade = Object.assign(new Phaser.GameObjects.Graphics(new Phaser.Scene()), new harness.Graphics());
    const roof = Object.assign(new Phaser.GameObjects.Graphics(new Phaser.Scene()), new harness.Graphics());
    const factory = vi.fn().mockReturnValueOnce(facade).mockReturnValueOnce(roof);
    const scene = Object.assign(new Phaser.Scene(), { add: { graphics: factory } });
    const layers = renderCityBuildings(scene, [{
      id: "fixture:library", kind: "library", x: 3, y: 10, width: 4, height: 3, door: { x: 4, y: 12 },
    }], () => true);
    expect(layers).toEqual([facade, roof]);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(facade.setDepth).toHaveBeenCalledWith(9);
    expect(roof.setDepth).toHaveBeenCalledWith(14);
    expect(facade.fillStyle).toHaveBeenCalledWith(0x504a3d);
    expect(roof.fillStyle).not.toHaveBeenCalledWith(0x504a3d);
    expect(roof.fillPath).toHaveBeenCalledTimes(2);
    expect(facade.fillPath).not.toHaveBeenCalled();
  });

  it("creates no empty graphics layers for ordinary districts without new footprints", () => {
    const factory = vi.fn();
    const scene = Object.assign(new Phaser.Scene(), { add: { graphics: factory } });
    expect(renderCityBuildings(scene, [], () => true)).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });
});

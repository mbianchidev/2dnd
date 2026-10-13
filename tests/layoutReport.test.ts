// @vitest-environment happy-dom

import * as Phaser from "phaser";
import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import {
  installSceneLayoutAudit,
  publishSceneLayoutReport,
  registerLayoutGroup,
} from "../src/managers/layout";

vi.mock("phaser", async () => {
  const { EventEmitter: Emitter } = await import("node:events");
  return {
    Scene: class {},
    Scenes: { Events: { POST_UPDATE: "postupdate" } },
    GameObjects: {
      Events: { DESTROY: "destroy" },
      Text: class {},
      Container: class extends Emitter {
        list: unknown[] = [];
        active = true;
        visible = true;
        alpha = 1;
        setData(): this { return this; }
      },
    },
  };
});

it("retains the full layout audit without rewriting identical diagnostic reports", () => {
  const element = document.createElement("div");
  element.id = "layout-report";
  document.body.appendChild(element);
  const canvas = document.createElement("canvas");
  const scene = Object.assign(new Phaser.Scene(), {
    game: { canvas },
    scene: { key: "FixtureScene" },
  });
  publishSceneLayoutReport(scene);
  const observer = new MutationObserver(() => {});
  observer.observe(canvas, { attributes: true });
  observer.observe(element, { childList: true, characterData: true, subtree: true });

  for (let audit = 0; audit < 20; audit++) publishSceneLayoutReport(scene);

  expect(observer.takeRecords()).toHaveLength(0);
  expect(JSON.parse(element.textContent ?? "")).toEqual({
    scene: "FixtureScene", groups: {}, overlapCount: 0, clippingCount: 0,
  });
  expect(canvas.dataset.layoutScene).toBe("FixtureScene");
  expect(canvas.dataset.layoutOverlapCount).toBe("0");
  expect(canvas.dataset.layoutClippingCount).toBe("0");
  observer.disconnect();
  element.remove();
});

it("coalesces changed groups into the next frame rather than waiting for the periodic audit", () => {
  const element = document.createElement("div");
  element.id = "layout-report";
  document.body.appendChild(element);
  const events = new EventEmitter();
  const scene = Object.assign(new Phaser.Scene(), {
    game: { canvas: document.createElement("canvas") },
    scene: { key: "FixtureScene" }, events,
  });
  installSceneLayoutAudit(scene);
  const first = new Phaser.GameObjects.Container(scene);
  const replacement = new Phaser.GameObjects.Container(scene);
  registerLayoutGroup(scene, "fixture", first);
  registerLayoutGroup(scene, "fixture", replacement);
  first.emit("destroy");
  expect(events.listenerCount("postupdate")).toBe(2);
  events.emit("postupdate", 16);
  expect(Object.keys(JSON.parse(element.textContent ?? "").groups)).toEqual(["fixture"]);
  expect(events.listenerCount("postupdate")).toBe(1);
  replacement.emit("destroy");
  events.emit("postupdate", 32);
  expect(JSON.parse(element.textContent ?? "").groups).toEqual({});
  events.emit("shutdown");
  element.remove();
});

it("rejects an audit callback captured before shutdown", () => {
  const element = document.createElement("div");
  element.id = "layout-report";
  document.body.appendChild(element);
  const events = new EventEmitter();
  const scene = Object.assign(new Phaser.Scene(), {
    game: { canvas: document.createElement("canvas") },
    scene: { key: "FixtureScene" }, events,
  });
  events.once("postupdate", () => events.emit("shutdown"));
  installSceneLayoutAudit(scene);
  registerLayoutGroup(scene, "fixture", new Phaser.GameObjects.Container(scene));
  events.emit("postupdate", 16);
  expect(JSON.parse(element.textContent ?? "").groups).toEqual({});
  expect(events.listenerCount("postupdate")).toBe(0);
  element.remove();
});

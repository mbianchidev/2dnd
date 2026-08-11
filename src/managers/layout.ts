import * as Phaser from "phaser";
import { isLocalDev } from "../config";
import {
  auditLayout,
  layoutVerticalStack,
  type LayoutAuditItem,
  type LayoutAuditResult,
  type LayoutRect,
} from "../systems/layout";

interface LayoutGroup {
  id: string;
  container: Phaser.GameObjects.Container;
  viewport?: LayoutRect;
}

const sceneGroups = new WeakMap<Phaser.Scene, Map<string, LayoutGroup>>();
const installedScenes = new WeakSet<Phaser.Scene>();

function getReportElement(): HTMLElement | null {
  return typeof document === "undefined"
    ? null
    : document.getElementById("layout-report");
}

function isVisibleObject(
  object: Phaser.GameObjects.GameObject,
): object is Phaser.GameObjects.Text {
  return object instanceof Phaser.GameObjects.Text
    && object.visible
    && object.active
    && object.alpha > 0
    && object.text.trim().length > 0
    && object.getData("layoutAuditIgnore") !== true;
}

function getObjectId(
  groupId: string,
  object: Phaser.GameObjects.Text,
  index: number,
): string {
  const explicit = object.getData("layoutId");
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const text = object.text.replace(/\s+/g, " ").trim().slice(0, 32);
  return `${groupId}:text-${index}:${text}`;
}

export function getScaledBounds(
  object: Phaser.GameObjects.Components.GetBounds,
): LayoutRect {
  const bounds = object.getBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

export function syncInteractiveHitArea(
  object: Phaser.GameObjects.Text,
  padding = 0,
): void {
  if (!object.input?.enabled) return;
  const width = object.width + padding * 2;
  const height = object.height + padding * 2;
  object.input.hitArea = new Phaser.Geom.Rectangle(
    -padding,
    -padding,
    width,
    height,
  );
  object.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains;
}

export function layoutTextStack(
  objects: readonly Phaser.GameObjects.Text[],
  options: {
    x: number;
    y: number;
    width?: number;
    gap?: number;
    align?: "start" | "center" | "end";
    hitAreaPadding?: number;
  },
): number {
  const layout = layoutVerticalStack(
    objects.map((object, index) => ({
      id: String(index),
      width: object.displayWidth,
      height: object.displayHeight,
    })),
    options,
  );
  layout.items.forEach((item, index) => {
    const object = objects[index];
    const bounds = object.getBounds();
    object.setPosition(
      object.x + item.x - bounds.x,
      object.y + item.y - bounds.y,
    );
    syncInteractiveHitArea(object, options.hitAreaPadding ?? 0);
  });
  return layout.height;
}

export function registerLayoutGroup(
  scene: Phaser.Scene,
  id: string,
  container: Phaser.GameObjects.Container,
  viewport?: LayoutRect,
): void {
  let groups = sceneGroups.get(scene);
  if (!groups) {
    groups = new Map<string, LayoutGroup>();
    sceneGroups.set(scene, groups);
  }
  container.setData("layoutGroupId", id);
  groups.set(id, { id, container, viewport });
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    groups?.delete(id);
  });
}

export function updateLayoutGroupViewport(
  scene: Phaser.Scene,
  id: string,
  viewport: LayoutRect,
): void {
  const group = sceneGroups.get(scene)?.get(id);
  if (group) group.viewport = viewport;
}

function collectGroupItems(group: LayoutGroup): LayoutAuditItem[] {
  return group.container.list
    .filter(isVisibleObject)
    .map((object, index) => ({
      id: getObjectId(group.id, object, index),
      bounds: getScaledBounds(object),
      allowOverlapWith: object.getData("layoutAllowOverlapWith") as
        | readonly string[]
        | undefined,
    }));
}

export function auditSceneLayout(scene: Phaser.Scene): {
  scene: string;
  groups: Record<string, LayoutAuditResult & { items: LayoutAuditItem[] }>;
  overlapCount: number;
  clippingCount: number;
} {
  const groups = sceneGroups.get(scene);
  const results: Record<
    string,
    LayoutAuditResult & { items: LayoutAuditItem[] }
  > = {};
  let overlapCount = 0;
  let clippingCount = 0;
  groups?.forEach((group) => {
    const items = collectGroupItems(group);
    const result = auditLayout(items, group.viewport);
    results[group.id] = { ...result, items };
    overlapCount += result.overlaps.length;
    clippingCount += result.clipping.length;
  });
  return {
    scene: scene.scene.key,
    groups: results,
    overlapCount,
    clippingCount,
  };
}

function publishLayoutReport(scene: Phaser.Scene): void {
  const report = auditSceneLayout(scene);
  scene.game.canvas.dataset.layoutOverlapCount = String(report.overlapCount);
  scene.game.canvas.dataset.layoutClippingCount = String(report.clippingCount);
  scene.game.canvas.dataset.layoutScene = report.scene;
  const element = getReportElement();
  if (element) element.textContent = JSON.stringify(report);
}

export function installSceneLayoutAudit(scene: Phaser.Scene): void {
  if (!isLocalDev() || installedScenes.has(scene)) return;
  installedScenes.add(scene);
  let lastAudit = 0;
  const audit = (time: number): void => {
    if (time - lastAudit < 200) return;
    lastAudit = time;
    publishLayoutReport(scene);
  };
  scene.events.on("postupdate", audit);
  scene.events.once("shutdown", () => {
    scene.events.off("postupdate", audit);
    sceneGroups.delete(scene);
    installedScenes.delete(scene);
  });
  publishLayoutReport(scene);
}

import * as Phaser from "phaser";
import { isLocalDev } from "../config";
import { gamePreferences } from "../systems/accessibility";
import { inputPromptSource } from "../systems/input";
import {
  auditLayout,
  layoutVerticalStack,
  type LayoutAuditItem,
  type LayoutAuditResult,
  type LayoutRect,
  type LayoutSize,
} from "../systems/layout";

interface LayoutGroup {
  id: string;
  container: Phaser.GameObjects.Container;
  viewport?: LayoutRect;
}

const sceneGroups = new WeakMap<Phaser.Scene, Map<string, LayoutGroup>>();
const installedScenes = new WeakSet<Phaser.Scene>();

/** Reflow at a frame boundary without destroying a control held by a pointer. */
export function subscribeOverlayReflow(scene: Phaser.Scene, render: () => void): () => void {
  let pending = false;
  let disposed = false;
  const request = (): void => {
    if (disposed || pending) return;
    pending = true;
    scene.events.once(Phaser.Scenes.Events.POST_UPDATE, flush);
  };
  const flush = (): void => {
    if (scene.input.activePointer.isDown) {
      scene.events.once(Phaser.Scenes.Events.POST_UPDATE, flush);
      return;
    }
    pending = false;
    render();
  };
  const unsubscribePreferences = gamePreferences.subscribe(request);
  const unsubscribeSource = inputPromptSource.subscribe(request);
  scene.scale.on(Phaser.Scale.Events.RESIZE, request);
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    unsubscribePreferences();
    unsubscribeSource();
    scene.scale.off(Phaser.Scale.Events.RESIZE, request);
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, flush);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, dispose);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  return dispose;
}

function getReportElement(): HTMLElement | null {
  return typeof document === "undefined"
    ? null
    : document.getElementById("layout-report");
}

function isLayoutRect(value: unknown): value is LayoutRect {
  return typeof value === "object" && value !== null
    && "x" in value && typeof value.x === "number" && Number.isFinite(value.x)
    && "y" in value && typeof value.y === "number" && Number.isFinite(value.y)
    && "width" in value && typeof value.width === "number" && value.width >= 0 && Number.isFinite(value.width)
    && "height" in value && typeof value.height === "number" && value.height >= 0 && Number.isFinite(value.height);
}

function getObjectId(
  groupId: string,
  object: Phaser.GameObjects.GameObject,
  index: number,
): string {
  const explicit = object.getData("layoutId");
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const text = object instanceof Phaser.GameObjects.Text
    ? object.text.replace(/\s+/g, " ").trim().slice(0, 32) : object.type;
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

/** Natural glyph bounds include padding/stroke even when a fixed text surface crops them. */
export function getTextContentSize(object: Phaser.GameObjects.Text, value = object.text): LayoutSize {
  const size = Phaser.GameObjects.GetTextSize(
    object, object.getTextMetrics(), object.getWrappedText(value),
  );
  return {
    width: size.width + (object.padding.left ?? 0) + (object.padding.right ?? 0),
    height: size.height + (object.padding.top ?? 0) + (object.padding.bottom ?? 0),
  };
}

export function getLayoutTexts(objects: readonly Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text[] {
  return objects.flatMap((object) => object instanceof Phaser.GameObjects.Text
    ? [object]
    : object instanceof Phaser.GameObjects.Container ? getLayoutTexts(object.list) : []
  );
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

function getAuditObjects(container: Phaser.GameObjects.Container): Phaser.GameObjects.GameObject[] {
  if (!container.active || !container.visible || container.alpha <= 0) return [];
  return container.list.flatMap((object) => object instanceof Phaser.GameObjects.Container
    ? getAuditObjects(object) : [object]);
}

function collectGroupItems(group: LayoutGroup): LayoutAuditItem[] {
  return getAuditObjects(group.container).flatMap((object, index) => {
      if (!object.active || ("visible" in object && object.visible === false)
        || ("alpha" in object && typeof object.alpha === "number" && object.alpha <= 0)
        || object.getData("layoutAuditIgnore") === true) return [];
      const declaredBounds: unknown = object.getData("layoutBounds");
      const isText = object instanceof Phaser.GameObjects.Text;
      if (isText ? object.text.trim().length === 0 : !isLayoutRect(declaredBounds)) return [];
      const bounds = isText ? getScaledBounds(object) : isLayoutRect(declaredBounds) ? declaredBounds : undefined;
      if (!bounds) return [];
      const item: LayoutAuditItem = {
        id: getObjectId(group.id, object, index), bounds,
        allowOverlapWith: object.getData("layoutAllowOverlapWith") as
          | readonly string[] | undefined,
      };
      if (isText && (object.style.fixedWidth > 0 || object.style.fixedHeight > 0)) {
        const size = getTextContentSize(object);
        item.contentBounds = {
          x: bounds.x, y: bounds.y,
          width: size.width * (object.width > 0 ? bounds.width / object.width : 1),
          height: size.height * (object.height > 0 ? bounds.height / object.height : 1),
        };
      }
      return [item];
    });
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

export function publishSceneLayoutReport(scene: Phaser.Scene): void {
  if (!isLocalDev() && globalThis.location?.origin !== "app://2dnd") return;
  const report = auditSceneLayout(scene);
  scene.game.canvas.dataset.layoutOverlapCount = String(report.overlapCount);
  scene.game.canvas.dataset.layoutClippingCount = String(report.clippingCount);
  scene.game.canvas.dataset.layoutScene = report.scene;
  const element = getReportElement();
  if (element) {
    const content = JSON.stringify(report);
    if (element.firstChild instanceof Text) element.firstChild.data = content;
    else element.textContent = content;
  }
}

export function installSceneLayoutAudit(scene: Phaser.Scene): void {
  const localDesktop = globalThis.location?.origin === "app://2dnd";
  if ((!isLocalDev() && !localDesktop) || installedScenes.has(scene)) return;
  installedScenes.add(scene);
  let lastAudit = 0;
  const audit = (time: number): void => {
    if (time - lastAudit < 200) return;
    lastAudit = time;
    publishSceneLayoutReport(scene);
  };
  scene.events.on("postupdate", audit);
  scene.events.once("shutdown", () => {
    scene.events.off("postupdate", audit);
    sceneGroups.delete(scene);
    installedScenes.delete(scene);
  });
  publishSceneLayoutReport(scene);
}

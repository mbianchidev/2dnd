import * as Phaser from "phaser";
import { getTextContentSize, subscribeOverlayReflow } from "../managers/layout";
import { clampRectToViewport, insetRect } from "../systems/layout";
import { createOverlayContainer, createStatusAnnouncer, setOverlayViewport } from "../utils/ui";

export interface NotificationPanelOptions {
  id: string;
  message: string;
  maxWidth: number;
  y: number;
  depth: number;
  backgroundColor: number;
}

/** Measure a non-interactive notice without taking input focus or ownership. */
export function renderNotificationPanel(
  scene: Phaser.Scene,
  options: NotificationPanelOptions,
): Phaser.GameObjects.Container {
  const container = createOverlayContainer(scene, options.id, options.depth);
  const background = scene.add.graphics();
  const text = scene.add.text(8, 6, options.message, {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#fff3a6",
  }).setData("layoutId", `${options.id}-text`);
  container.add([background, text]);
  const announcer = createStatusAnnouncer(`${options.id}-live-region`);
  announcer.textContent = options.message;

  const reflow = (): void => {
    const camera = scene.cameras.main;
    const viewport = insetRect(
      { x: 0, y: 0, width: camera.width, height: camera.height },
      { top: 8, right: 8, bottom: 8, left: 8 },
    );
    const width = Math.min(options.maxWidth, viewport.width);
    text.setWordWrapWidth(width - 16, true);
    text.setData("accessibilityMaxWidth", width - 16);
    const height = Math.ceil(Math.max(text.displayHeight, getTextContentSize(text).height)) + 12;
    if (height > viewport.height) {
      throw new RangeError(`Notification ${options.id} cannot fit its viewport`);
    }
    const bounds = clampRectToViewport({
      x: viewport.x + viewport.width - width,
      y: options.y,
      width,
      height,
    }, viewport);
    container.setPosition(bounds.x, bounds.y);
    background.clear().fillStyle(options.backgroundColor, 0.97)
      .fillRoundedRect(0, 0, bounds.width, bounds.height, 5)
      .lineStyle(2, 0xffd700, 1)
      .strokeRoundedRect(0, 0, bounds.width, bounds.height, 5);
    setOverlayViewport(scene, options.id, bounds);
  };
  const unsubscribe = subscribeOverlayReflow(scene, reflow);
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    unsubscribe();
    announcer.remove();
  });
  reflow();
  return container;
}

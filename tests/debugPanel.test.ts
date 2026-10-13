// @vitest-environment happy-dom

import { expect, it } from "vitest";
import { debugPanelState } from "../src/config";

it("publishes changed debug state without generating mutations for identical frames", () => {
  const element = document.createElement("div");
  element.id = "debug-state";
  document.body.appendChild(element);
  debugPanelState("OVERWORLD | Move: ready");
  const observer = new MutationObserver(() => {});
  observer.observe(element, { childList: true, characterData: true, subtree: true });

  for (let frame = 0; frame < 120; frame++) {
    debugPanelState("OVERWORLD | Move: ready");
  }
  expect(observer.takeRecords()).toHaveLength(0);

  debugPanelState("OVERWORLD | Move: locked");
  expect(element.textContent).toBe("OVERWORLD | Move: locked");
  expect(observer.takeRecords()).toHaveLength(1);
  observer.disconnect();
  element.remove();
});

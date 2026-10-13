import { OverlayAccessibility } from "./overlayAccessibility";
export type { OverlayAccessibleAction as DevotionAccessibleAction } from "./overlayAccessibility";

export class DevotionAccessibility extends OverlayAccessibility {
  constructor(select: (id: string) => void, activate: (id: string) => void) {
    super("devotion", select, activate);
  }
}

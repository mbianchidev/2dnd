import type { CompanionState, PartyMemberId } from "../systems/party";
import type { ProgressingActorState } from "../systems/player";

export interface PartyOverlayCallbacks {
  updateHUD(): void;
  autoSave(): void;
  showMessage(text: string, color?: string): void;
  refreshActors(): void;
  openCrafting(): void;
}

export type PartyOverlayPage = "status" | "social" | "items" | "gambits";

export interface PartyMemberView {
  id: PartyMemberId;
  name: string;
  state: ProgressingActorState;
  companion?: CompanionState;
}

export interface DevotionAccessibleAction {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}

/** Native semantics mirror the canvas controls; canvas borders show the same focus. */
export class DevotionAccessibility {
  private root: HTMLDivElement | null = null;
  private previousFocus: HTMLElement | null = null;
  private actions: readonly DevotionAccessibleAction[] = [];
  private selectedId = "";
  private readonly buttons = new Map<string, HTMLButtonElement>();

  constructor(
    private readonly select: (id: string) => void,
    private readonly activate: (id: string) => void,
  ) {}

  open(): void {
    this.close();
    this.previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const root = document.createElement("div");
    root.id = "devotion-accessibility";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "devotion-accessible-title");
    root.setAttribute("aria-describedby", "devotion-accessible-content");
    Object.assign(root.style, {
      position: "fixed", width: "1px", height: "1px",
      overflow: "hidden", clipPath: "inset(50%)",
    });
    document.body.append(root);
    this.root = root;
  }

  update(
    title: string,
    lines: readonly string[],
    actions: readonly DevotionAccessibleAction[],
    selectedId: string,
  ): void {
    const root = this.root;
    if (!root) return;
    this.actions = actions;
    this.selectedId = selectedId;
    this.buttons.clear();
    root.replaceChildren();
    const heading = document.createElement("h2");
    heading.id = "devotion-accessible-title";
    heading.textContent = title;
    const content = document.createElement("p");
    content.id = "devotion-accessible-content";
    content.textContent = lines.join(" ");
    const status = document.createElement("p");
    status.id = "devotion-live-region";
    status.setAttribute("role", "status");
    status.setAttribute("aria-atomic", "true");
    root.append(heading, content, status);
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.devotionAction = action.id;
      button.textContent = action.label;
      button.disabled = !action.enabled;
      button.addEventListener("focus", () => this.select(action.id));
      button.addEventListener("click", () => this.activate(action.id));
      this.buttons.set(action.id, button);
      root.append(button);
    }
    this.focus(selectedId);
  }

  focus(id: string): void {
    this.selectedId = id;
    const button = this.buttons.get(id);
    if (button && !button.disabled && document.activeElement !== button) {
      button.focus({ preventScroll: true });
    }
  }

  moveTab(backwards: boolean): void {
    const enabled = this.actions.filter((action) => action.enabled);
    const index = Math.max(0, enabled.findIndex((action) => action.id === this.selectedId));
    const next = enabled[(index + (backwards ? -1 : 1) + enabled.length) % enabled.length];
    if (next) this.focus(next.id);
  }

  announce(message: string): void {
    const status = this.root?.querySelector("#devotion-live-region");
    if (status) status.textContent = message;
  }

  close(): void {
    const previousFocus = this.previousFocus;
    this.root?.remove();
    this.root = null;
    this.actions = [];
    this.buttons.clear();
    this.previousFocus = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}

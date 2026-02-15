---
name: phaser-scene-management
description: Manage Phaser 3 scenes in 2D&D game with proper data flow and transitions
license: MIT
---

# Phaser Scene Management for 2D&D

This skill guides you in creating, managing, and transitioning between Phaser 3 scenes in the 2D&D game while maintaining proper game state.

## Scene Architecture

The game uses five main scenes:
- **Boot** - Asset generation, title screen, character creation
- **Overworld** - Map exploration, movement, random encounters
- **Battle** - Turn-based combat with monsters
- **Shop** - Item purchasing and inn resting
- **Codex** - Monster encyclopedia

## Scene Data Contract

**Every scene transition MUST pass this data object:**

```typescript
interface SceneData {
  player: PlayerState;
  defeatedBosses: Set<string>;
  codex: CodexData;
  timeStep: number;
  weatherState: WeatherState;
}
```

This ensures consistent game state across all scenes. The `weatherState` tracks current weather type and countdown to next change.

## Creating a New Scene

### 1. Scene Class Structure

```typescript
import Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import type { CodexData } from "../systems/codex";

export class MyNewScene extends Phaser.Scene {
  // Game state (passed from previous scene)
  private player!: PlayerState;
  private defeatedBosses!: string[];
  private codex!: CodexData;
  private timeStep!: number;

  // Scene-specific state
  private background!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: "MyNewScene" });
  }

  init(data: {
    player: PlayerState;
    defeatedBosses: string[];
    codex: CodexData;
    timeStep: number;
  }) {
    // Store passed data
    this.player = data.player;
    this.defeatedBosses = data.defeatedBosses;
    this.codex = data.codex;
    this.timeStep = data.timeStep;

    // Validate required data
    if (!this.player) {
      console.error("MyNewScene: Missing player data");
    }
  }

  create() {
    // Initialize scene visuals and logic
    this.createBackground();
    this.createUI();
    this.setupInput();
  }

  update(time: number, delta: number) {
    // Game loop (optional, for animated scenes)
  }

  private createBackground() {
    // Procedural graphics generation
    this.background = this.add.graphics();
    // ... draw background
  }

  private createUI() {
    // Create UI elements
    this.ui = this.add.container();
    // ... add UI
  }

  private setupInput() {
    // Input handling
    this.input.keyboard?.on("keydown-ESC", () => {
      this.exitScene();
    });
  }

  private exitScene() {
    // Transition to another scene
    this.scene.start("OverworldScene", {
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      codex: this.codex,
      timeStep: this.timeStep,
    });
  }
}
```

### 2. Register Scene in main.ts

```typescript
import { MyNewScene } from "./scenes/MyNewScene";

const config: Phaser.Types.Core.GameConfig = {
  // ... other config
  scene: [
    BootScene,
    OverworldScene,
    BattleScene,
    ShopScene,
    CodexScene,
    MyNewScene,  // Add your scene
  ],
};
```

## Scene Transitions

### Starting a Scene
```typescript
// From any scene to another
this.scene.start("NextScene", {
  player: this.player,
  defeatedBosses: this.defeatedBosses,
  codex: this.codex,
  timeStep: this.timeStep,
});
```

### Restarting Current Scene
```typescript
// Useful for "try again" or chunk transitions
this.scene.restart({
  player: this.player,
  defeatedBosses: this.defeatedBosses,
  codex: this.codex,
  timeStep: this.timeStep,
});
```

### Pausing/Resuming Scenes
```typescript
// Pause current scene and launch another (overlay)
this.scene.pause();
this.scene.launch("PauseMenu", { /* data */ });

// Resume from paused scene
this.scene.resume("OverworldScene");
this.scene.stop();  // Stop the overlay scene
```

## UI Positioning Best Practices

### Calculate Bounds to Prevent Overlap

```typescript
// BAD: Hardcoded positions can cause overlap
const title = this.add.text(320, 100, "Title", { fontSize: "32px" });
const subtitle = this.add.text(320, 120, "Subtitle", { fontSize: "16px" });
// These might overlap depending on scale!

// GOOD: Calculate actual bounds
const title = this.add.text(320, 100, "Title", { fontSize: "32px" });
title.setOrigin(0.5);
const titleBottom = title.y + (title.height * title.scaleY) / 2;

const subtitle = this.add.text(320, titleBottom + 20, "Subtitle", { fontSize: "16px" });
subtitle.setOrigin(0.5);
// 20px gap ensures no overlap
```

### Using Containers for Complex UI

```typescript
// Group related UI elements
const menuContainer = this.add.container(100, 100);

const background = this.add.graphics();
background.fillStyle(0x000000, 0.8);
background.fillRect(0, 0, 400, 300);

const title = this.add.text(200, 20, "Menu", { fontSize: "24px" });
title.setOrigin(0.5);

const option1 = this.add.text(20, 60, "Option 1", { fontSize: "16px" });
const option2 = this.add.text(20, 100, "Option 2", { fontSize: "16px" });

menuContainer.add([background, title, option1, option2]);

// Move entire menu at once
menuContainer.setPosition(150, 150);
```

## Procedural Graphics Generation

All graphics are generated in Boot.ts. Reference existing patterns:

```typescript
// Generate a sprite texture
const graphics = this.add.graphics();
graphics.fillStyle(0xff0000);
graphics.fillRect(0, 0, 32, 32);
graphics.generateTexture("mySprite", 32, 32);
graphics.destroy();

// Use the generated texture
const sprite = this.add.sprite(x, y, "mySprite");
```

## Debug Integration

```typescript
import { isDebug, debugLog, debugPanelLog } from "../config";

create() {
  debugLog("MyNewScene created");
  debugPanelLog("Entered MyNewScene");

  if (isDebug()) {
    // Show debug info
    this.add.text(10, 10, "DEBUG MODE", { fontSize: "12px", color: "#ff0000" });
  }
}
```

## Input Handling

### Keyboard Input
```typescript
// Method 1: Event-based
this.input.keyboard?.on("keydown-SPACE", () => {
  this.handleAction();
});

// Method 2: Polling in update()
update() {
  const keys = this.input.keyboard?.createCursorKeys();
  if (keys?.space.isDown) {
    this.handleAction();
  }
}

// Method 3: One-time key check
if (this.input.keyboard?.checkDown(this.input.keyboard.addKey("SPACE"))) {
  this.handleAction();
}
```

### Mouse/Touch Input
```typescript
// Click on game object
const button = this.add.text(100, 100, "Click Me", { fontSize: "16px" });
button.setInteractive();
button.on("pointerdown", () => {
  this.handleClick();
});

// Hover effects
button.on("pointerover", () => {
  button.setStyle({ color: "#ffff00" });
});
button.on("pointerout", () => {
  button.setStyle({ color: "#ffffff" });
});
```

## Common Patterns

### Modal Dialogs
```typescript
private showDialog(message: string, onConfirm: () => void) {
  // Dim background
  const overlay = this.add.graphics();
  overlay.fillStyle(0x000000, 0.7);
  overlay.fillRect(0, 0, 640, 560);

  // Dialog box
  const dialog = this.add.container(320, 280);
  const bg = this.add.graphics();
  bg.fillStyle(0x333333);
  bg.fillRect(-150, -50, 300, 100);

  const text = this.add.text(0, -20, message, { fontSize: "16px" });
  text.setOrigin(0.5);

  const button = this.add.text(0, 20, "OK", { fontSize: "16px" });
  button.setOrigin(0.5);
  button.setInteractive();
  button.on("pointerdown", () => {
    dialog.destroy();
    overlay.destroy();
    onConfirm();
  });

  dialog.add([bg, text, button]);
}
```

### Animation Sequences
```typescript
// Tween animations
this.tweens.add({
  targets: sprite,
  x: 400,
  y: 300,
  alpha: 0,
  duration: 1000,
  ease: "Power2",
  onComplete: () => {
    sprite.destroy();
  },
});

// Chained animations
this.tweens.chain({
  targets: sprite,
  tweens: [
    { x: 200, duration: 500 },
    { y: 300, duration: 500 },
    { alpha: 0, duration: 500 },
  ],
});
```

## Testing Scenes

1. **Type safety**: Ensure scene data is properly typed
2. **State persistence**: Verify player state carries through transitions
3. **UI layout**: Check no overlapping elements at all scales
4. **Input handling**: Test all keyboard/mouse interactions
5. **Memory**: Ensure scene cleanup (destroy unused objects)

## Common Pitfalls

- ❌ Forgetting to pass complete scene data during transitions
- ❌ Not using `!` assertion for init data (TypeScript error)
- ❌ Hardcoding positions without calculating bounds
- ❌ Creating memory leaks by not destroying old objects
- ❌ Not registering scene in main.ts config
- ❌ Using external assets instead of procedural generation

## Related Files

- Scene implementations: `src/scenes/*.ts`
- Main config: `src/main.ts`
- Player state: `src/systems/player.ts`
- Codex system: `src/systems/codex.ts`
- Debug utilities: `src/config.ts`

import * as Phaser from "phaser";
import type { BattleActionSource } from "../systems/battleActions";
import type { PartyCombatant } from "../systems/groupCombat";
import { getActiveEffectNames } from "../systems/statusEffects";

export class BattlePartyRenderer {
  private readonly scene: Phaser.Scene;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private labels = new Map<string, Phaser.GameObjects.Text>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  render(
    partyCombatants: PartyCombatant[],
    sources: BattleActionSource[],
  ): void {
    this.clear();
    const companions = partyCombatants.filter(
      (combatant) => combatant.actorKind === "companion",
    );
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    companions.forEach((combatant, index) => {
      const source = sources.find(
        (candidate) => candidate.combatant.id === combatant.id,
      );
      const textureKey = source
        ? `player_${source.state.appearanceId}`
        : "player";
      const x = width * (0.08 + index * 0.13);
      const y = height * 0.65;
      const sprite = this.scene.add.sprite(x, y, textureKey)
        .setScale(1.35)
        .setDepth(2);
      const label = this.scene.add.text(x, y + 22, "", {
        fontSize: "9px",
        fontFamily: "monospace",
        color: "#b8ddff",
        align: "center",
        backgroundColor: "#0a0a1acc",
        padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 0).setDepth(3);
      this.sprites.set(combatant.id, sprite);
      this.labels.set(combatant.id, label);
    });
    this.update(partyCombatants, sources);
  }

  update(
    partyCombatants: PartyCombatant[],
    sources: BattleActionSource[],
  ): void {
    for (const combatant of partyCombatants) {
      if (combatant.actorKind !== "companion") continue;
      const sprite = this.sprites.get(combatant.id);
      const label = this.labels.get(combatant.id);
      const source = sources.find(
        (candidate) => candidate.combatant.id === combatant.id,
      );
      if (!sprite || !label || !source) continue;
      const effects = getActiveEffectNames(combatant.effects);
      label.setText([
        combatant.label,
        `HP ${combatant.currentHp}/${combatant.maxHp}`,
        `MP ${source.state.mp}/${source.state.maxMp}`,
        effects.length > 0 ? effects.join(", ") : "",
      ].filter(Boolean).join("\n"));
      sprite.setAlpha(isFinite(combatant.currentHp) && combatant.currentHp > 0
        ? 1
        : 0.35);
      label.setAlpha(sprite.alpha);
    }
  }

  getSprite(combatantId: string): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(combatantId);
  }

  clear(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    for (const label of this.labels.values()) label.destroy();
    this.sprites.clear();
    this.labels.clear();
  }
}

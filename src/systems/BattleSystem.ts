import type { ActorData, MonsterData, BattleAction, DiceRoll, RollResult } from '../types'
import { getSkill } from '../data/skills'

interface ActionResult {
  message: string
  damage?: number
  healing?: number
  missed?: boolean
  critical?: boolean
}

interface BattleRewards {
  experience: number
  gold: number
  items: { itemId: string; quantity: number }[]
}

/**
 * Core battle system implementing DQ-style turn-based combat with D&D dice mechanics
 */
export class BattleSystem {
  private party: ActorData[]
  private enemies: MonsterData[]
  // Reserved for future multi-character turn system
  // @ts-expect-error - reserved for future use
  private _turnOrder: (ActorData | MonsterData)[] = []
  // @ts-expect-error - reserved for future use
  private _currentTurn = 0
  private defendingActors: Set<string> = new Set()

  constructor(party: ActorData[], enemies: MonsterData[]) {
    // Create copies to avoid mutating original data
    this.party = party.map((actor) => ({
      ...actor,
      stats: { ...actor.stats },
      skills: [...actor.skills],
    }))

    this.enemies = enemies.map((enemy) => ({
      ...enemy,
      stats: { ...enemy.stats },
      skills: [...enemy.skills],
    }))

    this.calculateTurnOrder()
  }

  private calculateTurnOrder(): void {
    const allActors = [...this.party, ...this.enemies]
    // Sort by speed (highest first), with some randomness for ties
    this._turnOrder = allActors.sort((a, b) => {
      const speedDiff = b.stats.speed - a.stats.speed
      if (speedDiff !== 0) return speedDiff
      return Math.random() - 0.5
    })
  }

  getParty(): ActorData[] {
    return this.party
  }

  getEnemies(): MonsterData[] {
    return this.enemies
  }

  isVictory(): boolean {
    return this.enemies.every((e) => e.stats.hp <= 0)
  }

  isDefeat(): boolean {
    return this.party.every((p) => p.stats.hp <= 0)
  }

  executePlayerAction(action: BattleAction): ActionResult {
    this.defendingActors.delete(action.actorId)

    switch (action.type) {
      case 'attack':
        return this.executeAttack(action)
      case 'skill':
        return this.executeSkill(action)
      case 'item':
        return this.executeItem(action)
      case 'defend':
        return this.executeDefend(action)
      case 'flee':
        return { message: 'Attempting to flee...' }
      default:
        return { message: 'Unknown action' }
    }
  }

  private executeAttack(action: BattleAction): ActionResult {
    const attacker = this.findActor(action.actorId)
    const targetId = action.targetIds?.[0]
    const target = targetId ? this.findActor(targetId) : null

    if (!attacker || !target) {
      return { message: 'Invalid target' }
    }

    // D&D-style attack roll: d20 + attack bonus
    const attackRoll = this.rollDice({ dice: 'd20', count: 1 })
    const attackBonus = Math.floor((attacker.stats.attack - 10) / 2)
    const totalAttack = attackRoll.total + attackBonus

    // Target AC approximation based on defense
    const targetAC = 10 + Math.floor(target.stats.defense / 2)

    // Check for critical hit (natural 20) or miss (natural 1)
    if (attackRoll.rolls[0] === 1) {
      return { message: `${attacker.name}'s attack missed!`, missed: true }
    }

    const isCritical = attackRoll.rolls[0] === 20

    if (!isCritical && totalAttack < targetAC) {
      return { message: `${attacker.name}'s attack missed ${target.name}!`, missed: true }
    }

    // Damage calculation: weapon die (d6) + strength modifier
    const damageDice = isCritical ? 2 : 1
    const damageRoll = this.rollDice({ dice: 'd6', count: damageDice })
    const strMod = Math.floor((attacker.stats.attack - 10) / 2)

    // Apply defense reduction
    const defenseReduction = this.defendingActors.has(target.id)
      ? Math.floor(target.stats.defense / 2)
      : Math.floor(target.stats.defense / 4)

    let damage = Math.max(1, damageRoll.total + strMod - defenseReduction)

    // Apply damage
    target.stats.hp = Math.max(0, target.stats.hp - damage)

    const critText = isCritical ? ' Critical hit!' : ''
    return {
      message: `${attacker.name} attacks ${target.name}!${critText} ${damage} damage!`,
      damage,
      critical: isCritical,
    }
  }

  private executeSkill(action: BattleAction): ActionResult {
    const actor = this.findActor(action.actorId)
    const skill = action.skillId ? getSkill(action.skillId) : null

    if (!actor || !skill) {
      return { message: 'Invalid skill' }
    }

    // Check MP cost
    if ((actor.stats.mp || 0) < skill.mpCost) {
      return { message: 'Not enough MP!' }
    }

    // Deduct MP
    if (actor.stats.mp !== undefined) {
      actor.stats.mp -= skill.mpCost
    }

    // For now, treat skills similarly to attacks
    // TODO: Implement full skill effect system
    const targetId = action.targetIds?.[0]
    const target = targetId ? this.findActor(targetId) : null

    if (!target) {
      return { message: `${actor.name} uses ${skill.name}!` }
    }

    // Calculate skill power
    const basePower = typeof skill.power === 'number' ? skill.power : this.rollDice(skill.power as DiceRoll).total
    const damage = Math.max(1, Math.floor((basePower * actor.stats.attack) / 100) - Math.floor(target.stats.defense / 4))

    target.stats.hp = Math.max(0, target.stats.hp - damage)

    return {
      message: `${actor.name} uses ${skill.name}! ${damage} damage to ${target.name}!`,
      damage,
    }
  }

  private executeItem(_action: BattleAction): ActionResult {
    // TODO: Implement item usage
    return { message: 'Item not implemented' }
  }

  private executeDefend(action: BattleAction): ActionResult {
    const actor = this.findActor(action.actorId)
    if (!actor) return { message: 'Invalid actor' }

    this.defendingActors.add(action.actorId)
    return { message: `${actor.name} is defending!` }
  }

  getEnemyActions(): ActionResult[] {
    const results: ActionResult[] = []
    const aliveEnemies = this.enemies.filter((e) => e.stats.hp > 0)
    const aliveParty = this.party.filter((p) => p.stats.hp > 0)

    if (aliveParty.length === 0) return results

    for (const enemy of aliveEnemies) {
      // Simple AI: attack random party member
      const target = aliveParty[Math.floor(Math.random() * aliveParty.length)]

      const action: BattleAction = {
        type: 'attack',
        actorId: enemy.id,
        targetIds: [target.id],
      }

      results.push(this.executeAttack(action))
    }

    return results
  }

  attemptFlee(): boolean {
    // Base 50% flee chance, modified by speed difference
    const partySpeed = this.party.reduce((sum, p) => sum + p.stats.speed, 0) / this.party.length
    const enemySpeed = this.enemies.reduce((sum, e) => sum + e.stats.speed, 0) / this.enemies.length

    const speedDiff = partySpeed - enemySpeed
    const fleeChance = Math.min(0.9, Math.max(0.1, 0.5 + speedDiff * 0.05))

    return Math.random() < fleeChance
  }

  getRewards(): BattleRewards {
    let totalExp = 0
    let totalGold = 0
    const items: { itemId: string; quantity: number }[] = []

    for (const enemy of this.enemies) {
      if (enemy.stats.hp <= 0) {
        totalExp += enemy.experienceReward

        // Roll for gold
        if (typeof enemy.goldReward === 'number') {
          totalGold += enemy.goldReward
        } else {
          totalGold += this.rollDice(enemy.goldReward).total
        }

        // Roll for drops
        if (enemy.dropTable) {
          for (const drop of enemy.dropTable) {
            if (Math.random() < drop.chance) {
              const quantity = typeof drop.quantity === 'number' ? drop.quantity : drop.quantity ? this.rollDice(drop.quantity).total : 1
              items.push({ itemId: drop.itemId, quantity })
            }
          }
        }
      }
    }

    return { experience: totalExp, gold: totalGold, items }
  }

  private findActor(id: string): ActorData | MonsterData | null {
    const partyMember = this.party.find((p) => p.id === id)
    if (partyMember) return partyMember

    const enemy = this.enemies.find((e) => e.id === id)
    return enemy || null
  }

  private rollDice(roll: DiceRoll): RollResult {
    const dieMax = parseInt(roll.dice.substring(1))
    const rolls: number[] = []

    for (let i = 0; i < roll.count; i++) {
      rolls.push(Math.floor(Math.random() * dieMax) + 1)
    }

    const total = rolls.reduce((sum, r) => sum + r, 0) + (roll.modifier || 0)

    return {
      rolls,
      total,
      critical: roll.dice === 'd20' && rolls.includes(20),
      fumble: roll.dice === 'd20' && rolls.includes(1),
    }
  }
}

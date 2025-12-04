import { ContentRegistry } from '../../contentRegistry'
import type {
  BattleLogEntry,
  BattleParticipant,
  BattleResult,
  Skill,
  StatBlock,
} from '../../types'

function cloneStats(stats: StatBlock): StatBlock {
  return { ...stats }
}

function buildParticipant(id: string, isPlayer: boolean): BattleParticipant {
  const data = isPlayer ? ContentRegistry.actor(id) : ContentRegistry.monster(id)
  const skills: Skill[] = data.skills.map((sid) => ContentRegistry.skill(sid))
  return {
    id: data.id,
    name: data.name,
    stats: cloneStats(data.stats),
    skills,
    isPlayer,
  }
}

function dealDamage(attacker: BattleParticipant, defender: BattleParticipant, skill: Skill): number {
  const raw = attacker.stats.attack * skill.power
  const dmg = Math.max(1, Math.floor(raw - defender.stats.defense))
  defender.stats.hp = Math.max(0, defender.stats.hp - dmg)
  return dmg
}

export class BattleEngine {
  hero: BattleParticipant
  enemy: BattleParticipant
  log: BattleLogEntry[] = []
  winner: BattleResult['winner'] | null = null

  constructor(heroId: string, enemyId: string) {
    this.hero = buildParticipant(heroId, true)
    this.enemy = buildParticipant(enemyId, false)
  }

  playerAttack(): BattleResult | null {
    if (this.winner) return this.currentResult()
    const skill = this.hero.skills[0]
    const dmg = dealDamage(this.hero, this.enemy, skill)
    this.log.push({ message: `${this.hero.name} uses ${skill.name} for ${dmg} damage!` })

    if (this.enemy.stats.hp <= 0) {
      this.winner = 'player'
      this.log.push({ message: `${this.enemy.name} is defeated!` })
      return this.currentResult()
    }

    // enemy counter-attack
    const enemySkill = this.enemy.skills[0]
    const enemyDmg = dealDamage(this.enemy, this.hero, enemySkill)
    this.log.push({
      message: `${this.enemy.name} uses ${enemySkill.name} for ${enemyDmg} damage!`,
    })

    if (this.hero.stats.hp <= 0) {
      this.winner = 'enemy'
      this.log.push({ message: `${this.hero.name} is defeated!` })
      return this.currentResult()
    }

    return null
  }

  isBattleOver(): boolean {
    return this.winner !== null
  }

  currentResult(): BattleResult {
    if (!this.winner) {
      throw new Error('Battle not finished')
    }
    return {
      winner: this.winner,
      log: [...this.log],
      remainingHp: this.winner === 'player' ? this.hero.stats.hp : this.enemy.stats.hp,
    }
  }
}

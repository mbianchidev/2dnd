import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type TileType = 'plains' | 'forest' | 'desert' | 'city' | 'dungeon' | 'mountain' | 'boss' | 'water'
type Mode = 'overworld' | 'battle' | 'shop' | 'defeat' | 'victory'

type InventoryItem = {
  id: string
  name: string
  type: 'heal' | 'damage' | 'escape'
  amount: string
  price: number
  quantity: number
  description: string
}

type Stats = {
  strength: number
  dexterity: number
  intellect: number
  armorClass: number
  attackBonus: number
}

type Player = {
  name: string
  hp: number
  maxHp: number
  level: number
  xp: number
  gold: number
  spells: string[]
  inventory: InventoryItem[]
  stats: Stats
}

type Monster = {
  id: string
  name: string
  hp: number
  maxHp: number
  ac: number
  attackBonus: number
  damage: string
  xp: number
  gold: number
  initiative: number
  biomes: TileType[]
  isBoss?: boolean
}

type Spell = {
  id: string
  name: string
  levelReq: number
  description: string
  type: 'damage' | 'heal'
  dice: string
  modifierKey?: keyof Stats
}

const TILE_DETAILS: Record<
  TileType,
  { label: string; color: string; encounterChance?: number; blocks?: boolean }
> = {
  plains: { label: 'Plains', color: '#83c47c', encounterChance: 0.08 },
  forest: { label: 'Whispering Forest', color: '#4c8b61', encounterChance: 0.23 },
  desert: { label: 'Blister Desert', color: '#d9b36f', encounterChance: 0.18 },
  city: { label: 'Harbor City (shop)', color: '#6c93d4' },
  dungeon: { label: 'Sunken Dungeon', color: '#8d5ab5', encounterChance: 0.32 },
  mountain: { label: 'Crags (blocked)', color: '#6e6f74', blocks: true },
  boss: { label: 'Cinder Drake Lair', color: '#d46a6a' },
  water: { label: 'Sea (blocked)', color: '#3a6fa4', blocks: true },
}

const WORLD_MAP: TileType[][] = [
  ['water', 'plains', 'forest', 'forest', 'mountain', 'mountain', 'plains', 'desert', 'desert', 'plains', 'boss', 'water'],
  ['water', 'city', 'plains', 'forest', 'plains', 'plains', 'plains', 'desert', 'dungeon', 'plains', 'plains', 'water'],
  ['water', 'plains', 'plains', 'plains', 'plains', 'forest', 'plains', 'plains', 'plains', 'plains', 'plains', 'water'],
  ['water', 'plains', 'plains', 'plains', 'plains', 'forest', 'plains', 'plains', 'plains', 'plains', 'plains', 'water'],
  ['water', 'plains', 'plains', 'plains', 'forest', 'forest', 'plains', 'plains', 'desert', 'desert', 'plains', 'water'],
  ['water', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'water'],
  ['water', 'plains', 'plains', 'forest', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'water'],
  ['water', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'water'],
  ['water', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'plains', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
]

const MERCHANT_STOCK: InventoryItem[] = [
  {
    id: 'potion',
    name: 'Healing Potion',
    type: 'heal',
    amount: '2d6+2',
    price: 10,
    quantity: 1,
    description: 'Restore a burst of vitality.',
  },
  {
    id: 'bomb',
    name: 'Fire Bomb',
    type: 'damage',
    amount: '2d6',
    price: 16,
    quantity: 1,
    description: 'Throwable explosive that hurts monsters.',
  },
  {
    id: 'smokebomb',
    name: 'Smoke Bomb',
    type: 'escape',
    amount: '0',
    price: 12,
    quantity: 1,
    description: 'Guarantees escape from a regular fight.',
  },
]

const SPELLS: Spell[] = [
  {
    id: 'arcane-bolt',
    name: 'Arcane Bolt',
    levelReq: 1,
    description: 'A quick blast of force (1d8 + INT).',
    type: 'damage',
    dice: '1d8',
    modifierKey: 'intellect',
  },
  {
    id: 'healing-word',
    name: 'Healing Word',
    levelReq: 2,
    description: 'Mend wounds with radiant whisper (1d8 + INT heal).',
    type: 'heal',
    dice: '1d8',
    modifierKey: 'intellect',
  },
  {
    id: 'flame-wave',
    name: 'Flame Wave',
    levelReq: 3,
    description: 'Sear foes with twin flames (2d6 + INT).',
    type: 'damage',
    dice: '2d6',
    modifierKey: 'intellect',
  },
]

const LEVEL_TABLE = [
  { level: 1, xp: 0, hpGain: 0, attackBoost: 0, acBoost: 0 },
  { level: 2, xp: 60, hpGain: 5, attackBoost: 1, acBoost: 1 },
  { level: 3, xp: 140, hpGain: 6, attackBoost: 1, acBoost: 0 },
  { level: 4, xp: 260, hpGain: 8, attackBoost: 1, acBoost: 1 },
]

const MONSTERS: Monster[] = [
  {
    id: 'slime',
    name: 'Azure Slime',
    hp: 16,
    maxHp: 16,
    ac: 10,
    attackBonus: 2,
    damage: '1d6',
    xp: 18,
    gold: 6,
    initiative: 1,
    biomes: ['plains', 'forest'],
  },
  {
    id: 'wolf',
    name: 'Dire Wolf',
    hp: 20,
    maxHp: 20,
    ac: 11,
    attackBonus: 3,
    damage: '1d8',
    xp: 24,
    gold: 10,
    initiative: 2,
    biomes: ['forest'],
  },
  {
    id: 'bandit',
    name: 'Dust Bandit',
    hp: 22,
    maxHp: 22,
    ac: 12,
    attackBonus: 3,
    damage: '1d8',
    xp: 30,
    gold: 14,
    initiative: 3,
    biomes: ['desert', 'plains'],
  },
  {
    id: 'skeleton',
    name: 'Dungeon Skeleton',
    hp: 20,
    maxHp: 20,
    ac: 12,
    attackBonus: 3,
    damage: '1d10',
    xp: 35,
    gold: 15,
    initiative: 2,
    biomes: ['dungeon'],
  },
  {
    id: 'warlock',
    name: 'Fallen Warlock',
    hp: 24,
    maxHp: 24,
    ac: 12,
    attackBonus: 4,
    damage: '2d6',
    xp: 44,
    gold: 18,
    initiative: 4,
    biomes: ['dungeon', 'desert'],
  },
]

const BOSS: Monster = {
  id: 'cinder-drake',
  name: 'Cinder Drake',
  hp: 48,
  maxHp: 48,
  ac: 14,
  attackBonus: 6,
  damage: '2d8',
  xp: 160,
  gold: 80,
  initiative: 5,
  biomes: ['boss'],
  isBoss: true,
}

const initialPlayer: Player = {
  name: 'Aria the Wanderer',
  hp: 28,
  maxHp: 28,
  level: 1,
  xp: 0,
  gold: 24,
  spells: ['arcane-bolt'],
  inventory: [
    {
      id: 'potion',
      name: 'Healing Potion',
      type: 'heal',
      amount: '2d6+2',
      price: 10,
      quantity: 2,
      description: 'Restore a burst of vitality.',
    },
  ],
  stats: {
    strength: 2,
    dexterity: 2,
    intellect: 3,
    armorClass: 11,
    attackBonus: 4,
  },
}

const rollDice = (notation: string) => {
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/i)
  if (!match) return 0
  const [, countStr, sidesStr, modStr] = match
  const count = Number(countStr)
  const sides = Number(sidesStr)
  const modifier = modStr ? Number(modStr) : 0

  let total = 0
  for (let i = 0; i < count; i += 1) {
    total += Math.floor(Math.random() * sides) + 1
  }
  return total + modifier
}

const cloneMonster = (monster: Monster): Monster => ({ ...monster, hp: monster.maxHp })

function getRandomMonster(tile: TileType, bossDefeated: boolean): Monster | null {
  if (tile === 'boss' && !bossDefeated) return cloneMonster(BOSS)
  const candidates = MONSTERS.filter((monster) => monster.biomes.includes(tile))
  if (!candidates.length) return null
  return cloneMonster(candidates[Math.floor(Math.random() * candidates.length)])
}

function getXpToNext(level: number, xp: number) {
  const next = LEVEL_TABLE.find((step) => step.level === level + 1)
  if (!next) return 0
  return Math.max(0, next.xp - xp)
}

function awardLevelUps(player: Player, additionalXp: number): Player {
  const updated = { ...player, xp: player.xp + additionalXp, gold: player.gold }
  let next = LEVEL_TABLE.find((step) => step.level === updated.level + 1 && updated.xp >= step.xp)

  while (next) {
    updated.level += 1
    updated.maxHp += next.hpGain
    updated.hp = Math.min(updated.maxHp, updated.hp + next.hpGain)
    updated.stats = {
      ...updated.stats,
      attackBonus: updated.stats.attackBonus + next.attackBoost,
      armorClass: updated.stats.armorClass + next.acBoost,
    }

    const newlyUnlocked = SPELLS.filter((spell) => spell.levelReq === updated.level).map((spell) => spell.id)
    updated.spells = Array.from(new Set([...updated.spells, ...newlyUnlocked]))

    next = LEVEL_TABLE.find((step) => step.level === updated.level + 1 && updated.xp >= step.xp)
  }

  return updated
}

function addInventoryItem(inventory: InventoryItem[], item: InventoryItem) {
  const existingIndex = inventory.findIndex((entry) => entry.id === item.id)
  if (existingIndex !== -1) {
    const existing = inventory[existingIndex]
    const updated = [...inventory]
    updated[existingIndex] = { ...existing, quantity: existing.quantity + item.quantity }
    return updated
  }

  return [...inventory, item]
}

function App() {
  const [player, setPlayer] = useState<Player>(initialPlayer)
  const [position, setPosition] = useState({ x: 1, y: 1 })
  const [mode, setMode] = useState<Mode>('overworld')
  const [currentEnemy, setCurrentEnemy] = useState<Monster | null>(null)
  const [battleLog, setBattleLog] = useState<string[]>([
    'Use WASD to move, Space to interact with cities and dungeons.',
    'Seek the Cinder Drake lair in the northeast.',
  ])
  const [turn, setTurn] = useState<'player' | 'enemy'>('player')
  const [bossDefeated, setBossDefeated] = useState(false)
  const [shopMessage, setShopMessage] = useState('The harbor sells potions, bombs, and escape tools.')

  const currentTile = WORLD_MAP[position.y]?.[position.x] ?? 'plains'
  const availableSpells = useMemo(
    () => SPELLS.filter((spell) => player.spells.includes(spell.id)).sort((a, b) => a.levelReq - b.levelReq),
    [player.spells],
  )

  const pushLog = useCallback((message: string) => {
    setBattleLog((prev) => [...prev.slice(-7), message])
  }, [])

  const startBattle = useCallback(
    (enemy: Monster) => {
      const playerInitiative = rollDice('1d20') + player.stats.dexterity
      const enemyInitiative = rollDice('1d20') + enemy.initiative
      const playerStarts = playerInitiative >= enemyInitiative
      setMode('battle')
      setCurrentEnemy(enemy)
      setTurn(playerStarts ? 'player' : 'enemy')
      pushLog(
        `Encountered ${enemy.name}! Initiative — You ${playerInitiative} vs ${enemy.name} ${enemyInitiative}. ${playerStarts ? 'You act first.' : `${enemy.name} acts first.`}`,
      )
    },
    [player.stats.dexterity, pushLog],
  )

  const handleMovement = useCallback(
    (dx: number, dy: number) => {
      if (mode !== 'overworld') return
      const newX = Math.min(Math.max(position.x + dx, 0), WORLD_MAP[0].length - 1)
      const newY = Math.min(Math.max(position.y + dy, 0), WORLD_MAP.length - 1)
      const tile = WORLD_MAP[newY][newX]

      if (TILE_DETAILS[tile].blocks) {
        pushLog(`The path is blocked by ${TILE_DETAILS[tile].label}.`)
        return
      }

      const newPos = { x: newX, y: newY }
      setPosition(newPos)

      if (tile === 'boss') {
        if (!bossDefeated) {
          const boss = getRandomMonster(tile, bossDefeated)
          if (boss) startBattle(boss)
        } else {
          pushLog('The lair lies quiet. The drake is no more.')
        }
        return
      }

      const encounterChance = TILE_DETAILS[tile].encounterChance ?? 0
      if (encounterChance > 0 && Math.random() < encounterChance) {
        const monster = getRandomMonster(tile, bossDefeated)
        if (monster) {
          startBattle(monster)
          return
        }
      }
    },
    [bossDefeated, mode, position.x, position.y, pushLog, startBattle],
  )

  const handleInteract = useCallback(() => {
    if (mode !== 'overworld') return
    if (currentTile === 'city') {
      setMode('shop')
      setShopMessage('Welcome! Spend gold for gear or sell unwanted items.')
      return
    }

    if (currentTile === 'dungeon') {
      pushLog('You steel yourself; threats lurk in the dungeon halls.')
      const monster = getRandomMonster('dungeon', bossDefeated)
      if (monster) startBattle(monster)
      return
    }

    pushLog('There is nothing to interact with here.')
  }, [bossDefeated, currentTile, mode, pushLog, startBattle])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', ' '].includes(key)) {
        event.preventDefault()
      }
      switch (key) {
        case 'w':
          handleMovement(0, -1)
          break
        case 'a':
          handleMovement(-1, 0)
          break
        case 's':
          handleMovement(0, 1)
          break
        case 'd':
          handleMovement(1, 0)
          break
        case ' ':
          handleInteract()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleInteract, handleMovement])

  const endBattle = useCallback(
    (enemy: Monster) => {
      setPlayer((prev) => {
        const rewarded = awardLevelUps(
          {
            ...prev,
            gold: prev.gold + enemy.gold,
          },
          enemy.xp,
        )
        pushLog(`Gained ${enemy.xp} XP and ${enemy.gold} gold.`)
        return rewarded
      })

      if (enemy.isBoss) {
        setBossDefeated(true)
        setMode('victory')
        pushLog('The Cinder Drake falls. Peace returns to the shore.')
      } else {
        setMode('overworld')
      }

      setCurrentEnemy(null)
      setTurn('player')
    },
    [pushLog],
  )

  const resolvePlayerAttack = useCallback(() => {
    if (!currentEnemy || mode !== 'battle') return
    const attackRoll = rollDice('1d20') + player.stats.attackBonus
    const hit = attackRoll >= currentEnemy.ac

    if (!hit) {
      pushLog('Your attack misses.')
      setTurn('enemy')
      return
    }

    const damage = rollDice('1d8') + player.stats.strength
    const nextHp = Math.max(0, currentEnemy.hp - damage)
    pushLog(`You strike for ${damage} damage.`)
    const updated = { ...currentEnemy, hp: nextHp }
    setCurrentEnemy(updated)
    if (nextHp <= 0) {
      endBattle(currentEnemy)
    } else {
      setTurn('enemy')
    }
  }, [currentEnemy, endBattle, mode, player.stats.attackBonus, player.stats.strength, pushLog])

  const resolveSpell = useCallback(
    (spell: Spell) => {
      if (!currentEnemy || mode !== 'battle') return
      if (spell.type === 'heal') {
        const healAmount = rollDice(spell.dice) + (spell.modifierKey ? player.stats[spell.modifierKey] : 0)
        setPlayer((prev) => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + healAmount) }))
        pushLog(`You cast ${spell.name} and recover ${healAmount} HP.`)
        setTurn('enemy')
        return
      }

      const damage = rollDice(spell.dice) + (spell.modifierKey ? player.stats[spell.modifierKey] : 0)
      const nextHp = Math.max(0, currentEnemy.hp - damage)
      pushLog(`${spell.name} hits for ${damage} damage.`)
      const updated = { ...currentEnemy, hp: nextHp }
      setCurrentEnemy(updated)
      if (nextHp <= 0) {
        endBattle(currentEnemy)
      } else {
        setTurn('enemy')
      }
    },
    [currentEnemy, endBattle, mode, player.stats, pushLog],
  )

  const resolveItemUse = useCallback(
    (item: InventoryItem) => {
      if (mode !== 'battle') return
      if (item.type === 'heal') {
        const heal = Math.max(1, rollDice(item.amount))
        setPlayer((prev) => {
          const updatedInventory = prev.inventory
            .map((entry) =>
              entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry,
            )
            .filter((entry) => entry.quantity > 0)
          return { ...prev, hp: Math.min(prev.maxHp, prev.hp + heal), inventory: updatedInventory }
        })
        pushLog(`You drink ${item.name} for ${heal} HP.`)
      } else if (item.type === 'damage' && currentEnemy) {
        const damage = rollDice(item.amount)
        const nextHp = Math.max(0, currentEnemy.hp - damage)
        pushLog(`${item.name} explodes for ${damage} damage.`)
        const updated = { ...currentEnemy, hp: nextHp }
        setCurrentEnemy(updated)
        if (nextHp <= 0) {
          endBattle(currentEnemy)
          return
        }
      } else if (item.type === 'escape') {
        pushLog('The smoke bomb blinds the foe — you escape!')
        setMode('overworld')
        setCurrentEnemy(null)
        setTurn('player')
        return
      }
      setTurn('enemy')
    },
    [currentEnemy, endBattle, mode, pushLog],
  )

  const attemptEscape = useCallback(() => {
    if (!currentEnemy || currentEnemy.isBoss) {
      pushLog('Escape is impossible from this foe.')
      return
    }
    const success = rollDice('1d20') + player.stats.dexterity >= 12
    if (success) {
      pushLog('You slip away into the wilds.')
      setMode('overworld')
      setCurrentEnemy(null)
      setTurn('player')
    } else {
      pushLog('You fail to escape!')
      setTurn('enemy')
    }
  }, [currentEnemy, player.stats.dexterity, pushLog])

  const enemyTurn = useCallback(() => {
    if (!currentEnemy || mode !== 'battle') return
    const attackRoll = rollDice('1d20') + currentEnemy.attackBonus
    const hit = attackRoll >= player.stats.armorClass
    if (!hit) {
      pushLog(`${currentEnemy.name} misses.`)
      setTurn('player')
      return
    }
    const damage = rollDice(currentEnemy.damage)
    const nextHp = Math.max(0, player.hp - damage)
    setPlayer((prev) => ({ ...prev, hp: nextHp }))
    pushLog(`${currentEnemy.name} hits for ${damage} damage.`)
    if (nextHp <= 0) {
      setMode('defeat')
      setBattleLog((prev) => [...prev.slice(-6), 'You are defeated.'])
      return
    }
    setTurn('player')
  }, [currentEnemy, mode, player.hp, player.stats.armorClass, pushLog])

  useEffect(() => {
    if (mode === 'battle' && turn === 'enemy') {
      const timer = window.setTimeout(() => enemyTurn(), 550)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [enemyTurn, mode, turn])

  const buyItem = (item: InventoryItem) => {
    setPlayer((prev) => {
      if (prev.gold < item.price) {
        setShopMessage('Not enough gold.')
        return prev
      }
      setShopMessage(`Purchased ${item.name}.`)
      const inventory = addInventoryItem(prev.inventory, { ...item })
      return { ...prev, gold: prev.gold - item.price, inventory }
    })
  }

  const sellItem = (item: InventoryItem) => {
    setPlayer((prev) => {
      const owned = prev.inventory.find((entry) => entry.id === item.id)
      if (!owned) return prev
      const updatedInventory = prev.inventory
        .map((entry) => (entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry))
        .filter((entry) => entry.quantity > 0)
      const value = Math.floor(item.price / 2)
      setShopMessage(`Sold ${item.name} for ${value}g.`)
      return { ...prev, gold: prev.gold + value, inventory: updatedInventory }
    })
  }

  const xpToNext = getXpToNext(player.level, player.xp)
  const hasEscape = player.inventory.find((item) => item.type === 'escape')

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">JRPG + D&D mechanics</p>
          <h1>2D&D</h1>
          <p className="subtitle">Explore biomes, roll dice in battle, and shop for survival.</p>
        </div>
        <div className="stats">
          <div>
            <span className="label">HP</span>
            <span className="value">
              {player.hp}/{player.maxHp}
            </span>
          </div>
          <div>
            <span className="label">Level</span>
            <span className="value">{player.level}</span>
          </div>
          <div>
            <span className="label">XP</span>
            <span className="value">
              {player.xp} {xpToNext ? `(${xpToNext} to next)` : '(max)'}
            </span>
          </div>
          <div>
            <span className="label">Gold</span>
            <span className="value">{player.gold}g</span>
          </div>
          <div>
            <span className="label">AC</span>
            <span className="value">{player.stats.armorClass}</span>
          </div>
        </div>
      </header>

      <div className="layout">
        <section className="map-section">
          <div className="panel-title">
            <h2>Overworld</h2>
            <p>WASD to move · Space to interact</p>
          </div>
          <div
            className="map-grid"
            style={{ gridTemplateColumns: `repeat(${WORLD_MAP[0].length}, 1fr)` }}
          >
            {WORLD_MAP.map((row, y) =>
              row.map((tile, x) => {
                const isPlayer = position.x === x && position.y === y
                const isBoss = tile === 'boss'
                return (
                  <div
                    key={`${x}-${y}`}
                    className={`tile ${tile} ${isPlayer ? 'player' : ''}`}
                    title={TILE_DETAILS[tile].label}
                  >
                    {isPlayer ? '★' : isBoss ? 'B' : ''}
                  </div>
                )
              }),
            )}
          </div>
          <div className="legend">
            {Object.entries(TILE_DETAILS).map(([tile, details]) => (
              <div className="legend-item" key={tile}>
                <span className="legend-swatch" style={{ background: details.color }} />
                <p>{details.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="side-panel">
          <div className="panel">
            <div className="panel-title">
              <h3>Adventure Log</h3>
              <p>Current tile: {TILE_DETAILS[currentTile].label}</p>
            </div>
            <div className="log">
              {battleLog.map((entry, index) => (
                <p key={`${entry}-${index}`}>{entry}</p>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              <h3>Actions</h3>
              <p>{mode === 'overworld' ? 'Explore, shop, or hunt monsters.' : 'Act before your foe.'}</p>
            </div>
            {mode === 'battle' && currentEnemy && (
              <div className="battle">
                <div className="battle-header">
                  <div>
                    <p className="eyebrow">Foe</p>
                    <h4>{currentEnemy.name}</h4>
                    <p>
                      HP {currentEnemy.hp}/{currentEnemy.maxHp} · AC {currentEnemy.ac}
                    </p>
                  </div>
                  <div className="tag">{turn === 'player' ? 'Your turn' : 'Enemy turn'}</div>
                </div>
                <div className="battle-actions">
                  <button type="button" onClick={resolvePlayerAttack} disabled={turn !== 'player'}>
                    Attack (d20 + {player.stats.attackBonus})
                  </button>
                  <button
                    type="button"
                    onClick={attemptEscape}
                    disabled={turn !== 'player' || currentEnemy.isBoss}
                  >
                    Run
                  </button>
                  {hasEscape && (
                    <button
                      type="button"
                      onClick={() => resolveItemUse(hasEscape)}
                      disabled={turn !== 'player'}
                    >
                      Use {hasEscape.name}
                    </button>
                  )}
                </div>
                <div className="spells">
                  <p className="eyebrow">Spells</p>
                  <div className="spell-grid">
                    {availableSpells.map((spell) => (
                      <button
                        type="button"
                        key={spell.id}
                        disabled={turn !== 'player'}
                        onClick={() => resolveSpell(spell)}
                      >
                        {spell.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="inventory">
                  <p className="eyebrow">Items</p>
                  <div className="inventory-grid">
                    {player.inventory.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        disabled={turn !== 'player'}
                        onClick={() => resolveItemUse(item)}
                      >
                        {item.name} ×{item.quantity}
                      </button>
                    ))}
                    {!player.inventory.length && <p>No items carried.</p>}
                  </div>
                </div>
              </div>
            )}

            {mode === 'shop' && (
              <div className="shop">
                <div className="shop-head">
                  <div>
                    <p className="eyebrow">Harbor Merchant</p>
                    <h4>Spend your gold</h4>
                    <p>{shopMessage}</p>
                  </div>
                  <button type="button" className="ghost" onClick={() => setMode('overworld')}>
                    Leave
                  </button>
                </div>
                <div className="shop-grid">
                  {MERCHANT_STOCK.map((item) => (
                    <div key={item.id} className="shop-card">
                      <div>
                        <p className="eyebrow">{item.type}</p>
                        <h5>{item.name}</h5>
                        <p>{item.description}</p>
                        <p className="cost">{item.price}g</p>
                      </div>
                      <div className="shop-actions">
                        <button type="button" onClick={() => buyItem(item)}>
                          Buy
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          disabled={!player.inventory.some((entry) => entry.id === item.id)}
                          onClick={() => sellItem(item)}
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === 'overworld' && (
              <div className="explore">
                <p>Stand on the harbor (blue) and press Space to trade.</p>
                <p>Step onto the dungeon or red lair to face stronger foes.</p>
                <p>Boss: Cinder Drake at the red tile; beating it wins the run.</p>
              </div>
            )}

            {mode === 'victory' && (
              <div className="victory">
                <h4>Victory!</h4>
                <p>You have defeated the Cinder Drake and restored peace.</p>
              </div>
            )}

            {mode === 'defeat' && (
              <div className="defeat">
                <h4>Defeat</h4>
                <p>The wilds claimed you, but you can refresh to try again.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App

import type { ItemData } from '../types'

export const items: Record<string, ItemData> = {
  // ==========================================================================
  // CONSUMABLES
  // ==========================================================================
  herb: {
    id: 'herb',
    name: 'Herb',
    description: 'A common medicinal herb. Restores 15 HP.',
    type: 'consumable',
    stackable: true,
    maxStack: 99,
    value: 8,
    usable: true,
    targetType: 'single_ally',
    effect: { healHp: 15 },
  },

  potion: {
    id: 'potion',
    name: 'Potion',
    description: 'A basic healing potion. Restores 30 HP.',
    type: 'consumable',
    stackable: true,
    maxStack: 99,
    value: 25,
    usable: true,
    targetType: 'single_ally',
    effect: { healHp: 30 },
  },

  hi_potion: {
    id: 'hi_potion',
    name: 'Hi-Potion',
    description: 'A powerful healing potion. Restores 100 HP.',
    type: 'consumable',
    stackable: true,
    maxStack: 99,
    value: 100,
    usable: true,
    targetType: 'single_ally',
    effect: { healHp: 100 },
  },

  ether: {
    id: 'ether',
    name: 'Ether',
    description: 'Restores 20 MP.',
    type: 'consumable',
    stackable: true,
    maxStack: 99,
    value: 50,
    usable: true,
    targetType: 'single_ally',
    effect: { healMp: 20 },
  },

  antidote: {
    id: 'antidote',
    name: 'Antidote',
    description: 'Cures poison.',
    type: 'consumable',
    stackable: true,
    maxStack: 99,
    value: 15,
    usable: true,
    targetType: 'single_ally',
    effect: { removeStatus: ['poison'] },
  },

  phoenix_feather: {
    id: 'phoenix_feather',
    name: 'Phoenix Feather',
    description: 'Revives a fallen ally with 25% HP.',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
    value: 200,
    usable: true,
    targetType: 'single_ally',
    effect: { revive: true, reviveHpPercent: 25 },
  },

  // ==========================================================================
  // WEAPONS
  // ==========================================================================
  wooden_sword: {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    description: 'A practice sword made of wood.',
    type: 'equipment',
    stackable: false,
    value: 30,
    usable: false,
    equipSlot: 'weapon',
    statBonus: { attack: 3 },
  },

  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'A sturdy iron sword.',
    type: 'equipment',
    stackable: false,
    value: 100,
    usable: false,
    equipSlot: 'weapon',
    statBonus: { attack: 8 },
  },

  steel_sword: {
    id: 'steel_sword',
    name: 'Steel Sword',
    description: 'A well-crafted steel blade.',
    type: 'equipment',
    stackable: false,
    value: 300,
    usable: false,
    equipSlot: 'weapon',
    statBonus: { attack: 15 },
  },

  rusty_dagger: {
    id: 'rusty_dagger',
    name: 'Rusty Dagger',
    description: 'A worn dagger. Better than nothing.',
    type: 'equipment',
    stackable: false,
    value: 15,
    usable: false,
    equipSlot: 'weapon',
    statBonus: { attack: 2, speed: 1 },
  },

  iron_axe: {
    id: 'iron_axe',
    name: 'Iron Axe',
    description: 'A heavy iron axe. Slow but powerful.',
    type: 'equipment',
    stackable: false,
    value: 150,
    usable: false,
    equipSlot: 'weapon',
    statBonus: { attack: 12, speed: -2 },
  },

  // ==========================================================================
  // ARMOR
  // ==========================================================================
  leather_armor: {
    id: 'leather_armor',
    name: 'Leather Armor',
    description: 'Basic leather protection.',
    type: 'equipment',
    stackable: false,
    value: 50,
    usable: false,
    equipSlot: 'body',
    statBonus: { defense: 3 },
  },

  chainmail: {
    id: 'chainmail',
    name: 'Chainmail',
    description: 'Interlocking metal rings provide good defense.',
    type: 'equipment',
    stackable: false,
    value: 200,
    usable: false,
    equipSlot: 'body',
    statBonus: { defense: 8, speed: -1 },
  },

  iron_helm: {
    id: 'iron_helm',
    name: 'Iron Helm',
    description: 'A sturdy iron helmet.',
    type: 'equipment',
    stackable: false,
    value: 80,
    usable: false,
    equipSlot: 'head',
    statBonus: { defense: 3 },
  },

  wooden_shield: {
    id: 'wooden_shield',
    name: 'Wooden Shield',
    description: 'A simple wooden shield.',
    type: 'equipment',
    stackable: false,
    value: 40,
    usable: false,
    equipSlot: 'shield',
    statBonus: { defense: 2 },
  },

  iron_shield: {
    id: 'iron_shield',
    name: 'Iron Shield',
    description: 'A reliable iron shield.',
    type: 'equipment',
    stackable: false,
    value: 150,
    usable: false,
    equipSlot: 'shield',
    statBonus: { defense: 5 },
  },

  // ==========================================================================
  // ACCESSORIES
  // ==========================================================================
  power_ring: {
    id: 'power_ring',
    name: 'Power Ring',
    description: 'A ring that boosts attack power.',
    type: 'equipment',
    stackable: false,
    value: 500,
    usable: false,
    equipSlot: 'accessory',
    statBonus: { attack: 5 },
  },

  speed_boots: {
    id: 'speed_boots',
    name: 'Speed Boots',
    description: 'Light boots that increase agility.',
    type: 'equipment',
    stackable: false,
    value: 400,
    usable: false,
    equipSlot: 'accessory',
    statBonus: { speed: 5 },
  },

  // ==========================================================================
  // KEY ITEMS
  // ==========================================================================
  chief_crown: {
    id: 'chief_crown',
    name: "Goblin Chief's Crown",
    description: 'The crown of the defeated Goblin Chief. Proof of your victory.',
    type: 'key',
    stackable: false,
    value: 0,
    usable: false,
  },

  dungeon_key: {
    id: 'dungeon_key',
    name: 'Dungeon Key',
    description: 'An old iron key. Opens doors in the dungeon.',
    type: 'key',
    stackable: false,
    value: 0,
    usable: false,
  },

  // ==========================================================================
  // MATERIALS
  // ==========================================================================
  slime_jelly: {
    id: 'slime_jelly',
    name: 'Slime Jelly',
    description: 'Gelatinous residue from a slime. Used in alchemy.',
    type: 'material',
    stackable: true,
    maxStack: 99,
    value: 5,
    usable: false,
  },

  bone: {
    id: 'bone',
    name: 'Bone',
    description: 'A weathered bone. Crafting material.',
    type: 'material',
    stackable: true,
    maxStack: 99,
    value: 8,
    usable: false,
  },

  spider_silk: {
    id: 'spider_silk',
    name: 'Spider Silk',
    description: 'Strong and flexible silk from a giant spider.',
    type: 'material',
    stackable: true,
    maxStack: 99,
    value: 20,
    usable: false,
  },

  orc_tusk: {
    id: 'orc_tusk',
    name: 'Orc Tusk',
    description: 'A large tusk from an orc warrior.',
    type: 'material',
    stackable: true,
    maxStack: 99,
    value: 35,
    usable: false,
  },
}

export function getItem(id: string): ItemData {
  const item = items[id]
  if (!item) {
    throw new Error(`Item not found: ${id}`)
  }
  return item
}

export function getItemsByType(type: ItemData['type']): ItemData[] {
  return Object.values(items).filter((item) => item.type === type)
}

export function getEquipmentBySlot(slot: ItemData['equipSlot']): ItemData[] {
  return Object.values(items).filter((item) => item.type === 'equipment' && item.equipSlot === slot)
}

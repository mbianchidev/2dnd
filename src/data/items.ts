import type { ItemData } from '../types'

export const items: Record<string, ItemData> = {
  potion: {
    id: 'potion',
    name: 'Potion',
    description: 'Heals 10 HP.',
    type: 'consumable',
    effect: { heal: 10 },
  },
}

export function getItem(id: string): ItemData {
  const item = items[id]
  if (!item) {
    throw new Error(`Item not found: ${id}`)
  }
  return item
}

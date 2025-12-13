import type { SaveData, GameSettings } from '../types'
import { HERO_ID, getActor } from '../data/actors'

const SAVE_KEY = '2dnd_save'
const SETTINGS_KEY = '2dnd_settings'
const SAVE_VERSION = '1.0.0'

const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  textSpeed: 'normal',
  battleAnimations: true,
  screenShake: true,
}

/**
 * Save/Load system using localStorage (with IndexedDB support planned)
 */
export class SaveManager {
  private settings: GameSettings = { ...DEFAULT_SETTINGS }

  constructor() {
    this.loadSettings()
  }

  /**
   * Create a new save data object
   */
  createNewGame(): SaveData {
    const hero = getActor(HERO_ID)

    return {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      playTime: 0,
      party: [
        {
          actorId: HERO_ID,
          stats: { ...hero.stats },
          attributes: hero.attributes ? { ...hero.attributes } : undefined,
          equipment: {},
          statusEffects: [],
          experience: 0,
          level: 1,
        },
      ],
      inventory: [
        { itemId: 'potion', quantity: 3 },
        { itemId: 'herb', quantity: 5 },
      ],
      gold: 100,
      currentMap: 'map_village',
      position: { x: 160, y: 120 },
      quests: [],
      flags: {},
      settings: this.settings,
    }
  }

  /**
   * Save game to localStorage
   */
  save(data: SaveData): boolean {
    try {
      data.timestamp = Date.now()
      data.version = SAVE_VERSION
      const json = JSON.stringify(data)
      localStorage.setItem(SAVE_KEY, json)
      return true
    } catch (error) {
      console.error('Failed to save game:', error)
      return false
    }
  }

  /**
   * Load game from localStorage
   */
  load(): SaveData | null {
    try {
      const json = localStorage.getItem(SAVE_KEY)
      if (!json) return null

      const data = JSON.parse(json) as SaveData

      // Version migration if needed
      if (data.version !== SAVE_VERSION) {
        return this.migrateData(data)
      }

      return data
    } catch (error) {
      console.error('Failed to load game:', error)
      return null
    }
  }

  /**
   * Check if a save exists
   */
  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null
  }

  /**
   * Delete save data
   */
  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY)
  }

  /**
   * Get save metadata without loading full data
   */
  getSaveInfo(): { timestamp: number; playTime: number; level: number } | null {
    try {
      const json = localStorage.getItem(SAVE_KEY)
      if (!json) return null

      const data = JSON.parse(json) as SaveData
      const heroLevel = data.party.find((p) => p.actorId === HERO_ID)?.level || 1

      return {
        timestamp: data.timestamp,
        playTime: data.playTime,
        level: heroLevel,
      }
    } catch {
      return null
    }
  }

  /**
   * Save settings
   */
  saveSettings(settings: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...settings }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  /**
   * Load settings
   */
  loadSettings(): GameSettings {
    try {
      const json = localStorage.getItem(SETTINGS_KEY)
      if (json) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(json) }
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS }
    }
    return this.settings
  }

  /**
   * Get current settings
   */
  getSettings(): GameSettings {
    return { ...this.settings }
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    localStorage.removeItem(SETTINGS_KEY)
  }

  /**
   * Migrate save data from older versions
   */
  private migrateData(data: SaveData): SaveData {
    // For now, just update version
    // Add migration logic here as versions change
    data.version = SAVE_VERSION
    return data
  }

  /**
   * Export save data as JSON string (for manual backup)
   */
  exportSave(): string | null {
    const data = this.load()
    if (!data) return null
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import save data from JSON string
   */
  importSave(json: string): boolean {
    try {
      const data = JSON.parse(json) as SaveData

      // Basic validation
      if (!data.version || !data.party || !Array.isArray(data.party)) {
        throw new Error('Invalid save data format')
      }

      return this.save(data)
    } catch (error) {
      console.error('Failed to import save:', error)
      return false
    }
  }
}

// Export singleton
export const saveManager = new SaveManager()

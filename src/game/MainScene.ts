import Phaser from 'phaser';
import { Player, Location } from '../types/game';
import { BIOMES } from './data';

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private playerData: Player;
  private locations: Location[] = [];
  private locationMarkers: Phaser.GameObjects.Rectangle[] = [];
  private stepCounter: number = 0;
  private onBattleStart?: (monsterId: string) => void;
  private onLocationInteract?: (location: Location) => void;

  constructor() {
    super({ key: 'MainScene' });
    
    // Initialize player data
    this.playerData = {
      id: 'player',
      name: 'Hero',
      position: { x: 400, y: 300 },
      level: 1,
      experience: 0,
      health: 20,
      maxHealth: 20,
      mana: 10,
      maxMana: 10,
      strength: 14,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      gold: 100,
      inventory: [],
      equipment: {},
      spells: [],
    };
  }

  create() {
    // Create map (simple tile-based)
    this.createMap();
    
    // Create locations
    this.createLocations();
    
    // Create player sprite
    this.player = this.add.rectangle(
      this.playerData.position.x,
      this.playerData.position.y,
      20,
      20,
      0x00ff00
    );
    
    // Set up input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // Camera follows player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, 800, 600);
  }

  update() {
    const speed = 3;
    let moved = false;

    // Handle WASD movement
    if (this.wasd.left.isDown || this.cursors.left?.isDown) {
      this.player.x -= speed;
      moved = true;
    } else if (this.wasd.right.isDown || this.cursors.right?.isDown) {
      this.player.x += speed;
      moved = true;
    }

    if (this.wasd.up.isDown || this.cursors.up?.isDown) {
      this.player.y -= speed;
      moved = true;
    } else if (this.wasd.down.isDown || this.cursors.down?.isDown) {
      this.player.y += speed;
      moved = true;
    }

    // Update player position
    this.playerData.position = { x: this.player.x, y: this.player.y };

    // Random encounters
    if (moved) {
      this.stepCounter++;
      this.checkRandomEncounter();
    }

    // Check for space key press near locations
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.checkLocationInteraction();
    }

    // Keep player in bounds
    this.player.x = Phaser.Math.Clamp(this.player.x, 10, 790);
    this.player.y = Phaser.Math.Clamp(this.player.y, 10, 590);
  }

  private createMap() {
    const tileSize = 40;
    const tilesX = Math.ceil(800 / tileSize);
    const tilesY = Math.ceil(600 / tileSize);

    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        // Simple biome selection based on position
        let biome = BIOMES.grass;
        if (x > tilesX / 2 && y < tilesY / 2) {
          biome = BIOMES.forest;
        } else if (x < tilesX / 3 && y > tilesY / 2) {
          biome = BIOMES.mountain;
        }

        this.add.rectangle(
          x * tileSize + tileSize / 2,
          y * tileSize + tileSize / 2,
          tileSize - 2,
          tileSize - 2,
          biome.tileColor
        );
      }
    }
  }

  private createLocations() {
    // Create some cities and dungeons
    this.locations = [
      {
        type: 'city',
        name: 'Starting Town',
        position: { x: 400, y: 300 },
        description: 'A peaceful town with shops and an inn',
      },
      {
        type: 'dungeon',
        name: 'Dark Cave',
        position: { x: 200, y: 450 },
        description: 'A dangerous cave filled with monsters',
      },
      {
        type: 'boss',
        name: 'Dragon Lair',
        position: { x: 700, y: 100 },
        description: 'The lair of a mighty dragon',
      },
    ];

    // Draw location markers
    this.locations.forEach(loc => {
      const color = loc.type === 'city' ? 0xFFD700 : loc.type === 'boss' ? 0xFF0000 : 0x8B4513;
      const marker = this.add.rectangle(loc.position.x, loc.position.y, 30, 30, color);
      this.locationMarkers.push(marker);
    });
  }

  private checkRandomEncounter() {
    if (this.stepCounter < 60) return; // Encounter every ~60 steps
    
    const encounterChance = Math.random();
    if (encounterChance < 0.05) { // 5% chance per check
      this.stepCounter = 0;
      
      // Select random monster
      const monsterKeys = ['goblin', 'orc', 'skeleton'];
      const randomMonster = monsterKeys[Math.floor(Math.random() * monsterKeys.length)];
      
      if (this.onBattleStart) {
        this.onBattleStart(randomMonster);
      }
    }
  }

  private checkLocationInteraction() {
    for (const location of this.locations) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        location.position.x,
        location.position.y
      );

      if (distance < 40) {
        if (this.onLocationInteract) {
          this.onLocationInteract(location);
        }
        break;
      }
    }
  }

  setOnBattleStart(callback: (monsterId: string) => void) {
    this.onBattleStart = callback;
  }

  setOnLocationInteract(callback: (location: Location) => void) {
    this.onLocationInteract = callback;
  }

  getPlayerData(): Player {
    return this.playerData;
  }

  updatePlayerData(player: Player) {
    this.playerData = player;
  }
}

import Phaser from 'phaser';
import { DialogRunner } from '../systems/DialogRunner';

export class TilemapScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private dialogRunner!: DialogRunner;
  // private map!: Phaser.Tilemaps.Tilemap;

  constructor() {
    super('TilemapScene');
  }

  preload() {
    // Placeholder: Load map and tileset
    // this.load.image('tiles', 'assets/tilesets/world.png');
    // this.load.tilemapTiledJSON('map', 'assets/maps/world.json');
    // this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    this.dialogRunner = new DialogRunner(this);

    // Placeholder map creation
    // this.map = this.make.tilemap({ key: 'map' });
    // const tileset = this.map.addTilesetImage('World', 'tiles');
    // const groundLayer = this.map.createLayer('Ground', tileset!, 0, 0);
    // const wallsLayer = this.map.createLayer('Walls', tileset!, 0, 0);

    // wallsLayer?.setCollisionByProperty({ collides: true });

    // Placeholder player
    this.player = this.physics.add.sprite(400, 300, 'player');
    
    // If no sprite loaded, use a rectangle
    if (!this.textures.exists('player')) {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0x00ff00, 1.0);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('player', 32, 32);
        this.player.setTexture('player');
    }

    // Camera
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(2);

    // UI / Instructions
    const helpText = this.add.text(10, 10, 'Arrows to Move\nPress B for Battle\nPress T for Talk', {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000'
    });
    helpText.setScrollFactor(0); // Fix to camera
    helpText.setDepth(100);

    // Input
    if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Debug: Start battle with 'B'
        this.input.keyboard.on('keydown-B', () => {
            this.scene.start('BattleScene', {
                enemies: [{
                    id: 'slime',
                    name: 'Slime',
                    hp: 20,
                    maxHp: 20,
                    sp: 0,
                    maxSp: 0,
                    stats: { str: 5, def: 2, spd: 5 },
                    isPlayer: false
                }]
            });
        });

        // Debug: Show dialog with 'T'
        this.input.keyboard.on('keydown-T', () => {
            if (this.dialogRunner.isDialogVisible()) {
                this.dialogRunner.hideDialog();
            } else {
                this.dialogRunner.showDialog('Hello traveler! Welcome to the world of 2DND.');
            }
        });
    }

    // Collisions
    // this.physics.add.collider(this.player, wallsLayer!);
  }

  update() {
    if (!this.cursors) return;
    if (this.dialogRunner.isDialogVisible()) return; // Freeze player when dialog is open

    const speed = 160;
    this.player.setVelocity(0);

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
    }

    if (this.cursors.up.isDown) {
      this.player.setVelocityY(-speed);
    } else if (this.cursors.down.isDown) {
      this.player.setVelocityY(speed);
    }
    
    // Normalize and scale the velocity so that player can't move faster along a diagonal
    if (this.player.body) {
      this.player.body.velocity.normalize().scale(speed);
    }
  }
}

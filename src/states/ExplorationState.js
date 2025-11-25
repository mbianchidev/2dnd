/**
 * Exploration State - Main gameplay state for exploring the world
 */
export class ExplorationState {
    constructor(game, inputManager, player, party, map) {
        this.game = game;
        this.inputManager = inputManager;
        this.player = player;
        this.party = party;
        this.map = map;
        
        // Camera for viewport
        this.cameraX = 0;
        this.cameraY = 0;
        
        // Step counter for encounters
        this.stepCounter = 0;
        this.stepsPerCheck = 10;
    }
    
    enter() {
        console.log('Entering Exploration State');
        // Center camera on player
        this.centerCameraOnPlayer();
    }
    
    exit() {
        console.log('Exiting Exploration State');
    }
    
    update(deltaTime) {
        // Handle movement input
        let moved = false;
        const oldX = this.player.x;
        const oldY = this.player.y;
        
        if (this.inputManager.isKeyDown('ArrowUp')) {
            this.player.move('up', deltaTime, this.map.getPixelWidth(), this.map.getPixelHeight());
            moved = true;
        } else if (this.inputManager.isKeyDown('ArrowDown')) {
            this.player.move('down', deltaTime, this.map.getPixelWidth(), this.map.getPixelHeight());
            moved = true;
        } else if (this.inputManager.isKeyDown('ArrowLeft')) {
            this.player.move('left', deltaTime, this.map.getPixelWidth(), this.map.getPixelHeight());
            moved = true;
        } else if (this.inputManager.isKeyDown('ArrowRight')) {
            this.player.move('right', deltaTime, this.map.getPixelWidth(), this.map.getPixelHeight());
            moved = true;
        } else {
            this.player.stopMoving();
        }
        
        // Check collision with terrain
        if (moved) {
            const playerCenterX = this.player.x + this.player.width / 2;
            const playerCenterY = this.player.y + this.player.height / 2;
            
            if (!this.map.isWalkable(playerCenterX, playerCenterY)) {
                // Revert movement
                this.player.x = oldX;
                this.player.y = oldY;
            } else {
                // Check for random encounters
                this.stepCounter++;
                if (this.stepCounter >= this.stepsPerCheck) {
                    this.stepCounter = 0;
                    const encounter = this.map.checkEncounter(playerCenterX, playerCenterY);
                    if (encounter) {
                        this.game.startBattle(encounter);
                    }
                }
            }
        }
        
        // Handle menu input
        if (this.inputManager.isKeyPressed('Escape')) {
            this.game.openMenu();
        }
        
        // Update camera
        this.centerCameraOnPlayer();
        
        this.inputManager.update();
    }
    
    render(ctx) {
        const canvas = ctx.canvas;
        
        // Render map
        this.map.render(ctx, this.cameraX, this.cameraY);
        
        // Render player
        ctx.save();
        ctx.translate(-this.cameraX, -this.cameraY);
        this.player.render(ctx);
        ctx.restore();
        
        // Render UI overlay
        this.renderUI(ctx);
    }
    
    renderUI(ctx) {
        const canvas = ctx.canvas;
        const padding = 10;
        
        // Draw party status panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(padding, padding, 200, 100);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        
        const leader = this.party.getLeader();
        if (leader) {
            ctx.fillText(`${leader.name} Lv${leader.level}`, padding + 10, padding + 25);
            ctx.fillText(`HP: ${leader.currentHP}/${leader.maxHP}`, padding + 10, padding + 45);
            ctx.fillText(`MP: ${leader.currentMP}/${leader.maxMP}`, padding + 10, padding + 65);
            ctx.fillText(`Gold: ${this.party.getGold()}`, padding + 10, padding + 85);
        }
    }
    
    centerCameraOnPlayer() {
        const canvas = this.game.engine.canvas;
        
        // Center camera on player
        this.cameraX = this.player.x + this.player.width / 2 - canvas.width / 2;
        this.cameraY = this.player.y + this.player.height / 2 - canvas.height / 2;
        
        // Clamp camera to map bounds
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.map.getPixelWidth() - canvas.width));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.map.getPixelHeight() - canvas.height));
    }
}

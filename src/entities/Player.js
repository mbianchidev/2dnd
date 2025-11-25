import { Character } from './Character.js';

/**
 * Player - The player character with movement capabilities
 */
export class Player extends Character {
    constructor(x, y, stats) {
        super(x, y, stats);
        
        this.moveSpeed = 128; // pixels per second
        this.direction = 'down'; // up, down, left, right
        this.moving = false;
        
        // Visual properties
        this.color = '#4a90e2';
    }
    
    /**
     * Move the player in a direction
     */
    move(direction, deltaTime, mapWidth, mapHeight) {
        this.direction = direction;
        this.moving = true;
        
        const distance = this.moveSpeed * deltaTime;
        const oldX = this.x;
        const oldY = this.y;
        
        switch (direction) {
            case 'up':
                this.y -= distance;
                break;
            case 'down':
                this.y += distance;
                break;
            case 'left':
                this.x -= distance;
                break;
            case 'right':
                this.x += distance;
                break;
        }
        
        // Keep player within map bounds
        this.x = Math.max(0, Math.min(this.x, mapWidth - this.width));
        this.y = Math.max(0, Math.min(this.y, mapHeight - this.height));
    }
    
    /**
     * Stop moving
     */
    stopMoving() {
        this.moving = false;
    }
    
    /**
     * Render the player
     */
    render(ctx) {
        // Draw player as a colored square (placeholder for sprite)
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw direction indicator
        ctx.fillStyle = '#ffffff';
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        ctx.beginPath();
        switch (this.direction) {
            case 'up':
                ctx.moveTo(centerX, this.y + 8);
                ctx.lineTo(centerX - 6, this.y + 16);
                ctx.lineTo(centerX + 6, this.y + 16);
                break;
            case 'down':
                ctx.moveTo(centerX, this.y + this.height - 8);
                ctx.lineTo(centerX - 6, this.y + this.height - 16);
                ctx.lineTo(centerX + 6, this.y + this.height - 16);
                break;
            case 'left':
                ctx.moveTo(this.x + 8, centerY);
                ctx.lineTo(this.x + 16, centerY - 6);
                ctx.lineTo(this.x + 16, centerY + 6);
                break;
            case 'right':
                ctx.moveTo(this.x + this.width - 8, centerY);
                ctx.lineTo(this.x + this.width - 16, centerY - 6);
                ctx.lineTo(this.x + this.width - 16, centerY + 6);
                break;
        }
        ctx.closePath();
        ctx.fill();
    }
}

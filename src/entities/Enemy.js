import { Character } from './Character.js';

/**
 * Enemy - Enemy character with AI behavior
 */
export class Enemy extends Character {
    constructor(x, y, stats) {
        super(x, y, stats);
        
        // Enemy-specific properties
        this.goldDrop = stats.goldDrop || Math.floor(this.level * 10);
        this.expDrop = stats.expDrop || Math.floor(this.level * 25);
        
        // Visual properties
        this.color = stats.color || '#e24a4a';
    }
    
    /**
     * Render the enemy
     */
    render(ctx) {
        // Draw enemy as a colored square (placeholder for sprite)
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw level indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Lv${this.level}`, this.x + this.width / 2, this.y + this.height / 2 + 4);
    }
}

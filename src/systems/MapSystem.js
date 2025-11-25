/**
 * Map System - Tile-based map rendering and management
 */
export class MapSystem {
    constructor(mapData) {
        this.tileSize = 32;
        this.mapData = mapData;
        this.width = mapData.width;
        this.height = mapData.height;
        this.tiles = mapData.tiles;
        this.encounters = mapData.encounters || [];
    }
    
    /**
     * Render the map
     */
    render(ctx, cameraX = 0, cameraY = 0) {
        const startCol = Math.floor(cameraX / this.tileSize);
        const endCol = Math.ceil((cameraX + ctx.canvas.width) / this.tileSize);
        const startRow = Math.floor(cameraY / this.tileSize);
        const endRow = Math.ceil((cameraY + ctx.canvas.height) / this.tileSize);
        
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                if (row >= 0 && row < this.height && col >= 0 && col < this.width) {
                    const tileType = this.tiles[row][col];
                    this.renderTile(ctx, col, row, tileType, cameraX, cameraY);
                }
            }
        }
    }
    
    /**
     * Render a single tile
     */
    renderTile(ctx, col, row, tileType, cameraX, cameraY) {
        const x = col * this.tileSize - cameraX;
        const y = row * this.tileSize - cameraY;
        
        // Color based on tile type
        let color;
        switch (tileType) {
            case 0: // grass
                color = '#2d5016';
                break;
            case 1: // water
                color = '#1e40af';
                break;
            case 2: // mountain
                color = '#6b7280';
                break;
            case 3: // forest
                color = '#1a3d0f';
                break;
            case 4: // path
                color = '#92774a';
                break;
            case 5: // town
                color = '#8b4513';
                break;
            default:
                color = '#000000';
        }
        
        ctx.fillStyle = color;
        ctx.fillRect(x, y, this.tileSize, this.tileSize);
        
        // Draw tile border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.strokeRect(x, y, this.tileSize, this.tileSize);
    }
    
    /**
     * Check if a tile is walkable
     */
    isWalkable(x, y) {
        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);
        
        if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
            return false;
        }
        
        const tileType = this.tiles[row][col];
        // Water (1) and mountains (2) are not walkable
        return tileType !== 1 && tileType !== 2;
    }
    
    /**
     * Check if position triggers a random encounter
     */
    checkEncounter(x, y) {
        const col = Math.floor(x / this.tileSize);
        const row = Math.floor(y / this.tileSize);
        
        if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
            return null;
        }
        
        const tileType = this.tiles[row][col];
        
        // Encounter rates based on terrain
        let encounterRate = 0;
        switch (tileType) {
            case 0: // grass
                encounterRate = 0.02; // 2% per step
                break;
            case 3: // forest
                encounterRate = 0.05; // 5% per step
                break;
        }
        
        if (Math.random() < encounterRate) {
            // Return a random encounter from the encounter table
            return this.getRandomEncounter();
        }
        
        return null;
    }
    
    /**
     * Get a random encounter for this map
     */
    getRandomEncounter() {
        if (this.encounters.length === 0) {
            return null;
        }
        
        const index = Math.floor(Math.random() * this.encounters.length);
        return this.encounters[index];
    }
    
    /**
     * Get map dimensions in pixels
     */
    getPixelWidth() {
        return this.width * this.tileSize;
    }
    
    getPixelHeight() {
        return this.height * this.tileSize;
    }
}

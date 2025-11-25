/**
 * Game Engine - Core game loop and engine management
 * Handles the main game loop, state management, and rendering
 */
export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.currentState = null;
        this.running = false;
        this.lastFrameTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        // Disable image smoothing for pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;
    }
    
    /**
     * Set the current game state
     */
    setState(state) {
        if (this.currentState && this.currentState.exit) {
            this.currentState.exit();
        }
        
        this.currentState = state;
        
        if (this.currentState && this.currentState.enter) {
            this.currentState.enter();
        }
    }
    
    /**
     * Start the game loop
     */
    start() {
        this.running = true;
        this.lastFrameTime = performance.now();
        this.lastFpsUpdate = performance.now();
        this.gameLoop();
    }
    
    /**
     * Stop the game loop
     */
    stop() {
        this.running = false;
    }
    
    /**
     * Main game loop using requestAnimationFrame
     */
    gameLoop = (currentTime = performance.now()) => {
        if (!this.running) return;
        
        // Calculate delta time in seconds
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;
        
        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }
        
        // Update and render current state
        if (this.currentState) {
            if (this.currentState.update) {
                this.currentState.update(deltaTime);
            }
            
            // Clear canvas
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            if (this.currentState.render) {
                this.currentState.render(this.ctx);
            }
        }
        
        // Continue the loop
        requestAnimationFrame(this.gameLoop);
    }
    
    /**
     * Get the current FPS
     */
    getFPS() {
        return this.fps;
    }
    
    /**
     * Get the canvas context
     */
    getContext() {
        return this.ctx;
    }
}

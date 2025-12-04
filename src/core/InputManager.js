/**
 * Input Manager - Handles keyboard and mouse input
 */
export class InputManager {
    constructor() {
        this.keys = new Map();
        this.keyPressed = new Map();
        this.keyReleased = new Map();
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.keys.get(e.key)) {
                this.keyPressed.set(e.key, true);
            }
            this.keys.set(e.key, true);
            
            // Prevent default for game controls
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', ' '].includes(e.key)) {
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys.set(e.key, false);
            this.keyReleased.set(e.key, true);
        });
    }
    
    /**
     * Check if a key is currently held down
     */
    isKeyDown(key) {
        return this.keys.get(key) || false;
    }
    
    /**
     * Check if a key was just pressed this frame
     */
    isKeyPressed(key) {
        return this.keyPressed.get(key) || false;
    }
    
    /**
     * Check if a key was just released this frame
     */
    isKeyReleased(key) {
        return this.keyReleased.get(key) || false;
    }
    
    /**
     * Clear frame-specific input states (call at end of frame)
     */
    update() {
        this.keyPressed.clear();
        this.keyReleased.clear();
    }
}

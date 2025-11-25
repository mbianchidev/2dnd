/**
 * Menu State - Main menu screen
 */
export class MenuState {
    constructor(game, inputManager) {
        this.game = game;
        this.inputManager = inputManager;
        this.options = ['New Game', 'Continue', 'Options'];
        this.selectedIndex = 0;
    }
    
    enter() {
        console.log('Entering Menu State');
    }
    
    exit() {
        console.log('Exiting Menu State');
    }
    
    update(deltaTime) {
        // Handle input
        if (this.inputManager.isKeyPressed('ArrowUp')) {
            this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
        }
        
        if (this.inputManager.isKeyPressed('ArrowDown')) {
            this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
        }
        
        if (this.inputManager.isKeyPressed('Enter')) {
            this.selectOption();
        }
        
        this.inputManager.update();
    }
    
    render(ctx) {
        const canvas = ctx.canvas;
        
        // Draw title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('2D&D', canvas.width / 2, 100);
        
        // Draw subtitle
        ctx.font = '16px monospace';
        ctx.fillText('A 2D Browser JRPG', canvas.width / 2, 140);
        
        // Draw menu options
        ctx.font = '24px monospace';
        const startY = 250;
        const spacing = 50;
        
        this.options.forEach((option, index) => {
            const y = startY + index * spacing;
            
            // Highlight selected option
            if (index === this.selectedIndex) {
                ctx.fillStyle = '#4a90e2';
                ctx.fillRect(canvas.width / 2 - 150, y - 30, 300, 40);
                ctx.fillStyle = '#ffffff';
            } else {
                ctx.fillStyle = '#888888';
            }
            
            ctx.fillText(option, canvas.width / 2, y);
        });
        
        // Draw instructions
        ctx.fillStyle = '#666666';
        ctx.font = '14px monospace';
        ctx.fillText('Use Arrow Keys and Enter to select', canvas.width / 2, canvas.height - 40);
    }
    
    selectOption() {
        switch (this.selectedIndex) {
            case 0: // New Game
                // Transition to exploration state
                // This will be handled by the main game controller
                this.game.startNewGame();
                break;
            case 1: // Continue
                // Load saved game
                console.log('Continue not yet implemented');
                break;
            case 2: // Options
                console.log('Options not yet implemented');
                break;
        }
    }
}

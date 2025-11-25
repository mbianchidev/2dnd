/**
 * Main entry point for 2D&D
 */
import { Game } from './Game.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('2D&D - Starting...');
    
    // Get the canvas element
    const canvas = document.getElementById('gameCanvas');
    
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    
    // Create and start the game
    const game = new Game(canvas);
    
    // Make game globally accessible for debugging
    window.game = game;
    
    console.log('2D&D - Ready!');
});

import { GameEngine } from './core/GameEngine.js';
import { InputManager } from './core/InputManager.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { PartySystem } from './systems/PartySystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { MapSystem } from './systems/MapSystem.js';
import { MenuState } from './states/MenuState.js';
import { ExplorationState } from './states/ExplorationState.js';
import { BattleState } from './states/BattleState.js';
import { CHARACTER_PRESETS, ENEMY_PRESETS, DEFAULT_MAP, GAME_CONFIG } from './config/GameConfig.js';

/**
 * Main Game Controller - Orchestrates all game systems and states
 */
export class Game {
    constructor(canvas) {
        this.engine = new GameEngine(canvas);
        this.inputManager = new InputManager();
        
        // Game systems
        this.party = null;
        this.combatSystem = new CombatSystem();
        this.map = null;
        
        // Game states
        this.menuState = null;
        this.explorationState = null;
        this.battleState = null;
        
        // Player reference
        this.player = null;
        
        // Debug mode
        this.debug = GAME_CONFIG.debug;
        
        // Initialize the game
        this.init();
    }
    
    /**
     * Initialize the game
     */
    init() {
        console.log('Initializing 2D&D...');
        
        // Create menu state
        this.menuState = new MenuState(this, this.inputManager);
        
        // Start with menu
        this.engine.setState(this.menuState);
        this.engine.start();
        
        // Update debug info
        this.updateDebugInfo();
    }
    
    /**
     * Start a new game
     */
    startNewGame() {
        console.log('Starting new game...');
        
        // Create party
        this.party = new PartySystem();
        this.party.addGold(GAME_CONFIG.startingGold);
        
        // Create player character
        const playerStats = { ...CHARACTER_PRESETS.warrior, name: 'Hero' };
        this.player = new Player(160, 160, playerStats);
        this.party.addMember(this.player);
        
        // Add some party members
        const mage = new Player(0, 0, { ...CHARACTER_PRESETS.mage, name: 'Merlin' });
        this.party.addMember(mage);
        
        // Create map
        this.map = new MapSystem(DEFAULT_MAP);
        
        // Create exploration state
        this.explorationState = new ExplorationState(
            this,
            this.inputManager,
            this.player,
            this.party,
            this.map
        );
        
        // Switch to exploration state
        this.engine.setState(this.explorationState);
        this.updateDebugInfo();
    }
    
    /**
     * Start a battle encounter
     */
    startBattle(encounterData) {
        console.log('Starting battle...', encounterData);
        
        // Create enemies based on encounter data
        const enemies = [];
        for (let i = 0; i < encounterData.count; i++) {
            const enemyPreset = ENEMY_PRESETS[encounterData.type];
            if (enemyPreset) {
                const enemy = new Enemy(0, 0, { ...enemyPreset });
                enemies.push(enemy);
            }
        }
        
        if (enemies.length === 0) {
            console.error('No valid enemies created for encounter');
            return;
        }
        
        // Create battle state
        this.battleState = new BattleState(
            this,
            this.inputManager,
            this.party,
            enemies,
            this.combatSystem
        );
        
        // Switch to battle state
        this.engine.setState(this.battleState);
        this.updateDebugInfo();
    }
    
    /**
     * Return to exploration after battle
     */
    returnToExploration() {
        console.log('Returning to exploration...');
        
        if (this.explorationState) {
            this.engine.setState(this.explorationState);
            this.updateDebugInfo();
        }
    }
    
    /**
     * Open the in-game menu
     */
    openMenu() {
        console.log('Opening menu... (not yet implemented)');
        // TODO: Implement menu state for inventory, status, save/load
    }
    
    /**
     * Handle game over
     */
    gameOver() {
        console.log('Game Over!');
        // Return to main menu
        this.engine.setState(this.menuState);
        this.updateDebugInfo();
    }
    
    /**
     * Update debug information display
     */
    updateDebugInfo() {
        if (this.debug) {
            const stateElement = document.getElementById('currentState');
            const fpsElement = document.getElementById('fps');
            
            if (stateElement) {
                let stateName = 'Unknown';
                if (this.engine.currentState === this.menuState) {
                    stateName = 'Main Menu';
                } else if (this.engine.currentState === this.explorationState) {
                    stateName = 'Exploration';
                } else if (this.engine.currentState === this.battleState) {
                    stateName = 'Battle';
                }
                stateElement.textContent = stateName;
            }
            
            // Update FPS continuously
            setInterval(() => {
                if (fpsElement) {
                    fpsElement.textContent = this.engine.getFPS();
                }
            }, 100);
        }
    }
    
    /**
     * Get the game engine
     */
    getEngine() {
        return this.engine;
    }
}

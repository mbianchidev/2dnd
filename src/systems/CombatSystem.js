/**
 * Combat System - Turn-based battle system inspired by Dragon Quest/D&D
 */
export class CombatSystem {
    constructor() {
        this.combatants = [];
        this.currentTurnIndex = 0;
        this.turnOrder = [];
        this.battleLog = [];
        this.battleActive = false;
    }
    
    /**
     * Initialize a new battle
     */
    startBattle(party, enemies) {
        this.combatants = [...party, ...enemies];
        this.battleActive = true;
        this.battleLog = [];
        this.currentTurnIndex = 0;
        
        // Determine turn order based on speed
        this.calculateTurnOrder();
        
        this.addToLog('Battle started!');
        return this.getCurrentCombatant();
    }
    
    /**
     * Calculate turn order based on character speed stats
     */
    calculateTurnOrder() {
        this.turnOrder = [...this.combatants]
            .filter(c => c.isAlive())
            .sort((a, b) => b.speed - a.speed);
    }
    
    /**
     * Get the current combatant whose turn it is
     */
    getCurrentCombatant() {
        if (!this.battleActive || this.turnOrder.length === 0) {
            return null;
        }
        return this.turnOrder[this.currentTurnIndex];
    }
    
    /**
     * Execute an attack action
     */
    attack(attacker, target) {
        if (!attacker || !target || !attacker.isAlive() || !target.isAlive()) {
            return null;
        }
        
        // Roll for hit (simple d20 system)
        const hitRoll = Math.floor(Math.random() * 20) + 1;
        const attackMod = Math.floor((attacker.strength - 10) / 2);
        const totalAttack = hitRoll + attackMod;
        
        const defenseMod = Math.floor((target.dexterity - 10) / 2);
        const targetAC = 10 + defenseMod;
        
        let result = {
            attacker: attacker.name,
            target: target.name,
            hit: false,
            damage: 0,
            critical: false
        };
        
        // Critical hit on natural 20
        if (hitRoll === 20) {
            result.critical = true;
            result.hit = true;
        } else if (hitRoll === 1) {
            // Critical miss
            result.hit = false;
            this.addToLog(`${attacker.name} critically missed!`);
            return result;
        } else {
            result.hit = totalAttack >= targetAC;
        }
        
        if (result.hit) {
            // Calculate damage
            let baseDamage = Math.floor(Math.random() * 6) + 1 + attacker.attack;
            if (result.critical) {
                baseDamage *= 2;
            }
            
            result.damage = target.takeDamage(baseDamage);
            
            if (result.critical) {
                this.addToLog(`Critical hit! ${attacker.name} dealt ${result.damage} damage to ${target.name}!`);
            } else {
                this.addToLog(`${attacker.name} hit ${target.name} for ${result.damage} damage!`);
            }
            
            if (!target.isAlive()) {
                this.addToLog(`${target.name} was defeated!`);
            }
        } else {
            this.addToLog(`${attacker.name} missed ${target.name}!`);
        }
        
        return result;
    }
    
    /**
     * Execute a defend action (increases defense temporarily)
     */
    defend(character) {
        this.addToLog(`${character.name} takes a defensive stance!`);
        // Could implement temporary defense boost here
    }
    
    /**
     * Use an item
     */
    useItem(character, item, target = null) {
        this.addToLog(`${character.name} used ${item.name}!`);
        // Item system implementation would go here
    }
    
    /**
     * Advance to the next turn
     */
    nextTurn() {
        this.currentTurnIndex++;
        
        // If we've gone through all combatants, start a new round
        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
            // Recalculate turn order in case someone died
            this.calculateTurnOrder();
        }
        
        // Skip defeated combatants
        while (this.turnOrder.length > 0 && !this.getCurrentCombatant()?.isAlive()) {
            this.currentTurnIndex++;
            if (this.currentTurnIndex >= this.turnOrder.length) {
                this.currentTurnIndex = 0;
                this.calculateTurnOrder();
            }
        }
        
        return this.getCurrentCombatant();
    }
    
    /**
     * Check if the battle is over
     */
    checkBattleEnd() {
        const aliveParty = this.combatants.filter((c, i) => 
            i < this.combatants.length / 2 && c.isAlive()
        );
        const aliveEnemies = this.combatants.filter((c, i) => 
            i >= this.combatants.length / 2 && c.isAlive()
        );
        
        if (aliveEnemies.length === 0) {
            this.battleActive = false;
            this.addToLog('Victory!');
            return 'victory';
        }
        
        if (aliveParty.length === 0) {
            this.battleActive = false;
            this.addToLog('Defeat...');
            return 'defeat';
        }
        
        return null;
    }
    
    /**
     * Add a message to the battle log
     */
    addToLog(message) {
        this.battleLog.push(message);
        // Keep only last 10 messages
        if (this.battleLog.length > 10) {
            this.battleLog.shift();
        }
    }
    
    /**
     * Get the battle log
     */
    getLog() {
        return this.battleLog;
    }
    
    /**
     * Check if battle is active
     */
    isActive() {
        return this.battleActive;
    }
}

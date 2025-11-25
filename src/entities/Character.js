import { Entity } from './Entity.js';

/**
 * Character - Base class for player and enemies with RPG stats
 */
export class Character extends Entity {
    constructor(x, y, stats = {}) {
        super(x, y);
        
        // Core D&D-inspired stats
        this.name = stats.name || 'Unnamed';
        this.level = stats.level || 1;
        this.experience = stats.experience || 0;
        
        // Primary attributes (D&D style)
        this.strength = stats.strength || 10;
        this.dexterity = stats.dexterity || 10;
        this.constitution = stats.constitution || 10;
        this.intelligence = stats.intelligence || 10;
        this.wisdom = stats.wisdom || 10;
        this.charisma = stats.charisma || 10;
        
        // Combat stats
        this.maxHP = this.calculateMaxHP();
        this.currentHP = stats.currentHP || this.maxHP;
        this.maxMP = this.calculateMaxMP();
        this.currentMP = stats.currentMP || this.maxMP;
        
        // Derived stats
        this.attack = this.calculateAttack();
        this.defense = this.calculateDefense();
        this.speed = this.calculateSpeed();
        
        // Status
        this.alive = true;
        this.status = null; // poisoned, paralyzed, etc.
    }
    
    /**
     * Calculate maximum HP based on constitution and level
     */
    calculateMaxHP() {
        const conModifier = Math.floor((this.constitution - 10) / 2);
        return 10 + (this.level * 5) + (this.level * conModifier);
    }
    
    /**
     * Calculate maximum MP based on intelligence and level
     */
    calculateMaxMP() {
        const intModifier = Math.floor((this.intelligence - 10) / 2);
        return 5 + (this.level * 3) + (this.level * intModifier);
    }
    
    /**
     * Calculate attack power based on strength
     */
    calculateAttack() {
        const strModifier = Math.floor((this.strength - 10) / 2);
        return 5 + strModifier + Math.floor(this.level / 2);
    }
    
    /**
     * Calculate defense based on constitution
     */
    calculateDefense() {
        const conModifier = Math.floor((this.constitution - 10) / 2);
        return 3 + conModifier + Math.floor(this.level / 3);
    }
    
    /**
     * Calculate speed based on dexterity
     */
    calculateSpeed() {
        const dexModifier = Math.floor((this.dexterity - 10) / 2);
        return 10 + dexModifier;
    }
    
    /**
     * Take damage
     */
    takeDamage(amount) {
        const actualDamage = Math.max(1, amount - this.defense);
        this.currentHP = Math.max(0, this.currentHP - actualDamage);
        
        if (this.currentHP === 0) {
            this.alive = false;
        }
        
        return actualDamage;
    }
    
    /**
     * Heal HP
     */
    heal(amount) {
        const actualHealing = Math.min(amount, this.maxHP - this.currentHP);
        this.currentHP += actualHealing;
        return actualHealing;
    }
    
    /**
     * Restore MP
     */
    restoreMP(amount) {
        const actualRestore = Math.min(amount, this.maxMP - this.currentMP);
        this.currentMP += actualRestore;
        return actualRestore;
    }
    
    /**
     * Gain experience
     */
    gainExperience(amount) {
        this.experience += amount;
        const expNeeded = this.getExperienceForNextLevel();
        
        if (this.experience >= expNeeded) {
            this.levelUp();
            return true;
        }
        return false;
    }
    
    /**
     * Get experience needed for next level
     */
    getExperienceForNextLevel() {
        return this.level * 100;
    }
    
    /**
     * Level up the character
     */
    levelUp() {
        this.level++;
        this.experience = 0;
        
        // Recalculate stats
        this.maxHP = this.calculateMaxHP();
        this.currentHP = this.maxHP; // Full heal on level up
        this.maxMP = this.calculateMaxMP();
        this.currentMP = this.maxMP;
        this.attack = this.calculateAttack();
        this.defense = this.calculateDefense();
        this.speed = this.calculateSpeed();
    }
    
    /**
     * Check if character is alive
     */
    isAlive() {
        return this.alive;
    }
}

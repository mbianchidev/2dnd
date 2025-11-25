/**
 * Party System - Manages the player's party of characters
 */
export class PartySystem {
    constructor() {
        this.members = [];
        this.maxSize = 4;
        this.gold = 0;
    }
    
    /**
     * Add a character to the party
     */
    addMember(character) {
        if (this.members.length < this.maxSize) {
            this.members.push(character);
            return true;
        }
        return false;
    }
    
    /**
     * Remove a character from the party
     */
    removeMember(index) {
        if (index >= 0 && index < this.members.length) {
            return this.members.splice(index, 1)[0];
        }
        return null;
    }
    
    /**
     * Get all party members
     */
    getMembers() {
        return this.members;
    }
    
    /**
     * Get alive party members
     */
    getAliveMembers() {
        return this.members.filter(m => m.isAlive());
    }
    
    /**
     * Get the leader (first member)
     */
    getLeader() {
        return this.members[0] || null;
    }
    
    /**
     * Check if the entire party is defeated
     */
    isDefeated() {
        return this.getAliveMembers().length === 0;
    }
    
    /**
     * Add gold to the party
     */
    addGold(amount) {
        this.gold += amount;
    }
    
    /**
     * Remove gold from the party
     */
    removeGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            return true;
        }
        return false;
    }
    
    /**
     * Get current gold
     */
    getGold() {
        return this.gold;
    }
    
    /**
     * Heal all party members
     */
    healAll() {
        this.members.forEach(member => {
            if (member.isAlive()) {
                member.heal(member.maxHP);
                member.restoreMP(member.maxMP);
            }
        });
    }
}

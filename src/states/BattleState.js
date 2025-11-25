/**
 * Battle State - Turn-based combat screen
 */
export class BattleState {
    constructor(game, inputManager, party, enemies, combatSystem) {
        this.game = game;
        this.inputManager = inputManager;
        this.party = party;
        this.enemies = enemies;
        this.combatSystem = combatSystem;
        
        this.actions = ['Attack', 'Defend', 'Item', 'Run'];
        this.selectedActionIndex = 0;
        this.selectingTarget = false;
        this.selectedTargetIndex = 0;
        this.waitingForAnimation = false;
        this.animationTimer = 0;
        this.animationDuration = 1.0; // seconds
    }
    
    enter() {
        console.log('Entering Battle State');
        this.combatSystem.startBattle(this.party.getMembers(), this.enemies);
        this.selectedActionIndex = 0;
        this.selectingTarget = false;
    }
    
    exit() {
        console.log('Exiting Battle State');
    }
    
    update(deltaTime) {
        // Handle animation wait
        if (this.waitingForAnimation) {
            this.animationTimer += deltaTime;
            if (this.animationTimer >= this.animationDuration) {
                this.waitingForAnimation = false;
                this.animationTimer = 0;
                this.advanceTurn();
            }
            return;
        }
        
        const currentCombatant = this.combatSystem.getCurrentCombatant();
        
        // Check if battle is over
        const battleResult = this.combatSystem.checkBattleEnd();
        if (battleResult) {
            this.handleBattleEnd(battleResult);
            return;
        }
        
        // AI turn for enemies
        if (currentCombatant && this.enemies.includes(currentCombatant)) {
            this.executeEnemyTurn(currentCombatant);
            return;
        }
        
        // Player turn
        if (this.selectingTarget) {
            this.handleTargetSelection();
        } else {
            this.handleActionSelection();
        }
        
        this.inputManager.update();
    }
    
    handleActionSelection() {
        if (this.inputManager.isKeyPressed('ArrowUp')) {
            this.selectedActionIndex = (this.selectedActionIndex - 1 + this.actions.length) % this.actions.length;
        }
        
        if (this.inputManager.isKeyPressed('ArrowDown')) {
            this.selectedActionIndex = (this.selectedActionIndex + 1) % this.actions.length;
        }
        
        if (this.inputManager.isKeyPressed('Enter')) {
            this.executeAction();
        }
    }
    
    handleTargetSelection() {
        const aliveEnemies = this.enemies.filter(e => e.isAlive());
        
        if (this.inputManager.isKeyPressed('ArrowUp')) {
            this.selectedTargetIndex = (this.selectedTargetIndex - 1 + aliveEnemies.length) % aliveEnemies.length;
        }
        
        if (this.inputManager.isKeyPressed('ArrowDown')) {
            this.selectedTargetIndex = (this.selectedTargetIndex + 1) % aliveEnemies.length;
        }
        
        if (this.inputManager.isKeyPressed('Enter')) {
            const target = aliveEnemies[this.selectedTargetIndex];
            const attacker = this.combatSystem.getCurrentCombatant();
            this.combatSystem.attack(attacker, target);
            this.selectingTarget = false;
            this.waitingForAnimation = true;
        }
        
        if (this.inputManager.isKeyPressed('Escape')) {
            this.selectingTarget = false;
            this.selectedTargetIndex = 0;
        }
    }
    
    executeAction() {
        const action = this.actions[this.selectedActionIndex];
        const currentCombatant = this.combatSystem.getCurrentCombatant();
        
        switch (action) {
            case 'Attack':
                this.selectingTarget = true;
                this.selectedTargetIndex = 0;
                break;
            case 'Defend':
                this.combatSystem.defend(currentCombatant);
                this.waitingForAnimation = true;
                break;
            case 'Item':
                console.log('Item system not yet implemented');
                break;
            case 'Run':
                // 50% chance to run
                if (Math.random() < 0.5) {
                    this.combatSystem.addToLog('Escaped successfully!');
                    this.game.returnToExploration();
                } else {
                    this.combatSystem.addToLog('Could not escape!');
                    this.waitingForAnimation = true;
                }
                break;
        }
    }
    
    executeEnemyTurn(enemy) {
        // Simple AI: attack random party member
        const aliveParty = this.party.getAliveMembers();
        if (aliveParty.length > 0) {
            const target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
            this.combatSystem.attack(enemy, target);
            this.waitingForAnimation = true;
        }
    }
    
    advanceTurn() {
        this.combatSystem.nextTurn();
        this.selectedActionIndex = 0;
    }
    
    handleBattleEnd(result) {
        if (result === 'victory') {
            // Award experience and gold
            let totalExp = 0;
            let totalGold = 0;
            
            this.enemies.forEach(enemy => {
                totalExp += enemy.expDrop;
                totalGold += enemy.goldDrop;
            });
            
            this.party.addGold(totalGold);
            this.party.getMembers().forEach(member => {
                if (member.isAlive()) {
                    member.gainExperience(totalExp);
                }
            });
            
            // Wait a bit before returning
            setTimeout(() => {
                this.game.returnToExploration();
            }, 2000);
        } else if (result === 'defeat') {
            // Game over
            setTimeout(() => {
                this.game.gameOver();
            }, 2000);
        }
    }
    
    render(ctx) {
        const canvas = ctx.canvas;
        
        // Draw battle background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw enemies
        this.renderEnemies(ctx);
        
        // Draw party
        this.renderParty(ctx);
        
        // Draw UI
        this.renderBattleUI(ctx);
    }
    
    renderEnemies(ctx) {
        const aliveEnemies = this.enemies.filter(e => e.isAlive());
        const spacing = 80;
        const startX = 400;
        const startY = 150;
        
        aliveEnemies.forEach((enemy, index) => {
            const x = startX + (index % 2) * spacing;
            const y = startY + Math.floor(index / 2) * spacing;
            
            // Highlight if selected as target
            if (this.selectingTarget && index === this.selectedTargetIndex) {
                ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.fillRect(x - 5, y - 5, enemy.width + 10, enemy.height + 10);
            }
            
            ctx.save();
            ctx.translate(x, y);
            enemy.x = 0;
            enemy.y = 0;
            enemy.render(ctx);
            ctx.restore();
            
            // Draw HP bar
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(x, y + enemy.height + 5, enemy.width, 5);
            ctx.fillStyle = '#00ff00';
            const hpPercent = enemy.currentHP / enemy.maxHP;
            ctx.fillRect(x, y + enemy.height + 5, enemy.width * hpPercent, 5);
        });
    }
    
    renderParty(ctx) {
        const aliveParty = this.party.getAliveMembers();
        const startX = 50;
        const startY = 250;
        const spacing = 60;
        
        aliveParty.forEach((member, index) => {
            const y = startY + index * spacing;
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${member.name} Lv${member.level}`, startX, y);
            ctx.fillText(`HP: ${member.currentHP}/${member.maxHP}`, startX, y + 20);
            ctx.fillText(`MP: ${member.currentMP}/${member.maxMP}`, startX, y + 40);
        });
    }
    
    renderBattleUI(ctx) {
        const canvas = ctx.canvas;
        const currentCombatant = this.combatSystem.getCurrentCombatant();
        
        // Draw action menu for player turn
        if (currentCombatant && this.party.getMembers().includes(currentCombatant) && !this.selectingTarget) {
            const menuX = canvas.width - 200;
            const menuY = canvas.height - 180;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(menuX, menuY, 180, 160);
            
            ctx.font = '16px monospace';
            ctx.textAlign = 'left';
            
            this.actions.forEach((action, index) => {
                const y = menuY + 30 + index * 35;
                
                if (index === this.selectedActionIndex) {
                    ctx.fillStyle = '#4a90e2';
                    ctx.fillRect(menuX + 10, y - 20, 160, 30);
                }
                
                ctx.fillStyle = '#ffffff';
                ctx.fillText(action, menuX + 20, y);
            });
        }
        
        // Draw battle log
        const logX = 10;
        const logY = canvas.height - 120;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(logX, logY, canvas.width - 20, 110);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        
        const log = this.combatSystem.getLog();
        const visibleLines = 6;
        const startIndex = Math.max(0, log.length - visibleLines);
        
        for (let i = startIndex; i < log.length; i++) {
            const lineY = logY + 20 + (i - startIndex) * 16;
            ctx.fillText(log[i], logX + 10, lineY);
        }
        
        // Draw turn indicator
        if (currentCombatant) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${currentCombatant.name}'s Turn`, canvas.width / 2, 30);
        }
    }
}

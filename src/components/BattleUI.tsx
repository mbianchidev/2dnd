import React from 'react';
import { Player, Monster } from '../types/game';

interface BattleUIProps {
  player: Player;
  monster: Monster;
  battleLog: string[];
  onAttack: () => void;
  onFlee: () => void;
  onCastSpell: (damage: string, manaCost: number) => void;
}

const BattleUI: React.FC<BattleUIProps> = ({
  player,
  monster,
  battleLog,
  onAttack,
  onFlee,
  onCastSpell,
}) => {
  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <h2 style={styles.title}>Battle!</h2>
        
        <div style={styles.combatants}>
          <div style={styles.combatant}>
            <h3>{player.name}</h3>
            <p>HP: {player.health}/{player.maxHealth}</p>
            <p>MP: {player.mana}/{player.maxMana}</p>
          </div>
          
          <div style={styles.vs}>VS</div>
          
          <div style={styles.combatant}>
            <h3>{monster.name}</h3>
            <p>HP: {monster.health}/{monster.maxHealth}</p>
            <p>AC: {monster.armorClass}</p>
          </div>
        </div>

        <div style={styles.log}>
          <h4>Battle Log:</h4>
          {battleLog.map((log, idx) => (
            <div key={idx} style={styles.logEntry}>{log}</div>
          ))}
        </div>

        <div style={styles.actions}>
          <button onClick={onAttack} style={styles.button}>
            Attack
          </button>
          
          {player.spells.length > 0 && (
            <div style={styles.spells}>
              {player.spells.map(spell => (
                <button
                  key={spell.id}
                  onClick={() => onCastSpell(spell.damage || '0', spell.manaCost)}
                  style={{...styles.button, ...styles.spellButton}}
                  disabled={player.mana < spell.manaCost}
                >
                  {spell.name} ({spell.manaCost} MP)
                </button>
              ))}
            </div>
          )}
          
          <button onClick={onFlee} style={{...styles.button, ...styles.fleeButton}}>
            Flee
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#2a2a2a',
    padding: '20px',
    borderRadius: '10px',
    minWidth: '500px',
    color: 'white',
  },
  title: {
    textAlign: 'center',
    marginBottom: '20px',
    color: '#ff6b6b',
  },
  combatants: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '20px',
  },
  combatant: {
    textAlign: 'center',
    padding: '10px',
    backgroundColor: '#1a1a1a',
    borderRadius: '5px',
  },
  vs: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffd700',
  },
  log: {
    backgroundColor: '#1a1a1a',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    maxHeight: '150px',
    overflowY: 'auto',
  },
  logEntry: {
    padding: '5px',
    borderBottom: '1px solid #444',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  spells: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  spellButton: {
    backgroundColor: '#2196F3',
    flex: 1,
  },
  fleeButton: {
    backgroundColor: '#f44336',
  },
};

export default BattleUI;

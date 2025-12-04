import React from 'react';
import { Player } from '../types/game';

interface PlayerStatsProps {
  player: Player;
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ player }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>{player.name}</h3>
        <p>Level {player.level}</p>
      </div>
      
      <div style={styles.stats}>
        <div style={styles.statBar}>
          <span>HP:</span>
          <div style={styles.bar}>
            <div
              style={{
                ...styles.barFill,
                width: `${(player.health / player.maxHealth) * 100}%`,
                backgroundColor: '#4CAF50',
              }}
            />
          </div>
          <span>{player.health}/{player.maxHealth}</span>
        </div>
        
        <div style={styles.statBar}>
          <span>MP:</span>
          <div style={styles.bar}>
            <div
              style={{
                ...styles.barFill,
                width: `${(player.mana / player.maxMana) * 100}%`,
                backgroundColor: '#2196F3',
              }}
            />
          </div>
          <span>{player.mana}/{player.maxMana}</span>
        </div>
        
        <div style={styles.statBar}>
          <span>XP:</span>
          <div style={styles.bar}>
            <div
              style={{
                ...styles.barFill,
                width: `${(player.experience / (player.level * 1000)) * 100}%`,
                backgroundColor: '#FFD700',
              }}
            />
          </div>
          <span>{player.experience}/{player.level * 1000}</span>
        </div>
      </div>
      
      <div style={styles.gold}>
        💰 {player.gold} Gold
      </div>
      
      <div style={styles.controls}>
        <p><strong>Controls:</strong></p>
        <p>WASD - Move</p>
        <p>Space - Interact</p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '10px',
    right: '10px',
    backgroundColor: '#2a2a2a',
    padding: '15px',
    borderRadius: '10px',
    color: 'white',
    minWidth: '200px',
    zIndex: 100,
  },
  header: {
    textAlign: 'center',
    marginBottom: '10px',
    borderBottom: '2px solid #444',
    paddingBottom: '10px',
  },
  stats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '10px',
  },
  statBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '14px',
  },
  bar: {
    flex: 1,
    height: '15px',
    backgroundColor: '#1a1a1a',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  gold: {
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    padding: '10px',
    backgroundColor: '#1a1a1a',
    borderRadius: '5px',
    marginBottom: '10px',
  },
  controls: {
    fontSize: '12px',
    padding: '10px',
    backgroundColor: '#1a1a1a',
    borderRadius: '5px',
  },
};

export default PlayerStats;

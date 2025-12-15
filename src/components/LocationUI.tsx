import React, { useState } from 'react';
import { Location, Player } from '../types/game';
import { ShopSystem } from '../game/ShopSystem';

interface LocationUIProps {
  location: Location;
  player: Player;
  shopSystem: ShopSystem;
  onClose: () => void;
  onBuyItem: (itemId: string) => void;
  onRest: () => void;
}

const LocationUI: React.FC<LocationUIProps> = ({
  location,
  player,
  shopSystem,
  onClose,
  onBuyItem,
  onRest,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'shop' | 'inn'>('info');

  const renderContent = () => {
    if (location.type === 'city') {
      switch (activeTab) {
        case 'shop':
          const items = shopSystem.getShopInventory();
          return (
            <div style={styles.shopContent}>
              <h3>Shop</h3>
              <div style={styles.itemList}>
                {items.map(item => (
                  <div key={item.id} style={styles.item}>
                    <div>
                      <strong>{item.name}</strong>
                      <p style={styles.itemDesc}>{item.description}</p>
                    </div>
                    <div style={styles.itemPrice}>
                      <span>{item.value} 💰</span>
                      <button
                        onClick={() => onBuyItem(item.id)}
                        style={styles.buyButton}
                        disabled={player.gold < item.value}
                      >
                        Buy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
          
        case 'inn':
          return (
            <div style={styles.innContent}>
              <h3>Inn</h3>
              <p>Rest and recover your strength</p>
              <p>Cost: 10 gold</p>
              <button
                onClick={onRest}
                style={styles.button}
                disabled={player.gold < 10}
              >
                Rest (Full HP & MP)
              </button>
            </div>
          );
          
        default:
          return (
            <div>
              <p>{location.description}</p>
              <p>This is a bustling town with merchants and an inn.</p>
            </div>
          );
      }
    } else if (location.type === 'dungeon') {
      return (
        <div>
          <p>{location.description}</p>
          <p style={styles.warning}>⚠️ Dangerous monsters lurk within!</p>
        </div>
      );
    } else if (location.type === 'boss') {
      return (
        <div>
          <p>{location.description}</p>
          <p style={styles.warning}>🐉 A powerful boss awaits!</p>
        </div>
      );
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h2>{location.name}</h2>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        {location.type === 'city' && (
          <div style={styles.tabs}>
            <button
              onClick={() => setActiveTab('info')}
              style={{
                ...styles.tab,
                ...(activeTab === 'info' ? styles.activeTab : {}),
              }}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTab('shop')}
              style={{
                ...styles.tab,
                ...(activeTab === 'shop' ? styles.activeTab : {}),
              }}
            >
              Shop
            </button>
            <button
              onClick={() => setActiveTab('inn')}
              style={{
                ...styles.tab,
                ...(activeTab === 'inn' ? styles.activeTab : {}),
              }}
            >
              Inn
            </button>
          </div>
        )}

        <div style={styles.content}>
          {renderContent()}
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
    maxWidth: '600px',
    color: 'white',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '2px solid #444',
    paddingBottom: '10px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  tab: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#1a1a1a',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    borderRadius: '5px',
  },
  activeTab: {
    backgroundColor: '#4CAF50',
  },
  content: {
    backgroundColor: '#1a1a1a',
    padding: '15px',
    borderRadius: '5px',
  },
  shopContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  itemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    backgroundColor: '#2a2a2a',
    borderRadius: '5px',
  },
  itemDesc: {
    fontSize: '12px',
    color: '#aaa',
    margin: '5px 0 0 0',
  },
  itemPrice: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  buyButton: {
    padding: '5px 15px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  innContent: {
    textAlign: 'center',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '10px',
  },
  warning: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    marginTop: '10px',
  },
};

export default LocationUI;

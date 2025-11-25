import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/MainScene';
import { BattleSystem } from '../game/BattleSystem';
import { ProgressionSystem } from '../game/ProgressionSystem';
import { ShopSystem } from '../game/ShopSystem';
import { Player, Monster, Location } from '../types/game';
import BattleUI from './BattleUI';
import LocationUI from './LocationUI';
import PlayerStats from './PlayerStats';

const GameComponent: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<MainScene | null>(null);
  const battleSystemRef = useRef<BattleSystem>(new BattleSystem());
  const progressionSystemRef = useRef<ProgressionSystem>(new ProgressionSystem());
  const shopSystemRef = useRef<ShopSystem>(new ShopSystem());

  const [player, setPlayer] = useState<Player | null>(null);
  const [inBattle, setInBattle] = useState(false);
  const [currentMonster, setCurrentMonster] = useState<Monster | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: 'game-container',
      backgroundColor: '#000000',
      scene: MainScene,
    };

    gameRef.current = new Phaser.Game(config);

    // Get scene reference
    gameRef.current.events.once('ready', () => {
      const scene = gameRef.current?.scene.getScene('MainScene') as MainScene;
      if (scene) {
        sceneRef.current = scene;
        setPlayer(scene.getPlayerData());

        // Set up callbacks
        scene.setOnBattleStart((monsterId: string) => {
          const monster = battleSystemRef.current.startBattle(monsterId);
          setCurrentMonster(monster);
          setInBattle(true);
          setBattleLog(battleSystemRef.current.getBattleLog());
          battleSystemRef.current.rollInitiative(scene.getPlayerData());
        });

        scene.setOnLocationInteract((location: Location) => {
          setCurrentLocation(location);
        });
      }
    });

    return () => {
      gameRef.current?.destroy(true);
    };
  }, []);

  const handleAttack = () => {
    if (!sceneRef.current || !currentMonster) return;

    const playerData = sceneRef.current.getPlayerData();
    battleSystemRef.current.playerAttack(playerData);

    if (currentMonster.health <= 0) {
      // Battle won
      const rewards = battleSystemRef.current.endBattle(playerData);
      progressionSystemRef.current.addExperience(playerData, rewards.experience);
      progressionSystemRef.current.addGold(playerData, rewards.gold);
      sceneRef.current.updatePlayerData(playerData);
      setPlayer({ ...playerData });
      setInBattle(false);
      setCurrentMonster(null);
    } else {
      // Monster's turn
      const monsterResult = battleSystemRef.current.monsterAttack(playerData);
      playerData.health -= monsterResult.damage;
      
      if (playerData.health <= 0) {
        battleSystemRef.current.addLog('You have been defeated!');
        playerData.health = 1;
        playerData.gold = Math.floor(playerData.gold / 2);
        setInBattle(false);
        setCurrentMonster(null);
      }
      
      sceneRef.current.updatePlayerData(playerData);
      setPlayer({ ...playerData });
    }

    setCurrentMonster({ ...currentMonster });
    setBattleLog([...battleSystemRef.current.getBattleLog()]);
  };

  const handleFlee = () => {
    if (!sceneRef.current) return;

    const success = battleSystemRef.current.playerFlee();
    if (success) {
      setInBattle(false);
      setCurrentMonster(null);
    } else {
      // Monster's turn
      const playerData = sceneRef.current.getPlayerData();
      const monsterResult = battleSystemRef.current.monsterAttack(playerData);
      playerData.health -= monsterResult.damage;
      sceneRef.current.updatePlayerData(playerData);
      setPlayer({ ...playerData });
    }
    setBattleLog([...battleSystemRef.current.getBattleLog()]);
  };

  const handleCastSpell = (spellDamage: string, manaCost: number) => {
    if (!sceneRef.current || !currentMonster || !player) return;

    if (player.mana < manaCost) {
      battleSystemRef.current.addLog('Not enough mana!');
      setBattleLog([...battleSystemRef.current.getBattleLog()]);
      return;
    }

    player.mana -= manaCost;
    battleSystemRef.current.playerCastSpell(player, spellDamage);

    if (currentMonster.health <= 0) {
      // Battle won
      const playerData = sceneRef.current.getPlayerData();
      const rewards = battleSystemRef.current.endBattle(playerData);
      progressionSystemRef.current.addExperience(playerData, rewards.experience);
      progressionSystemRef.current.addGold(playerData, rewards.gold);
      sceneRef.current.updatePlayerData(playerData);
      setPlayer({ ...playerData });
      setInBattle(false);
      setCurrentMonster(null);
    } else {
      // Monster's turn
      const playerData = sceneRef.current.getPlayerData();
      const monsterResult = battleSystemRef.current.monsterAttack(playerData);
      playerData.health -= monsterResult.damage;
      sceneRef.current.updatePlayerData(playerData);
      setPlayer({ ...playerData });
    }

    setCurrentMonster({ ...currentMonster });
    setBattleLog([...battleSystemRef.current.getBattleLog()]);
  };

  const handleCloseLocation = () => {
    setCurrentLocation(null);
  };

  const handleBuyItem = (itemId: string) => {
    if (!sceneRef.current || !player) return;

    const success = shopSystemRef.current.buyItem(player, itemId);
    if (success) {
      sceneRef.current.updatePlayerData(player);
      setPlayer({ ...player });
    }
  };

  const handleRest = () => {
    if (!sceneRef.current || !player) return;

    if (progressionSystemRef.current.spendGold(player, 10)) {
      progressionSystemRef.current.rest(player);
      sceneRef.current.updatePlayerData(player);
      setPlayer({ ...player });
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div id="game-container" />
      
      {player && <PlayerStats player={player} />}
      
      {inBattle && currentMonster && (
        <BattleUI
          player={player!}
          monster={currentMonster}
          battleLog={battleLog}
          onAttack={handleAttack}
          onFlee={handleFlee}
          onCastSpell={handleCastSpell}
        />
      )}
      
      {currentLocation && (
        <LocationUI
          location={currentLocation}
          player={player!}
          shopSystem={shopSystemRef.current}
          onClose={handleCloseLocation}
          onBuyItem={handleBuyItem}
          onRest={handleRest}
        />
      )}
    </div>
  );
};

export default GameComponent;

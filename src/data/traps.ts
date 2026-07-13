import {
  TRAP_STATES,
  TRAP_TYPES,
  type TrapDefinition,
  type TrapState,
  type TrapType,
} from "./trapTypes";

export {
  TRAP_STATES,
  TRAP_TYPES,
  type DungeonTrap,
  type DungeonTrapProfile,
  type TrapAbility,
  type TrapDefinition,
  type TrapDie,
  type TrapState,
  type TrapStatusEffect,
  type TrapType,
} from "./trapTypes";

export const LEGACY_TRAP_SEED = 0x2d0d66;

export const TRAP_DEFINITIONS: Record<TrapType, TrapDefinition> = {
  spikePit: {
    type: "spikePit",
    name: "Spike Pit",
    cue: "Hairline seams divide the stone floor.",
    detectionAbility: "intelligence",
    disarmAbility: "dexterity",
    detectionDC: 11,
    disarmDC: 12,
    rewardXp: 25,
    color: 0xc62828,
    damage: { count: 2, sides: 6 },
    statusEffect: "prone",
  },
  poisonDarts: {
    type: "poisonDarts",
    name: "Poison Darts",
    cue: "Pinprick holes line the nearby wall.",
    detectionAbility: "intelligence",
    disarmAbility: "dexterity",
    detectionDC: 12,
    disarmDC: 13,
    rewardXp: 30,
    color: 0x7cb342,
    damage: { count: 1, sides: 6 },
    statusEffect: "poison",
  },
  fallingRocks: {
    type: "fallingRocks",
    name: "Falling Rocks",
    cue: "Loose grit sifts from a cracked ceiling.",
    detectionAbility: "intelligence",
    disarmAbility: "dexterity",
    detectionDC: 12,
    disarmDC: 13,
    rewardXp: 35,
    color: 0x795548,
    damage: { count: 2, sides: 8 },
    statusEffect: "stunned",
  },
  alarm: {
    type: "alarm",
    name: "Alarm Wire",
    cue: "A taut wire catches the edge of the light.",
    detectionAbility: "dexterity",
    disarmAbility: "dexterity",
    detectionDC: 10,
    disarmDC: 12,
    rewardXp: 30,
    color: 0xffca28,
    startsEncounter: true,
  },
  hiddenFloor: {
    type: "hiddenFloor",
    name: "Hidden Floor",
    cue: "The flagstones ahead look hollow and uneven.",
    detectionAbility: "intelligence",
    disarmAbility: "dexterity",
    detectionDC: 13,
    disarmDC: 14,
    rewardXp: 40,
    color: 0x8d6e63,
    damage: { count: 1, sides: 8 },
    mpLoss: 4,
    statusEffect: "prone",
    dropsLevel: true,
  },
  necroticRune: {
    type: "necroticRune",
    name: "Necrotic Rune",
    cue: "Faded violet sigils pulse beneath the dust.",
    detectionAbility: "intelligence",
    disarmAbility: "intelligence",
    detectionDC: 14,
    disarmDC: 14,
    rewardXp: 45,
    color: 0x7b1fa2,
    damage: { count: 1, sides: 8 },
    mpLoss: 6,
    statusEffect: "frightened",
  },
  frostBurst: {
    type: "frostBurst",
    name: "Frost Burst",
    cue: "Fresh rime spreads across an otherwise dry tile.",
    detectionAbility: "intelligence",
    disarmAbility: "intelligence",
    detectionDC: 13,
    disarmDC: 14,
    rewardXp: 45,
    color: 0x4fc3f7,
    damage: { count: 1, sides: 6 },
    statusEffect: "freeze",
  },
  flameJet: {
    type: "flameJet",
    name: "Flame Jet",
    cue: "Warm air breathes through narrow floor vents.",
    detectionAbility: "intelligence",
    disarmAbility: "dexterity",
    detectionDC: 13,
    disarmDC: 15,
    rewardXp: 50,
    color: 0xff6f00,
    damage: { count: 2, sides: 6 },
    statusEffect: "burn",
  },
};

export function getTrapDefinition(type: TrapType): TrapDefinition {
  return TRAP_DEFINITIONS[type];
}

export function isTrapState(value: unknown): value is TrapState {
  return typeof value === "string"
    && TRAP_STATES.includes(value as TrapState);
}

export function isTrapType(value: unknown): value is TrapType {
  return typeof value === "string"
    && TRAP_TYPES.includes(value as TrapType);
}

export function createTrapSeed(random: () => number = Math.random): number {
  return Math.floor(random() * 0x7ffffffe) + 1;
}

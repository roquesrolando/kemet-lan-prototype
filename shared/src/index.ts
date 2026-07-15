export type PlayerColor = 'red' | 'blue' | 'green';

export interface BattleCard {
  id: string;
  name: string;
  strength: number;
  damage: number;
  defense: number;
  selfDamage?: number;
}

export const BATTLE_CARDS: BattleCard[] = [
  {
    id: 'balanced',
    name: 'Balanced Assault',
    strength: 2,
    damage: 1,
    defense: 1,
  },
  {
    id: 'charge',
    name: 'Charge',
    strength: 3,
    damage: 2,
    defense: 0,
  },
  {
    id: 'shield-wall',
    name: 'Shield Wall',
    strength: 2,
    damage: 0,
    defense: 3,
  },
  {
    id: 'bloodbath',
    name: 'Bloodbath',
    strength: 1,
    damage: 3,
    defense: 0,
  },
  {
    id: 'maneuver',
    name: 'Maneuver',
    strength: 4,
    damage: 0,
    defense: 1,
  },
  {
    id: 'sacrifice',
    name: 'Sacrifice',
    strength: 5,
    damage: 1,
    defense: 0,
    selfDamage: 2,
  },
];

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  prayer: number;
  connected: boolean;
  availableBattleCards: string[];
  discardedBattleCards: string[];
}

export interface Territory {
  id: string;
  name: string;
  kind: 'city' | 'desert' | 'temple';
  ownerId?: string;
  armies: Record<string, number>;
  neighbors: string[];
  x: number;
  y: number;
}

export interface LogEntry {
  id: string;
  text: string;
  at: string;
}

export interface BattleSummary {
  attackerId: string;
  defenderId: string;
  territoryId: string;
  attackerCardId: string;
  defenderCardId: string;
  attackerStrength: number;
  defenderStrength: number;
  attackerLosses: number;
  defenderLosses: number;
  winnerId: string;
  loserId: string;
}

export interface BattleState {
  id: string;
  territoryId: string;
  originTerritoryId: string;
  attackerId: string;
  defenderId: string;
  attackerUnitsAtStart: number;
  defenderUnitsAtStart: number;
  submittedPlayerIds: string[];
  phase: 'SELECT_CARDS' | 'RETREAT';
  loserId?: string;
  legalRetreatTerritoryIds?: string[];
  summary?: BattleSummary;
}

export interface GameState {
  roomCode: string;
  started: boolean;
  activePlayerId?: string;
  round: number;
  players: Player[];
  territories: Territory[];
  log: LogEntry[];
  battle?: BattleState;
}

export type ClientCommand =
  | {
      type: 'JOIN';
      name: string;
      playerToken?: string;
    }
  | { type: 'START' }
  | {
      type: 'RECRUIT';
      territoryId: string;
      units: number;
    }
  | {
      type: 'MOVE';
      fromId: string;
      toId: string;
      units: number;
    }
  | {
      type: 'SELECT_BATTLE_CARD';
      cardId: string;
    }
  | {
      type: 'RETREAT';
      territoryId?: string;
    }
  | { type: 'END_TURN' }
  | { type: 'SAVE' }
  | { type: 'LOAD' };

export interface ServerMessage {
  ok: boolean;
  message?: string;
  state?: GameState;
  playerId?: string;
}
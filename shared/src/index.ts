export type PlayerColor = 'red' | 'blue' | 'green';
export interface Player { id: string; name: string; color: PlayerColor; prayer: number; connected: boolean; }
export interface Territory { id: string; name: string; kind: 'city'|'desert'|'temple'; ownerId?: string; armies: Record<string, number>; neighbors: string[]; x: number; y: number; }
export interface LogEntry { id: string; text: string; at: string; }
export interface GameState { roomCode: string; started: boolean; activePlayerId?: string; round: number; players: Player[]; territories: Territory[]; log: LogEntry[]; }
export type ClientCommand =
  | { type: 'JOIN'; name: string }
  | { type: 'START' }
  | { type: 'RECRUIT'; territoryId: string; units: number }
  | { type: 'MOVE'; fromId: string; toId: string; units: number }
  | { type: 'END_TURN' }
  | { type: 'SAVE' }
  | { type: 'LOAD' };
export interface ServerMessage { ok: boolean; message?: string; state?: GameState; playerId?: string; }

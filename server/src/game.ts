import crypto from 'node:crypto';
import type { BattleCard, BattleSummary, GameState, Player, PlayerColor, Territory } from '@kemet/shared';
import { BATTLE_CARDS } from '@kemet/shared';

const colors: PlayerColor[] = ['red', 'blue', 'green'];
const baseTerritories: Territory[] = [
  {id:'red-city',name:'Red City',kind:'city',armies:{},neighbors:['west-desert'],x:12,y:72},
  {id:'blue-city',name:'Blue City',kind:'city',armies:{},neighbors:['east-desert'],x:88,y:72},
  {id:'green-city',name:'Green City',kind:'city',armies:{},neighbors:['north-desert'],x:50,y:8},
  {id:'west-desert',name:'Western Desert',kind:'desert',armies:{},neighbors:['red-city','center','west-temple'],x:28,y:56},
  {id:'east-desert',name:'Eastern Desert',kind:'desert',armies:{},neighbors:['blue-city','center','east-temple'],x:72,y:56},
  {id:'north-desert',name:'Northern Desert',kind:'desert',armies:{},neighbors:['green-city','center','north-temple'],x:50,y:28},
  {id:'center',name:'Nile Crossroads',kind:'desert',armies:{},neighbors:['west-desert','east-desert','north-desert'],x:50,y:52},
  {id:'west-temple',name:'Western Temple',kind:'temple',armies:{},neighbors:['west-desert'],x:16,y:32},
  {id:'east-temple',name:'Eastern Temple',kind:'temple',armies:{},neighbors:['east-desert'],x:84,y:32},
  {id:'north-temple',name:'Northern Temple',kind:'temple',armies:{},neighbors:['north-desert'],x:50,y:76}
];

export type BattleSelections = Map<string, string>;

export function newGame(): GameState {
  return { roomCode: Math.random().toString(36).slice(2,6).toUpperCase(), started:false, round:1, players:[], territories:structuredClone(baseTerritories), log:[] };
}

export function addPlayer(state: GameState, name: string, id: string): Player {
  if (state.started) throw new Error('Game already started.');
  if (state.players.length >= 3) throw new Error('This prototype supports exactly 3 players.');
  const p: Player = {
    id,
    name: name.trim() || `Player ${state.players.length + 1}`,
    color: colors[state.players.length],
    prayer: 7,
    connected: true,
    availableBattleCards: BATTLE_CARDS.map(card => card.id),
    discardedBattleCards: []
  };
  state.players.push(p);
  return p;
}

export function startGame(state: GameState, caller: string) {
  if (state.players[0]?.id !== caller) throw new Error('Only the first player can start.');
  if (state.players.length !== 3) throw new Error('Three players must join first.');
  state.started = true;
  state.activePlayerId = state.players[0].id;
  state.players.forEach(p => {
    const t = state.territories.find(t => t.id === `${p.color}-city`)!;
    t.ownerId = p.id;
    t.homeOwnerId = p.id;
    t.armies[p.id] = 5;
  });
  log(state, `${state.players[0].name} started the game.`);
}

export function recruit(state: GameState, pid: string, territoryId: string, units: number) {
  actionCheck(state, pid);
  if (!Number.isInteger(units) || units < 1) throw new Error('Units must be a positive whole number.');
  const p = player(state, pid);
  const t = territory(state, territoryId);
  if (t.kind !== 'city' || t.ownerId !== pid) throw new Error('Recruit only in your own city.');
  if (Object.entries(t.armies).some(([id, n]) => id !== pid && n > 0)) throw new Error('Cannot recruit in a city occupied by an enemy army.');
  if (p.prayer < units) throw new Error('Not enough prayer points.');
  if ((t.armies[pid] || 0) + units > 10) throw new Error('Army limit is 10 in this prototype.');
  p.prayer -= units;
  t.armies[pid] = (t.armies[pid] || 0) + units;
  log(state, `${p.name} recruited ${units} unit${units === 1 ? '' : 's'} in ${t.name}.`);
}

export function move(state: GameState, pid: string, fromId: string, toId: string, units: number) {
  actionCheck(state, pid);
  if (!Number.isInteger(units) || units < 1) throw new Error('Units must be a positive whole number.');
  const p = player(state, pid);
  const from = territory(state, fromId);
  const to = territory(state, toId);
  if (!from.neighbors.includes(to.id)) throw new Error('Territories are not adjacent.');
  if ((from.armies[pid] || 0) < units) throw new Error('Not enough units in the origin.');
  if ((to.armies[pid] || 0) + units > 10) throw new Error('Army limit is 10 in this prototype.');

  const enemies = Object.entries(to.armies).filter(([id, n]) => id !== pid && n > 0);
  if (enemies.length > 1) throw new Error('A territory cannot contain multiple enemy armies in this prototype.');

  from.armies[pid] -= units;
  to.armies[pid] = (to.armies[pid] || 0) + units;

  if (enemies.length === 1) {
    const defenderId = enemies[0][0];
    state.battle = {
      id: crypto.randomUUID(),
      territoryId: to.id,
      originTerritoryId: from.id,
      attackerId: pid,
      defenderId,
      attackerUnitsAtStart: units,
      defenderUnitsAtStart: enemies[0][1],
      submittedPlayerIds: [],
      phase: 'SELECT_CARDS'
    };
    log(state, `${p.name} attacked ${player(state, defenderId).name} in ${to.name}. Both players must secretly choose a battle card.`);
    return;
  }

  log(state, `${p.name} moved ${units} unit${units === 1 ? '' : 's'} from ${from.name} to ${to.name}.`);
  updateCityOwnership(state);
}

export function selectBattleCard(state: GameState, pid: string, cardId: string, selections: BattleSelections) {
  const battle = state.battle;
  if (!battle || battle.phase !== 'SELECT_CARDS') throw new Error('There is no battle waiting for cards.');
  if (pid !== battle.attackerId && pid !== battle.defenderId) throw new Error('You are not participating in this battle.');
  const p = player(state, pid);
  if (!p.availableBattleCards.includes(cardId)) throw new Error('That battle card is not available.');
  if (!BATTLE_CARDS.some(card => card.id === cardId)) throw new Error('Unknown battle card.');
  selections.set(pid, cardId);
  if (!battle.submittedPlayerIds.includes(pid)) battle.submittedPlayerIds.push(pid);
  log(state, `${p.name} locked in a battle card.`);
  if (selections.has(battle.attackerId) && selections.has(battle.defenderId)) {
    resolveBattle(state, selections);
    updateCityOwnership(state);
  }
}

function resolveBattle(state: GameState, selections: BattleSelections) {
  const battle = state.battle!;
  const territoryInBattle = territory(state, battle.territoryId);
  const attackerCard = card(selections.get(battle.attackerId)!);
  const defenderCard = card(selections.get(battle.defenderId)!);
  const attackerUnits = territoryInBattle.armies[battle.attackerId] || 0;
  const defenderUnits = territoryInBattle.armies[battle.defenderId] || 0;
  const attackerStrength = attackerUnits + attackerCard.strength;
  const defenderStrength = defenderUnits + defenderCard.strength;
  const winnerId = attackerStrength > defenderStrength ? battle.attackerId : battle.defenderId;
  const loserId = winnerId === battle.attackerId ? battle.defenderId : battle.attackerId;

  const attackerLosses = Math.min(attackerUnits, Math.max(0, defenderCard.damage - attackerCard.defense) + (attackerCard.selfDamage || 0));
  const defenderLosses = Math.min(defenderUnits, Math.max(0, attackerCard.damage - defenderCard.defense) + (defenderCard.selfDamage || 0));
  territoryInBattle.armies[battle.attackerId] = attackerUnits - attackerLosses;
  territoryInBattle.armies[battle.defenderId] = defenderUnits - defenderLosses;

  discardCard(player(state, battle.attackerId), attackerCard.id);
  discardCard(player(state, battle.defenderId), defenderCard.id);
  selections.clear();

  const summary: BattleSummary = {
    attackerId: battle.attackerId,
    defenderId: battle.defenderId,
    territoryId: battle.territoryId,
    attackerCardId: attackerCard.id,
    defenderCardId: defenderCard.id,
    attackerStrength,
    defenderStrength,
    attackerLosses,
    defenderLosses,
    winnerId,
    loserId
  };

  battle.summary = summary;
  battle.loserId = loserId;
  const loserUnits = territoryInBattle.armies[loserId] || 0;
  const winnerUnits = territoryInBattle.armies[winnerId] || 0;

  log(state, `${player(state, winnerId).name} won the battle ${Math.max(attackerStrength, defenderStrength)}–${Math.min(attackerStrength, defenderStrength)}. ${player(state, battle.attackerId).name} lost ${attackerLosses}; ${player(state, battle.defenderId).name} lost ${defenderLosses}.`);

  if (winnerUnits <= 0 && loserUnits <= 0) {
    delete territoryInBattle.armies[battle.attackerId];
    delete territoryInBattle.armies[battle.defenderId];
    log(state, 'Both armies were destroyed. The territory is empty.');
    state.battle = undefined;
    return;
  }

  if (winnerUnits <= 0 && loserUnits > 0) {
    // The nominal loser is the only surviving army, so it remains instead of retreating.
    delete territoryInBattle.armies[winnerId];
    delete territoryInBattle.armies[loserId];
    territoryInBattle.armies[loserId] = loserUnits;
    log(state, `${player(state, loserId).name}'s surviving army remains because the battle winner was destroyed.`);
    state.battle = undefined;
    return;
  }

  if (loserUnits <= 0) {
    delete territoryInBattle.armies[loserId];
    log(state, `${player(state, loserId).name}'s army was destroyed; no retreat is required.`);
    state.battle = undefined;
    return;
  }

  const legalRetreats = territoryInBattle.neighbors.filter(id => {
    const destination = territory(state, id);
    const enemyPresent = Object.entries(destination.armies).some(([armyOwner, count]) => armyOwner !== loserId && count > 0);
    return !enemyPresent && (destination.armies[loserId] || 0) + loserUnits <= 10;
  });

  battle.phase = 'RETREAT';
  battle.legalRetreatTerritoryIds = legalRetreats;
  log(state, `${player(state, loserId).name} must retreat or recall the surviving army.`);
}

export function retreat(state: GameState, pid: string, territoryId?: string) {
  const battle = state.battle;
  if (!battle || battle.phase !== 'RETREAT' || battle.loserId !== pid) throw new Error('You do not have a retreat decision.');
  const battlefield = territory(state, battle.territoryId);
  const units = battlefield.armies[pid] || 0;
  if (units <= 0) throw new Error('No surviving units to retreat.');

  delete battlefield.armies[pid];
  if (!territoryId) {
    log(state, `${player(state, pid).name} recalled ${units} surviving unit${units === 1 ? '' : 's'} to supply.`);
    state.battle = undefined;
    updateCityOwnership(state);
    return;
  }
  if (!battle.legalRetreatTerritoryIds?.includes(territoryId)) throw new Error('That territory is not a legal retreat destination.');
  const destination = territory(state, territoryId);
  destination.armies[pid] = (destination.armies[pid] || 0) + units;
  log(state, `${player(state, pid).name} retreated ${units} unit${units === 1 ? '' : 's'} to ${destination.name}.`);
  state.battle = undefined;
  updateCityOwnership(state);
}

/**
 * A city belongs to whichever single player has units in it, and reverts
 * to its home owner once it is empty. Contested cities keep their owner
 * until the battle there is resolved.
 */
export function updateCityOwnership(state: GameState) {
  for (const t of state.territories) {
    if (t.kind !== 'city') continue;
    // Saves from before captures existed only stored the starting owner.
    if (!t.homeOwnerId) t.homeOwnerId = t.ownerId;
    const occupants = Object.entries(t.armies).filter(([, n]) => n > 0).map(([id]) => id);
    if (occupants.length > 1) continue;
    const owner = occupants[0] ?? t.homeOwnerId;
    if (owner === t.ownerId) continue;
    t.ownerId = owner;
    if (!owner) continue;
    log(state, owner === t.homeOwnerId
      ? `${t.name} reverted to ${player(state, owner).name}.`
      : `${player(state, owner).name} captured ${t.name}.`);
  }
}

export function endTurn(state: GameState, pid: string) {
  actionCheck(state, pid);
  const i = state.players.findIndex(p => p.id === pid);
  const next = (i + 1) % state.players.length;
  if (next === 0) state.round++;
  state.activePlayerId = state.players[next].id;
  state.players[next].prayer += 2;
  log(state, `${state.players[i].name} ended their turn. ${state.players[next].name} is active.`);
}

function discardCard(p: Player, cardId: string) {
  p.availableBattleCards = p.availableBattleCards.filter(id => id !== cardId);
  p.discardedBattleCards.push(cardId);
  if (p.availableBattleCards.length === 0) {
    p.availableBattleCards = BATTLE_CARDS.map(c => c.id);
    p.discardedBattleCards = [];
  }
}

function actionCheck(s: GameState, id: string) {
  if (!s.started) throw new Error('Game has not started.');
  if (s.activePlayerId !== id) throw new Error('It is not your turn.');
  if (s.battle) throw new Error('Resolve the current battle first.');
}
function player(s: GameState, id: string) { const p = s.players.find(x => x.id === id); if (!p) throw new Error('Player not found.'); return p; }
function territory(s: GameState, id: string) { const t = s.territories.find(x => x.id === id); if (!t) throw new Error('Territory not found.'); return t; }
function card(id: string): BattleCard { const result = BATTLE_CARDS.find(c => c.id === id); if (!result) throw new Error('Battle card not found.'); return result; }
export function log(s: GameState, text: string) { s.log.unshift({id:crypto.randomUUID(),text,at:new Date().toISOString()}); s.log=s.log.slice(0,100); }

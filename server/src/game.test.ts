import { describe, expect, it } from 'vitest';
import { addPlayer, move, newGame, recruit, retreat, selectBattleCard, startGame, updateCityOwnership, type BattleSelections } from './game.js';

function startedGame() {
  const s = newGame();
  addPlayer(s, 'A', 'a'); addPlayer(s, 'B', 'b'); addPlayer(s, 'C', 'c');
  startGame(s, 'a');
  return s;
}

describe('rules', () => {
  it('recruits and charges prayer', () => {
    const s = startedGame();
    recruit(s, 'a', 'red-city', 2);
    expect(s.players[0].prayer).toBe(5);
    expect(s.territories.find(t => t.id === 'red-city')!.armies.a).toBe(7);
  });

  it('starts a battle when recruiting in your city while an enemy holds it', () => {
    const s = startedGame();
    const city = s.territories.find(t => t.id === 'red-city')!;
    delete city.armies.a;
    city.armies.b = 3;
    updateCityOwnership(s);
    expect(city.ownerId).toBe('b');
    recruit(s, 'a', 'red-city', 4);
    expect(s.players[0].prayer).toBe(3);
    expect(city.armies.a).toBe(4);
    expect(s.battle).toMatchObject({ attackerId: 'a', defenderId: 'b', territoryId: 'red-city', attackerUnitsAtStart: 4, defenderUnitsAtStart: 3 });
    const selections: BattleSelections = new Map();
    selectBattleCard(s, 'a', 'maneuver', selections);
    selectBattleCard(s, 'b', 'shield-wall', selections);
    expect(s.battle?.loserId).toBe('b');
    retreat(s, 'b');
    expect(city.ownerId).toBe('a');
  });

  it('transfers a captured city while occupied and reverts it once empty', () => {
    const s = startedGame();
    const city = s.territories.find(t => t.id === 'red-city')!;
    const desert = s.territories.find(t => t.id === 'west-desert')!;
    // Red has left the city; Blue walks in from the adjacent desert.
    move(s, 'a', 'red-city', 'west-desert', 5);
    s.activePlayerId = 'b';
    delete desert.armies.a;
    desert.armies.b = 4;
    move(s, 'b', 'west-desert', 'red-city', 3);
    expect(city.ownerId).toBe('b');
    expect(city.homeOwnerId).toBe('a');
    expect(() => recruit(s, 'b', 'red-city', 1)).toThrow(/own city/);
    move(s, 'b', 'red-city', 'west-desert', 3);
    expect(city.ownerId).toBe('a');
  });

  it('transfers a city when its defenders are destroyed in battle', () => {
    const s = startedGame();
    const city = s.territories.find(t => t.id === 'red-city')!;
    city.armies.a = 1;
    s.territories.find(t => t.id === 'west-desert')!.armies.b = 6;
    s.activePlayerId = 'b';
    move(s, 'b', 'west-desert', 'red-city', 6);
    expect(city.ownerId).toBe('a');
    const selections: BattleSelections = new Map();
    selectBattleCard(s, 'b', 'bloodbath', selections);
    selectBattleCard(s, 'a', 'charge', selections);
    expect(s.battle).toBeUndefined();
    expect(city.armies.a).toBeUndefined();
    expect(city.ownerId).toBe('b');
  });

  it('backfills the home owner for saves made before captures', () => {
    const s = startedGame();
    const city = s.territories.find(t => t.id === 'red-city')!;
    delete city.homeOwnerId;
    updateCityOwnership(s);
    expect(city.homeOwnerId).toBe('a');
  });

  it('blocks non-adjacent moves', () => {
    const s = startedGame();
    expect(() => move(s, 'a', 'red-city', 'center', 1)).toThrow(/adjacent/);
  });

  it('starts combat when entering an enemy territory', () => {
    const s = startedGame();
    const target = s.territories.find(t => t.id === 'west-desert')!;
    target.armies.b = 3;
    move(s, 'a', 'red-city', 'west-desert', 4);
    expect(s.battle?.attackerId).toBe('a');
    expect(s.battle?.defenderId).toBe('b');
  });

  it('keeps selections secret until both cards are submitted and then resolves', () => {
    const s = startedGame();
    s.territories.find(t => t.id === 'west-desert')!.armies.b = 3;
    move(s, 'a', 'red-city', 'west-desert', 4);
    const selections: BattleSelections = new Map();
    selectBattleCard(s, 'a', 'maneuver', selections);
    expect(s.battle?.phase).toBe('SELECT_CARDS');
    selectBattleCard(s, 'b', 'balanced', selections);
    expect(s.battle?.phase).toBe('RETREAT');
    expect(s.battle?.summary?.winnerId).toBe('a');
  });

  it('allows the loser to retreat to a legal adjacent territory', () => {
    const s = startedGame();
    s.territories.find(t => t.id === 'west-desert')!.armies.b = 3;
    move(s, 'a', 'red-city', 'west-desert', 4);
    const selections: BattleSelections = new Map();
    selectBattleCard(s, 'a', 'maneuver', selections);
    selectBattleCard(s, 'b', 'shield-wall', selections);
    expect(s.battle?.loserId).toBe('b');
    retreat(s, 'b', 'west-temple');
    expect(s.battle).toBeUndefined();
    expect(s.territories.find(t => t.id === 'west-temple')!.armies.b).toBeGreaterThan(0);
  });
});

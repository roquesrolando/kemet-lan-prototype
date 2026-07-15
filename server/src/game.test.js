import { describe, expect, it } from 'vitest';
import { addPlayer, move, newGame, recruit, retreat, selectBattleCard, startGame } from './game.js';
function startedGame() {
    const s = newGame();
    addPlayer(s, 'A', 'a');
    addPlayer(s, 'B', 'b');
    addPlayer(s, 'C', 'c');
    startGame(s, 'a');
    return s;
}
describe('rules', () => {
    it('recruits and charges prayer', () => {
        const s = startedGame();
        recruit(s, 'a', 'red-city', 2);
        expect(s.players[0].prayer).toBe(5);
        expect(s.territories.find(t => t.id === 'red-city').armies.a).toBe(7);
    });
    it('blocks non-adjacent moves', () => {
        const s = startedGame();
        expect(() => move(s, 'a', 'red-city', 'center', 1)).toThrow(/adjacent/);
    });
    it('starts combat when entering an enemy territory', () => {
        const s = startedGame();
        const target = s.territories.find(t => t.id === 'west-desert');
        target.armies.b = 3;
        move(s, 'a', 'red-city', 'west-desert', 4);
        expect(s.battle?.attackerId).toBe('a');
        expect(s.battle?.defenderId).toBe('b');
    });
    it('keeps selections secret until both cards are submitted and then resolves', () => {
        const s = startedGame();
        s.territories.find(t => t.id === 'west-desert').armies.b = 3;
        move(s, 'a', 'red-city', 'west-desert', 4);
        const selections = new Map();
        selectBattleCard(s, 'a', 'maneuver', selections);
        expect(s.battle?.phase).toBe('SELECT_CARDS');
        selectBattleCard(s, 'b', 'balanced', selections);
        expect(s.battle?.phase).toBe('RETREAT');
        expect(s.battle?.summary?.winnerId).toBe('a');
    });
    it('allows the loser to retreat to a legal adjacent territory', () => {
        const s = startedGame();
        s.territories.find(t => t.id === 'west-desert').armies.b = 3;
        move(s, 'a', 'red-city', 'west-desert', 4);
        const selections = new Map();
        selectBattleCard(s, 'a', 'maneuver', selections);
        selectBattleCard(s, 'b', 'shield-wall', selections);
        expect(s.battle?.loserId).toBe('b');
        retreat(s, 'b', 'west-temple');
        expect(s.battle).toBeUndefined();
        expect(s.territories.find(t => t.id === 'west-temple').armies.b).toBeGreaterThan(0);
    });
});

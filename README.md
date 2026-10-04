# Kemet LAN Prototype v0.2

A private three-player LAN prototype with a synchronized board, turns, prayer points, recruiting, adjacent movement, action history, save/load, and a first automated combat flow.

## Run on macOS with pnpm

```bash
pnpm install
pnpm dev
```

The host opens `http://localhost:5173`. Other players on the same network open the LAN URL printed in Terminal, such as `http://192.168.0.6:5173`.

## v0.2 combat

- Moving into an enemy-occupied adjacent territory starts a battle.
- Attacker and defender privately select an available battle card on their own devices.
- Strength equals army units plus the card's strength value. The defender wins ties.
- Damage and defense are resolved simultaneously; some cards also cause self-losses.
- The losing surviving army retreats to a legal adjacent empty/friendly territory or is recalled to supply.
- Played cards are discarded. When a player has used every battle card, the full set refreshes.
- Other actions and ending the turn are blocked until the battle is resolved.
- A city belongs to whichever player has units in it, and reverts to its original owner as soon as it is empty. Holding a captured city does not let you recruit there.
- Players always recruit in their own starting city. Recruiting there while an enemy holds it immediately starts a battle, with the recruited units attacking.

The v0.2 cards are an original simplified prototype set for testing the software architecture. They are not a transcription of the physical game's copyrighted cards.

## Commands

```bash
pnpm dev
pnpm test
pnpm build
pnpm start   # serves the built server from server/dist
```

Each browser keeps a secret seat token in `localStorage` to reclaim its seat after a reconnect. Saves in `saves/latest.json` include these tokens, so treat that file as private to the host.

## Not included yet

Divine Intervention cards, power tiles, creatures, permanent battle Fame, winner recall choices, exact Blood and Sand card-discard procedure, action tokens, pyramids, temples, and victory conditions remain future milestones.

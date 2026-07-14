# Kemet LAN Prototype v0.1

A private three-player LAN prototype with a synchronized board, lobby, turns, prayer points, recruiting, adjacent movement, action history, and JSON save/load. Combat, cards, pyramids, powers, creatures, and full Kemet rules are intentionally outside v0.1.

## Mac setup

1. Install Node.js 20 or newer. The easiest option is the LTS installer from the official Node.js site, or Homebrew: `brew install node`.
2. Open Terminal and enter the project folder.
3. Run:

```bash
npm install
npm run dev
```

4. The host opens `http://localhost:5173`.
5. The other two players join the same Wi-Fi/LAN and open `http://HOST_IP:5173`.

To find the host Mac's IP:

```bash
ipconfig getifaddr en0
```

If that returns nothing while using Ethernet, try `ipconfig getifaddr en1`.

## macOS firewall

The first run may ask whether Node can accept incoming connections. Choose **Allow**. You can also review this under **System Settings → Network → Firewall**.

## Gameplay in v0.1

- Exactly three players join.
- The first player starts the game.
- Each player begins with 7 prayer points and 5 units in their city.
- Recruit costs 1 prayer point per unit and is limited to your own city.
- To move, select an origin territory and then an adjacent destination.
- Movement into an enemy-occupied territory is blocked because combat is not implemented yet.
- Ending a turn gives the next player 2 prayer points.
- Save/load uses `saves/latest.json` on the host.

## Commands

```bash
npm run dev      # client and server development mode
npm test         # server rules tests
npm run build    # production build
```

## Architecture

- `client`: React + TypeScript + Vite
- `server`: Node.js + Express + Socket.IO
- `shared`: shared game-state and command types
- `saves`: host-side JSON save files

## Known v0.1 limitations

Player reconnection identity is intentionally simple and can be lost if the browser/server restarts. There is no combat, action-token board, pyramids, power tiles, cards, victory scoring, or official board artwork. The map is an original placeholder layout for private prototyping.


## TypeScript TS2688 troubleshooting

Version 0.1.1 explicitly limits the type libraries loaded by each workspace. If you previously installed v0.1.0, use the corrected package or replace the three `tsconfig.json` files, then run:

```bash
rm -rf node_modules client/node_modules server/node_modules shared/node_modules
npm install
npm run dev
```

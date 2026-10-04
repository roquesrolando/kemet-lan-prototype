import express from 'express';
import cors from 'cors';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import type { ClientCommand, GameState, ServerMessage } from '@kemet/shared';
import {
  addPlayer,
  endTurn,
  log,
  move,
  newGame,
  recruit,
  retreat,
  selectBattleCard,
  startGame,
  type BattleSelections,
} from './game.js';

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

let state = newGame();

const battleSelections: BattleSelections = new Map();

/*
 * Maps each browser's secret seat token to its public player ID.
 * Player IDs are broadcast to everyone in the game state, so they
 * cannot double as proof of identity when reconnecting.
 */
let playerTokens = new Map<string, string>();

const savePath = path.resolve(
  process.cwd(),
  '../saves/latest.json',
);

function broadcast() {
  io.emit('state', state);
}

io.on('connection', (socket) => {
  socket.emit('state', state);

  socket.on(
    'command',
    (
      cmd: ClientCommand,
      reply: (response: ServerMessage) => void,
    ) => {
      try {
        let playerId = socket.data.playerId as
          | string
          | undefined;

        if (cmd.type === 'JOIN') {
          const existingPlayerId = cmd.playerToken
            ? playerTokens.get(cmd.playerToken)
            : undefined;

          const existingPlayer = existingPlayerId
            ? state.players.find(
                (player) => player.id === existingPlayerId,
              )
            : undefined;

          /*
           * Reconnect the browser to its existing player seat.
           * The player's permanent ID is no longer tied to
           * Socket.IO's temporary socket.id.
           */
          if (existingPlayer) {
            existingPlayer.connected = true;
            socket.data.playerId = existingPlayer.id;
            playerId = existingPlayer.id;

            reply({
              ok: true,
              playerId: existingPlayer.id,
              playerToken: cmd.playerToken,
              state,
            });

            broadcast();
            return;
          }

          const trimmedName = cmd.name.trim();

          if (!trimmedName) {
            throw new Error('Enter a player name.');
          }

          /*
           * Create a permanent public player ID plus a secret token.
           * The token remains stored in the browser and survives
           * Socket.IO reconnections.
           */
          const permanentPlayerId = randomUUID();

          const newPlayer = addPlayer(
            state,
            trimmedName,
            permanentPlayerId,
          );

          const newPlayerToken = randomUUID();
          playerTokens.set(newPlayerToken, newPlayer.id);

          newPlayer.connected = true;
          socket.data.playerId = newPlayer.id;
          playerId = newPlayer.id;

          reply({
            ok: true,
            playerId: newPlayer.id,
            playerToken: newPlayerToken,
            state,
          });

          broadcast();
          return;
        }

        if (!playerId) {
          throw new Error('Join the game first.');
        }

        switch (cmd.type) {
          case 'START':
            startGame(state, playerId);
            break;

          case 'RECRUIT':
            recruit(
              state,
              playerId,
              cmd.territoryId,
              cmd.units,
            );
            break;

          case 'MOVE':
            move(
              state,
              playerId,
              cmd.fromId,
              cmd.toId,
              cmd.units,
            );
            break;

          case 'SELECT_BATTLE_CARD':
            selectBattleCard(
              state,
              playerId,
              cmd.cardId,
              battleSelections,
            );
            break;

          case 'RETREAT':
            retreat(
              state,
              playerId,
              cmd.territoryId,
            );
            break;

          case 'END_TURN':
            endTurn(state, playerId);
            break;

          case 'SAVE':
            fs.mkdirSync(path.dirname(savePath), {
              recursive: true,
            });

            fs.writeFileSync(
              savePath,
              JSON.stringify(
                {
                  state,
                  playerTokens: Object.fromEntries(playerTokens),
                },
                null,
                2,
              ),
            );

            log(state, 'Game saved on the host.');
            break;

          case 'LOAD':
            if (!fs.existsSync(savePath)) {
              throw new Error('No saved game was found.');
            }

            const saved = JSON.parse(
              fs.readFileSync(savePath, 'utf8'),
            );

            if (saved.playerTokens) {
              state = saved.state as GameState;
              playerTokens = new Map(
                Object.entries(saved.playerTokens as Record<string, string>),
              );
            } else {
              /*
               * Saves from before secret tokens stored the bare state,
               * and browsers reconnected with their player ID.
               */
              state = saved as GameState;
              playerTokens = new Map(
                state.players.map((player) => [player.id, player.id]),
              );
            }

            battleSelections.clear();

            if (
              state.battle?.phase === 'SELECT_CARDS'
            ) {
              state.battle = undefined;

              log(
                state,
                'An unresolved battle was cleared while loading because secret selections are not stored.',
              );
            }

            log(state, 'Saved game loaded.');
            break;
        }

        reply({
          ok: true,
          state,
        });

        broadcast();
      } catch (error) {
        reply({
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : 'Unknown error',
        });
      }
    },
  );

  socket.on('disconnect', async () => {
    const disconnectedPlayerId = socket.data.playerId as
      | string
      | undefined;

    if (!disconnectedPlayerId) {
      return;
    }

    /*
     * A player may already have reconnected through another
     * socket. Only mark them disconnected if no remaining socket
     * represents that player.
     */
    const connectedSockets = await io.fetchSockets();

    const hasAnotherConnection = connectedSockets.some(
      (connectedSocket) =>
        connectedSocket.data.playerId ===
        disconnectedPlayerId,
    );

    if (!hasAnotherConnection) {
      const player = state.players.find(
        (candidate) =>
          candidate.id === disconnectedPlayerId,
      );

      if (player) {
        player.connected = false;
      }
    }

    broadcast();
  });
});

const port = 3001;

server.listen(port, '0.0.0.0', () => {
  const networks = os.networkInterfaces();

  const addresses = Object.values(networks)
    .flat()
    .filter(
      (
        network,
      ): network is NonNullable<typeof network> =>
        Boolean(
          network &&
            network.family === 'IPv4' &&
            !network.internal,
        ),
    )
    .map((network) => network.address);

  console.log(
    `Kemet server running. Local: http://localhost:${port}`,
  );

  addresses.forEach((address) => {
    console.log(`LAN: http://${address}:5173`);
  });
});
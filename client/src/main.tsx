import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import {
  BATTLE_CARDS,
  type ClientCommand,
  type GameState,
  type ServerMessage,
} from '@kemet/shared';
import './styles.css';

const socket = io(`http://${window.location.hostname}:3001`);

function App() {
  const [state, setState] = useState<GameState>();
  const [playerId, setPlayerId] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState<string>();
  const [units, setUnits] = useState(1);

  useEffect(() => {
    const handleState = (newState: GameState) => {
      setState(newState);
    };

    socket.on('state', handleState);

    return () => {
      socket.off('state', handleState);
    };
  }, []);

  useEffect(() => {
    function reconnectPlayer() {
      const savedPlayerToken = localStorage.getItem('kemet-token');

      if (!savedPlayerToken) {
        return;
      }

      socket.emit(
        'command',
        {
          type: 'JOIN',
          name: '',
          playerToken: savedPlayerToken,
        },
        (response: ServerMessage) => {
          if (response.ok) {
            setPlayerId(response.playerId || '');

            if (response.state) {
              setState(response.state);
            }
          } else {
            localStorage.removeItem('kemet-token');
            setPlayerId('');
          }
        },
      );
    }

    socket.on('connect', reconnectPlayer);

    if (socket.connected) {
      reconnectPlayer();
    }

    return () => {
      socket.off('connect', reconnectPlayer);
    };
  }, []);

  const me = useMemo(
    () => state?.players.find((player) => player.id === playerId),
    [state, playerId],
  );

  function send(cmd: ClientCommand) {
    socket.emit('command', cmd, (response: ServerMessage) => {
      setMsg(response.ok ? '' : response.message || 'Error');

      if (response.playerId) {
        setPlayerId(response.playerId);
      }

      if (response.playerToken) {
        localStorage.setItem('kemet-token', response.playerToken);
      }

      if (response.state) {
        setState(response.state);
      }
    });
  }

  if (!state) {
    return <main>Connecting…</main>;
  }

  if (!me) {
    return (
      <main className="join">
        <h1>Kemet LAN v0.2</h1>

        <p>
          Room <b>{state.roomCode}</b>
        </p>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Player name"
        />

        <button
          disabled={!name.trim()}
          onClick={() =>
            send({
              type: 'JOIN',
              name: name.trim(),
              playerToken:
                localStorage.getItem('kemet-token') || undefined,
            })
          }
        >
          Join game
        </button>

        <p className="error">{msg}</p>
      </main>
    );
  }

  const active = state.activePlayerId === playerId;
  const first = state.players[0]?.id === playerId;
  const battle = state.battle;

  const inBattle =
    !!battle &&
    (battle.attackerId === playerId || battle.defenderId === playerId);

  const submitted =
    !!battle?.submittedPlayerIds.includes(playerId);

  const retreating =
    battle?.phase === 'RETREAT' &&
    battle.loserId === playerId;

  const battleSummary = battle?.summary;

  function territoryClick(id: string) {
    if (retreating) {
      if (battle?.legalRetreatTerritoryIds?.includes(id)) {
        send({
          type: 'RETREAT',
          territoryId: id,
        });
      }

      return;
    }

    if (!active || battle) {
      return;
    }

    if (!selected) {
      setSelected(id);
      return;
    }

    if (selected === id) {
      setSelected(undefined);
      return;
    }

    send({
      type: 'MOVE',
      fromId: selected,
      toId: id,
      units,
    });

    setSelected(undefined);
  }

  return (
    <main>
      <header>
        <div>
          <h1>Kemet LAN v0.2</h1>

          <span>
            Room {state.roomCode} · Round {state.round}
          </span>
        </div>

        <div className="toolbar">
          {!state.started && first && (
            <button onClick={() => send({ type: 'START' })}>
              Start game
            </button>
          )}

          <button onClick={() => send({ type: 'SAVE' })}>
            Save
          </button>

          <button onClick={() => send({ type: 'LOAD' })}>
            Load
          </button>
        </div>
      </header>

      <section className="players">
        {state.players.map((player) => (
          <article
            className={
              state.activePlayerId === player.id ? 'active' : ''
            }
            key={player.id}
          >
            <b>{player.name}</b>

            <span>
              {player.color} · ☥ {player.prayer}
            </span>
          </article>
        ))}
      </section>

      {battle && (
        <section className="battle-banner">
          <strong>
            {battle.phase === 'SELECT_CARDS'
              ? 'Battle in progress'
              : 'Retreat required'}
          </strong>

          <span>
            {
              state.players.find(
                (player) => player.id === battle.attackerId,
              )?.name
            }{' '}
            vs.{' '}
            {
              state.players.find(
                (player) => player.id === battle.defenderId,
              )?.name
            }{' '}
            in{' '}
            {
              state.territories.find(
                (territory) =>
                  territory.id === battle.territoryId,
              )?.name
            }
          </span>
        </section>
      )}

      <div className="layout">
        <section className="board">
          {state.territories.map((territory) => {
            const legalRetreat =
              !!battle?.legalRetreatTerritoryIds?.includes(
                territory.id,
              );

            const armyText =
              Object.entries(territory.armies)
                .filter(([, amount]) => amount > 0)
                .map(([id, amount]) => {
                  const playerName = state.players.find(
                    (player) => player.id === id,
                  )?.name;

                  return `${playerName}: ${amount}`;
                })
                .join(' · ') || 'Empty';

            const capturedBy =
              territory.kind === 'city' &&
              territory.ownerId !== territory.homeOwnerId
                ? state.players.find(
                    (player) => player.id === territory.ownerId,
                  )?.name
                : undefined;

            return (
              <button
                key={territory.id}
                onClick={() => territoryClick(territory.id)}
                className={[
                  'territory',
                  territory.kind,
                  selected === territory.id ? 'selected' : '',
                  legalRetreat ? 'legal-retreat' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: `${territory.x}%`,
                  top: `${territory.y}%`,
                }}
              >
                <b>{territory.name}</b>
                {capturedBy && (
                  <small className="captured">
                    Held by {capturedBy}
                  </small>
                )}
                <small>{armyText}</small>
              </button>
            );
          })}
        </section>

        <aside>
          {!battle && (
            <>
              <h2>{active ? 'Your turn' : 'Waiting'}</h2>

              <label>
                Units
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={units}
                  onChange={(event) =>
                    setUnits(Number(event.target.value))
                  }
                />
              </label>

              <button
                disabled={!active || !selected}
                onClick={() => {
                  if (!selected) {
                    return;
                  }

                  send({
                    type: 'RECRUIT',
                    territoryId: selected,
                    units,
                  });
                }}
              >
                Recruit in selected city
              </button>

              <button
                disabled={!active}
                onClick={() => send({ type: 'END_TURN' })}
              >
                End turn
              </button>

              <p className="hint">
                Move: select an origin, then an adjacent
                destination. Entering an enemy territory starts
                combat.
              </p>
            </>
          )}

          {battle?.phase === 'SELECT_CARDS' && (
            <div className="combat-panel">
              <h2>Choose a battle card</h2>

              {!inBattle && (
                <p>You are observing this battle.</p>
              )}

              {inBattle && submitted && (
                <p>
                  Your card is locked in. Waiting for the other
                  player…
                </p>
              )}

              {inBattle && !submitted && (
                <div className="cards">
                  {BATTLE_CARDS.filter((card) =>
                    me.availableBattleCards.includes(card.id),
                  ).map((card) => (
                    <button
                      key={card.id}
                      className="battle-card"
                      onClick={() =>
                        send({
                          type: 'SELECT_BATTLE_CARD',
                          cardId: card.id,
                        })
                      }
                    >
                      <b>{card.name}</b>
                      <span>Strength +{card.strength}</span>
                      <span>Damage {card.damage}</span>
                      <span>Defense {card.defense}</span>

                      {card.selfDamage ? (
                        <span>
                          Self-loss {card.selfDamage}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {battle?.phase === 'RETREAT' && (
            <div className="combat-panel">
              <h2>Battle resolved</h2>

              {battleSummary ? (
                <p>
                  {
                    state.players.find(
                      (player) =>
                        player.id === battleSummary.winnerId,
                    )?.name
                  }{' '}
                  won. Strength{' '}
                  {battleSummary.attackerStrength}–
                  {battleSummary.defenderStrength}. Losses:
                  attacker {battleSummary.attackerLosses},
                  defender {battleSummary.defenderLosses}.
                </p>
              ) : null}

              {retreating ? (
                <>
                  <p>
                    Select a highlighted adjacent territory, or
                    recall survivors to supply.
                  </p>

                  <button
                    onClick={() =>
                      send({
                        type: 'RETREAT',
                      })
                    }
                  >
                    Recall survivors
                  </button>
                </>
              ) : (
                <p>
                  Waiting for{' '}
                  {
                    state.players.find(
                      (player) =>
                        player.id === battle.loserId,
                    )?.name
                  }{' '}
                  to retreat.
                </p>
              )}
            </div>
          )}

          <p className="error">{msg}</p>

          <h3>History</h3>

          <div className="log">
            {state.log.map((entry) => (
              <p key={entry.id}>{entry.text}</p>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
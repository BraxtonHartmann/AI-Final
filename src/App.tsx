import { useState } from 'react'
import { useLobby } from './useLobby'
import type { Role } from '../shared/protocol'
import './App.css'
import { PowerPanel } from './PowerPanel'

const roles: { id: Role; title: string; description: string }[] = [
  {
    id: 'equipment',
    title: 'Equipment operator',
    description:
      'Work the breakers, valves, and hatch. Your partner has the information you need.',
  },
  {
    id: 'control',
    title: 'Control room analyst',
    description:
      'Read the diagrams and monitor the station. Guide your partner through each system.',
  },
]

function App() {
  const { room, session, connected, busy, error, send } = useLobby()
  const [code, setCode] = useState('')
  const player = room?.players.find((entry) => entry.id === session?.playerId)
  const canStart =
    room?.players.length === 2 &&
    room.players.every((entry) => entry.connected && entry.role && entry.ready)
  const disabled = !connected || busy

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Below the Surface home">
          BELOW <span>THE SURFACE</span>
        </a>
        <span
          className={`connection ${connected ? 'online' : ''}`}
          role="status"
        >
          <span aria-hidden="true" />
          {connected ? 'Station connected' : 'Connecting to station…'}
        </span>
      </header>
      <main className={room && room.phase !== 'lobby' ? 'game-main' : ''}>
        <section className="mission-intro" aria-labelledby="mission-title">
          <p className="eyebrow">A two-player escape room</p>
          <h1 id="mission-title">
            Two rooms.
            <br />
            One way out.
          </h1>
          <p className="intro-copy">
            Deep below the surface, the station has gone quiet. You have the
            controls. Your partner has the answers. Getting out takes both of
            you.
          </p>
          <div className="station-diagram" aria-hidden="true">
            <div className="waterline" />
            <div className="umbilical" />
            <div className="station-body">
              <div className="porthole" />
              <div className="station-link" />
              <div className="porthole" />
            </div>
            <div className="station-leg left" />
            <div className="station-leg right" />
            <div className="seabed" />
          </div>
          <p className="play-note">
            2 players · 2 browsers · Stay on a voice call or play side by side
          </p>
        </section>
        <section className="lobby-panel" aria-labelledby="panel-title">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {room && !connected && (
            <p className="notice" role="status">
              Connection lost. Your seat is reserved for five minutes while we
              reconnect.
            </p>
          )}
          {!room ? (
            <>
              <p className="eyebrow">Crew access</p>
              <h2 id="panel-title">Find your partner.</h2>
              <p className="muted">
                Open a room and share the code, or join your partner's room.
              </p>
              <button
                className="primary create-button"
                disabled={disabled}
                onClick={() => void send({ type: 'create' })}
              >
                Create a room <span aria-hidden="true">↗</span>
              </button>
              <div className="divider">
                <span>Have a room code?</span>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void send({ type: 'join', code: code.trim().toUpperCase() })
                }}
              >
                <label htmlFor="room-code">Room code</label>
                <div className="join-row">
                  <input
                    id="room-code"
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.toUpperCase())
                    }
                    placeholder="ABC234"
                    maxLength={6}
                    minLength={6}
                    pattern="[A-Za-z2-9]{6}"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                    aria-describedby="code-help"
                  />
                  <button className="secondary" disabled={disabled}>
                    Join room
                  </button>
                </div>
                <p className="field-help" id="code-help">
                  Enter the six-character code from your partner.
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="room-heading">
                <div>
                  <p className="eyebrow">Room code</p>
                  <h2 id="panel-title" className="room-code">
                    {room.code}
                  </h2>
                </div>
                <span className="crew-count">
                  {room.players.length} / 2 crew
                </span>
              </div>
              {room.phase === 'lobby' ? (
                <>
                  <p className="muted">
                    Share this code with your partner. Choose a role, then get
                    ready.
                  </p>
                  <div
                    className="roles"
                    role="group"
                    aria-label="Choose your role"
                  >
                    {roles.map((role) => {
                      const owner = room.players.find(
                        (entry) => entry.role === role.id,
                      )
                      const selected = player?.role === role.id
                      return (
                        <button
                          key={role.id}
                          className={`role-card ${selected ? 'selected' : ''}`}
                          aria-pressed={selected}
                          disabled={disabled || Boolean(owner && !selected)}
                          onClick={() =>
                            void send({ type: 'role', role: role.id })
                          }
                        >
                          <span className="role-card-top">
                            <strong>{role.title}</strong>
                            <span className="role-marker" aria-hidden="true">
                              {selected ? '✓' : '+'}
                            </span>
                          </span>
                          <span className="role-description">
                            {role.description}
                          </span>
                          <span className="role-status">
                            {selected
                              ? 'Your role'
                              : owner
                                ? 'Partner’s role'
                                : 'Available'}
                            {owner && !owner.connected ? ' · Reconnecting' : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <ul
                    className="crew-list"
                    aria-label="Crew status"
                    aria-live="polite"
                  >
                    {room.players.map((entry) => (
                      <li key={entry.id}>
                        <span>
                          {entry.id === player?.id ? 'You' : 'Partner'}
                        </span>
                        <span>
                          {!entry.connected
                            ? 'Disconnected · seat reserved'
                            : entry.ready
                              ? 'Ready'
                              : entry.role
                                ? 'Not ready'
                                : 'Choosing a role'}
                        </span>
                      </li>
                    ))}
                    {room.players.length === 1 && (
                      <li>
                        <span>Partner</span>
                        <span>Waiting to join…</span>
                      </li>
                    )}
                  </ul>
                  <div className="lobby-actions">
                    <button
                      className="secondary"
                      disabled={disabled || !player?.role}
                      onClick={() =>
                        void send({ type: 'ready', ready: !player?.ready })
                      }
                    >
                      {player?.ready ? 'Cancel ready' : 'Ready up'}
                    </button>
                    <button
                      className="primary"
                      disabled={disabled || !canStart}
                      onClick={() => void send({ type: 'start' })}
                    >
                      Enter station <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : (
                room.power && (
                  <PowerPanel
                    power={room.power}
                    disabled={disabled}
                    partnerConnected={
                      room.players.length === 2 &&
                      room.players.every((entry) => entry.connected)
                    }
                    send={send}
                  />
                )
              )}
              <button
                className="text-button"
                disabled={disabled}
                onClick={() => void send({ type: 'leave' })}
              >
                Leave room
              </button>
            </>
          )}
        </section>
      </main>
      <footer>Communication is your lifeline.</footer>
    </div>
  )
}

export default App

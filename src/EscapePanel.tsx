import { useEffect, useRef } from 'react'
import type { Request, Role, RoomView } from '../shared/protocol'

interface Props {
  room: RoomView
  role: Role
  disabled: boolean
  send: (request: Request) => Promise<void>
}

export function EscapePanel({ room, role, disabled, send }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const voted = room.replay?.[role] ?? false
  const bothConnected =
    room.players.length === 2 &&
    room.players.every((player) => player.connected)
  return (
    <section className="escape-panel" aria-labelledby="escape-title">
      <p className="eyebrow">All four systems restored</p>
      <div className="escape-porthole" aria-hidden="true">
        <span />
      </div>
      <h3 id="escape-title" ref={heading} tabIndex={-1}>
        You escaped.
      </h3>
      <p>
        You restored power, drained the airlock, reached rescue, and released
        the hatch. The crew is together again.
      </p>
      <ul className="escape-systems" aria-label="Completed systems">
        {[
          'Power restored',
          'Airlock drained',
          'Rescue acknowledged',
          'Hatch released',
        ].map((system) => (
          <li key={system}>
            <span aria-hidden="true">✓</span> {system}
          </li>
        ))}
      </ul>
      <div className="replay-panel">
        <h4>Another dive?</h4>
        <p>
          Both players must request a replay. You'll return to the lobby
          together and can switch roles.
        </p>
        <ul className="crew-list" aria-live="polite">
          {(['equipment', 'control'] as Role[]).map((side) => (
            <li key={side}>
              <span>{side === role ? 'You' : 'Partner'}</span>
              <span>
                {room.replay?.[side] ? 'Replay requested' : 'Deciding'}
              </span>
            </li>
          ))}
        </ul>
        {!bothConnected && (
          <p className="notice" role="status">
            Waiting for your partner to reconnect.
          </p>
        )}
        <button
          className="primary"
          disabled={disabled || !bothConnected}
          onClick={() =>
            void send({ type: 'replay', ready: !voted, runId: room.runId })
          }
        >
          {voted ? 'Cancel replay request' : 'Play again'}
        </button>
      </div>
    </section>
  )
}

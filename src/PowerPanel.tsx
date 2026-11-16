import { useEffect, useRef } from 'react'
import { breakers } from '../shared/protocol'
import type { PowerAction, PowerView, Request } from '../shared/protocol'

interface Props {
  power: PowerView
  disabled: boolean
  partnerConnected: boolean
  send: (request: Request) => Promise<void>
}

function breakerLabel(id: string) {
  return breakers.find((breaker) => breaker.id === id)?.label ?? id
}

export function PowerPanel({ power, disabled, partnerConnected, send }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [power.status])
  const restored = power.status === 'restored'
  const tripped = power.status === 'tripped'
  function act(action: PowerAction) {
    void send({
      type: 'power',
      action,
      actionId: crypto.randomUUID(),
      expectedVersion: power.version,
    })
  }

  return (
    <div className="power-puzzle">
      <div className="puzzle-heading">
        <div>
          <p className="eyebrow">
            System 1 of 4 ·{' '}
            {power.role === 'equipment'
              ? 'Equipment operator'
              : 'Control room analyst'}
          </p>
          <h3 ref={heading} tabIndex={-1}>
            Restore the power.
          </h3>
        </div>
        <span className={`power-indicator ${power.status}`}>
          {restored ? 'Online' : tripped ? 'Tripped' : 'Offline'}
        </span>
      </div>
      {!partnerConnected && (
        <p className="notice" role="status">
          Your partner is reconnecting. Panel controls will resume when both of
          you are here.
        </p>
      )}
      <div
        className={`power-status ${power.status}`}
        role={tripped ? 'alert' : 'status'}
      >
        {restored
          ? 'Power restored. The airlock systems are back online.'
          : tripped
            ? 'Circuit tripped. Reset the panel and check the sequence with your partner.'
            : `${power.activated.length} of 3 circuits energized. ${power.activated.length ? 'Keep following the wiring sequence.' : 'Waiting for the first breaker.'}`}
      </div>
      <div className="puzzle-workspace">
        {power.role === 'equipment' ? (
          <>
            <div className="panel-instructions">
              <h4>Breaker panel</h4>
              <p>
                Your partner has the wiring diagram. Describe the symbols and
                follow their instructions. Leave each energized breaker on.
              </p>
            </div>
            <div
              className="breaker-grid"
              role="group"
              aria-label="Breaker switches"
            >
              {breakers.map((breaker) => {
                const on = power.activated.includes(breaker.id)
                return (
                  <button
                    key={breaker.id}
                    className={`breaker-switch ${on ? 'energized' : ''}`}
                    aria-label={`${breaker.label} breaker`}
                    aria-pressed={on}
                    disabled={
                      disabled ||
                      !partnerConnected ||
                      power.status !== 'active' ||
                      on
                    }
                    onClick={() =>
                      act({ type: 'breaker', breaker: breaker.id })
                    }
                  >
                    <span className="breaker-symbol" aria-hidden="true">
                      {breaker.symbol}
                    </span>
                    <strong>{breaker.label}</strong>
                    <span className="switch-track" aria-hidden="true">
                      <span />
                    </span>
                    <span className="switch-status">
                      {on ? (tripped ? 'Tripped' : 'Energized') : 'Off'}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              className="secondary reset-panel"
              disabled={disabled || !partnerConnected || restored}
              onClick={() => act({ type: 'reset' })}
            >
              Reset panel
            </button>
          </>
        ) : (
          <>
            <div className="panel-instructions">
              <h4>Wiring diagram</h4>
              <p>
                Your partner can operate the breakers. Talk them through the
                feed path, starting at the auxiliary supply.
              </p>
            </div>
            <div className="wiring-manual">
              <p className="eyebrow">Auxiliary supply → airlock bus</p>
              <ol className="wiring-path" aria-label="Safe activation order">
                {power.sequence.map((id) => {
                  const breaker = breakers.find((entry) => entry.id === id)!
                  return (
                    <li key={id}>
                      <span className="diagram-symbol" aria-hidden="true">
                        {breaker.symbol}
                      </span>
                      <strong>{breaker.label}</strong>
                      <span>
                        {power.activated.includes(id) && !tripped
                          ? 'Energized'
                          : 'Awaiting power'}
                      </span>
                    </li>
                  )
                })}
              </ol>
              <p className="manual-rule">
                Energize one breaker at a time in the direction of the feed. An
                incorrect step trips the safety relay. Ask the operator to reset
                before another attempt.
              </p>
              <p className="damage-warning">
                <strong>Damaged circuit — {breakerLabel(power.damaged)}</strong>
                <br />
                Keep this breaker off. It is isolated from the safe feed path.
              </p>
            </div>
          </>
        )}
      </div>
      {restored && (
        <div className="power-success" role="status">
          <h4>First system restored.</h4>
          <p>
            Power is back. Next, the control room operates the valves while the
            equipment room reads the gauges.
          </p>
          <button
            className="primary"
            disabled={disabled || !partnerConnected}
            onClick={() => void send({ type: 'continue' })}
          >
            Continue to airlock
          </button>
        </div>
      )}
    </div>
  )
}

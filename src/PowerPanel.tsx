import { useEffect, useRef } from 'react'
import { breakers } from '../shared/protocol'
import type { PowerAction, PowerView, Request } from '../shared/protocol'

interface Props {
  power: PowerView
  disabled: boolean
  partnerConnected: boolean
  send: (request: Request) => Promise<void>
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
        <div
          className={`power-lamp ${power.status}`}
          role="status"
          aria-label={`Power lamp: ${restored ? 'green, power restored' : tripped ? 'red, circuit tripped' : 'red, awaiting sequence'}`}
        >
          <span aria-hidden="true" />
          {restored
            ? 'Power restored'
            : tripped
              ? 'Tripped'
              : 'Awaiting sequence'}
        </div>
      </div>
      {!partnerConnected && (
        <p className="notice" role="status">
          Your partner is reconnecting. Panel controls will resume when both of
          you are here.
        </p>
      )}
      {tripped && (
        <p className="error" role="alert">
          Circuit tripped. Reset the panel and follow both procedures from the
          beginning.
        </p>
      )}
      <div className="puzzle-workspace">
        {power.role === 'equipment' ? (
          <>
            <div className="panel-instructions">
              <h4>Breaker panel</h4>
              <p>
                Your partner has the procedures. Raise and lower switches as
                directed. The lamp turns green when the complete sequence is
                correct.
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
                    aria-label={`${breaker.label} switch`}
                    aria-pressed={on}
                    disabled={
                      disabled || !partnerConnected || power.status !== 'active'
                    }
                    onClick={() =>
                      act({ type: 'breaker', breaker: breaker.id })
                    }
                  >
                    <span className="breaker-symbol" aria-hidden="true">
                      {breaker.symbol}
                    </span>
                    <span className="switch-track" aria-hidden="true">
                      <span />
                    </span>
                    <span className="switch-status">{on ? 'On' : 'Off'}</span>
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
              <h4>Power procedures</h4>
              <p>
                Start with every switch down. Read both blocks in order. Raise
                means on, lower means off. Follow repeated symbols each time
                they appear.
              </p>
            </div>
            <div
              className="power-procedures"
              aria-label="Power instruction blocks"
            >
              {power.instructions.map((block) => (
                <section
                  className="instruction-block"
                  key={block.title}
                  aria-label={block.title}
                >
                  <div className="instruction-heading">
                    <h5>{block.title}</h5>
                    <span
                      className={`instruction-lamp ${block.complete ? 'complete' : ''}`}
                      role="status"
                      aria-label={`${block.title}: ${block.complete ? 'complete' : 'pending'}`}
                      title={block.complete ? 'Complete' : 'Pending'}
                    >
                      {block.complete ? '✓' : ''}
                    </span>
                  </div>
                  <p>
                    {block.steps.map((step, index) => {
                      const breaker = breakers.find(
                        (entry) => entry.id === step.breaker,
                      )!
                      return (
                        <span key={index} className="instruction-step">
                          {step.on ? 'Raise' : 'Lower'}{' '}
                          <span role="img" aria-label={breaker.label}>
                            {breaker.symbol}
                          </span>
                          {index === block.steps.length - 1 ? '.' : ','}{' '}
                        </span>
                      )
                    })}
                  </p>
                </section>
              ))}
            </div>
            <p className="muted">
              An incorrect move trips the circuit. Ask your partner to reset and
              restart both blocks. Watch for the green lamp at completion.
            </p>
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
            onClick={() => void send({ type: 'continue', target: 'pressure' })}
          >
            Continue to airlock
          </button>
        </div>
      )}
    </div>
  )
}

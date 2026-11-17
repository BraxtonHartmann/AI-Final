import { useEffect, useRef, useState } from 'react'
import type { HatchAction, HatchView, Request, Role } from '../shared/protocol'

interface Props {
  hatch: HatchView
  disabled: boolean
  partnerConnected: boolean
  send: (request: Request) => Promise<void>
}

export function HatchPanel({ hatch, disabled, partnerConnected, send }: Props) {
  const [code, setCode] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const authorized = hatch.status === 'authorized'
  const locked = disabled || !partnerConnected
  useEffect(() => {
    heading.current?.focus()
  }, [hatch.status])
  function act(action: HatchAction) {
    void send({
      type: 'hatch',
      action,
      actionId: crypto.randomUUID(),
      expectedVersion: hatch.version,
    })
  }

  return (
    <div className="power-puzzle hatch-puzzle">
      <div className="puzzle-heading">
        <div>
          <p className="eyebrow">
            System 4 of 4 ·{' '}
            {hatch.role === 'control'
              ? 'Control room release console'
              : 'Equipment room maintenance panel'}
          </p>
          <h3 ref={heading} tabIndex={-1}>
            Release the hatch.
          </h3>
        </div>
        <span className={`power-indicator ${authorized ? 'restored' : ''}`}>
          {authorized ? 'Authorized' : 'Locked'}
        </span>
      </div>
      {!partnerConnected && (
        <p className="notice" role="status">
          Your partner is reconnecting. Their side must be armed again when they
          return.
        </p>
      )}
      <div
        className={`power-status ${hatch.status === 'rejected' ? 'tripped' : authorized ? 'restored' : ''}`}
        role={hatch.status === 'rejected' ? 'alert' : 'status'}
      >
        {authorized
          ? 'Code accepted. Each player must arm their own side, then Control can release the hatch.'
          : hatch.status === 'rejected'
            ? 'Code rejected. Check the symbol order with your partner and try again.'
            : 'Rescue is standing by. Decode the maintenance plate to authorize release.'}
      </div>
      <div className="puzzle-workspace">
        {hatch.role === 'equipment' ? (
          <>
            <div className="panel-instructions">
              <h4>Maintenance instructions</h4>
              <p>
                Read the plate from left to right. Use the legend to turn each
                symbol into a digit, then tell your partner the release code.
              </p>
            </div>
            <ol className="hatch-plate" aria-label="Hatch symbol order">
              {hatch.plate.map((id) => {
                const symbol = hatch.legend.find((row) => row.id === id)!
                return (
                  <li key={id}>
                    <span aria-hidden="true">{symbol.symbol}</span>
                    <strong>{symbol.label}</strong>
                  </li>
                )
              })}
            </ol>
            <div
              className="hatch-legend"
              role="group"
              aria-label="Symbol digit legend"
            >
              {hatch.legend.map((symbol) => (
                <div key={symbol.id}>
                  <span aria-hidden="true">{symbol.symbol}</span>
                  <p>
                    {symbol.label}
                    <strong>{symbol.digit}</strong>
                  </p>
                </div>
              ))}
            </div>
            <p className="muted">
              After the code is accepted, arm your Equipment side. Control will
              release the hatch when both sides are armed.
            </p>
          </>
        ) : (
          <>
            <div className="panel-instructions">
              <h4>Release keypad</h4>
              <p>
                Your partner has the symbol plate and maintenance legend. Enter
                their four-digit code, then authorize the release.
              </p>
            </div>
            {!authorized && (
              <form
                className="hatch-keypad"
                onSubmit={(event) => {
                  event.preventDefault()
                  act({ type: 'submit', code })
                }}
              >
                <label htmlFor="hatch-code">Release code</label>
                <input
                  id="hatch-code"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                    )
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  minLength={4}
                  placeholder="0000"
                  required
                  disabled={locked}
                />
                <div
                  className="keypad-digits"
                  role="group"
                  aria-label="Numeric keypad"
                >
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(
                    (digit) => (
                      <button
                        type="button"
                        className="secondary"
                        key={digit}
                        disabled={locked || code.length === 4}
                        onClick={() => setCode((current) => current + digit)}
                      >
                        {digit}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className="secondary"
                    disabled={locked || !code}
                    onClick={() => setCode('')}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={locked || !code}
                    onClick={() => setCode((current) => current.slice(0, -1))}
                    aria-label="Delete last digit"
                  >
                    ⌫
                  </button>
                </div>
                <button
                  className="primary"
                  disabled={locked || code.length !== 4}
                >
                  Authorize release
                </button>
              </form>
            )}
            <button
              className="text-button"
              disabled={locked}
              onClick={() => {
                setCode('')
                act({ type: 'reset' })
              }}
            >
              Reset keypad and arms
            </button>
          </>
        )}
      </div>
      <div className="hatch-arming">
        <h4>Release interlock</h4>
        <ul className="crew-list" aria-live="polite">
          {(['equipment', 'control'] as Role[]).map((role) => (
            <li key={role}>
              <span>
                {role === 'equipment' ? 'Equipment side' : 'Control side'}
              </span>
              <span>{hatch.armed[role] ? 'Armed' : 'Not armed'}</span>
            </li>
          ))}
        </ul>
        <div className="pressure-actions">
          <button
            className="secondary"
            disabled={locked || !authorized}
            onClick={() =>
              act({ type: 'arm', armed: !hatch.armed[hatch.role] })
            }
          >
            {hatch.armed[hatch.role] ? 'Disarm' : 'Arm'}{' '}
            {hatch.role === 'equipment' ? 'Equipment' : 'Control'} side
          </button>
          {hatch.role === 'control' && (
            <button
              className="primary"
              disabled={
                locked ||
                !authorized ||
                !hatch.armed.equipment ||
                !hatch.armed.control
              }
              onClick={() => act({ type: 'release' })}
            >
              Release hatch
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

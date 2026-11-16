import { useEffect, useRef } from 'react'
import { valves } from '../shared/protocol'
import type { PressureAction, PressureView, Request } from '../shared/protocol'

interface Props {
  pressure: PressureView
  disabled: boolean
  partnerConnected: boolean
  send: (request: Request) => Promise<void>
}

export function PressurePanel({
  pressure,
  disabled,
  partnerConnected,
  send,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [pressure.status])
  const drained = pressure.status === 'drained'
  const locked = disabled || !partnerConnected || drained
  function act(action: PressureAction) {
    void send({
      type: 'pressure',
      action,
      actionId: crypto.randomUUID(),
      expectedVersion: pressure.version,
    })
  }

  return (
    <div className="power-puzzle pressure-puzzle">
      <div className="puzzle-heading">
        <div>
          <p className="eyebrow">
            System 2 of 4 ·{' '}
            {pressure.role === 'control'
              ? 'Control room valves'
              : 'Equipment room gauges'}
          </p>
          <h3 ref={heading} tabIndex={-1}>
            Drain the airlock.
          </h3>
        </div>
        <span className={`power-indicator ${drained ? 'restored' : ''}`}>
          {drained ? 'Drained' : 'Sealed'}
        </span>
      </div>
      {!partnerConnected && (
        <p className="notice" role="status">
          Your partner is reconnecting. Valve controls will resume when both of
          you are here.
        </p>
      )}
      <div
        className={`power-status ${drained ? 'restored' : ''}`}
        role="status"
      >
        {drained
          ? 'Airlock drained. The passage to the transmitter is clear.'
          : 'Balance both chambers before starting the drain pump.'}
      </div>
      <div className="puzzle-workspace">
        {pressure.role === 'control' ? (
          <>
            <div className="panel-instructions">
              <h4>Valve controls</h4>
              <p>
                It's your turn to operate. Your partner has the gauges. Each
                valve affects both chambers. Tell them what you change and ask
                how the pressure responds.
              </p>
            </div>
            <div
              className="valve-grid"
              role="group"
              aria-label="Pressure valves"
            >
              {valves.map((valve) => {
                const open = pressure.valves[valve.id]
                return (
                  <button
                    key={valve.id}
                    className={`valve-control ${open ? 'open' : ''}`}
                    aria-label={`${valve.label} valve`}
                    aria-pressed={open}
                    disabled={locked}
                    onClick={() =>
                      act({ type: 'valve', valve: valve.id, open: !open })
                    }
                  >
                    <span className="valve-wheel" aria-hidden="true">
                      <span />
                    </span>
                    <strong>{valve.label}</strong>
                    <span>{open ? 'Open' : 'Closed'}</span>
                  </button>
                )
              })}
            </div>
            <div className="pressure-actions">
              <button
                className="secondary"
                disabled={locked}
                onClick={() => act({ type: 'reset' })}
              >
                Reset valves
              </button>
              <button
                className="primary"
                disabled={locked}
                onClick={() => act({ type: 'pump' })}
              >
                Start drain pump
              </button>
            </div>
            <p className="field-help">
              The pump has a safety interlock. Ask your partner to confirm both
              chambers are ready.
            </p>
          </>
        ) : (
          <>
            <div className="panel-instructions">
              <h4>Pressure gauges</h4>
              <p>
                It's your turn to guide. Your partner operates the valves. Read
                out both pressures after each change, then tell them when it is
                safe to start the pump.
              </p>
              <p id="safe-pressure">
                Safe range for both chambers —{' '}
                <strong>
                  {pressure.safeRange[0]}–{pressure.safeRange[1]} kPa
                </strong>
                .
              </p>
            </div>
            <div className="gauge-grid" aria-live="polite" aria-atomic="true">
              {pressure.readings.map((reading, index) => {
                const condition =
                  reading < pressure.safeRange[0]
                    ? 'Below safe range'
                    : reading > pressure.safeRange[1]
                      ? 'Above safe range'
                      : 'In safe range'
                const label = index === 0 ? 'Chamber A' : 'Chamber B'
                return (
                  <div
                    className={`pressure-gauge ${condition === 'In safe range' ? 'safe' : ''}`}
                    key={label}
                  >
                    <label htmlFor={`gauge-${index}`}>{label}</label>
                    <p className="gauge-reading">
                      {reading}
                      <span> kPa</span>
                    </p>
                    <meter
                      id={`gauge-${index}`}
                      min={0}
                      max={100}
                      low={pressure.safeRange[0]}
                      high={pressure.safeRange[1]}
                      optimum={50}
                      value={reading}
                      aria-valuetext={`${reading} kPa. ${condition}.`}
                      aria-describedby="safe-pressure"
                    />
                    <div className="gauge-scale" aria-hidden="true">
                      <span>0</span>
                      <span>50</span>
                      <span>100 kPa</span>
                    </div>
                    <p className="gauge-condition">{condition}</p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      {drained && (
        <div className="power-success" role="status">
          <h4>Second system restored.</h4>
          <p>
            The airlock is ready. Equipment operates the radio next, while
            Control reads the transmission chart.
          </p>
          <button
            className="primary"
            disabled={disabled || !partnerConnected}
            onClick={() =>
              void send({ type: 'continue', target: 'transmitter' })
            }
          >
            Continue to transmitter
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { antennaBearings, radioFrequencies } from '../shared/protocol'
import type {
  RadioSettings,
  Request,
  TransmitterAction,
  TransmitterView,
} from '../shared/protocol'

interface Props {
  transmitter: TransmitterView
  disabled: boolean
  partnerConnected: boolean
  send: (request: Request) => Promise<void>
}

export function TransmitterPanel({
  transmitter,
  disabled,
  partnerConnected,
  send,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [transmitter.version])
  const sent = transmitter.status === 'sent'
  const unanswered = transmitter.status === 'unanswered'
  const locked = disabled || !partnerConnected || sent
  function act(action: TransmitterAction) {
    void send({
      type: 'transmitter',
      action,
      actionId: crypto.randomUUID(),
      expectedVersion: transmitter.version,
    })
  }

  return (
    <div className="power-puzzle transmitter-puzzle">
      <div className="puzzle-heading">
        <div>
          <p className="eyebrow">
            System 3 of 4 ·{' '}
            {transmitter.role === 'equipment'
              ? 'Equipment room radio'
              : 'Control room chart'}
          </p>
          <h3 ref={heading} tabIndex={-1}>
            Send a distress signal.
          </h3>
        </div>
        <span className={`power-indicator ${sent ? 'restored' : ''}`}>
          {sent ? 'Acknowledged' : 'Standby'}
        </span>
      </div>
      {!partnerConnected && (
        <p className="notice" role="status">
          Your partner is reconnecting. Radio controls will resume when both of
          you are here.
        </p>
      )}
      <div
        className={`power-status ${sent ? 'restored' : unanswered ? 'tripped' : ''}`}
        role={unanswered ? 'alert' : 'status'}
      >
        {sent
          ? 'Rescue acknowledged your signal. Hatch preparation is authorized.'
          : unanswered
            ? 'No acknowledgment. Check the applied settings with your partner and try again.'
            : 'The transmitter is powered. Coordinate with your partner to reach rescue.'}
      </div>
      <div className="puzzle-workspace">
        {transmitter.role === 'equipment' ? (
          <>
            <div className="panel-instructions">
              <h4>Radio controls</h4>
              <p>
                Your partner has the transmission chart. Set all three values,
                apply them, then transmit. Only applied settings are saved when
                you refresh.
              </p>
            </div>
            <form
              key={transmitter.version}
              className="radio-controls"
              onSubmit={(event) => {
                event.preventDefault()
                const fields = new FormData(event.currentTarget)
                act({
                  type: 'tune',
                  settings: {
                    frequencyKHz: Number(
                      fields.get('frequency'),
                    ) as RadioSettings['frequencyKHz'],
                    bearing: String(
                      fields.get('bearing'),
                    ) as RadioSettings['bearing'],
                    code: String(fields.get('code')),
                  },
                })
              }}
            >
              <div className="radio-fields">
                <div>
                  <label htmlFor="radio-frequency">Frequency</label>
                  <select
                    id="radio-frequency"
                    name="frequency"
                    defaultValue={transmitter.settings.frequencyKHz}
                    disabled={locked}
                  >
                    {radioFrequencies.map((frequency) => (
                      <option key={frequency} value={frequency}>
                        {(frequency / 1000).toFixed(1)} MHz
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="radio-bearing">Antenna direction</label>
                  <select
                    id="radio-bearing"
                    name="bearing"
                    defaultValue={transmitter.settings.bearing}
                    disabled={locked}
                  >
                    {antennaBearings.map((bearing) => (
                      <option key={bearing} value={bearing}>
                        {bearing[0].toUpperCase() + bearing.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="radio-code">Signal code</label>
                  <input
                    id="radio-code"
                    name="code"
                    defaultValue={transmitter.settings.code}
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={4}
                    minLength={4}
                    pattern="[0-9]{4}"
                    placeholder="0000"
                    required
                    disabled={locked}
                    aria-describedby="radio-code-help"
                  />
                </div>
              </div>
              <p className="field-help" id="radio-code-help">
                Use the four-digit code from your partner's chart.
              </p>
              <button className="secondary" disabled={locked}>
                Apply settings
              </button>
            </form>
            <div className="applied-radio" aria-label="Applied radio settings">
              <p className="eyebrow">Applied settings</p>
              <dl>
                <div>
                  <dt>Frequency</dt>
                  <dd>
                    {(transmitter.settings.frequencyKHz / 1000).toFixed(1)} MHz
                  </dd>
                </div>
                <div>
                  <dt>Antenna</dt>
                  <dd>{transmitter.settings.bearing}</dd>
                </div>
                <div>
                  <dt>Signal code</dt>
                  <dd>{transmitter.settings.code || 'Not set'}</dd>
                </div>
              </dl>
            </div>
            <div className="pressure-actions">
              <button
                className="secondary"
                disabled={locked}
                onClick={() => act({ type: 'reset' })}
              >
                Reset radio
              </button>
              <button
                className="primary"
                disabled={locked}
                onClick={() => act({ type: 'transmit' })}
              >
                Transmit applied settings
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="panel-instructions">
              <h4>Transmission chart</h4>
              <p>
                Your partner operates the radio. Use the{' '}
                <strong>{transmitter.targetService}</strong> service for station
                evacuation. Read out the matching frequency, antenna direction,
                and signal code.
              </p>
            </div>
            <div className="transmission-chart">
              {transmitter.chart.map((row) => (
                <section
                  className="channel-card"
                  key={row.service}
                  aria-label={`${row.service} channel`}
                >
                  <h5>{row.service}</h5>
                  <dl>
                    <div>
                      <dt>Frequency</dt>
                      <dd>
                        {(row.settings.frequencyKHz / 1000).toFixed(1)} MHz
                      </dd>
                    </div>
                    <div>
                      <dt>Antenna direction</dt>
                      <dd>{row.settings.bearing}</dd>
                    </div>
                    <div>
                      <dt>Signal code</dt>
                      <dd className="channel-code">{row.settings.code}</dd>
                    </div>
                  </dl>
                </section>
              ))}
            </div>
            <p className="muted">
              Wait for the acknowledgment before moving to the hatch. If there
              is no response, confirm all three applied values with your
              partner.
            </p>
          </>
        )}
      </div>
      {sent && (
        <div className="power-success" role="status">
          <h4>Third system restored.</h4>
          <p>
            Rescue has your location. Control operates the hatch keypad next,
            while Equipment reads the maintenance instructions.
          </p>
          <button
            className="primary"
            disabled={disabled || !partnerConnected}
            onClick={() => void send({ type: 'continue', target: 'hatch' })}
          >
            Continue to hatch
          </button>
        </div>
      )}
    </div>
  )
}

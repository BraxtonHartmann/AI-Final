import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  initialTransmitter,
  applyTransmitterAction,
  transmitterView,
} from '../server/transmitter.ts'

const rescue = {
  frequencyKHz: 5600 as const,
  bearing: 'west' as const,
  code: '7314',
}

test('rescue settings are required before a transmission receives acknowledgment', () => {
  const initial = initialTransmitter()
  assert.equal(
    applyTransmitterAction(initial, { type: 'transmit' }).status,
    'unanswered',
  )
  for (const settings of [
    { ...rescue, frequencyKHz: 4200 as const },
    { ...rescue, bearing: 'north' as const },
    { ...rescue, code: '7315' },
  ]) {
    const tuned = applyTransmitterAction(initial, { type: 'tune', settings })
    assert.equal(
      applyTransmitterAction(tuned, { type: 'transmit' }).status,
      'unanswered',
    )
  }
  const tuned = applyTransmitterAction(initial, {
    type: 'tune',
    settings: rescue,
  })
  const sent = applyTransmitterAction(tuned, { type: 'transmit' })
  assert.equal(sent.status, 'sent')
  assert.equal(sent.version, 2)
  assert.throws(
    () => applyTransmitterAction(sent, { type: 'reset' }),
    /acknowledged/,
  )
})

test('failed attempts can be retuned or reset without mutating earlier state', () => {
  const initial = initialTransmitter()
  const failed = applyTransmitterAction(initial, { type: 'transmit' })
  const tuned = applyTransmitterAction(failed, {
    type: 'tune',
    settings: rescue,
  })
  assert.equal(tuned.status, 'active')
  assert.deepEqual(initial.settings, {
    frequencyKHz: 4200,
    bearing: 'north',
    code: '',
  })
  const reset = applyTransmitterAction(tuned, { type: 'reset' })
  assert.deepEqual(reset.settings, initial.settings)
  assert.equal(reset.version, tuned.version + 1)
})

test('only Control receives the chart, and only Equipment receives applied settings', () => {
  const state = initialTransmitter()
  const equipment = transmitterView(state, 'equipment')
  const control = transmitterView(state, 'control')
  assert.ok(
    equipment.role === 'equipment' &&
      !('chart' in equipment) &&
      !('targetService' in equipment),
  )
  assert.ok(control.role === 'control' && !('settings' in control))
  assert.equal(control.targetService, 'Rescue')
  assert.deepEqual(
    control.chart.find((row) => row.service === 'Rescue')?.settings,
    rescue,
  )
})

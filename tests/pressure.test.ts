import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  initialPressure,
  applyPressureAction,
  pressureReadings,
  pressureView,
} from '../server/pressure.ts'

test('opening Intake and Bypass balances both chambers and enables pumping', () => {
  let state = initialPressure()
  assert.deepEqual(pressureReadings(state), [80, 20])
  assert.throws(() => applyPressureAction(state, { type: 'pump' }), /safe/)
  state = applyPressureAction(state, {
    type: 'valve',
    valve: 'intake',
    open: true,
  })
  assert.deepEqual(pressureReadings(state), [60, 30])
  state = applyPressureAction(state, {
    type: 'valve',
    valve: 'bypass',
    open: true,
  })
  assert.deepEqual(pressureReadings(state), [50, 50])
  state = applyPressureAction(state, { type: 'pump' })
  assert.equal(state.status, 'drained')
  assert.throws(() => applyPressureAction(state, { type: 'reset' }), /drained/)
})

test('all valve configurations are bounded, reversible, and only the solution can pump', () => {
  const valves = ['intake', 'bypass', 'return'] as const
  for (let mask = 0; mask < 8; mask++) {
    let state = initialPressure()
    for (let i = 0; i < valves.length; i++) {
      state = applyPressureAction(state, {
        type: 'valve',
        valve: valves[i],
        open: Boolean(mask & (1 << i)),
      })
    }
    for (const reading of pressureReadings(state))
      assert.ok(reading >= 0 && reading <= 100)
    if (mask === 3)
      assert.equal(
        applyPressureAction(state, { type: 'pump' }).status,
        'drained',
      )
    else
      assert.throws(() => applyPressureAction(state, { type: 'pump' }), /safe/)
    for (const valve of valves)
      state = applyPressureAction(state, { type: 'valve', valve, open: false })
    assert.deepEqual(pressureReadings(state), [80, 20])
    const reset = applyPressureAction(state, { type: 'reset' })
    assert.equal(reset.version, state.version + 1)
    assert.deepEqual(reset.valves, initialPressure().valves)
  }
})

test('pressure roles keep controls and numerical readings private', () => {
  const state = initialPressure()
  const controls = pressureView(state, 'control')
  const gauges = pressureView(state, 'equipment')
  assert.ok(
    controls.role === 'control' &&
      'valves' in controls &&
      !('readings' in controls) &&
      !('safeRange' in controls),
  )
  assert.ok(
    gauges.role === 'equipment' &&
      'readings' in gauges &&
      !('valves' in gauges),
  )
  assert.deepEqual(gauges.safeRange, [45, 55])
})

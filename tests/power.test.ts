import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialPower, applyPowerAction } from '../server/power.ts'

const activate = (breaker: 'tide' | 'anchor' | 'beacon' | 'coil') => ({
  type: 'breaker' as const,
  breaker,
})

test('power requires Tide, Anchor, then Beacon and cannot change after restoration', () => {
  let state = initialPower()
  for (const breaker of ['tide', 'anchor', 'beacon'] as const)
    state = applyPowerAction(state, activate(breaker))
  assert.equal(state.status, 'restored')
  assert.deepEqual(state.activated, ['tide', 'anchor', 'beacon'])
  assert.throws(() => applyPowerAction(state, { type: 'reset' }), /restored/)
})

test('wrong order or damaged breaker trips panel until an explicit reset', () => {
  for (const breaker of ['anchor', 'beacon', 'coil'] as const) {
    const tripped = applyPowerAction(initialPower(), activate(breaker))
    assert.equal(tripped.status, 'tripped')
    assert.throws(() => applyPowerAction(tripped, activate('tide')), /Reset/)
    const reset = applyPowerAction(tripped, { type: 'reset' })
    assert.equal(reset.status, 'active')
    assert.deepEqual(reset.activated, [])
    assert.equal(reset.version, 2)
  }
})

test('repeated breaker input trips and reset clears partial progress', () => {
  const first = applyPowerAction(initialPower(), activate('tide'))
  assert.equal(applyPowerAction(first, activate('tide')).status, 'tripped')
  const reset = applyPowerAction(first, { type: 'reset' })
  assert.deepEqual(reset.activated, [])
  assert.deepEqual(first.activated, ['tide'])
})

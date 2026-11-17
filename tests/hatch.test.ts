import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialHatch, applyHatchAction, hatchView } from '../server/hatch.ts'

test('the hatch requires the correct code, both arms, and Control release', () => {
  let state = initialHatch()
  assert.throws(
    () => applyHatchAction(state, { type: 'release' }, 'control'),
    /authorize/,
  )
  assert.throws(
    () => applyHatchAction(state, { type: 'arm', armed: true }, 'equipment'),
    /authorize/,
  )
  state = applyHatchAction(state, { type: 'submit', code: '0000' }, 'control')
  assert.equal(state.status, 'rejected')
  state = applyHatchAction(state, { type: 'submit', code: '4826' }, 'control')
  assert.equal(state.status, 'authorized')
  state = applyHatchAction(state, { type: 'arm', armed: true }, 'equipment')
  assert.throws(
    () => applyHatchAction(state, { type: 'release' }, 'control'),
    /Both/,
  )
  state = applyHatchAction(state, { type: 'arm', armed: true }, 'control')
  assert.throws(
    () => applyHatchAction(state, { type: 'release' }, 'equipment'),
    /Only/,
  )
  state = applyHatchAction(state, { type: 'release' }, 'control')
  assert.equal(state.status, 'open')
  assert.throws(
    () => applyHatchAction(state, { type: 'reset' }, 'control'),
    /open/,
  )
})

test('only Control enters or resets the code and reset clears authorization and both arms', () => {
  const initial = initialHatch()
  assert.throws(
    () =>
      applyHatchAction(initial, { type: 'submit', code: '4826' }, 'equipment'),
    /Only/,
  )
  let state = applyHatchAction(
    initial,
    { type: 'submit', code: '4826' },
    'control',
  )
  state = applyHatchAction(state, { type: 'arm', armed: true }, 'equipment')
  state = applyHatchAction(state, { type: 'arm', armed: false }, 'equipment')
  assert.deepEqual(state.armed, { equipment: false, control: false })
  state = applyHatchAction(state, { type: 'reset' }, 'control')
  assert.equal(state.status, 'locked')
  assert.deepEqual(initial.armed, { equipment: false, control: false })
})

test('only Equipment receives the symbol plate and maintenance legend', () => {
  const equipment = hatchView(initialHatch(), 'equipment')
  const control = hatchView(initialHatch(), 'control')
  assert.ok(equipment.role === 'equipment')
  assert.deepEqual(
    equipment.plate.map(
      (id) => equipment.legend.find((row) => row.id === id)?.digit,
    ),
    ['4', '8', '2', '6'],
  )
  assert.ok(!('plate' in control) && !('legend' in control))
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  initialPower,
  applyPowerAction,
  powerView,
  nextPowerPath,
} from '../server/power.ts'
import { breakers } from '../shared/protocol.ts'
import { powerProcedure } from './helpers/power.ts'

test('twelve toggles across two instruction blocks automatically restore power', () => {
  let state = initialPower()
  for (const [index, breaker] of powerProcedure.entries()) {
    state = applyPowerAction(state, { type: 'breaker', breaker })
    assert.equal(
      state.status,
      index === powerProcedure.length - 1 ? 'restored' : 'active',
    )
    if (index === 2) assert.equal(state.activated.includes('beacon'), false)
    if (index === 8) assert.equal(state.activated.includes('beacon'), true)
  }
  assert.deepEqual([...state.activated].sort(), [
    'beacon',
    'diamond',
    'square',
    'tide',
  ])
  assert.throws(() => applyPowerAction(state, { type: 'reset' }), /restored/)
})

test('wrong switches and wrong repeated toggles trip until a full reset', () => {
  assert.equal(breakers.length, 8)
  for (const breaker of breakers.filter((entry) => entry.id !== 'beacon')) {
    const tripped = applyPowerAction(initialPower(), {
      type: 'breaker',
      breaker: breaker.id,
    })
    assert.equal(tripped.status, 'tripped')
    assert.throws(
      () => applyPowerAction(tripped, { type: 'breaker', breaker: 'beacon' }),
      /Reset/,
    )
    assert.deepEqual(applyPowerAction(tripped, { type: 'reset' }).activated, [])
  }
  const first = applyPowerAction(initialPower(), {
    type: 'breaker',
    breaker: 'beacon',
  })
  assert.equal(
    applyPowerAction(first, { type: 'breaker', breaker: 'beacon' }).status,
    'tripped',
  )
  assert.equal(first.activated.includes('beacon'), true)
})

test('the two static instruction blocks and sequence progress stay private to their intended views', () => {
  const state = applyPowerAction(initialPower(), {
    type: 'breaker',
    breaker: 'beacon',
  })
  const operator = powerView(state, 'equipment')
  const analyst = powerView(state, 'control')
  assert.ok(analyst.role === 'control')
  assert.equal(analyst.instructions.length, 2)
  assert.deepEqual(
    analyst.instructions.flatMap((block) =>
      block.steps.map((step) => step.breaker),
    ),
    powerProcedure,
  )
  assert.equal(
    analyst.instructions
      .flatMap((block) => block.steps)
      .filter((step) => !step.on).length,
    4,
  )
  assert.equal('instructions' in operator, false)
  assert.equal('progress' in operator, false)
  assert.equal('progress' in analyst, false)
})

test('analyst block lights complete at their boundaries and clear after a trip or reset', () => {
  let state = initialPower()
  function lights() {
    const view = powerView(state, 'control')
    assert.ok(view.role === 'control')
    return view.instructions.map((block) => block.complete)
  }
  assert.deepEqual(lights(), [false, false])
  for (const breaker of powerProcedure.slice(0, 6))
    state = applyPowerAction(state, { type: 'breaker', breaker })
  assert.deepEqual(lights(), [true, false])
  const halfway = state
  state = applyPowerAction(state, { type: 'breaker', breaker: 'star' })
  assert.deepEqual(lights(), [false, false])
  state = applyPowerAction(state, { type: 'reset' })
  assert.deepEqual(lights(), [false, false])
  state = halfway
  for (const breaker of powerProcedure.slice(6))
    state = applyPowerAction(state, { type: 'breaker', breaker })
  assert.deepEqual(lights(), [true, true])
  assert.equal('instructions' in powerView(state, 'equipment'), false)
})

test('six distinct power paths are solvable, stable on reset, and keep their identity private', () => {
  const paths = new Set<string>()
  for (let path = 0; path < 6; path++) {
    let state = initialPower(path)
    const view = powerView(state, 'control')
    assert.ok(view.role === 'control')
    const steps = view.instructions.flatMap((block) => block.steps)
    paths.add(JSON.stringify(steps))
    const reset = applyPowerAction(state, { type: 'reset' })
    assert.equal(reset.path, path)
    assert.equal('path' in powerView(state, 'equipment'), false)
    for (const step of steps) {
      assert.notEqual(state.activated.includes(step.breaker), step.on)
      state = applyPowerAction(state, {
        type: 'breaker',
        breaker: step.breaker,
      })
    }
    assert.equal(state.status, 'restored')
  }
  assert.equal(paths.size, 6)
})

test('next power selection always differs from the preceding run', () => {
  for (let previous = 0; previous < 6; previous++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const next = nextPowerPath(previous)
      assert.ok(next >= 0 && next < 6)
      assert.notEqual(next, previous)
    }
  }
})

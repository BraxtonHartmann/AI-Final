import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Lobby } from '../server/lobby.ts'

function crew() {
  const lobby = new Lobby()
  const equipment = lobby.create('equipment')
  const control = lobby.join('control', equipment.room.code)
  lobby.role('equipment', 'equipment')
  lobby.role('control', 'control')
  lobby.ready('equipment', true)
  lobby.ready('control', true)
  lobby.start('equipment')
  return { lobby, equipment, control }
}

function restorePower(lobby: Lobby) {
  for (const [version, breaker] of (
    ['tide', 'anchor', 'beacon'] as const
  ).entries()) {
    lobby.power(
      'equipment',
      { type: 'breaker', breaker },
      `power-${version}`,
      version,
    )
  }
}

test('pressure follows power, reverses operating roles, and filters each view', () => {
  const { lobby, equipment } = crew()
  assert.throws(() => lobby.continue('equipment'), /Restore/)
  assert.throws(
    () => lobby.pressure('control', { type: 'pump' }, 'early', 0),
    /not active/,
  )
  restorePower(lobby)
  assert.equal(lobby.continue('control').phase, 'pressure')
  const current = lobby.continue('equipment')
  assert.equal(current.pressure?.version, 0)
  assert.equal(current.power, undefined)
  assert.equal(lobby.view(equipment.room.code).pressure, undefined)
  const controls = lobby.view(equipment.room.code, 'control').pressure
  assert.ok(
    controls?.role === 'control' &&
      !('readings' in controls) &&
      !('safeRange' in controls),
  )
  assert.ok(
    current.pressure?.role === 'equipment' && !('valves' in current.pressure),
  )
  assert.throws(
    () => lobby.pressure('equipment', { type: 'pump' }, 'denied', 0),
    /Only/,
  )
  assert.throws(
    () => lobby.power('equipment', { type: 'reset' }, 'reset-old', 3),
    /restored/,
  )
  // A late accepted power request returns the current role-specific pressure view.
  const oldRetry = lobby.power(
    'equipment',
    { type: 'breaker', breaker: 'tide' },
    'power-0',
    0,
  )
  assert.equal(oldRetry.power, undefined)
  assert.equal(oldRetry.pressure?.role, 'equipment')
})

test('pressure deduplication, resets, disconnects, completion, and leave preserve a consistent run', () => {
  const { lobby, equipment, control } = crew()
  restorePower(lobby)
  lobby.continue('equipment')
  assert.throws(
    () => lobby.pressure('control', { type: 'pump' }, 'unsafe', 0),
    /safe/,
  )
  const action = {
    type: 'valve' as const,
    valve: 'intake' as const,
    open: true,
  }
  const moved = lobby.pressure('control', action, 'first', 0)
  assert.equal(
    lobby.pressure('control', action, 'first', 0).revision,
    moved.revision,
  )
  assert.throws(
    () => lobby.pressure('control', { type: 'reset' }, 'first', 0),
    /different/,
  )
  assert.throws(
    () => lobby.pressure('control', { type: 'reset' }, 'stale', 0),
    /changed/,
  )
  lobby.pressure('control', { type: 'reset' }, 'reset', 1)
  const retryAfterReset = lobby.pressure('control', action, 'first', 0)
  assert.ok(retryAfterReset.pressure?.role === 'control')
  assert.equal(retryAfterReset.pressure.valves.intake, false)
  lobby.disconnect('equipment')
  assert.throws(
    () => lobby.pressure('control', action, 'paused', 2),
    /reconnect/,
  )
  const returned = lobby.resume(
    'equipment-returned',
    equipment.room.code,
    equipment.session.token,
  )
  assert.ok(returned.room.pressure?.role === 'equipment')
  assert.deepEqual(returned.room.pressure.readings, [80, 20])
  lobby.pressure('control', action, 'intake', 2)
  lobby.disconnect('control')
  const restored = lobby.resume(
    'control-returned',
    control.room.code,
    control.session.token,
  )
  assert.ok(
    restored.room.pressure?.role === 'control' &&
      restored.room.pressure.valves.intake,
  )
  lobby.pressure(
    'control-returned',
    { type: 'valve', valve: 'bypass', open: true },
    'bypass',
    3,
  )
  const complete = lobby.pressure(
    'control-returned',
    { type: 'pump' },
    'pump',
    4,
  )
  assert.equal(complete.phase, 'pressure-complete')
  assert.equal(
    lobby.pressure('control-returned', { type: 'pump' }, 'pump', 4).phase,
    'pressure-complete',
  )
  assert.equal(lobby.continue('equipment-returned').phase, 'pressure-complete')
  assert.throws(
    () => lobby.pressure('control-returned', { type: 'reset' }, 'done', 5),
    /drained/,
  )
  lobby.leave('control-returned')
  assert.equal(
    lobby.view(equipment.room.code, 'equipment-returned').pressure,
    undefined,
  )
})

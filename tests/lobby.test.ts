import { powerProcedure } from './helpers/power.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Lobby } from '../server/lobby.ts'

test('room capacity, role ownership, readiness, and start gates', () => {
  const lobby = new Lobby(Date.now, false, () => 0)
  const first = lobby.create('one')
  const second = lobby.join('two', first.session.code)
  assert.throws(() => lobby.join('three', first.session.code), /full/)
  assert.throws(() => lobby.start('one'), /ready/)
  lobby.role('one', 'equipment')
  assert.throws(() => lobby.role('two', 'equipment'), /taken/)
  lobby.role('two', 'control')
  lobby.ready('one', true)
  lobby.ready('two', true)
  assert.equal(lobby.start('two').phase, 'power')
  assert.equal(lobby.start('one').phase, 'power')
  assert.throws(() => lobby.role('one', 'control'), /started/)
  assert.equal(second.room.players.length, 2)
})

test('private credentials restore a seat and disconnect resets readiness', () => {
  const lobby = new Lobby(Date.now, false, () => 0)
  const first = lobby.create('one')
  lobby.join('two', first.session.code)
  lobby.role('one', 'equipment')
  lobby.ready('one', true)
  lobby.disconnect('one')
  assert.throws(
    () => lobby.resume('bad', first.session.code, 'wrong'),
    /expired/,
  )
  const restored = lobby.resume('new', first.session.code, first.session.token)
  const player = restored.room.players.find(
    (entry) => entry.id === first.session.playerId,
  )
  assert.deepEqual(player, {
    id: first.session.playerId,
    role: 'equipment',
    ready: false,
    connected: true,
  })
  assert.throws(() => lobby.role('one', 'control'), /Join/)
  assert.equal(
    JSON.stringify(restored.room).includes(first.session.token),
    false,
  )
})

test('role changes invalidate readiness and rooms remain isolated', () => {
  const lobby = new Lobby(Date.now, false, () => 0)
  const a = lobby.create('a')
  const b = lobby.create('b')
  lobby.role('a', 'equipment')
  lobby.ready('a', true)
  assert.equal(lobby.role('a', 'control').players[0].ready, false)
  assert.equal(lobby.view(b.room.code).players[0].role, null)
  assert.throws(() => lobby.join('a', b.room.code), /already/)
  assert.equal(lobby.leave('a'), a.room.code)
  assert.throws(() => lobby.view(a.room.code), /expired/)
})

test('expired seats free capacity and inactive rooms expire', () => {
  let now = 0
  const lobby = new Lobby(() => now)
  const first = lobby.create('one')
  lobby.join('two', first.room.code)
  lobby.disconnect('one')
  now = 5 * 60_000 + 1
  lobby.sweep()
  assert.equal(lobby.join('three', first.room.code).room.players.length, 2)
  assert.throws(
    () => lobby.resume('four', first.room.code, first.session.token),
    /expired/,
  )
  now += 30 * 60_000 + 1
  const removed = lobby.sweep()
  assert.deepEqual(removed, ['two', 'three'])
})

test('puzzle views protect instructions, authorize moves, and deduplicate across reconnect', () => {
  const lobby = new Lobby(Date.now, false, () => 0)
  const created = lobby.create('operator')
  const analystSession = lobby.join('analyst', created.room.code).session
  lobby.role('operator', 'equipment')
  lobby.role('analyst', 'control')
  assert.throws(
    () => lobby.power('operator', { type: 'reset' }, 'early', 0),
    /Start/,
  )
  lobby.ready('operator', true)
  lobby.ready('analyst', true)
  const started = lobby.start('operator')
  assert.ok(
    started.power &&
      !('instructions' in started.power) &&
      !('damaged' in started.power),
  )
  const analyst = lobby.view(created.room.code, 'analyst').power
  assert.ok(analyst?.role === 'control')
  assert.deepEqual(
    analyst.instructions.flatMap((block) =>
      block.steps.map((step) => step.breaker),
    ),
    powerProcedure,
  )
  assert.equal(lobby.view(created.room.code).power, undefined)
  assert.throws(
    () => lobby.power('analyst', { type: 'reset' }, 'denied', 0),
    /Only/,
  )
  const first = lobby.power(
    'operator',
    { type: 'breaker', breaker: 'beacon' },
    'first',
    0,
  )
  const repeated = lobby.power(
    'operator',
    { type: 'breaker', breaker: 'beacon' },
    'first',
    0,
  )
  assert.equal(first.revision, repeated.revision)
  assert.deepEqual(repeated.power?.activated, ['beacon'])
  lobby.disconnect('analyst')
  assert.throws(
    () =>
      lobby.power(
        'operator',
        { type: 'breaker', breaker: 'anchor' },
        'paused',
        1,
      ),
    /reconnect/,
  )
  lobby.resume('analyst-returned', created.room.code, analystSession.token)
  assert.throws(
    () => lobby.power('operator', { type: 'reset' }, 'first', 0),
    /different/,
  )
  assert.throws(
    () => lobby.power('operator', { type: 'reset' }, 'stale', 0),
    /changed/,
  )
  lobby.disconnect('operator')
  const restored = lobby.resume(
    'returned',
    created.room.code,
    created.session.token,
  )
  assert.deepEqual(restored.room.power?.activated, ['beacon'])
  assert.deepEqual(
    lobby.power('returned', { type: 'breaker', breaker: 'beacon' }, 'first', 0)
      .power?.activated,
    ['beacon'],
  )
  for (const [index, breaker] of powerProcedure.entries()) {
    if (index > 0)
      lobby.power(
        'returned',
        { type: 'breaker', breaker },
        `remaining-${index}`,
        index,
      )
  }
  const complete = lobby.view(created.room.code, 'returned')
  assert.equal(complete.phase, 'power-complete')
  assert.throws(
    () =>
      lobby.power('returned', { type: 'reset' }, 'late', powerProcedure.length),
    /restored/,
  )
  lobby.leave('returned')
  assert.equal(lobby.view(created.room.code, 'analyst').power, undefined)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Lobby } from '../server/lobby.ts'

test('room capacity, role ownership, readiness, and start gates', () => {
  const lobby = new Lobby()
  const first = lobby.create('one')
  const second = lobby.join('two', first.session.code)
  assert.throws(() => lobby.join('three', first.session.code), /full/)
  assert.throws(() => lobby.start('one'), /ready/)
  lobby.role('one', 'equipment')
  assert.throws(() => lobby.role('two', 'equipment'), /taken/)
  lobby.role('two', 'control')
  lobby.ready('one', true)
  lobby.ready('two', true)
  assert.equal(lobby.start('two').phase, 'briefing')
  assert.equal(lobby.start('one').phase, 'briefing')
  assert.throws(() => lobby.role('one', 'control'), /started/)
  assert.equal(second.room.players.length, 2)
})

test('private credentials restore a seat and disconnect resets readiness', () => {
  const lobby = new Lobby()
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
  const lobby = new Lobby()
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

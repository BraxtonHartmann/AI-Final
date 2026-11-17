import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Lobby } from '../server/lobby.ts'

test('skip is disabled by default and needs both connected role holders', () => {
  const normal = new Lobby()
  normal.create('a')
  assert.throws(() => normal.skip('a', 'hatch'), /disabled/)
  const testing = new Lobby(Date.now, true)
  const room = testing.create('a')
  assert.equal(room.room.canSkip, true)
  assert.throws(() => testing.skip('a', 'hatch'), /Both/)
  testing.join('b', room.room.code)
  testing.role('a', 'equipment')
  assert.throws(() => testing.skip('a', 'hatch'), /Both/)
  testing.role('b', 'control')
  const hatch = testing.skip('a', 'hatch')
  assert.equal(hatch.phase, 'hatch')
  assert.notEqual(hatch.runId, room.room.runId)
  assert.equal(hatch.hatch?.status, 'locked')
  assert.throws(
    () => testing.continue('b', 'pressure', room.room.runId),
    /run has changed/,
  )
  assert.throws(
    () => testing.skip('b', 'power', room.room.runId),
    /run has changed/,
  )
})

test('every skip target initializes a playable puzzle and consistent prerequisites', () => {
  for (const target of ['power', 'pressure', 'transmitter', 'hatch'] as const) {
    const lobby = new Lobby(Date.now, true)
    const created = lobby.create('equipment')
    lobby.join('control', created.room.code)
    lobby.role('equipment', 'equipment')
    lobby.role('control', 'control')
    const view = lobby.skip('control', target)
    assert.equal(view.phase, target)
    if (target === 'power') assert.deepEqual(view.power?.activated, [])
    if (target === 'pressure')
      assert.equal(
        lobby.pressure('control', { type: 'reset' }, 'reset', 0, view.runId)
          .pressure?.version,
        1,
      )
    if (target === 'transmitter')
      assert.equal(
        lobby.transmitter(
          'equipment',
          { type: 'reset' },
          'reset',
          0,
          view.runId,
        ).transmitter?.version,
        1,
      )
    if (target === 'hatch')
      assert.equal(
        lobby.hatch(
          'control',
          { type: 'submit', code: '4826' },
          'code',
          0,
          view.runId,
        ).hatch?.status,
        'authorized',
      )
  }
})

test('new testing runs choose different procedures while resets preserve the selected path', () => {
  const lobby = new Lobby(Date.now, true)
  const equipment = lobby.create('equipment')
  lobby.join('control', equipment.room.code)
  lobby.role('equipment', 'equipment')
  lobby.role('control', 'control')
  let previous = ''
  for (let run = 0; run < 5; run++) {
    const current = lobby.skip(
      'control',
      'power',
      lobby.view(equipment.room.code).runId,
    )
    assert.ok(current.power?.role === 'control')
    const procedure = JSON.stringify(current.power.instructions)
    if (previous) assert.notEqual(procedure, previous)
    const reset = lobby.power(
      'equipment',
      { type: 'reset' },
      'reset',
      0,
      current.runId,
    )
    const analyst = lobby.view(equipment.room.code, 'control').power
    assert.ok(analyst?.role === 'control')
    assert.equal(JSON.stringify(analyst.instructions), procedure)
    assert.equal(reset.power?.status, 'active')
    previous = procedure
  }
})

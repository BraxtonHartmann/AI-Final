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

function reachHatch(lobby: Lobby) {
  for (const [version, breaker] of (
    ['tide', 'anchor', 'beacon'] as const
  ).entries())
    lobby.power(
      'equipment',
      { type: 'breaker', breaker },
      `power-${version}`,
      version,
    )
  lobby.continue('control')
  lobby.pressure(
    'control',
    { type: 'valve', valve: 'intake', open: true },
    'intake',
    0,
  )
  lobby.pressure(
    'control',
    { type: 'valve', valve: 'bypass', open: true },
    'bypass',
    1,
  )
  lobby.pressure('control', { type: 'pump' }, 'pump', 2)
  lobby.continue('equipment', 'transmitter')
  lobby.transmitter(
    'equipment',
    {
      type: 'tune',
      settings: { frequencyKHz: 5600, bearing: 'west', code: '7314' },
    },
    'tune',
    0,
  )
  lobby.transmitter('equipment', { type: 'transmit' }, 'send', 1)
  return lobby.continue('control', 'hatch')
}

function escape(lobby: Lobby) {
  lobby.hatch('control', { type: 'submit', code: '4826' }, 'code', 0)
  lobby.hatch('control', { type: 'arm', armed: true }, 'arm-control', 1)
  lobby.hatch('equipment', { type: 'arm', armed: true }, 'arm-equipment', 2)
  return lobby.hatch('control', { type: 'release' }, 'release', 3)
}

test('hatch is gated behind rescue and protects the equipment manual', () => {
  const { lobby, equipment } = crew()
  assert.throws(() => lobby.continue('control', 'hatch'), /acknowledgment/)
  assert.throws(
    () => lobby.hatch('control', { type: 'release' }, 'early', 0),
    /not active/,
  )
  const current = reachHatch(lobby)
  assert.equal(current.phase, 'hatch')
  assert.equal(current.transmitter, undefined)
  assert.ok(
    current.hatch?.role === 'control' &&
      !('plate' in current.hatch) &&
      !('legend' in current.hatch),
  )
  assert.equal(lobby.view(equipment.room.code).hatch, undefined)
  assert.equal(
    lobby.view(equipment.room.code, 'equipment').hatch?.role,
    'equipment',
  )
  assert.equal(lobby.continue('equipment').phase, 'hatch')
  assert.throws(
    () =>
      lobby.hatch('equipment', { type: 'submit', code: '4826' }, 'denied', 0),
    /Only/,
  )
  assert.throws(() => lobby.replay('control', true, current.runId), /Finish/)
})

test('reconnect withdraws arming, actions deduplicate, and stale concurrent arms can retry', () => {
  const { lobby, equipment, control } = crew()
  reachHatch(lobby)
  const code = lobby.hatch(
    'control',
    { type: 'submit', code: '4826' },
    'code',
    0,
  )
  assert.equal(
    lobby.hatch('control', { type: 'submit', code: '4826' }, 'code', 0)
      .revision,
    code.revision,
  )
  assert.throws(
    () => lobby.hatch('control', { type: 'reset' }, 'code', 0),
    /different/,
  )
  lobby.hatch('equipment', { type: 'arm', armed: true }, 'equipment-arm', 1)
  assert.throws(
    () => lobby.hatch('control', { type: 'arm', armed: true }, 'stale-arm', 1),
    /changed/,
  )
  lobby.hatch('control', { type: 'arm', armed: true }, 'control-arm', 2)
  // Reclaiming an active seat also withdraws its armed state.
  const restored = lobby.resume(
    'equipment-returned',
    equipment.room.code,
    equipment.session.token,
  )
  assert.equal(restored.room.hatch?.armed.equipment, false)
  assert.equal(restored.room.hatch?.armed.control, true)
  assert.throws(
    () => lobby.hatch('control', { type: 'release' }, 'blocked', 4),
    /Both/,
  )
  lobby.disconnect('control')
  assert.throws(
    () =>
      lobby.hatch(
        'equipment-returned',
        { type: 'arm', armed: true },
        'paused',
        5,
      ),
    /reconnect/,
  )
  const controlReturn = lobby.resume(
    'control-returned',
    control.room.code,
    control.session.token,
  )
  assert.deepEqual(controlReturn.room.hatch?.armed, {
    equipment: false,
    control: false,
  })
  lobby.hatch(
    'equipment-returned',
    { type: 'arm', armed: true },
    'rearm-equipment',
    5,
  )
  lobby.hatch(
    'control-returned',
    { type: 'arm', armed: true },
    'rearm-control',
    6,
  )
  const released = lobby.hatch(
    'control-returned',
    { type: 'release' },
    'release',
    7,
  )
  assert.equal(released.phase, 'escaped')
  assert.equal(
    lobby.hatch('control-returned', { type: 'release' }, 'release', 7).revision,
    released.revision,
  )
})

test('replay requires both votes, permits cancellation, and isolates the new run from old commands', () => {
  const { lobby, equipment } = crew()
  reachHatch(lobby)
  const escaped = escape(lobby)
  const runId = escaped.runId
  assert.equal(lobby.replay('equipment', true, runId).phase, 'escaped')
  assert.equal(lobby.replay('equipment', false, runId).replay?.equipment, false)
  lobby.replay('equipment', true, runId)
  const restored = lobby.resume(
    'equipment-returned',
    equipment.room.code,
    equipment.session.token,
  )
  assert.equal(restored.room.replay?.equipment, false)
  lobby.replay('equipment-returned', true, runId)
  const restarted = lobby.replay('control', true, runId)
  assert.equal(restarted.phase, 'lobby')
  assert.notEqual(restarted.runId, runId)
  assert.equal(restarted.hatch, undefined)
  assert.ok(restarted.players.every((player) => !player.ready && player.role))
  assert.throws(() => lobby.replay('control', true, runId), /run has changed/)
  lobby.ready('equipment-returned', true)
  lobby.ready('control', true)
  lobby.start('control')
  assert.throws(
    () =>
      lobby.power(
        'equipment-returned',
        { type: 'breaker', breaker: 'tide' },
        'old-late',
        0,
        runId,
      ),
    /run has changed/,
  )
  assert.throws(
    () =>
      lobby.power(
        'equipment-returned',
        { type: 'breaker', breaker: 'tide' },
        'legacy-late',
        0,
      ),
    /run has changed/,
  )
  assert.equal(
    lobby.power(
      'equipment-returned',
      { type: 'breaker', breaker: 'tide' },
      'new',
      0,
      restarted.runId,
    ).power?.version,
    1,
  )
  assert.throws(
    () => lobby.continue('control', 'hatch', runId),
    /run has changed/,
  )
})

test('returning to the lobby after a player leaves also invalidates the ended run', () => {
  const { lobby, equipment } = crew()
  const oldRunId = lobby.view(equipment.room.code).runId
  lobby.leave('control')
  const nextRunId = lobby.view(equipment.room.code).runId
  assert.notEqual(nextRunId, oldRunId)
  lobby.join('new-control', equipment.room.code)
  lobby.role('new-control', 'control')
  lobby.ready('equipment', true)
  lobby.ready('new-control', true)
  lobby.start('equipment')
  assert.throws(
    () =>
      lobby.power(
        'equipment',
        { type: 'breaker', breaker: 'tide' },
        'old',
        0,
        oldRunId,
      ),
    /run has changed/,
  )
  assert.equal(
    lobby.power(
      'equipment',
      { type: 'breaker', breaker: 'tide' },
      'current',
      0,
      nextRunId,
    ).power?.version,
    1,
  )
})

import { restorePower } from './helpers/power.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Lobby } from '../server/lobby.ts'

function crew() {
  const lobby = new Lobby(Date.now, false, () => 0)
  const equipment = lobby.create('equipment')
  const control = lobby.join('control', equipment.room.code)
  lobby.role('equipment', 'equipment')
  lobby.role('control', 'control')
  lobby.ready('equipment', true)
  lobby.ready('control', true)
  lobby.start('equipment')
  return { lobby, equipment, control }
}

function reachTransmitter(lobby: Lobby) {
  restorePower(lobby)
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
  return lobby.continue('equipment', 'transmitter')
}

const tune = {
  type: 'tune' as const,
  settings: {
    frequencyKHz: 5600 as const,
    bearing: 'west' as const,
    code: '7314',
  },
}

test('transmitter has targeted progression, private charts, and equipment-only controls', () => {
  const { lobby, equipment } = crew()
  assert.throws(() => lobby.continue('equipment', 'transmitter'), /Drain/)
  assert.throws(
    () => lobby.transmitter('equipment', tune, 'early', 0),
    /not active/,
  )
  const current = reachTransmitter(lobby)
  assert.equal(current.phase, 'transmitter')
  assert.equal(current.power, undefined)
  assert.equal(current.pressure, undefined)
  assert.ok(
    current.transmitter?.role === 'equipment' &&
      !('chart' in current.transmitter),
  )
  const control = lobby.view(equipment.room.code, 'control').transmitter
  assert.ok(control?.role === 'control' && !('settings' in control))
  assert.equal(lobby.view(equipment.room.code).transmitter, undefined)
  assert.throws(() => lobby.transmitter('control', tune, 'denied', 0), /Only/)
  // Late/duplicate earlier-stage transition requests preserve the current puzzle.
  assert.equal(lobby.continue('control').phase, 'transmitter')
  assert.equal(lobby.continue('control', 'transmitter').transmitter?.version, 0)
})

test('transmitter tuning survives reconnect and deduplicates before and after reset and completion', () => {
  const { lobby, equipment, control } = crew()
  reachTransmitter(lobby)
  const tuned = lobby.transmitter('equipment', tune, 'tune', 0)
  assert.equal(
    lobby.transmitter('equipment', tune, 'tune', 0).revision,
    tuned.revision,
  )
  assert.throws(
    () => lobby.transmitter('equipment', { type: 'reset' }, 'tune', 0),
    /different/,
  )
  assert.throws(
    () => lobby.transmitter('equipment', { type: 'reset' }, 'stale', 0),
    /changed/,
  )
  lobby.transmitter('equipment', { type: 'reset' }, 'reset', 1)
  const retried = lobby.transmitter('equipment', tune, 'tune', 0)
  assert.ok(
    retried.transmitter?.role === 'equipment' &&
      retried.transmitter.settings.code === '',
  )
  lobby.disconnect('control')
  assert.throws(
    () => lobby.transmitter('equipment', tune, 'paused', 2),
    /reconnect/,
  )
  lobby.resume('control-returned', control.room.code, control.session.token)
  lobby.transmitter('equipment', tune, 'retune', 2)
  lobby.disconnect('equipment')
  const returned = lobby.resume(
    'equipment-returned',
    equipment.room.code,
    equipment.session.token,
  )
  assert.ok(returned.room.transmitter?.role === 'equipment')
  assert.deepEqual(returned.room.transmitter.settings, tune.settings)
  const sent = lobby.transmitter(
    'equipment-returned',
    { type: 'transmit' },
    'send',
    3,
  )
  assert.equal(sent.phase, 'transmitter-complete')
  assert.equal(
    lobby.transmitter('equipment-returned', { type: 'transmit' }, 'send', 3)
      .revision,
    sent.revision,
  )
  assert.throws(
    () => lobby.transmitter('equipment-returned', { type: 'reset' }, 'late', 4),
    /acknowledged/,
  )
  lobby.leave('equipment-returned')
  assert.equal(
    lobby.view(equipment.room.code, 'control-returned').transmitter,
    undefined,
  )
})

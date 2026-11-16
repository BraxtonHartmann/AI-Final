import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type {
  ClientEvents,
  Reply,
  Request,
  ServerEvents,
} from '../shared/protocol.ts'
import { createLobbyServer } from '../server/server.ts'

test('real clients handle role races, room isolation, reconnect, and invalid requests', async (t) => {
  const server = createLobbyServer()
  server.http.listen(0, '127.0.0.1')
  await once(server.http, 'listening')
  const address = server.http.address()
  assert.ok(address && typeof address !== 'string')
  const clients: Socket<ServerEvents, ClientEvents>[] = []
  t.after(async () => {
    clients.forEach((client) => client.disconnect())
    await server.close()
  })
  async function connect() {
    const socket: Socket<ServerEvents, ClientEvents> = io(
      `http://127.0.0.1:${(address as { port: number }).port}`,
      { forceNew: true },
    )
    clients.push(socket)
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
    })
    return socket
  }
  function send(
    socket: Socket<ServerEvents, ClientEvents>,
    request: Request,
  ): Promise<Reply> {
    return socket.timeout(2000).emitWithAck('request', request)
  }
  const [a, b, c, other] = await Promise.all([
    connect(),
    connect(),
    connect(),
    connect(),
  ])
  const created = await send(a, { type: 'create' })
  assert.ok(created.ok && created.session)
  const session = created.session
  assert.equal((await send(b, { type: 'join', code: session.code })).ok, true)
  assert.equal((await send(c, { type: 'join', code: session.code })).ok, false)
  assert.equal((await send(c, { type: 'start' })).ok, false)
  const roles = await Promise.all([
    send(a, { type: 'role', role: 'equipment' }),
    send(b, { type: 'role', role: 'equipment' }),
  ])
  assert.equal(roles.filter((result) => result.ok).length, 1)
  const winner = roles[0].ok ? a : b
  const loser = winner === a ? b : a
  await send(loser, { type: 'role', role: 'control' })
  await send(winner, { type: 'ready', ready: true })
  await send(loser, { type: 'ready', ready: true })
  const started = await send(a, { type: 'start' })
  assert.ok(started.ok && started.room?.phase === 'power')
  const operatorView = await send(winner, { type: 'start' })
  const analystView = await send(loser, { type: 'start' })
  assert.ok(operatorView.ok && operatorView.room?.power?.role === 'equipment')
  assert.equal('sequence' in operatorView.room.power, false)
  assert.equal('damaged' in operatorView.room.power, false)
  assert.ok(analystView.ok && analystView.room?.power?.role === 'control')
  assert.deepEqual(analystView.room.power.sequence, [
    'tide',
    'anchor',
    'beacon',
  ])
  const action: Request = {
    type: 'power',
    action: { type: 'breaker', breaker: 'tide' },
    actionId: 'network-first',
    expectedVersion: 0,
  }
  assert.equal((await send(loser, action)).ok, false)
  const broadcasts: string[] = []
  winner.on('room', (room) => broadcasts.push(JSON.stringify(room)))
  const moved = await send(winner, action)
  assert.ok(moved.ok && moved.room?.power?.version === 1)
  const repeated = await send(winner, action)
  assert.ok(repeated.ok && repeated.room?.power?.version === 1)
  for (const invalid of [
    { ...action, actionId: {}, expectedVersion: 1 },
    { ...action, expectedVersion: '1' },
    { ...action, expectedVersion: -1 },
    { ...action, action: { type: 'breaker', breaker: 'unknown' } },
  ])
    assert.equal((await send(winner, invalid as unknown as Request)).ok, false)
  assert.ok(broadcasts.length > 0)
  assert.ok(
    broadcasts.every(
      (value) => !value.includes('sequence') && !value.includes('damaged'),
    ),
  )
  const isolated = await send(other, { type: 'create' })
  assert.ok(isolated.ok && isolated.room)
  assert.notEqual(isolated.room.code, session.code)
  const seenCodes: string[] = []
  other.on('room', (room) => seenCodes.push(room.code))
  const reconnected = await connect()
  assert.equal(
    (
      await send(reconnected, {
        type: 'resume',
        code: session.code,
        token: 'f'.repeat(64),
      })
    ).ok,
    false,
  )
  const restored = await send(reconnected, {
    type: 'resume',
    code: session.code,
    token: session.token,
  })
  assert.ok(restored.ok && restored.room?.phase === 'power')
  assert.equal(a.connected, false)
  assert.equal(JSON.stringify(restored.room).includes(session.token), false)
  const malformed = await send(c, {
    type: 'role',
    role: 'admin',
  } as unknown as Request)
  assert.equal(malformed.ok, false)
  assert.ok(seenCodes.every((code) => code === isolated.room?.code))
  const equipment = winner === a ? reconnected : winner
  const control = loser === a ? reconnected : loser
  await send(equipment, {
    type: 'power',
    action: { type: 'breaker', breaker: 'anchor' },
    actionId: 'next-power',
    expectedVersion: 1,
  })
  await send(equipment, {
    type: 'power',
    action: { type: 'breaker', breaker: 'beacon' },
    actionId: 'last-power',
    expectedVersion: 2,
  })
  const controls = await send(control, { type: 'continue' })
  assert.ok(controls.ok && controls.room?.pressure?.role === 'control')
  assert.equal('readings' in controls.room.pressure, false)
  assert.equal('safeRange' in controls.room.pressure, false)
  assert.equal(controls.room.power, undefined)
  const gauges = await send(equipment, { type: 'continue' })
  assert.ok(gauges.ok && gauges.room?.pressure?.role === 'equipment')
  assert.equal('valves' in gauges.room.pressure, false)
  const privateBroadcasts: string[] = []
  control.on('room', (room) => {
    if (room.pressure) privateBroadcasts.push(JSON.stringify(room.pressure))
  })
  const valveRequest: Request = {
    type: 'pressure',
    action: { type: 'valve', valve: 'intake', open: true },
    actionId: 'valve-first',
    expectedVersion: 0,
  }
  assert.equal((await send(equipment, valveRequest)).ok, false)
  assert.equal((await send(c, valveRequest)).ok, false)
  for (const invalid of [
    {
      ...valveRequest,
      action: { type: 'valve', valve: 'unknown', open: true },
    },
    {
      ...valveRequest,
      action: { type: 'valve', valve: 'intake', open: 'true' },
    },
    { ...valveRequest, expectedVersion: '0' },
    { ...valveRequest, actionId: {} },
  ])
    assert.equal((await send(control, invalid as unknown as Request)).ok, false)
  assert.equal(
    (
      await send(control, {
        type: 'pressure',
        action: { type: 'pump' },
        actionId: 'unsafe-pump',
        expectedVersion: 0,
      })
    ).ok,
    false,
  )
  const valveMoved = await send(control, valveRequest)
  assert.ok(valveMoved.ok && valveMoved.room?.pressure?.version === 1)
  const valveRepeated = await send(control, valveRequest)
  assert.ok(valveRepeated.ok && valveRepeated.room?.pressure?.version === 1)
  await send(control, {
    type: 'pressure',
    action: { type: 'valve', valve: 'bypass', open: true },
    actionId: 'valve-second',
    expectedVersion: 1,
  })
  const pumped = await send(control, {
    type: 'pressure',
    action: { type: 'pump' },
    actionId: 'pump',
    expectedVersion: 2,
  })
  assert.ok(pumped.ok && pumped.room?.phase === 'pressure-complete')
  assert.ok(privateBroadcasts.length > 0)
  assert.ok(
    privateBroadcasts.every(
      (value) => !value.includes('readings') && !value.includes('safeRange'),
    ),
  )
  assert.equal((await send(reconnected, { type: 'leave' })).ok, true)
})

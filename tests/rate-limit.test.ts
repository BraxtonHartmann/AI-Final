import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type {
  ClientEvents,
  ServerEvents,
  Request,
  Reply,
} from '../shared/protocol.ts'
import { createLobbyServer } from '../server/server.ts'

test('one connection is throttled without blocking another room, while room-entry attempts share an address limit', async (t) => {
  const server = createLobbyServer()
  server.http.listen(0, '127.0.0.1')
  await once(server.http, 'listening')
  const address = server.http.address()
  assert.ok(address && typeof address !== 'string')
  const sockets: Socket<ServerEvents, ClientEvents>[] = []
  t.after(async () => {
    sockets.forEach((socket) => socket.disconnect())
    await server.close()
  })
  async function connect() {
    const socket: Socket<ServerEvents, ClientEvents> = io(
      `http://127.0.0.1:${(address as { port: number }).port}`,
      { autoConnect: false, forceNew: true },
    )
    sockets.push(socket)
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
      socket.connect()
    })
    return socket
  }
  function send(
    socket: Socket<ServerEvents, ClientEvents>,
    request: Request,
  ): Promise<Reply> {
    return socket.timeout(2000).emitWithAck('request', request)
  }
  const [a, b, c, d] = await Promise.all([
    connect(),
    connect(),
    connect(),
    connect(),
  ])
  assert.equal((await send(a, { type: 'create' })).ok, true)
  assert.equal((await send(b, { type: 'create' })).ok, true)
  let last: Reply = { ok: true, room: null }
  for (let i = 0; i < 120; i++) last = await send(a, { type: 'start' })
  assert.ok(!last.ok && last.error.includes('Too many requests'))
  assert.equal((await send(b, { type: 'role', role: 'equipment' })).ok, true)
  for (const socket of [c, d]) {
    for (let i = 0; i < 65; i++)
      last = await send(socket, { type: 'join', code: 'ZZZZZZ' })
  }
  assert.ok(!last.ok && last.error.includes('room-entry'))
  assert.equal((await send(b, { type: 'role', role: 'control' })).ok, true)
})

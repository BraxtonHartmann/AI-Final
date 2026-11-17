import { createServer } from 'node:http'
import { Server } from 'socket.io'
import type {
  ClientEvents,
  Reply,
  Request,
  ServerEvents,
} from '../shared/protocol.ts'
import { Lobby } from './lobby.ts'
import {
  breakers,
  valves,
  radioFrequencies,
  antennaBearings,
} from '../shared/protocol.ts'

function parseActionRequest(value: unknown): Request {
  if (!value || typeof value !== 'object') throw new Error('Invalid request.')
  const data = value as Record<string, unknown>
  switch (data.type) {
    case 'hatch':
    case 'transmitter':
    case 'pressure':
    case 'power': {
      if (
        typeof data.actionId !== 'string' ||
        !/^[a-zA-Z0-9-]{1,64}$/.test(data.actionId) ||
        !Number.isSafeInteger(data.expectedVersion) ||
        (data.expectedVersion as number) < 0
      )
        break
      if (!data.action || typeof data.action !== 'object') break
      const action = data.action as Record<string, unknown>
      if (data.type === 'hatch') {
        const metadata = {
          actionId: data.actionId,
          expectedVersion: data.expectedVersion as number,
        }
        if (action.type === 'release' || action.type === 'reset')
          return { type: 'hatch', action: { type: action.type }, ...metadata }
        if (action.type === 'arm' && typeof action.armed === 'boolean')
          return {
            type: 'hatch',
            action: { type: 'arm', armed: action.armed },
            ...metadata,
          }
        if (
          action.type === 'submit' &&
          typeof action.code === 'string' &&
          /^[0-9]{4}$/.test(action.code)
        )
          return {
            type: 'hatch',
            action: { type: 'submit', code: action.code },
            ...metadata,
          }
        break
      }
      if (data.type === 'transmitter') {
        const metadata = {
          actionId: data.actionId,
          expectedVersion: data.expectedVersion as number,
        }
        if (action.type === 'reset' || action.type === 'transmit')
          return {
            type: 'transmitter',
            action: { type: action.type },
            ...metadata,
          }
        if (
          action.type !== 'tune' ||
          !action.settings ||
          typeof action.settings !== 'object'
        )
          break
        const settings = action.settings as Record<string, unknown>
        const frequencyKHz = radioFrequencies.find(
          (value) => value === settings.frequencyKHz,
        )
        const bearing = antennaBearings.find(
          (value) => value === settings.bearing,
        )
        if (
          frequencyKHz &&
          bearing &&
          typeof settings.code === 'string' &&
          /^[0-9]{4}$/.test(settings.code)
        )
          return {
            type: 'transmitter',
            action: {
              type: 'tune',
              settings: { frequencyKHz, bearing, code: settings.code },
            },
            ...metadata,
          }
        break
      }
      if (data.type === 'pressure') {
        const metadata = {
          actionId: data.actionId,
          expectedVersion: data.expectedVersion as number,
        }
        if (action.type === 'reset' || action.type === 'pump')
          return {
            type: 'pressure',
            action: { type: action.type },
            ...metadata,
          }
        const valve = valves.find((entry) => entry.id === action.valve)
        if (
          action.type === 'valve' &&
          valve &&
          typeof action.open === 'boolean'
        )
          return {
            type: 'pressure',
            action: { type: 'valve', valve: valve.id, open: action.open },
            ...metadata,
          }
        break
      }
      if (action.type === 'reset')
        return {
          type: 'power',
          action: { type: 'reset' },
          actionId: data.actionId,
          expectedVersion: data.expectedVersion as number,
        }
      const breaker = breakers.find((entry) => entry.id === action.breaker)
      if (action.type === 'breaker' && breaker)
        return {
          type: 'power',
          action: { type: 'breaker', breaker: breaker.id },
          actionId: data.actionId,
          expectedVersion: data.expectedVersion as number,
        }
      break
    }
    case 'continue':
      if (
        data.target === undefined ||
        data.target === 'pressure' ||
        data.target === 'transmitter' ||
        data.target === 'hatch'
      )
        return { type: 'continue', target: data.target }
      break
    case 'replay':
      if (typeof data.ready === 'boolean' && typeof data.runId === 'string')
        return { type: 'replay', ready: data.ready, runId: data.runId }
      break
    case 'create':
    case 'start':
    case 'leave':
      return { type: data.type }
    case 'join':
      if (typeof data.code === 'string' && /^[A-Z2-9]{6}$/.test(data.code))
        return { type: 'join', code: data.code }
      break
    case 'resume':
      if (
        typeof data.code === 'string' &&
        /^[A-Z2-9]{6}$/.test(data.code) &&
        typeof data.token === 'string' &&
        /^[a-f0-9]{64}$/.test(data.token)
      ) {
        return { type: 'resume', code: data.code, token: data.token }
      }
      break
    case 'role':
      if (data.role === 'equipment' || data.role === 'control')
        return { type: 'role', role: data.role }
      break
    case 'ready':
      if (typeof data.ready === 'boolean')
        return { type: 'ready', ready: data.ready }
      break
  }
  throw new Error('Invalid request. Check the room code or action.')
}

function parseRequest(value: unknown): Request {
  const request = parseActionRequest(value)
  if (
    'actionId' in request ||
    request.type === 'continue' ||
    request.type === 'replay'
  ) {
    const runId = (value as Record<string, unknown>).runId
    if (
      runId !== undefined &&
      (typeof runId !== 'string' || !/^[a-f0-9-]{36}$/.test(runId))
    )
      throw new Error('Invalid run identifier.')
    return { ...request, runId } as Request
  }
  return request
}

export function createLobbyServer() {
  const http = createServer((request, response) => {
    response.writeHead(request.url === '/health' ? 200 : 404, {
      'Content-Type': 'application/json',
    })
    response.end(
      JSON.stringify({
        status: request.url === '/health' ? 'ok' : 'not found',
      }),
    )
  })
  const io = new Server<ClientEvents, ServerEvents>(http, {
    serveClient: false,
    maxHttpBufferSize: 4096,
    allowRequest: (request, callback) => {
      const origin = request.headers.origin
      const allowed = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
      callback(
        null,
        !origin ||
          origin === allowed ||
          origin === `http://${request.headers.host}`,
      )
    },
  })
  const lobby = new Lobby()
  const budgets = new Map<string, { count: number; since: number }>()

  function publish() {
    for (const code of lobby.codes()) {
      for (const socketId of lobby.sockets(code))
        io.to(socketId).emit('room', lobby.view(code, socketId))
    }
  }

  function sweep() {
    for (const id of lobby.sweep()) io.to(id).emit('expired')
  }

  const timer = setInterval(() => {
    sweep()
    publish()
    for (const [key, budget] of budgets) {
      if (Date.now() - budget.since >= 60_000) budgets.delete(key)
    }
  }, 10_000)
  timer.unref()

  io.on('connection', (socket) => {
    socket.on('request', (raw, acknowledge) => {
      if (typeof acknowledge !== 'function') return
      let reply: Reply
      try {
        const address = socket.handshake.address
        let budget = budgets.get(address)
        if (!budget || Date.now() - budget.since >= 60_000) {
          budget = { count: 0, since: Date.now() }
          budgets.set(address, budget)
        }
        budget.count += 1
        if (budget.count > 120)
          throw new Error('Too many requests. Wait a minute and try again.')
        const request = parseRequest(raw)
        sweep()
        switch (request.type) {
          case 'create':
            reply = { ok: true, ...lobby.create(socket.id) }
            break
          case 'join':
            reply = { ok: true, ...lobby.join(socket.id, request.code) }
            break
          case 'resume': {
            const result = lobby.resume(socket.id, request.code, request.token)
            if (result.replacedSocket) {
              io.to(result.replacedSocket).emit('replaced')
              io.sockets.sockets.get(result.replacedSocket)?.disconnect(true)
            }
            reply = { ok: true, room: result.room, session: result.session }
            break
          }
          case 'role':
            reply = { ok: true, room: lobby.role(socket.id, request.role) }
            break
          case 'ready':
            reply = { ok: true, room: lobby.ready(socket.id, request.ready) }
            break
          case 'start':
            reply = { ok: true, room: lobby.start(socket.id) }
            break
          case 'continue':
            reply = {
              ok: true,
              room: lobby.continue(socket.id, request.target, request.runId),
            }
            break
          case 'replay':
            reply = {
              ok: true,
              room: lobby.replay(socket.id, request.ready, request.runId),
            }
            break
          case 'hatch':
            reply = {
              ok: true,
              room: lobby.hatch(
                socket.id,
                request.action,
                request.actionId,
                request.expectedVersion,
                request.runId,
              ),
            }
            break
          case 'transmitter':
            reply = {
              ok: true,
              room: lobby.transmitter(
                socket.id,
                request.action,
                request.actionId,
                request.expectedVersion,
                request.runId,
              ),
            }
            break
          case 'pressure':
            reply = {
              ok: true,
              room: lobby.pressure(
                socket.id,
                request.action,
                request.actionId,
                request.expectedVersion,
                request.runId,
              ),
            }
            break
          case 'power':
            reply = {
              ok: true,
              room: lobby.power(
                socket.id,
                request.action,
                request.actionId,
                request.expectedVersion,
                request.runId,
              ),
            }
            break
          case 'leave':
            lobby.leave(socket.id)
            reply = { ok: true, room: null }
            break
        }
      } catch (error) {
        reply = {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to complete action.',
        }
      }
      acknowledge(reply)
      publish()
    })
    socket.on('disconnect', () => {
      lobby.disconnect(socket.id)
      publish()
    })
  })

  return {
    http,
    close: async () => {
      clearInterval(timer)
      await new Promise<void>((resolve) => io.close(() => resolve()))
    },
  }
}

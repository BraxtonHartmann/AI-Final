import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import type {
  PowerAction,
  PowerState,
  PressureAction,
  PressureState,
  Request,
  TransmitterAction,
  TransmitterState,
  Role,
  RoomView,
  Session,
} from '../shared/protocol.ts'
import { applyPowerAction, initialPower, powerView } from './power.ts'
import {
  applyPressureAction,
  initialPressure,
  pressureView,
} from './pressure.ts'

import {
  applyTransmitterAction,
  initialTransmitter,
  transmitterView,
} from './transmitter.ts'

interface Player {
  id: string
  token: string
  socketId: string | null
  disconnectedAt: number | null
  role: Role | null
  ready: boolean
}

interface Room {
  code: string
  revision: number
  phase: RoomView['phase']
  players: Player[]
  updatedAt: number
  power: PowerState
  pressure: PressureState
  transmitter: TransmitterState
  actions: Map<string, string>
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const seatTimeout = 5 * 60_000
const roomTimeout = 30 * 60_000

export class Lobby {
  private rooms = new Map<string, Room>()
  private connections = new Map<string, string>()
  private now: () => number

  constructor(now = Date.now) {
    this.now = now
  }

  private room(code: string) {
    const room = this.rooms.get(code)
    if (!room)
      throw new Error(
        'Room unavailable or expired. Check the code or create a new room.',
      )
    return room
  }

  private member(socketId: string) {
    const code = this.connections.get(socketId)
    if (!code) throw new Error('Join a room first.')
    const room = this.room(code)
    const player = room.players.find((entry) => entry.socketId === socketId)
    if (!player) throw new Error('Join a room first.')
    return { room, player }
  }

  private available(socketId: string) {
    if (this.connections.has(socketId))
      throw new Error('You are already in a room. Leave it first.')
  }

  private changed(room: Room) {
    room.revision += 1
    room.updatedAt = this.now()
    return this.view(room.code)
  }

  view(code: string, socketId?: string): RoomView {
    const room = this.room(code)
    const player = room.players.find((entry) => entry.socketId === socketId)
    return {
      code: room.code,
      revision: room.revision,
      phase: room.phase,
      players: room.players.map((player) => ({
        id: player.id,
        role: player.role,
        ready: player.ready,
        connected: player.socketId !== null,
      })),
      ...((room.phase === 'power' || room.phase === 'power-complete') &&
      player?.role
        ? { power: powerView(room.power, player.role) }
        : {}),
      ...((room.phase === 'pressure' || room.phase === 'pressure-complete') &&
      player?.role
        ? { pressure: pressureView(room.pressure, player.role) }
        : {}),
      ...((room.phase === 'transmitter' ||
        room.phase === 'transmitter-complete') &&
      player?.role
        ? { transmitter: transmitterView(room.transmitter, player.role) }
        : {}),
    }
  }

  codes() {
    return [...this.rooms.keys()]
  }

  sockets(code: string) {
    return this.room(code).players.flatMap((player) =>
      player.socketId ? [player.socketId] : [],
    )
  }

  private add(room: Room, socketId: string) {
    const player: Player = {
      id: randomUUID(),
      token: randomBytes(32).toString('hex'),
      socketId,
      disconnectedAt: null,
      role: null,
      ready: false,
    }
    room.players.push(player)
    this.connections.set(socketId, room.code)
    const session: Session = {
      code: room.code,
      token: player.token,
      playerId: player.id,
    }
    return { room: this.changed(room), session }
  }

  create(socketId: string) {
    this.available(socketId)
    if (this.rooms.size >= 500)
      throw new Error('Station capacity reached. Try again later.')
    let code: string
    do {
      code = Array.from(
        { length: 6 },
        () => alphabet[randomInt(alphabet.length)],
      ).join('')
    } while (this.rooms.has(code))
    const room: Room = {
      code,
      revision: 0,
      phase: 'lobby',
      players: [],
      updatedAt: this.now(),
      power: initialPower(),
      pressure: initialPressure(),
      transmitter: initialTransmitter(),
      actions: new Map(),
    }
    this.rooms.set(code, room)
    return this.add(room, socketId)
  }

  join(socketId: string, code: string) {
    this.available(socketId)
    const room = this.room(code)
    if (room.phase !== 'lobby')
      throw new Error('This session has already started.')
    if (room.players.length >= 2)
      throw new Error(
        'Room is full. Disconnected seats are reserved for five minutes.',
      )
    return this.add(room, socketId)
  }

  resume(socketId: string, code: string, token: string) {
    this.available(socketId)
    const room = this.room(code)
    const player = room.players.find((entry) => entry.token === token)
    if (
      !player ||
      (player.disconnectedAt !== null &&
        this.now() - player.disconnectedAt >= seatTimeout)
    ) {
      throw new Error(
        'Session expired. Join an available room or create a new one.',
      )
    }
    const replacedSocket = player.socketId
    if (replacedSocket) this.connections.delete(replacedSocket)
    player.socketId = socketId
    player.disconnectedAt = null
    player.ready = false
    this.connections.set(socketId, code)
    this.changed(room)
    return {
      room: this.view(code, socketId),
      session: { code, token, playerId: player.id },
      replacedSocket,
    }
  }

  role(socketId: string, role: Role) {
    const { room, player } = this.member(socketId)
    if (room.phase !== 'lobby') throw new Error('Session already started.')
    if (
      room.players.some(
        (entry) => entry.id !== player.id && entry.role === role,
      )
    ) {
      throw new Error('That role is already taken.')
    }
    if (player.role === role) return this.view(room.code)
    player.role = role
    player.ready = false
    return this.changed(room)
  }

  ready(socketId: string, ready: boolean) {
    const { room, player } = this.member(socketId)
    if (room.phase !== 'lobby') throw new Error('Session already started.')
    if (!player.role) throw new Error('Choose a role before getting ready.')
    if (player.ready === ready) return this.view(room.code)
    player.ready = ready
    return this.changed(room)
  }

  start(socketId: string) {
    const { room } = this.member(socketId)
    if (room.phase !== 'lobby') return this.view(room.code, socketId)
    if (
      room.players.length !== 2 ||
      !room.players.every(
        (player) => player.role && player.ready && player.socketId,
      )
    ) {
      throw new Error(
        'Both players must be connected, assigned a role, and ready.',
      )
    }
    room.phase = 'power'
    room.power = initialPower()
    room.pressure = initialPressure()
    room.transmitter = initialTransmitter()
    room.actions.clear()
    this.changed(room)
    return this.view(room.code, socketId)
  }

  power(
    socketId: string,
    action: PowerAction,
    actionId: string,
    expectedVersion: number,
  ) {
    return this.applyPuzzle(socketId, {
      type: 'power',
      action,
      actionId,
      expectedVersion,
    })
  }

  pressure(
    socketId: string,
    action: PressureAction,
    actionId: string,
    expectedVersion: number,
  ) {
    return this.applyPuzzle(socketId, {
      type: 'pressure',
      action,
      actionId,
      expectedVersion,
    })
  }

  transmitter(
    socketId: string,
    action: TransmitterAction,
    actionId: string,
    expectedVersion: number,
  ) {
    return this.applyPuzzle(socketId, {
      type: 'transmitter',
      action,
      actionId,
      expectedVersion,
    })
  }

  continue(socketId: string, target: 'pressure' | 'transmitter' = 'pressure') {
    const { room } = this.member(socketId)
    // Old clients without a target retain their original power-to-pressure behavior.
    if (
      target === 'pressure' &&
      [
        'pressure',
        'pressure-complete',
        'transmitter',
        'transmitter-complete',
      ].includes(room.phase)
    )
      return this.view(room.code, socketId)
    if (
      target === 'transmitter' &&
      (room.phase === 'transmitter' || room.phase === 'transmitter-complete')
    )
      return this.view(room.code, socketId)
    const requiredPhase =
      target === 'pressure' ? 'power-complete' : 'pressure-complete'
    if (room.phase !== requiredPhase)
      throw new Error(
        target === 'pressure'
          ? 'Restore power before continuing to the airlock.'
          : 'Drain the airlock before continuing to the transmitter.',
      )
    if (
      room.players.length !== 2 ||
      !room.players.every((entry) => entry.socketId)
    )
      throw new Error('Wait for your partner to reconnect.')
    room.phase = target
    this.changed(room)
    return this.view(room.code, socketId)
  }

  private applyPuzzle(
    socketId: string,
    request: Extract<Request, { type: 'power' | 'pressure' | 'transmitter' }>,
  ) {
    const { room, player } = this.member(socketId)
    const requiredRole = request.type === 'pressure' ? 'control' : 'equipment'
    if (player.role !== requiredRole)
      throw new Error(
        request.type === 'power'
          ? 'Only the equipment operator can use the breaker panel.'
          : request.type === 'pressure'
            ? 'Only the control room analyst can operate the valves and pump.'
            : 'Only the equipment operator can tune and transmit.',
      )
    if (room.phase === 'lobby')
      throw new Error('Start the session before using the panel.')
    if (
      room.players.length !== 2 ||
      !room.players.every((entry) => entry.socketId)
    )
      throw new Error(
        'Wait for your partner to reconnect before using the panel.',
      )
    const key = `${player.id}:${request.actionId}`
    const fingerprint = JSON.stringify({
      type: request.type,
      action: request.action,
      expectedVersion: request.expectedVersion,
    })
    const previous = room.actions.get(key)
    if (previous) {
      if (previous !== fingerprint)
        throw new Error('Action ID was already used for a different action.')
      return this.view(room.code, socketId)
    }
    if (room.phase !== request.type) {
      if (request.type === 'power' && room.power.status === 'restored')
        throw new Error('Power is already restored.')
      if (request.type === 'pressure' && room.pressure.status === 'drained')
        throw new Error('The airlock is already drained.')
      if (request.type === 'transmitter' && room.transmitter.status === 'sent')
        throw new Error('Rescue has already acknowledged the signal.')
      throw new Error('This puzzle is not active yet.')
    }
    if (request.expectedVersion !== room[request.type].version)
      throw new Error('Panel changed. Check the latest state and try again.')
    if (room.actions.size >= 1024)
      throw new Error(
        'Puzzle action limit reached. Leave and start a new session.',
      )
    if (request.type === 'power') {
      room.power = applyPowerAction(room.power, request.action)
      if (room.power.status === 'restored') room.phase = 'power-complete'
    } else if (request.type === 'pressure') {
      room.pressure = applyPressureAction(room.pressure, request.action)
      if (room.pressure.status === 'drained') room.phase = 'pressure-complete'
    } else {
      room.transmitter = applyTransmitterAction(
        room.transmitter,
        request.action,
      )
      if (room.transmitter.status === 'sent')
        room.phase = 'transmitter-complete'
    }
    room.actions.set(key, fingerprint)
    this.changed(room)
    return this.view(room.code, socketId)
  }

  leave(socketId: string) {
    const { room, player } = this.member(socketId)
    this.connections.delete(socketId)
    room.players = room.players.filter((entry) => entry.id !== player.id)
    if (room.players.length === 0) this.rooms.delete(room.code)
    else {
      room.phase = 'lobby'
      room.power = initialPower()
      room.pressure = initialPressure()
      room.transmitter = initialTransmitter()
      room.actions.clear()
      room.players.forEach((entry) => {
        entry.ready = false
      })
      this.changed(room)
    }
    return room.code
  }

  disconnect(socketId: string) {
    if (!this.connections.has(socketId)) return
    const { room, player } = this.member(socketId)
    this.connections.delete(socketId)
    player.socketId = null
    player.disconnectedAt = this.now()
    player.ready = false
    this.changed(room)
  }

  sweep() {
    const expiredSockets: string[] = []
    for (const room of this.rooms.values()) {
      if (this.now() - room.updatedAt >= roomTimeout) {
        for (const socketId of this.sockets(room.code)) {
          this.connections.delete(socketId)
          expiredSockets.push(socketId)
        }
        this.rooms.delete(room.code)
        continue
      }
      const remaining = room.players.filter(
        (player) =>
          player.disconnectedAt === null ||
          this.now() - player.disconnectedAt < seatTimeout,
      )
      if (remaining.length === room.players.length) continue
      room.players = remaining
      if (remaining.length === 0) this.rooms.delete(room.code)
      else {
        room.phase = 'lobby'
        room.power = initialPower()
        room.pressure = initialPressure()
        room.transmitter = initialTransmitter()
        room.actions.clear()
        remaining.forEach((player) => {
          player.ready = false
        })
        this.changed(room)
      }
    }
    return expiredSockets
  }
}

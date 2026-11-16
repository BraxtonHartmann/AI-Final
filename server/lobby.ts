import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import type { Role, RoomView, Session } from '../shared/protocol.ts'

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

  view(code: string): RoomView {
    const room = this.room(code)
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
    return {
      room: this.changed(room),
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
    if (room.phase === 'briefing') return this.view(room.code)
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
    room.phase = 'briefing'
    return this.changed(room)
  }

  leave(socketId: string) {
    const { room, player } = this.member(socketId)
    this.connections.delete(socketId)
    room.players = room.players.filter((entry) => entry.id !== player.id)
    if (room.players.length === 0) this.rooms.delete(room.code)
    else {
      room.phase = 'lobby'
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
        remaining.forEach((player) => {
          player.ready = false
        })
        this.changed(room)
      }
    }
    return expiredSockets
  }
}

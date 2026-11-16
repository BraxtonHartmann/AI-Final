export type Role = 'equipment' | 'control'

export interface PlayerView {
  id: string
  role: Role | null
  ready: boolean
  connected: boolean
}

export interface RoomView {
  code: string
  revision: number
  phase: 'lobby' | 'briefing'
  players: PlayerView[]
}

export type Request =
  | { type: 'create' }
  | { type: 'join'; code: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'role'; role: Role }
  | { type: 'ready'; ready: boolean }
  | { type: 'start' }
  | { type: 'leave' }

export interface Session {
  code: string
  token: string
  playerId: string
}

export type Reply =
  | { ok: true; room: RoomView | null; session?: Session }
  | { ok: false; error: string }

export interface ClientEvents {
  request: (request: Request, acknowledge: (reply: Reply) => void) => void
}

export interface ServerEvents {
  room: (room: RoomView) => void
  expired: () => void
  replaced: () => void
}

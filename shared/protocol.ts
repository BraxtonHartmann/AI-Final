export type Role = 'equipment' | 'control'

export const breakers = [
  { id: 'beacon', label: 'Beacon', symbol: '△' },
  { id: 'coil', label: 'Coil', symbol: 'ϟ' },
  { id: 'tide', label: 'Tide', symbol: '≈' },
  { id: 'anchor', label: 'Anchor', symbol: '⊥' },
] as const
export type BreakerId = (typeof breakers)[number]['id']
export type PowerAction =
  { type: 'breaker'; breaker: BreakerId } | { type: 'reset' }
export interface PowerState {
  status: 'active' | 'tripped' | 'restored'
  activated: BreakerId[]
  version: number
}
export type PowerView = PowerState &
  (
    | { role: 'equipment' }
    | { role: 'control'; sequence: BreakerId[]; damaged: BreakerId }
  )

export interface PlayerView {
  id: string
  role: Role | null
  ready: boolean
  connected: boolean
}

export interface RoomView {
  code: string
  revision: number
  phase: 'lobby' | 'power' | 'power-complete'
  players: PlayerView[]
  power?: PowerView
}

export type Request =
  | { type: 'create' }
  | { type: 'join'; code: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'role'; role: Role }
  | { type: 'ready'; ready: boolean }
  | { type: 'start' }
  | { type: 'leave' }
  | {
      type: 'power'
      action: PowerAction
      actionId: string
      expectedVersion: number
    }

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

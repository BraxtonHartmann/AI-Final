export type Role = 'equipment' | 'control'

export const radioFrequencies = [4200, 5600, 6800] as const
export const antennaBearings = ['north', 'east', 'south', 'west'] as const
export interface RadioSettings {
  frequencyKHz: (typeof radioFrequencies)[number]
  bearing: (typeof antennaBearings)[number]
  code: string
}
export type TransmitterAction =
  | { type: 'tune'; settings: RadioSettings }
  | { type: 'transmit' }
  | { type: 'reset' }
export interface TransmitterState {
  status: 'active' | 'unanswered' | 'sent'
  settings: RadioSettings
  version: number
}
export interface TransmissionRow {
  service: string
  settings: RadioSettings
}
export type TransmitterView = {
  status: TransmitterState['status']
  version: number
} & (
  | { role: 'equipment'; settings: RadioSettings }
  | { role: 'control'; chart: TransmissionRow[]; targetService: string }
)

export const valves = [
  { id: 'intake', label: 'Intake' },
  { id: 'bypass', label: 'Bypass' },
  { id: 'return', label: 'Return' },
] as const
export type ValveId = (typeof valves)[number]['id']
export type PressureAction =
  | { type: 'valve'; valve: ValveId; open: boolean }
  | { type: 'pump' }
  | { type: 'reset' }
export interface PressureState {
  status: 'active' | 'drained'
  valves: Record<ValveId, boolean>
  version: number
}
export type PressureView = {
  status: PressureState['status']
  version: number
} & (
  | { role: 'control'; valves: Record<ValveId, boolean> }
  | {
      role: 'equipment'
      readings: [number, number]
      safeRange: [number, number]
    }
)

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
  phase:
    | 'lobby'
    | 'power'
    | 'power-complete'
    | 'pressure'
    | 'pressure-complete'
    | 'transmitter'
    | 'transmitter-complete'
  players: PlayerView[]
  power?: PowerView
  pressure?: PressureView
  transmitter?: TransmitterView
}

export type Request =
  | { type: 'create' }
  | { type: 'join'; code: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'role'; role: Role }
  | { type: 'ready'; ready: boolean }
  | { type: 'start' }
  | { type: 'leave' }
  | { type: 'continue'; target?: 'pressure' | 'transmitter' }
  | {
      type: 'transmitter'
      action: TransmitterAction
      actionId: string
      expectedVersion: number
    }
  | {
      type: 'pressure'
      action: PressureAction
      actionId: string
      expectedVersion: number
    }
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

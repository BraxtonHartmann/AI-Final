import type {
  BreakerId,
  PowerAction,
  PowerState,
  PowerView,
  Role,
} from '../shared/protocol.ts'

const sequence: BreakerId[] = ['tide', 'anchor', 'beacon']
const damaged: BreakerId = 'coil'

export function initialPower(): PowerState {
  return { status: 'active', activated: [], version: 0 }
}

export function applyPowerAction(
  state: PowerState,
  action: PowerAction,
): PowerState {
  if (state.status === 'restored') throw new Error('Power is already restored.')
  if (action.type === 'reset')
    return { ...initialPower(), version: state.version + 1 }
  if (state.status === 'tripped')
    throw new Error('Reset the panel before trying again.')
  if (action.breaker !== sequence[state.activated.length]) {
    return { ...state, status: 'tripped', version: state.version + 1 }
  }
  const activated = [...state.activated, action.breaker]
  return {
    status: activated.length === sequence.length ? 'restored' : 'active',
    activated,
    version: state.version + 1,
  }
}

export function powerView(state: PowerState, role: Role): PowerView {
  const publicState = {
    status: state.status,
    activated: [...state.activated],
    version: state.version,
  }
  if (role === 'control')
    return { ...publicState, role, sequence: [...sequence], damaged }
  return { ...publicState, role }
}

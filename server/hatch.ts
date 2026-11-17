import type {
  HatchAction,
  HatchState,
  HatchSymbol,
  HatchView,
  Role,
} from '../shared/protocol.ts'

const plate = ['triangle', 'wave', 'anchor', 'ring']
const legend: HatchSymbol[] = [
  { id: 'ring', label: 'Ring', symbol: '○', digit: '6' },
  { id: 'anchor', label: 'Anchor', symbol: '⊥', digit: '2' },
  { id: 'triangle', label: 'Triangle', symbol: '△', digit: '4' },
  { id: 'wave', label: 'Wave', symbol: '≈', digit: '8' },
]
const releaseCode = plate
  .map((id) => legend.find((row) => row.id === id)!.digit)
  .join('')

export function initialHatch(): HatchState {
  return {
    status: 'locked',
    armed: { equipment: false, control: false },
    version: 0,
  }
}

export function applyHatchAction(
  state: HatchState,
  action: HatchAction,
  role: Role,
): HatchState {
  if (state.status === 'open') throw new Error('The hatch is already open.')
  if (action.type !== 'arm' && role !== 'control')
    throw new Error(
      'Only Control can enter codes, reset, or release the hatch.',
    )
  if (action.type === 'reset')
    return { ...initialHatch(), version: state.version + 1 }
  if (action.type === 'submit') {
    if (state.status === 'authorized')
      throw new Error(
        'Release already authorized. Arm both sides or reset the keypad.',
      )
    return {
      status: action.code === releaseCode ? 'authorized' : 'rejected',
      armed: { equipment: false, control: false },
      version: state.version + 1,
    }
  }
  if (state.status !== 'authorized')
    throw new Error('Enter the correct code to authorize the release first.')
  if (action.type === 'arm')
    return {
      ...state,
      armed: { ...state.armed, [role]: action.armed },
      version: state.version + 1,
    }
  if (!state.armed.equipment || !state.armed.control)
    throw new Error('Both players must arm their side before release.')
  return { ...state, status: 'open', version: state.version + 1 }
}

export function hatchView(state: HatchState, role: Role): HatchView {
  const publicState = {
    status: state.status,
    armed: { ...state.armed },
    version: state.version,
  }
  if (role === 'control') return { ...publicState, role }
  return {
    ...publicState,
    role,
    plate: [...plate],
    legend: legend.map((row) => ({ ...row })),
  }
}

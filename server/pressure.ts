import type {
  PressureAction,
  PressureState,
  PressureView,
  Role,
  ValveId,
} from '../shared/protocol.ts'

const effects: Record<ValveId, [number, number]> = {
  intake: [-20, 10],
  bypass: [-10, 20],
  return: [15, -15],
}
const safeRange: [number, number] = [45, 55]

export function initialPressure(): PressureState {
  return {
    status: 'active',
    valves: { intake: false, bypass: false, return: false },
    version: 0,
  }
}

export function pressureReadings(state: PressureState): [number, number] {
  const readings: [number, number] = [80, 20]
  for (const id of Object.keys(effects) as ValveId[]) {
    if (state.valves[id]) {
      readings[0] += effects[id][0]
      readings[1] += effects[id][1]
    }
  }
  return readings
}

export function applyPressureAction(
  state: PressureState,
  action: PressureAction,
): PressureState {
  if (state.status === 'drained')
    throw new Error('The airlock is already drained.')
  if (action.type === 'reset')
    return { ...initialPressure(), version: state.version + 1 }
  if (action.type === 'pump') {
    const safe = pressureReadings(state).every(
      (reading) => reading >= safeRange[0] && reading <= safeRange[1],
    )
    if (!safe)
      throw new Error(
        'Pump interlock engaged. Ask your partner to confirm both chambers are in the safe range.',
      )
    return { ...state, status: 'drained', version: state.version + 1 }
  }
  return {
    ...state,
    valves: { ...state.valves, [action.valve]: action.open },
    version: state.version + 1,
  }
}

export function pressureView(state: PressureState, role: Role): PressureView {
  const publicState = { status: state.status, version: state.version }
  if (role === 'control')
    return { ...publicState, role, valves: { ...state.valves } }
  return {
    ...publicState,
    role,
    readings: pressureReadings(state),
    safeRange: [...safeRange],
  }
}

export function completedPressure(): PressureState {
  let state = initialPressure()
  state = applyPressureAction(state, {
    type: 'valve',
    valve: 'intake',
    open: true,
  })
  state = applyPressureAction(state, {
    type: 'valve',
    valve: 'bypass',
    open: true,
  })
  return applyPressureAction(state, { type: 'pump' })
}

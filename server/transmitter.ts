import type {
  TransmitterAction,
  TransmitterState,
  TransmitterView,
  TransmissionRow,
  Role,
} from '../shared/protocol.ts'

const chart: TransmissionRow[] = [
  {
    service: 'Maintenance',
    settings: { frequencyKHz: 4200, bearing: 'north', code: '1042' },
  },
  {
    service: 'Rescue',
    settings: { frequencyKHz: 5600, bearing: 'west', code: '7314' },
  },
  {
    service: 'Supply',
    settings: { frequencyKHz: 6800, bearing: 'east', code: '2691' },
  },
]
const rescue = chart[1].settings

export function initialTransmitter(): TransmitterState {
  return {
    status: 'active',
    settings: { frequencyKHz: 4200, bearing: 'north', code: '' },
    version: 0,
  }
}

export function applyTransmitterAction(
  state: TransmitterState,
  action: TransmitterAction,
): TransmitterState {
  if (state.status === 'sent')
    throw new Error('Rescue has already acknowledged the signal.')
  if (action.type === 'reset')
    return { ...initialTransmitter(), version: state.version + 1 }
  if (action.type === 'tune')
    return {
      status: 'active',
      settings: { ...action.settings },
      version: state.version + 1,
    }
  const correct =
    state.settings.frequencyKHz === rescue.frequencyKHz &&
    state.settings.bearing === rescue.bearing &&
    state.settings.code === rescue.code
  return {
    ...state,
    status: correct ? 'sent' : 'unanswered',
    version: state.version + 1,
  }
}

export function transmitterView(
  state: TransmitterState,
  role: Role,
): TransmitterView {
  const publicState = { status: state.status, version: state.version }
  if (role === 'equipment')
    return { ...publicState, role, settings: { ...state.settings } }
  return {
    ...publicState,
    role,
    targetService: 'Rescue',
    chart: chart.map((row) => ({
      service: row.service,
      settings: { ...row.settings },
    })),
  }
}

export function completedTransmitter(): TransmitterState {
  return applyTransmitterAction(
    applyTransmitterAction(initialTransmitter(), {
      type: 'tune',
      settings: rescue,
    }),
    { type: 'transmit' },
  )
}

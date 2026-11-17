import { randomInt } from 'node:crypto'
import type {
  BreakerId,
  PowerAction,
  PowerInstruction,
  PowerState,
  PowerView,
  Role,
} from '../shared/protocol.ts'

const baseInstructions: PowerInstruction[] = [
  {
    title: 'Auxiliary startup',
    steps: [
      { breaker: 'beacon', on: true },
      { breaker: 'tide', on: true },
      { breaker: 'beacon', on: false },
      { breaker: 'ring', on: true },
      { breaker: 'anchor', on: true },
      { breaker: 'tide', on: false },
    ],
  },
  {
    title: 'Airlock transfer',
    steps: [
      { breaker: 'diamond', on: true },
      { breaker: 'ring', on: false },
      { breaker: 'beacon', on: true },
      { breaker: 'anchor', on: false },
      { breaker: 'square', on: true },
      { breaker: 'tide', on: true },
    ],
  },
]
const symbols: BreakerId[] = [
  'beacon',
  'tide',
  'ring',
  'anchor',
  'diamond',
  'square',
  'coil',
  'star',
]
export const powerPathCount = 6

function instructionsFor(path: number): PowerInstruction[] {
  return baseInstructions.map((block) => ({
    title: block.title,
    steps: block.steps.map((step) => ({
      breaker: symbols[(symbols.indexOf(step.breaker) + path) % symbols.length],
      on: step.on,
    })),
  }))
}

export function nextPowerPath(previous: number): number {
  if (previous < 0) return randomInt(powerPathCount)
  return (previous + 1 + randomInt(powerPathCount - 1)) % powerPathCount
}

export function initialPower(path = 0): PowerState {
  if (!Number.isInteger(path) || path < 0 || path >= powerPathCount)
    throw new Error('Invalid power path.')
  return { status: 'active', activated: [], progress: 0, path, version: 0 }
}

export function applyPowerAction(
  state: PowerState,
  action: PowerAction,
): PowerState {
  if (state.status === 'restored') throw new Error('Power is already restored.')
  if (action.type === 'reset')
    return { ...initialPower(state.path), version: state.version + 1 }
  if (state.status === 'tripped')
    throw new Error('Reset the panel before trying again.')
  const on = !state.activated.includes(action.breaker)
  const sequence = instructionsFor(state.path).flatMap((block) => block.steps)
  const expected = sequence[state.progress]
  if (action.breaker !== expected.breaker || on !== expected.on)
    return { ...state, status: 'tripped', version: state.version + 1 }
  const activated = on
    ? [...state.activated, action.breaker]
    : state.activated.filter((id) => id !== action.breaker)
  const progress = state.progress + 1
  return {
    status: progress === sequence.length ? 'restored' : 'active',
    activated,
    progress,
    path: state.path,
    version: state.version + 1,
  }
}

export function completedPower(path = 0): PowerState {
  return instructionsFor(path)
    .flatMap((block) => block.steps)
    .reduce(
      (state, step) =>
        applyPowerAction(state, { type: 'breaker', breaker: step.breaker }),
      initialPower(path),
    )
}

export function powerView(state: PowerState, role: Role): PowerView {
  const publicState = {
    status: state.status,
    activated: [...state.activated],
    version: state.version,
  }
  if (role === 'control') {
    let endOfBlock = 0
    return {
      ...publicState,
      role,
      instructions: instructionsFor(state.path).map((block) => {
        endOfBlock += block.steps.length
        return {
          title: block.title,
          complete: state.status !== 'tripped' && state.progress >= endOfBlock,
          steps: block.steps.map((step) => ({ ...step })),
        }
      }),
    }
  }
  return { ...publicState, role }
}

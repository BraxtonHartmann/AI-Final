import type { BreakerId } from '../../shared/protocol.ts'
import type { Lobby } from '../../server/lobby.ts'

// Independent expected procedure used by rule, transport, and playthrough tests.
export const powerProcedure: BreakerId[] = [
  'beacon',
  'tide',
  'beacon',
  'ring',
  'anchor',
  'tide',
  'diamond',
  'ring',
  'beacon',
  'anchor',
  'square',
  'tide',
]

export function restorePower(lobby: Lobby, socketId = 'equipment') {
  for (const [version, breaker] of powerProcedure.entries()) {
    lobby.power(
      socketId,
      { type: 'breaker', breaker },
      `power-${version}`,
      version,
    )
  }
}

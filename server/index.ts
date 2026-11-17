import { createLobbyServer } from './server.ts'

const server = createLobbyServer({
  allowPuzzleSkip:
    process.env.NODE_ENV !== 'production' &&
    ['dev', 'dev:server'].includes(process.env.npm_lifecycle_event ?? ''),
})
const port = Number(process.env.PORT ?? 3001)
server.http.listen(port, '127.0.0.1', () => {
  console.log(`Lobby server listening on http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0))
  })
}

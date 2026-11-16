import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type {
  ClientEvents,
  Reply,
  Request,
  RoomView,
  ServerEvents,
  Session,
} from '../shared/protocol'

const storageKey = 'escape-room-session'

function readSession(): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
    if (
      value &&
      typeof value.code === 'string' &&
      typeof value.token === 'string' &&
      typeof value.playerId === 'string'
    )
      return value
  } catch {
    /* An unavailable or stale browser session starts at the entry screen. */
  }
  return null
}

export function useLobby() {
  const socketRef = useRef<Socket<ServerEvents, ClientEvents> | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const busyRef = useRef(false)
  const [session, setSession] = useState<Session | null>(null)
  const [room, setRoom] = useState<RoomView | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  function saveSession(next: Session | null) {
    sessionRef.current = next
    setSession(next)
    try {
      if (next) sessionStorage.setItem(storageKey, JSON.stringify(next))
      else sessionStorage.removeItem(storageKey)
    } catch {
      setError(
        'Browser storage is unavailable. Your seat cannot be restored after a refresh.',
      )
    }
  }

  useEffect(() => {
    const socket: Socket<ServerEvents, ClientEvents> = io({
      autoConnect: false,
    })
    socketRef.current = socket
    sessionRef.current = readSession()
    socket.on('connect', async () => {
      setConnected(true)
      setError('')
      busyRef.current = true
      setBusy(true)
      const previous = sessionRef.current
      try {
        if (previous) {
          const reply = await socket
            .timeout(5000)
            .emitWithAck('request', {
              type: 'resume',
              code: previous.code,
              token: previous.token,
            })
          if (reply.ok && reply.session) {
            saveSession(reply.session)
            setRoom(reply.room)
          } else if (!reply.ok) {
            saveSession(null)
            setRoom(null)
            setError(reply.error)
          }
        }
      } catch {
        setError('Could not restore your seat. Reconnecting…')
        socket.disconnect().connect()
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    })
    socket.on('room', (next) => {
      setRoom((current) =>
        !current ||
        current.code !== next.code ||
        next.revision >= current.revision
          ? next
          : current,
      )
    })
    socket.on('disconnect', () => {
      setConnected(false)
    })
    socket.on('connect_error', () => {
      setError('Unable to reach the station. Retrying the connection…')
      setConnected(false)
    })
    socket.on('expired', () => {
      saveSession(null)
      setRoom(null)
      setError(
        'The room expired after inactivity. Create a new room to continue.',
      )
    })
    socket.on('replaced', () => {
      saveSession(null)
      setRoom(null)
      setError(
        'Your seat was opened in another tab. Reload to join a new room.',
      )
      socket.disconnect()
    })
    socket.connect()
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [])

  async function send(request: Request) {
    const socket = socketRef.current
    if (!socket?.connected || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const reply: Reply = await socket
        .timeout(5000)
        .emitWithAck('request', request)
      if (!reply.ok) {
        setError(reply.error)
        return
      }
      if (reply.session) saveSession(reply.session)
      if (request.type === 'leave') saveSession(null)
      setRoom(reply.room)
    } catch {
      setError(
        'The connection was interrupted. Restoring the latest room state…',
      )
      // Reconnect and request a snapshot instead of repeating an uncertain action.
      socket.disconnect().connect()
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return { room, session, connected, busy, error, send }
}

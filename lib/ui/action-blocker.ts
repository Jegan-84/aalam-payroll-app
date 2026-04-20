'use client'

import {
  useActionState,
  useEffect,
  useSyncExternalStore,
  useTransition,
} from 'react'

// =============================================================================
// Global "action pending" counter — drives the full-screen ActionBlocker.
// =============================================================================
// Any button/switch/form that fires a server action should use one of the
// hooks below instead of React's raw `useTransition` / `useActionState`. They
// behave identically except they bump a singleton counter while pending; the
// <ActionBlocker /> mounted in the (app) layout renders a <PageLoader /> whenever
// the counter is > 0, which blocks every click underneath.
//
// Why a counter (not a boolean): many actions can overlap, and each individual
// hook decrements on its own completion — the overlay stays up until all are
// settled.
// =============================================================================

type Listener = () => void
let pendingCount = 0
const listeners = new Set<Listener>()

function inc() {
  pendingCount += 1
  listeners.forEach((l) => l())
}

function dec() {
  pendingCount = Math.max(0, pendingCount - 1)
  listeners.forEach((l) => l())
}

function subscribe(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function getSnapshot() {
  return pendingCount
}

function getServerSnapshot() {
  return 0
}

/** Returns the current number of pending tracked actions. 0 = idle. */
export function useActionPendingCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// =============================================================================
// useBlockingTransition — drop-in for React's useTransition
// =============================================================================
export function useBlockingTransition(): readonly [
  boolean,
  (cb: () => void) => void,
] {
  const [pending, startTransition] = useTransition()
  useEffect(() => {
    if (!pending) return
    inc()
    return () => {
      dec()
    }
  }, [pending])
  return [pending, startTransition] as const
}

// =============================================================================
// useBlockingActionState — drop-in for React's useActionState
// =============================================================================
export function useBlockingActionState<State, Payload>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  initialState: Awaited<State>,
  permalink?: string,
): [Awaited<State>, (payload: Payload) => void, boolean] {
  const [state, dispatch, pending] = useActionState(action, initialState, permalink)
  useEffect(() => {
    if (!pending) return
    inc()
    return () => {
      dec()
    }
  }, [pending])
  return [state, dispatch, pending]
}

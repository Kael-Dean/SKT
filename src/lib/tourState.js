// src/lib/tourState.js
// ─────────────────────────────────────────────────────────────────────────────
// Run state of the self-service tour: { active, index }. Persisted in sessionStorage
// (TOUR_STATE_KEY — cleared on logout by auth.js) so a reload or a page change keeps the
// stop. Tiny external store; components read it with useTourState().
//
//   startTour(i = 0)   begin / jump to stop i (active)
//   pauseTour()        hide the overlay, keep the index ("ข้าม" / Esc) → Home shows resume
//   resumeTour()       show again at the kept index
//   setTourIndex(i)    move to stop i
//   stopTour()         forget everything (finished)
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"
import { TOUR_STATE_KEY } from "./onboarding"
import { TOUR_LENGTH } from "./onboardingTour"

const IDLE = { active: false, index: 0, started: false }
const listeners = new Set()
let cacheRaw = undefined
let cacheVal = IDLE

function readRaw() {
  try {
    return sessionStorage.getItem(TOUR_STATE_KEY)
  } catch {
    return null
  }
}

/** Snapshot (stable object while the stored string is unchanged). */
export function getTourState() {
  const raw = readRaw()
  if (raw === cacheRaw) return cacheVal
  cacheRaw = raw
  let v = IDLE
  if (raw) {
    try {
      const p = JSON.parse(raw)
      const index = Math.min(Math.max(0, Number(p.index) || 0), TOUR_LENGTH - 1)
      v = { active: Boolean(p.active), index, started: true }
    } catch {
      v = IDLE
    }
  }
  cacheVal = v
  return v
}

function write(next) {
  try {
    if (next) sessionStorage.setItem(TOUR_STATE_KEY, JSON.stringify(next))
    else sessionStorage.removeItem(TOUR_STATE_KEY)
  } catch {
    // storage disabled — state lives only until the next read
  }
  listeners.forEach((fn) => fn())
}

export const startTour = (index = 0) => write({ active: true, index })
export const setTourIndex = (index) => write({ active: true, index: Math.min(Math.max(0, index), TOUR_LENGTH - 1) })
export const pauseTour = () => write({ active: false, index: getTourState().index })
export const resumeTour = () => write({ active: true, index: getTourState().index })
export const stopTour = () => write(null)

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useTourState() {
  return useSyncExternalStore(subscribe, getTourState, getTourState)
}

/** Window event: detail true = open the Sidebar drawer, false = close it (AppLayout listens). */
export const TOUR_SIDEBAR_EVENT = "tour:sidebar"

import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "./api"
import { onMasterDataChanged } from "./useProductsByGroup"

const cache = new Map()
const inflight = new Map()
const subscribers = new Map() // path → Set<refetch fn>

function loadList(path) {
  if (cache.has(path)) return Promise.resolve(cache.get(path))
  if (inflight.has(path)) return inflight.get(path)
  const p = apiAuth(path)
    .then((data) => {
      const items = Array.isArray(data) ? data : []
      cache.set(path, items)
      inflight.delete(path)
      return items
    })
    .catch((err) => {
      inflight.delete(path)
      throw err
    })
  inflight.set(path, p)
  return p
}

function notify(path) {
  const subs = subscribers.get(path)
  if (subs) for (const cb of subs) try { cb() } catch { /* ignore */ }
}

export function invalidateBusinessListCache(path) {
  if (path) {
    cache.delete(path)
    notify(path)
  } else {
    cache.clear()
    for (const p of subscribers.keys()) notify(p)
  }
}

function useList(path, businessGroupId) {
  const [state, setState] = useState(() => ({
    items: cache.get(path) || [],
    loading: !cache.has(path),
    error: null,
  }))

  useEffect(() => {
    let alive = true

    const refetch = () => {
      cache.delete(path)
      setState((s) => ({ ...s, loading: true, error: null }))
      loadList(path)
        .then((items) => alive && setState({ items, loading: false, error: null }))
        .catch((error) => alive && setState({ items: [], loading: false, error }))
    }

    if (cache.has(path)) {
      setState({ items: cache.get(path), loading: false, error: null })
    } else {
      setState((s) => ({ ...s, loading: true, error: null }))
      loadList(path)
        .then((items) => alive && setState({ items, loading: false, error: null }))
        .catch((error) => alive && setState({ items: [], loading: false, error }))
    }

    // subscribe ให้ refetch เมื่อมีคน invalidate
    const subs = subscribers.get(path) || new Set()
    subs.add(refetch)
    subscribers.set(path, subs)

    // refetch เมื่อ master data ถูกแก้ (จาก BusinessEdit)
    const off = onMasterDataChanged(() => { refetch() })

    return () => {
      alive = false
      const s = subscribers.get(path)
      if (s) {
        s.delete(refetch)
        if (s.size === 0) subscribers.delete(path)
      }
      off()
    }
  }, [path])

  const bg = Number(businessGroupId || 0) || 0

  const filtered = useMemo(
    () => (bg ? state.items.filter((x) => Number(x.business_group_id) === bg) : state.items),
    [state.items, bg]
  )

  const { byId, nameById } = useMemo(() => {
    const byId = {}
    const nameById = {}
    for (const it of filtered) {
      byId[it.id] = it
      nameById[it.id] = it.name
    }
    return { byId, nameById }
  }, [filtered])

  return { items: filtered, byId, nameById, loading: state.loading, error: state.error }
}

export function useBusinessCosts(businessGroupId) {
  return useList("/lists/businesscosts", businessGroupId)
}

export function useBusinessEarnings(businessGroupId) {
  return useList("/lists/businessearnings", businessGroupId)
}

export function useAuxCosts(businessGroupId) {
  return useList("/lists/auxcosts", businessGroupId)
}

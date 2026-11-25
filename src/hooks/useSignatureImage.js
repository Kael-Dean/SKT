// src/hooks/useSignatureImage.js
// โหลดรูปลายเซ็น (data URI) จากฟังก์ชันใน lib/signatures — key เปลี่ยน = โหลดใหม่, key=null = ไม่โหลด
//   const { src, loading } = useSignatureImage(() => loadRequestImage(id), `req:${id}`)
import { useEffect, useRef, useState } from "react"

const cache = new Map() // key → Promise<string|null>

export function clearSignatureImageCache() {
  cache.clear()
}

export default function useSignatureImage(loader, key) {
  const [state, setState] = useState({ key: null, src: null })
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    if (key == null) return
    let alive = true
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => loaderRef.current()).catch(() => null))
    cache.get(key).then((src) => alive && setState({ key, src }))
    return () => { alive = false }
  }, [key])

  const ready = key != null && state.key === key
  return { src: ready ? state.src : null, loading: key != null && !ready }
}

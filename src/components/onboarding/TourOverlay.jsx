// src/components/onboarding/TourOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Self-service tour over the REAL pages (onboarding PR 59, api-handoff §6.7–6.9).
// Mounted once in AppLayout; renders nothing unless a tour is active (lib/tourState.js)
// and the person is unlocked.
//
// Per stop (lib/onboardingTour.js): open stop.route → wait ≤3s for [data-tour="<target>"]
// → scroll it into view → one fixed rounded "spotlight" box whose huge box-shadow is the
// scrim; it GLIDES between targets (top/left/width/height, index.css .ob-spotlight).
// No route/target (or not found) → the box collapses to the centre = full scrim + centred
// card. Desktop: card beside the target (flips to fit). Phone: card docked at the bottom.
// Last stop: tour-complete → complete; 422 sends the person back to what is left.
//
// z 10045: above Sheet (10040), below popovers (10050) / ConfirmDialog / Toaster.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, LoaderCircle } from "lucide-react"
import Portal from "../Portal"
import Celebration from "./Celebration"
import Mascot from "../ui/Mascot"
import { toast } from "../ui"
import { apiAuth } from "../../lib/api"
import { completeOnboarding, sectionMeta, tourComplete, useOnboarding } from "../../lib/onboarding"
import { TOUR_LENGTH, TOUR_STOPS } from "../../lib/onboardingTour"
import { TOUR_SIDEBAR_EVENT, pauseTour, resumeTour, setTourIndex, startTour, stopTour, useTourState } from "../../lib/tourState"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { cx, focusRingCls, neutralBtnCls, primaryBtnCls, submitBtnCls } from "../../lib/styles"

const Z = 10045
const PAD = 8
const GAP = 16
const CARD_W = 384
const FIND_TIMEOUT = 3000
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
const topbarH = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 64
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Leave quota chips — the person's own figures (fails silently; field names vary). */
function LeaveQuota() {
  const [items, setItems] = useState(null)
  useEffect(() => {
    let alive = true
    apiAuth("/personnel/me/leave-balance")
      .then((d) => {
        if (!alive || !Array.isArray(d)) return
        const list = d
          .map((x) => ({
            label: x?.leave_type_name ?? x?.leave_type ?? x?.name ?? x?.type_name ?? x?.label,
            remaining: x?.remaining ?? x?.balance ?? x?.left,
            quota: x?.quota ?? x?.entitled ?? x?.total ?? x?.days,
          }))
          .filter((x) => x.label && (x.remaining != null || x.quota != null))
        setItems(list)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  if (!items?.length) return null
  const num = (v) => (v == null || v === "" ? null : Number(v).toLocaleString("th-TH", { maximumFractionDigits: 1 }))
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">สิทธิ์ลาของคุณปีนี้</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {items.map((x) => (
          <li
            key={x.label}
            className="rounded-xl bg-indigo-50 px-2.5 py-1 text-[13px] leading-snug text-indigo-900 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-100 dark:ring-indigo-400/20"
          >
            <span className="font-medium">{x.label}</span>{" "}
            <span className="tabular-nums">
              {x.remaining != null ? <>เหลือ <b className="font-semibold">{num(x.remaining)}</b></> : null}
              {x.quota != null ? <> / {num(x.quota)}</> : null} วัน
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Progress dots — the active one is wider; width animates (tiny, on purpose). */
function Dots({ index }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-1.5">
      {TOUR_STOPS.map((s, i) => (
        <span
          key={s.key}
          className={cx(
            "h-1.5 rounded-full transition-all duration-300 ease-[cubic-bezier(.32,.72,0,1)]",
            i === index ? "w-5 bg-indigo-600 dark:bg-indigo-400" : i < index ? "w-1.5 bg-indigo-300 dark:bg-indigo-400/50" : "w-1.5 bg-gray-300 dark:bg-white/15",
          )}
        />
      ))}
    </div>
  )
}

function TourRunner({ index, onFinished }) {
  const stop = TOUR_STOPS[index]
  const isLast = index === TOUR_LENGTH - 1
  const navigate = useNavigate()
  const location = useLocation()
  const isPhone = useIsPhone()
  const titleId = useId()
  const descId = useId()
  const cardRef = useRef(null)
  const headingRef = useRef(null)
  const targetRef = useRef(null)
  const [rect, setRect] = useState(null)
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [cardH, setCardH] = useState(0)
  const [placed, setPlaced] = useState(false)
  const [busy, setBusy] = useState(false)

  // 1 · open the page of this stop (once per stop; a role that is redirected elsewhere
  //     simply falls back to a centred card after the timeout)
  useEffect(() => {
    if (stop.route && location.pathname !== stop.route) navigate(stop.route)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate once per stop, not on every route change
  }, [index])

  // 1b · stops that live in the menu drawer open it (AppLayout listens) and close it after;
  //      the drawer focuses its own close button, so hand focus back to the card
  useEffect(() => {
    if (!stop.sidebar) return
    window.dispatchEvent(new CustomEvent(TOUR_SIDEBAR_EVENT, { detail: true }))
    const t = setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 120)
    return () => {
      clearTimeout(t)
      window.dispatchEvent(new CustomEvent(TOUR_SIDEBAR_EVENT, { detail: false }))
    }
  }, [index, stop.sidebar])

  // 2 · find the target, bring it into view, keep measuring
  const measure = useCallback(() => {
    const el = targetRef.current
    setVp({ w: window.innerWidth, h: window.innerHeight })
    if (!el || !el.isConnected) return setRect(null)
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return setRect(null)
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [])

  useEffect(() => {
    targetRef.current = null
    setRect(null)
    if (!stop.target) return
    let raf = 0
    let ro = null
    const started = Date.now()
    const found = (el) => {
      targetRef.current = el
      const r = el.getBoundingClientRect()
      const top = topbarH()
      const avail = window.innerHeight - top
      // desktop: no room for the card beside a wide target → park the target near the top
      // so the card can sit underneath it instead of over it
      const sideRoom = Math.max(r.left, window.innerWidth - r.right) - PAD - 2 * GAP
      let y
      if (isPhone) y = window.scrollY + r.top - top - 12
      else if (sideRoom < CARD_W) y = window.scrollY + r.top - top - 16
      else if (r.height < avail - 48) y = window.scrollY + r.top - top - (avail - r.height) / 2
      else y = window.scrollY + r.top - top - 16
      window.scrollTo({ top: Math.max(0, y), behavior: reducedMotion() ? "auto" : "smooth" })
      // follow the page entrance + smooth scroll for a moment, then rely on events
      const until = Date.now() + 900
      const loop = () => {
        measure()
        if (Date.now() < until) raf = requestAnimationFrame(loop)
      }
      loop()
      if (typeof ResizeObserver === "function") {
        ro = new ResizeObserver(measure)
        ro.observe(el)
      }
    }
    const poll = setInterval(() => {
      const el = document.querySelector(`[data-tour="${stop.target}"]`)
      if (el && el.getClientRects().length) {
        clearInterval(poll)
        found(el)
      } else if (Date.now() - started > FIND_TIMEOUT) clearInterval(poll)
    }, 120)
    return () => {
      clearInterval(poll)
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [index, stop.target, isPhone, measure])

  useEffect(() => {
    const on = () => measure()
    window.addEventListener("resize", on)
    window.addEventListener("scroll", on, true)
    return () => {
      window.removeEventListener("resize", on)
      window.removeEventListener("scroll", on, true)
    }
  }, [measure])

  // 3 · card size (desktop placement needs it)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const write = () => setCardH(el.offsetHeight)
    write()
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(write) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [isPhone])

  // 4 · focus the stop heading on every stop (announced via aria-live as well)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [index])

  // ── geometry ──────────────────────────────────────────────────────────────
  const hole = rect
    ? (() => {
        const top = clamp(rect.top - PAD, 8, vp.h - 16)
        const bottom = clamp(rect.top + rect.height + PAD, top + 8, vp.h - 8)
        const left = clamp(rect.left - PAD, 8, vp.w - 16)
        const right = clamp(rect.left + rect.width + PAD, left + 8, vp.w - 8)
        return { top, left, width: right - left, height: bottom - top, r: 16 }
      })()
    : { top: vp.h / 2, left: vp.w / 2, width: 0, height: 0, r: 0 }

  let cardPos = null
  const cardW = Math.min(CARD_W, vp.w - 2 * GAP)
  if (!isPhone) {
    const w = cardW
    const h = cardH || 280
    if (!rect) cardPos = { x: (vp.w - w) / 2, y: (vp.h - h) / 2 }
    else {
      const right = vp.w - (hole.left + hole.width) - GAP
      const left = hole.left - GAP
      const yBeside = clamp(hole.top, GAP, vp.h - h - GAP)
      if (right >= w + GAP) cardPos = { x: hole.left + hole.width + GAP, y: yBeside }
      else if (left >= w + GAP) cardPos = { x: hole.left - GAP - w, y: yBeside }
      else {
        const x = clamp(hole.left, GAP, vp.w - w - GAP)
        if (vp.h - (hole.top + hole.height) - GAP >= h + GAP) cardPos = { x, y: hole.top + hole.height + GAP }
        else if (hole.top - GAP >= h + GAP) cardPos = { x, y: hole.top - GAP - h }
        else cardPos = { x: vp.w - w - 24, y: vp.h - h - 24 }
      }
    }
  }

  // Where น้องหอมทอง points: from the mascot (top-left of the card) toward the
  // spotlight centre. Mostly sideways; up/down only when the target sits clearly
  // above or below. The artwork points to its right, so mirror for targets on the left.
  const mascotAim = (() => {
    if (!rect) return { point: "side", mirror: false }
    const mx = isPhone ? 64 : cardPos.x + 64
    const my = isPhone ? vp.h - (cardH || vp.h * 0.6) + 80 : cardPos.y + 96
    const dx = hole.left + hole.width / 2 - mx
    const dy = hole.top + hole.height / 2 - my
    const mirror = dx < 0
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return { point: dy < 0 ? "up" : "down", mirror }
    return { point: "side", mirror }
  })()
  useEffect(() => {
    if (cardH) {
      const id = requestAnimationFrame(() => setPlaced(true))
      return () => cancelAnimationFrame(id)
    }
  }, [cardH])

  // ── actions ───────────────────────────────────────────────────────────────
  const skip = () => {
    pauseTour()
    toast.info("หยุดทัวร์ไว้ก่อน", {
      id: "tour-paused",
      description: "ดูต่อได้จากหน้าหลัก",
      action: { label: "ดูต่อ", onClick: resumeTour },
    })
  }
  const back = () => index > 0 && setTourIndex(index - 1)
  const finish = async () => {
    if (busy) return
    setBusy(true)
    try {
      await tourComplete()
      await completeOnboarding()
      stopTour()
      onFinished()
    } catch (err) {
      const d = err?.data?.detail
      if (err?.status === 422 && d && typeof d === "object" && !Array.isArray(d)) {
        if (Array.isArray(d.sections) && d.sections.length) {
          pauseTour()
          toast.warning("ยังมีข้อมูลที่ต้องยืนยันอีกครั้ง", {
            description: d.sections.map((k) => sectionMeta(k)?.label ?? k).join(", "),
          })
          navigate(`/onboarding?step=${d.sections[0]}`)
          return
        }
        if (d.tour) {
          startTour(0)
          toast.info("ขอเริ่มทัวร์ใหม่อีกครั้ง")
          return
        }
      }
      if (!err?.onboardingRequired) toast.error("บันทึกไม่สำเร็จ", { description: err?.message || "ลองอีกครั้ง" })
    } finally {
      setBusy(false)
    }
  }
  const next = () => (isLast ? finish() : setTourIndex(index + 1))

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      skip()
      return
    }
    if (e.key !== "Tab" || !cardRef.current) return
    const nodes = [...cardRef.current.querySelectorAll(FOCUSABLE)]
    if (!nodes.length) return
    const first = nodes[0]
    const lastNode = nodes[nodes.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
      e.preventDefault()
      lastNode.focus()
    } else if (!e.shiftKey && document.activeElement === lastNode) {
      e.preventDefault()
      first.focus()
    }
  }

  const card = (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onKeyDown={onKeyDown}
      style={
        isPhone
          ? undefined
          : { width: cardW, transform: `translate3d(${cardPos.x}px, ${cardPos.y}px, 0)` }
      }
      className={cx(
        "fixed bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-surface dark:shadow-black/60 dark:ring-line-strong",
        isPhone
          ? "inset-x-0 bottom-0 flex max-h-[62dvh] flex-col rounded-t-3xl px-5 pt-5 pb-safe-3 animate-sheet-in"
          : cx("top-0 left-0 flex max-h-[calc(100dvh-2rem)] flex-col rounded-2xl p-5", placed ? "ob-tour-card" : "opacity-0"),
      )}
    >
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-1">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            {index + 1}/{TOUR_LENGTH}
          </span>
          <button
            type="button"
            onClick={skip}
            className={cx(
              "-mr-2 inline-flex min-h-touch cursor-pointer items-center rounded-lg px-2 text-sm font-medium text-gray-500 hover:text-gray-900 md:min-h-8 dark:text-gray-400 dark:hover:text-gray-100",
              focusRingCls,
            )}
          >
            ข้าม
          </button>
        </div>
        {/* น้องหอมทอง guides every stop. It stays mounted across stops (outside the keyed
            block) so the Rive state machine keeps running: wave once, then point at the
            spotlight; the last stop switches to the success dance. */}
        <div className="mt-1 flex items-center gap-3">
          <Mascot
            mood={isLast ? "success" : "onboard"}
            size={isPhone ? 84 : 112}
            point={mascotAim.point}
            mirror={mascotAim.mirror}
            className="-my-2 -ml-2 shrink-0"
          />
          <div key={stop.key} className="animate-fade-in min-w-0 flex-1">
            <h2
              id={titleId}
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold leading-snug text-gray-900 text-balance focus:outline-none dark:text-gray-100"
            >
              {stop.title}
            </h2>
            <p id={descId} className="mt-1 text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">
              {stop.purpose}
            </p>
          </div>
        </div>
        <div key={`${stop.key}-body`} className="animate-fade-in">
          {stop.figures === "leave-balance" && <LeaveQuota />}
          {stop.howTo?.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">วิธีใช้</p>
              <ol className="mt-1.5 space-y-2">
                {stop.howTo.map((s, i) => (
                  <li key={s} className="flex gap-2.5 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                    <span
                      aria-hidden="true"
                      className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold tabular-nums text-white dark:bg-indigo-500"
                    >
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {stop.policy?.length > 0 && (
            <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[.04]">
              {stop.howTo?.length > 0 && (
                <p className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">ควรรู้</p>
              )}
              <ul className="space-y-1.5">
                {stop.policy.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400 dark:bg-indigo-400/80" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 shrink-0">
        <Dots index={index} />
      </div>
      <div className="mt-3 flex shrink-0 items-center gap-2">
        {index > 0 && (
          <button type="button" onClick={back} disabled={busy} className={cx(neutralBtnCls, "whitespace-nowrap px-3")}>
            <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2} />
            ย้อนกลับ
          </button>
        )}
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={next}
            disabled={busy}
            aria-busy={busy || undefined}
            data-autofocus
            className={cx(
              isLast ? cx(submitBtnCls, "h-11 rounded-xl px-4 py-0 text-sm hover:scale-100 md:h-10") : primaryBtnCls,
              "whitespace-nowrap",
            )}
          >
            {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            {isLast ? "เสร็จสิ้น" : "เข้าใจแล้ว ถัดไป"}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <Portal>
      <div style={{ zIndex: Z }} className="fixed inset-0">
        {/* click shield: the page underneath is for looking, not touching */}
        <div className="absolute inset-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className={cx(
            "ob-spotlight pointer-events-none fixed",
            "shadow-[0_0_0_9999px_rgb(17_17_24/.55)] dark:shadow-[0_0_0_9999px_rgb(0_0_0/.72)]",
            rect && "outline-2 outline-offset-0 outline-white/80 dark:outline-indigo-300/70",
          )}
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: hole.r }}
        />
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {`จุดที่ ${index + 1} จาก ${TOUR_LENGTH}: ${stop.title}`}
        </p>
        {card}
      </div>
    </Portal>
  )
}

/** Short flourish after completing: check draws, rays burst, then Home. */
function FinishFlourish({ onDone }) {
  const navigate = useNavigate()
  useEffect(() => {
    toast.success("เริ่มใช้งานบริการตนเองได้แล้ว", { id: "onboarding-complete" })
    navigate("/home")
    const t = setTimeout(onDone, reducedMotion() ? 900 : 2800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, [])
  return (
    <Portal>
      <div
        style={{ zIndex: Z }}
        className="fixed inset-0 flex items-center justify-center bg-white/70 animate-fade-in dark:bg-canvas/75"
        onClick={onDone}
        role="status"
      >
        <div className="flex flex-col items-center text-center">
          {/* the success state is น้องหอมทอง's happy dance; Celebration stays as the
              still fallback under reduced motion (Mascot shows a static pose there) */}
          {reducedMotion() ? <Celebration size={152} /> : <Mascot mood="success" size={176} />}
          <p className="mt-3 text-xl font-bold text-gray-900 dark:text-gray-100">พร้อมใช้งานแล้ว</p>
          <p className="mt-1 text-[15px] text-gray-600 dark:text-gray-300">เมนูบริการตนเองเปิดให้ใช้ครบทุกเมนู</p>
        </div>
      </div>
    </Portal>
  )
}

export default function TourOverlay() {
  const tour = useTourState()
  const ob = useOnboarding()
  const [celebrate, setCelebrate] = useState(false)
  if (celebrate) return <FinishFlourish onDone={() => setCelebrate(false)} />
  if (!tour.active || !ob.unlocked) return null
  return <TourRunner index={tour.index} onFinished={() => setCelebrate(true)} />
}

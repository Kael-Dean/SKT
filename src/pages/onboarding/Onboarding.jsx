// src/pages/onboarding/Onboarding.jsx
// ─────────────────────────────────────────────────────────────────────────────
// First-login onboarding (backend PR 59) — focused full-screen flow, outside AppLayout.
//
//   ?step=welcome | account | personal | address | family | education | work | criminal | license | ready | done
//   (pushes history, so the browser back button walks the steps)
//
// Status + prefill: useOnboarding() (src/lib/onboarding.js); every PUT/confirm returns the
// full payload and the store re-renders this page. All 8 confirmed → `unlocked` → "ready"
// → the self-service tour starts on /home (components/onboarding/TourOverlay.jsx), whose
// last stop ("ส่งข้อมูลยืนยัน") completes onboarding.
//
// Hard lock: AppLayout keeps everyone who has not finished here (or inside the tour); the only
// way out of this page before finishing is "ออกจากระบบ".
//
// `preview` (pages/admin/OnboardingWizardPreview.jsx, Super Admin only) = { ob, exit, onStartTour,
// offset }: runs on an in-memory payload with no status load, no logout, no report form, and every step
// reachable. Its saves are answered from memory (lib/onboarding.js) and drafts do nothing (onboardingDraft.js).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { WifiOff } from "lucide-react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import ReportIssueSheet from "../../components/ReportIssueSheet"
import { ConfirmDialog, ErrorState, PageLoader, ResultSheet, Stepper, Toaster, toast } from "../../components/ui"
import { getToken, logoutAndReload } from "../../lib/auth"
import {
  SECTIONS,
  SECTION_KEYS,
  completeOnboarding,
  firstOpenSection,
  getOnboardingState,
  isConnectionError,
  loadOnboarding,
  sectionMeta,
  tourComplete,
  useOnboarding,
} from "../../lib/onboarding"
import { clearAllDrafts } from "../../lib/onboardingDraft"
import { getTourState, resumeTour, startTour, stopTour } from "../../lib/tourState"
import { cx, focusRingCls } from "../../lib/styles"
import FamilyStep from "./FamilyStep"
import { WIZARD_STEP_KEYS as STEP_KEYS } from "./introContent"
import { DoneStep, ReadyStep, WelcomeStep } from "./IntroSteps"
import RowsStep from "./RowsStep"
import { AccountStep, AddressStep, PersonalStep } from "./ScalarSteps"

const STEPPER_STEPS = SECTIONS.map((s) => ({ key: s.key, label: s.label, shortLabel: s.short }))
const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

function applyStoredTheme() {
  const stored = localStorage.getItem("darkMode")
  const dark = stored !== null ? stored === "true" : (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false)
  document.documentElement.classList.toggle("dark", dark)
}

/**
 * Next section to open after `key` is confirmed (wraps around), or "ready" once none is left.
 * Decided from the sections themselves, not `payload.unlocked`: the server can report unlocked
 * while sections still wait (it was unlocked once, then sections were reopened), and trusting it
 * sent people to the tour screen after every save with only 3/8 done.
 */
function nextAfter(key, payload) {
  const sections = payload?.sections ?? {}
  const open = (k) => !sections[k]?.confirmed_at
  const i = SECTION_KEYS.indexOf(key)
  const order = [...SECTION_KEYS.slice(i + 1), ...SECTION_KEYS.slice(0, i)]
  return order.find(open) ?? "ready"
}

function Header({ confirmed, actionLabel, onAction, showProgress, stickyCls = "top-0" }) {
  const total = SECTIONS.length
  return (
    <header className={cx("sticky z-30", stickyCls, "border-b border-gray-200/70 bg-white/90 backdrop-blur-md dark:border-line dark:bg-canvas/85")}>
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 md:px-6">
        <img
          src={asset("/logo/amc-logo.png")}
          alt=""
          className="h-8 w-auto shrink-0 rounded object-contain dark:hidden"
          decoding="async"
        />
        <img
          src={asset("/logo/amc-logo-dark.png")}
          alt=""
          className="hidden h-8 w-auto shrink-0 rounded object-contain dark:block"
          decoding="async"
        />
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">
          ข้อมูลเริ่มต้น
          {showProgress && (
            <span className="ml-2 text-sm font-normal tabular-nums text-gray-500 dark:text-gray-400">
              {confirmed}/{total} หัวข้อ
            </span>
          )}
        </p>
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className={cx(
              "inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-xl px-3 text-[15px] font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100 md:pointer-fine:min-h-10 dark:text-gray-200 dark:hover:bg-white/[.06]",
              focusRingCls,
            )}
          >
            {actionLabel}
          </button>
        )}
      </div>
      {showProgress && (
        <div aria-hidden="true" className="h-0.5 bg-gray-100 dark:bg-white/[.06]">
          <div
            className="h-full origin-left bg-indigo-600 transition-transform duration-500 ease-[cubic-bezier(.25,1,.5,1)] dark:bg-indigo-400"
            style={{ transform: `scaleX(${confirmed / total})` }}
          />
        </div>
      )}
    </header>
  )
}

export default function Onboarding({ preview = null }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const liveOb = useOnboarding()
  const isPreview = Boolean(preview)
  const ob = isPreview ? preview.ob : liveOb
  const data = ob.data
  const [failed, setFailed] = useState([])
  const [locked409, setLocked409] = useState(false)
  const [report, setReport] = useState(null) // { category, field, value }
  const [askLogout, setAskLogout] = useState(false)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const mainRef = useRef(null)

  // ── boot: auth, theme, fresh status ────────────────────────────────────────
  useEffect(() => {
    applyStoredTheme()
    if (!getToken()) {
      navigate("/", { replace: true })
      return
    }
    if (!isPreview) loadOnboarding({ force: true })
  }, [navigate, isPreview])

  useEffect(() => {
    if (ob.status === "out_of_scope") navigate("/home", { replace: true })
  }, [ob.status, navigate])

  // finished (also on another device): nothing here can be saved any more
  const finished = Boolean(data?.onboarded)
  useEffect(() => {
    if (finished) clearAllDrafts()
  }, [finished])

  // connection indicator; coming back online refreshes the status
  useEffect(() => {
    const onOffline = () => setOffline(true)
    const onOnline = () => {
      setOffline(false)
      if (!isPreview) loadOnboarding({ force: true })
    }
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    return () => {
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [isPreview])

  // arrived from a locked menu → say why (once)
  const location = useLocation()
  const lockedFrom = location.state?.lockedFrom
  useEffect(() => {
    if (!lockedFrom) return
    toast.info(`เมนู “${lockedFrom}” จะเปิดเมื่อกรอกข้อมูลครบ`, {
      description: `กรอกให้ครบ ${SECTIONS.length} หัวข้อ แล้วดูทัวร์เมนูสั้น ๆ`,
      id: "onboarding-locked",
    })
  }, [lockedFrom])

  // message from a page that sent the person here: AppLayout's toaster unmounts on the way out
  const notice = location.state?.notice
  useEffect(() => {
    if (notice) toast.warning(notice.title, { description: notice.description, id: "onboarding-notice" })
  }, [notice])

  // ── resolve the step ───────────────────────────────────────────────────────
  const requested = params.get("step")
  // "ready" (ข้อมูลครบแล้ว) only when every section is really confirmed — `unlocked` alone can be
  // true while sections still wait, and finishing would 422 on them anyway.
  const openSection = data ? firstOpenSection(data) : null
  const allDone = Boolean(data?.unlocked) && SECTION_KEYS.every((k) => data.sections?.[k]?.confirmed_at)
  const defaultStep = !data ? null : data.onboarded ? "done" : allDone ? "ready" : "welcome"
  let step = STEP_KEYS.includes(requested) ? requested : defaultStep
  // A preview may open any step: there is no real progress for these rules to protect.
  if (data && !isPreview) {
    if (data.onboarded) step = "done"
    else if (step === "done") step = defaultStep
    else if (step === "ready" && !allDone) step = openSection ?? "welcome"
  }

  // direction-aware slide (also right for browser back/forward)
  const last = useRef({ step: null, dir: "next" })
  if (step && last.current.step !== step) {
    const prevIdx = STEP_KEYS.indexOf(last.current.step)
    last.current = { step, dir: prevIdx === -1 || STEP_KEYS.indexOf(step) >= prevIdx ? "next" : "prev" }
  }
  const dir = last.current.dir

  const firstRender = useRef(true)
  useEffect(() => {
    if (!step) return
    window.scrollTo(0, 0)
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
  }, [step])

  const goStep = (key, { replace = false } = {}) => setParams({ step: key }, { replace })
  const goHome = isPreview ? preview.exit : () => navigate("/home")

  // ── section handlers ───────────────────────────────────────────────────────
  const handlersFor = (key) => ({
    onDone: (payload) => {
      setFailed((f) => f.filter((k) => k !== key))
      goStep(nextAfter(key, payload))
    },
    onLocked: () => {
      clearAllDrafts()
      setLocked409(true)
    },
    onFailed: (k) => setFailed((f) => (f.includes(k) ? f : [...f, k])),
  })
  const sectionIdx = SECTION_KEYS.indexOf(step)
  const backFrom = (key) => {
    const i = SECTION_KEYS.indexOf(key)
    return () => goStep(i > 0 ? SECTION_KEYS[i - 1] : "welcome")
  }
  const onReport = (category, field, value) => {
    // The report form sends a real request, so a preview says so instead of opening it.
    if (isPreview) toast.info("โหมดตัวอย่าง ปุ่มนี้เปิดฟอร์มส่งคำร้องจริง จึงไม่เปิดให้ลอง")
    else setReport({ category, field, value })
  }

  // "ข้ามทัวร์": the same two calls as the tour's last stop, straight from the Ready step.
  const [skipping, setSkipping] = useState(false)
  const skipTourNow = async () => {
    if (isPreview) {
      goStep("done")
      return
    }
    if (skipping) return
    setSkipping(true)
    try {
      await tourComplete()
      await completeOnboarding()
      clearAllDrafts()
      stopTour()
      toast.success("เริ่มใช้งานบริการตนเองได้แล้ว", { id: "onboarding-complete" })
    } catch (err) {
      if (err?.status === 401 || err?.onboardingRequired) return
      const connection = isConnectionError(err)
      if (connection || err?.status === 409) {
        // the request may have landed and only its answer got lost
        await loadOnboarding({ force: true })
        if (getOnboardingState().data?.onboarded) {
          clearAllDrafts()
          stopTour()
          return
        }
      }
      const d = err?.data?.detail
      if (err?.status === 422 && d && typeof d === "object" && Array.isArray(d.sections) && d.sections.length) {
        toast.warning("ยังมีข้อมูลที่ต้องยืนยันอีกครั้ง", {
          description: d.sections.map((k) => sectionMeta(k)?.label ?? k).join(", "),
        })
        goStep(d.sections[0])
        return
      }
      toast.error("ยังส่งข้อมูลไม่สำเร็จ", {
        description: connection
          ? "การเชื่อมต่อกับระบบขัดข้อง ข้อมูลที่กรอกไว้บันทึกแล้ว กดอีกครั้งเมื่อเน็ตกลับมา"
          : (typeof d === "string" && d) || err?.message || "ลองอีกครั้งในอีกสักครู่",
      })
    } finally {
      setSkipping(false)
    }
  }

  const startTourNow = () => {
    if (isPreview) {
      preview.onStartTour()
      return
    }
    if (getTourState().started) resumeTour()
    else startTour(0)
    navigate("/home")
  }

  // ── render ─────────────────────────────────────────────────────────────────
  let body
  if (ob.status === "error" && !data) {
    body = (
      <ErrorState
        message={ob.error || "โหลดข้อมูลไม่สำเร็จ"}
        onRetry={() => loadOnboarding({ force: true })}
        className="mx-auto mt-10 max-w-md"
      />
    )
  } else if (!data || !step) {
    body = <PageLoader variant="spinner" message="กำลังโหลดข้อมูลของคุณ…" />
  } else if (step === "welcome") {
    body = (
      <WelcomeStep
        data={data}
        confirmedCount={ob.confirmedCount}
        onStart={() => goStep(firstOpenSection(data) ?? "ready")}
        onGoStep={goStep}
      />
    )
  } else if (step === "ready") {
    body = (
      <ReadyStep
        onStartTour={startTourNow}
        onReview={() => goStep("welcome")}
        onSkipTour={skipTourNow}
        skipping={skipping}
      />
    )
  } else if (step === "done") {
    body = <DoneStep onHome={goHome} profilePath={isPreview ? preview.exitPath : undefined} />
  } else {
    const common = { data, handlers: handlersFor(step), onBack: backFrom(step) }
    body = (
      <>
        <Stepper
          steps={STEPPER_STEPS}
          current={sectionIdx}
          maxReached={SECTION_KEYS.length - 1}
          doneSteps={SECTION_KEYS.filter((k) => data.sections?.[k]?.confirmed_at)}
          errorSteps={failed.filter((k) => !data.sections?.[k]?.confirmed_at)}
          onSelect={(i) => goStep(SECTION_KEYS[i])}
          className={cx(isPreview ? preview.offset.stepperCls : "!top-14", "-mx-4 mb-5 px-4 md:mx-0 md:px-0")}
        />
        {step === "account" && <AccountStep key="account" {...common} />}
        {step === "personal" && <PersonalStep key="personal" {...common} onReport={onReport} />}
        {step === "address" && <AddressStep key="address" {...common} />}
        {step === "family" && (
          <FamilyStep key="family" {...common} onGoStep={goStep} onReport={onReport} />
        )}
        {["education", "work", "criminal", "license"].includes(step) && <RowsStep key={step} sectionKey={step} {...common} />}
      </>
    )
  }

  const inSections = SECTION_KEYS.includes(step)

  return (
    <div className={cx("min-h-dvh bg-gray-50 text-gray-900 dark:bg-canvas dark:text-gray-100", isPreview && preview.offset.pageCls)}>
      <a
        href="#ob-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg dark:focus:bg-surface"
      >
        ข้ามไปที่เนื้อหา
      </a>
      <Header
        confirmed={ob.confirmedCount}
        actionLabel={isPreview ? null : finished ? "หน้าหลัก" : "ออกจากระบบ"}
        onAction={finished ? goHome : () => setAskLogout(true)}
        showProgress={Boolean(data) && step !== "done"}
        stickyCls={isPreview ? preview.offset.headerCls : undefined}
      />

      <div role="status" aria-live="polite">
        {offline && (
          <div className="border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="mx-auto flex max-w-3xl items-start gap-2 px-4 py-2 text-sm leading-relaxed md:px-6">
              <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              ไม่มีอินเทอร์เน็ต กรอกต่อได้ ข้อมูลเก็บไว้ในเครื่องนี้ กดบันทึกเมื่อเน็ตกลับมา
            </p>
          </div>
        )}
      </div>

      <main
        id="ob-main"
        ref={mainRef}
        tabIndex={-1}
        className={cx("mx-auto max-w-3xl px-4 pb-10 focus:outline-none md:px-6", inSections ? "pt-3" : "pt-8 md:pt-14")}
      >
        <div key={step ?? "boot"} className={step ? (dir === "prev" ? "animate-ob-prev" : "animate-ob-next") : undefined}>
          {body}
        </div>
      </main>

      <ReportIssueSheet
        open={Boolean(report)}
        onClose={() => setReport(null)}
        initialCategory={report?.category ?? ""}
        initialField={report?.field ?? ""}
        currentValue={report?.value ?? ""}
        onSent={() => setReport(null)}
      />

      <ResultSheet
        open={locked409}
        tone="error"
        title="ข้อมูลเริ่มต้นปิดแล้ว"
        description="การแก้ไขต่อจากนี้ต้องส่งเป็นคำขอผ่านเมนูแจ้งแก้ไขข้อมูล ให้ HR ตรวจสอบและอนุมัติ"
        primary={{
          label: "ไปที่แจ้งแก้ไขข้อมูล",
          // fresh status first: a stale "pending" would bounce them straight back here
          onClick: async () => {
            await loadOnboarding({ force: true })
            navigate("/my-profile")
          },
        }}
        secondary={{
          label: "ปิด",
          onClick: () => {
            setLocked409(false)
            loadOnboarding({ force: true })
          },
        }}
        onClose={() => {
          setLocked409(false)
          loadOnboarding({ force: true })
        }}
      />

      <ConfirmDialog
        open={askLogout}
        title="ออกจากระบบ?"
        description="หัวข้อที่บันทึกแล้วจะยังอยู่ครบ ส่วนที่กรอกค้างและยังไม่ได้บันทึกจะถูกล้าง ต้องทำให้ครบก่อนจึงจะใช้เมนูอื่นได้"
        confirmLabel="ออกจากระบบ"
        tone="danger"
        onConfirm={() => {
          clearAllDrafts()
          logoutAndReload()
        }}
        onCancel={() => setAskLogout(false)}
      />

      <Toaster />
    </div>
  )
}

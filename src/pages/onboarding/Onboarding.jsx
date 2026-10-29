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
// last stop completes onboarding.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import ReportIssueSheet from "../../components/ReportIssueSheet"
import { ErrorState, PageLoader, ResultSheet, Stepper, Toaster, toast } from "../../components/ui"
import { getToken } from "../../lib/auth"
import {
  ONBOARDING_PROMPTED_KEY,
  SECTIONS,
  SECTION_KEYS,
  firstOpenSection,
  loadOnboarding,
  useOnboarding,
} from "../../lib/onboarding"
import { startTour } from "../../lib/tourState"
import { cx, focusRingCls } from "../../lib/styles"
import FamilyStep from "./FamilyStep"
import { DoneStep, ReadyStep, WelcomeStep } from "./IntroSteps"
import RowsStep from "./RowsStep"
import { AccountStep, AddressStep, PersonalStep } from "./ScalarSteps"

const STEP_KEYS = ["welcome", ...SECTION_KEYS, "ready", "done"]
const STEPPER_STEPS = SECTIONS.map((s) => ({ key: s.key, label: s.label, shortLabel: s.short }))
const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

function applyStoredTheme() {
  const stored = localStorage.getItem("darkMode")
  const dark = stored !== null ? stored === "true" : (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false)
  document.documentElement.classList.toggle("dark", dark)
}

/** Next section to open after `key` is confirmed (wraps around), or "ready" once unlocked. */
function nextAfter(key, payload) {
  if (payload?.unlocked) return "ready"
  const sections = payload?.sections ?? {}
  const open = (k) => !sections[k]?.confirmed_at
  const i = SECTION_KEYS.indexOf(key)
  const order = [...SECTION_KEYS.slice(i + 1), ...SECTION_KEYS.slice(0, i)]
  return order.find(open) ?? "ready"
}

function Header({ confirmed, onLater, showProgress }) {
  const total = SECTIONS.length
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/90 backdrop-blur-md dark:border-line dark:bg-canvas/85">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 md:px-6">
        <img
          src={asset("/logo/skt-logo.png")}
          alt=""
          className="h-8 w-auto shrink-0 rounded object-contain dark:hidden"
          decoding="async"
        />
        <img
          src={asset("/logo/skt-logo-dark.png")}
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
        <button
          type="button"
          onClick={onLater}
          className={cx(
            "inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-xl px-3 text-[15px] font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100 md:min-h-10 dark:text-gray-200 dark:hover:bg-white/[.06]",
            focusRingCls,
          )}
        >
          ทำทีหลัง
        </button>
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

export default function Onboarding() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const ob = useOnboarding()
  const data = ob.data
  const [failed, setFailed] = useState([])
  const [locked409, setLocked409] = useState(false)
  const [report, setReport] = useState(null) // { category, field, value }
  const mainRef = useRef(null)

  // ── boot: auth, theme, fresh status ────────────────────────────────────────
  useEffect(() => {
    applyStoredTheme()
    if (!getToken()) {
      navigate("/", { replace: true })
      return
    }
    try {
      sessionStorage.setItem(ONBOARDING_PROMPTED_KEY, "1") // AppLayout must not bounce "ทำทีหลัง" back here
    } catch {
      // storage disabled
    }
    loadOnboarding({ force: true })
  }, [navigate])

  useEffect(() => {
    if (ob.status === "out_of_scope") navigate("/home", { replace: true })
  }, [ob.status, navigate])

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

  // ── resolve the step ───────────────────────────────────────────────────────
  const requested = params.get("step")
  const defaultStep = !data ? null : data.onboarded ? "done" : data.unlocked ? "ready" : "welcome"
  let step = STEP_KEYS.includes(requested) ? requested : defaultStep
  if (data) {
    if (data.onboarded) step = "done"
    else if (step === "done") step = defaultStep
    else if (step === "ready" && !data.unlocked) step = firstOpenSection(data) ?? "welcome"
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
  const goHome = () => navigate("/home")

  // ── section handlers ───────────────────────────────────────────────────────
  const handlersFor = (key) => ({
    onDone: (payload) => {
      setFailed((f) => f.filter((k) => k !== key))
      goStep(nextAfter(key, payload))
    },
    onLocked: () => setLocked409(true),
    onFailed: (k) => setFailed((f) => (f.includes(k) ? f : [...f, k])),
  })
  const sectionIdx = SECTION_KEYS.indexOf(step)
  const backFrom = (key) => {
    const i = SECTION_KEYS.indexOf(key)
    return () => goStep(i > 0 ? SECTION_KEYS[i - 1] : "welcome")
  }
  const onReport = (category, field, value) => setReport({ category, field, value })

  const startTourNow = () => {
    startTour(0)
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
    body = <ReadyStep onStartTour={startTourNow} />
  } else if (step === "done") {
    body = <DoneStep onHome={goHome} />
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
          className="!top-14 -mx-4 mb-5 px-4 md:mx-0 md:px-0"
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
    <div className="min-h-dvh bg-gray-50 text-gray-900 dark:bg-canvas dark:text-gray-100">
      <a
        href="#ob-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg dark:focus:bg-surface"
      >
        ข้ามไปที่เนื้อหา
      </a>
      <Header confirmed={ob.confirmedCount} onLater={goHome} showProgress={Boolean(data) && step !== "done"} />

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
        primary={{ label: "ไปที่แจ้งแก้ไขข้อมูล", onClick: () => navigate("/my-profile") }}
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

      <Toaster />
    </div>
  )
}

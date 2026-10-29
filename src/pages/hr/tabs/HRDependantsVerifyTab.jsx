// src/pages/hr/tabs/HRDependantsVerifyTab.jsx
// รอตรวจสอบข้อมูลครอบครัว (onboarding PR 59)
//   GET  /hr/dependants/unverified?branch_id=  → คิวแถวครอบครัวที่พนักงานเพิ่ม/แก้เอง ยังไม่ผ่าน HR (เก่าสุดก่อน)
//   POST /hr/dependants/{id}/verify            → ตรวจสอบแล้ว — สวัสดิการเริ่มนับคนนี้
// สาขาอื่นนอกขอบเขต → 403 (แสดงข้อความ ไม่ใช่หน้าว่าง)
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Info, LoaderCircle } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { cx, neutralBtnCls } from "../../../lib/styles"
import SelectDropdown from "../../../components/SelectDropdown"
import BranchLockNote from "../../../components/BranchLockNote"
import useBranchLock, { scopedBranchId } from "../../../hooks/useBranchLock"
import Can from "../../../components/Can"
import { useDrill } from "../../../lib/drill"
import { thaiDate } from "../../../lib/loans"
import { fmtDateTh } from "../../../lib/approvalActions"
import { EmptyState, ErrorState, Skeleton, toast } from "../../../components/ui"

const COLLAPSE_MS = 300

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false

const nf = (n) => Number(n).toLocaleString("th-TH")
const fullName = (d) =>
  d.display_name || [`${d.name_title ?? ""}${d.first_name ?? ""}`, d.last_name].filter(Boolean).join(" ") || "—"
const byOldest = (a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
const NOT_ENABLED_MSG = "ระบบตรวจข้อมูลครอบครัวยังไม่เปิดใช้บนเซิร์ฟเวอร์นี้ รอทีม backend อัปเดต"

/**
 * ปุ่ม "ตรวจสอบแล้ว" (มีสิทธิ์ hr.dependants.verify เท่านั้น) — ใช้ร่วมกับการ์ดในหน้าโปรไฟล์พนักงาน
 * onVerified(item) ถูกเรียกหลัง backend ตอบสำเร็จ
 */
export function VerifyDependantButton({ dependant, onVerified, className = "" }) {
  const [busy, setBusy] = useState(false)
  const verify = async () => {
    setBusy(true)
    try {
      const res = await apiAuth(`/hr/dependants/${dependant.id}/verify`, { method: "POST" })
      toast.success("ตรวจสอบแล้ว", { description: `${fullName(dependant)} — สวัสดิการเริ่มนับรายการนี้แล้ว` })
      onVerified?.(res ?? dependant)
    } catch (e) {
      toast.error("ตรวจสอบไม่สำเร็จ", { description: e.message || "ลองใหม่อีกครั้ง" })
      setBusy(false)
    }
  }
  return (
    <Can perm="hr.dependants.verify">
      <button
        type="button"
        onClick={verify}
        disabled={busy}
        aria-label={`ตรวจสอบแล้ว: ${fullName(dependant)}`}
        className={cx(neutralBtnCls, "!h-11 md:!h-9 !px-3 !text-[13px] whitespace-nowrap", className)}
      >
        {busy
          ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
          : <Check aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />}
        ตรวจสอบแล้ว
      </button>
    </Can>
  )
}

/** แถวที่ยุบหายแบบนุ่ม (grid-template-rows 1fr → 0fr) แล้วค่อยถูกเอาออกจาก state */
function Collapsible({ leaving, children }) {
  return (
    <li
      aria-hidden={leaving || undefined}
      className={cx(
        "grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none",
        leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
      )}
      style={{ transitionDuration: `${COLLAPSE_MS}ms` }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </li>
  )
}

function Meta({ label, children, className = "" }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{children}</dd>
    </div>
  )
}

export default function HRDependantsVerifyTab({ onCountChange }) {
  const { drillTo } = useDrill()
  const [rows, setRows] = useState([])
  const [leaving, setLeaving] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const reqRef = useRef(0)
  const timers = useRef([])

  const branchLock = useBranchLock()
  const [branch, setBranch] = useState(branchLock.activeKey)
  useEffect(() => {
    if (branchLock.locked) setBranch(branchLock.activeKey)
  }, [branchLock.locked, branchLock.activeKey])
  const [branches, setBranches] = useState([])
  // จำนวนในป้ายเมนูนับทั้งขอบเขตของผู้ใช้ — รายงานเฉพาะตอนไม่ได้กรองสาขาเอง
  const reportsScope = branchLock.locked || !branch

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches((data || []).map((b) => ({ value: String(b.id), label: b.branch_name }))))
      .catch(() => {})
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])

  const fetchRows = useCallback(() => {
    const req = ++reqRef.current
    setLoading(true)
    setError("")
    const params = new URLSearchParams()
    const branchId = scopedBranchId(branch)
    if (branchId) params.set("branch_id", branchId)
    const qs = params.toString()
    apiAuth(`/hr/dependants/unverified${qs ? `?${qs}` : ""}`)
      .then((data) => {
        if (req !== reqRef.current) return
        const list = (Array.isArray(data) ? data : []).slice().sort(byOldest)
        setRows(list)
        setLeaving(new Set())
      })
      .catch((e) => {
        if (req !== reqRef.current) return
        setRows([])
        // 404 = backend without the dependants queue yet (PR 59 not deployed on this server)
        setError(e.status === 404 ? NOT_ENABLED_MSG : e.status === 403
          ? (e.message && e.message !== "Request failed" ? e.message : "ไม่มีสิทธิ์ดูข้อมูลครอบครัวของสาขานี้")
          : (e.message || "โหลดข้อมูลไม่สำเร็จ"))
      })
      .finally(() => { if (req === reqRef.current) setLoading(false) })
  }, [branch])

  useEffect(() => { fetchRows() }, [fetchRows])

  const remaining = rows.length - leaving.size
  useEffect(() => {
    if (!loading && !error && reportsScope) onCountChange?.(remaining)
  }, [loading, error, reportsScope, remaining, onCountChange])

  const onVerified = (item) => {
    const id = item.id
    if (prefersReducedMotion()) {
      setRows((prev) => prev.filter((r) => r.id !== id))
      return
    }
    setLeaving((prev) => new Set(prev).add(id))
    timers.current.push(setTimeout(() => {
      setRows((prev) => prev.filter((r) => r.id !== id))
      setLeaving((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, COLLAPSE_MS + 20))
  }

  const branchOptions = useMemo(() => [{ value: "", label: "ทุกสาขา" }, ...branches], [branches])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="flex max-w-prose items-start gap-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-indigo-500 dark:text-indigo-400" strokeWidth={1.75} />
          <span>
            รายการที่พนักงานเพิ่มหรือแก้เองตอนกรอกข้อมูลเริ่มต้น สวัสดิการจะนับบุคคลเหล่านี้หลัง HR ตรวจสอบแล้วเท่านั้น
            เทียบกับเอกสาร (ทะเบียนบ้าน สูติบัตร ทะเบียนสมรส) ก่อนกด “ตรวจสอบแล้ว”
          </span>
        </p>
        <div className="w-full sm:w-52 sm:shrink-0">
          <SelectDropdown
            size="sm"
            value={branch}
            onChange={setBranch}
            placeholder="ทุกสาขา"
            ariaLabel="สาขา"
            showSwatch={false}
            options={branchOptions}
            disabled={branchLock.locked}
          />
          {branchLock.locked && <BranchLockNote />}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchRows} />
      ) : loading ? (
        <div role="status" aria-label="กำลังโหลด" className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200/70 dark:divide-line dark:ring-line">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} aria-hidden="true" className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton rounded="rounded-md" className="h-4 w-2/5" />
                <Skeleton rounded="rounded-md" className="h-3 w-3/5" />
              </div>
              <Skeleton rounded="rounded-xl" className="h-9 w-28 shrink-0" />
            </div>
          ))}
        </div>
      ) : remaining <= 0 ? (
        <EmptyState
          title="ไม่มีข้อมูลครอบครัวรอตรวจสอบ"
          description={branch && !branchLock.locked
            ? "สาขานี้ตรวจครบแล้ว ลองเลือกทุกสาขาเพื่อดูรายการที่เหลือ"
            : "รายการที่พนักงานเพิ่มหรือแก้ไขจะมาแสดงที่นี่"}
          action={branch && !branchLock.locked
            ? <button type="button" onClick={() => setBranch("")} className={neutralBtnCls}>ดูทุกสาขา</button>
            : null}
        />
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
            รอตรวจสอบ {nf(remaining)} รายการ · เรียงจากที่เพิ่มก่อน
          </p>
          <ul className="rounded-xl ring-1 ring-gray-200/70 dark:ring-line">
            {rows.map((d, i) => (
              <Collapsible key={d.id} leaving={leaving.has(d.id)}>
                <div
                  className={cx(
                    "flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-6",
                    i > 0 && "border-t border-gray-100 dark:border-line",
                  )}
                >
                  <div className="min-w-0 md:w-56 md:shrink-0">
                    <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100 md:text-sm" title={fullName(d)}>
                      {fullName(d)}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                      {d.relationship || "—"} · {d.legal_status || "—"}{d.is_twin ? " · แฝด" : ""}
                    </p>
                  </div>
                  <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">พนักงาน</dt>
                      <dd className="truncate text-sm">
                        <button
                          type="button"
                          onClick={() => drillTo(`/hr/personnel/${d.user_id}`, "ตรวจข้อมูลครอบครัว")}
                          className="rounded font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
                        >
                          {d.employee_name || "—"}
                        </button>
                        {d.branch_name && <span className="text-gray-500 dark:text-gray-400"> · {d.branch_name}</span>}
                      </dd>
                    </div>
                    <Meta label="วันเกิด"><span className="tabular-nums">{thaiDate(d.birthday)}</span></Meta>
                    <Meta label="เพิ่มเมื่อ"><span className="tabular-nums">{fmtDateTh(d.created_at)}</span></Meta>
                  </dl>
                  <div className="flex justify-end md:shrink-0">
                    <VerifyDependantButton dependant={d} onVerified={onVerified} className="w-full sm:w-auto" />
                  </div>
                </div>
              </Collapsible>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

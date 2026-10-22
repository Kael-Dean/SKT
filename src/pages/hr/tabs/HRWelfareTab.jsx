// src/pages/hr/tabs/HRWelfareTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// สวัสดิการ (3P) — คำขอเบิกค่ารักษาพยาบาล / ตรวจสุขภาพ / ค่าการศึกษาบุตร
// เปิดจาก /hr/dashboard?tab=welfare และ /hr/welfare (HRWelfare.jsx)
//
//   GET  /hr/welfare/claims?claim_type=&cap_year=&user_id=     (hr.welfare.view) — โหลดครั้งเดียวแล้วแบ่งแท็บย่อย
//   POST /hr/welfare/claims (+ /preview)                        (hr.welfare.submit) — ClaimEntrySheet
//   POST …/{id}/approve · /reject                               (hr.welfare.approve — ผจก.)
//   POST …/{id}/board                                           (hr.welfare.board — เมื่อ board_required)
//   POST …/{id}/mark-paid                                       (hr.welfare.submit — จ่ายแยกเท่านั้น)
//   GET  /hr/welfare/settings                                   payout_route / board_required ปัจจุบัน
//   GET  /hr/welfare/education-rates                            เพดานค่าการศึกษาในฟอร์ม
//   PDF  /hr/reports/welfare/claims?fiscal_year= · /hr/reports/welfare/dependants   (hr.reports.welfare)
//
// แท็บย่อย (?sub=): queue = รอผู้จัดการอนุมัติ · topay = อนุมัติแล้วรอจ่าย · all = ทั้งหมด
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Plus, RotateCw } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { getUser } from "../../../lib/auth"
import { useCan } from "../../../lib/permissions"
import { cx, baseField, cardCls, iconBtnCls, neutralBtnCls, primaryBtnCls, tabPanelCls } from "../../../lib/styles"
import {
  CLAIM_TYPES, STATUS_FILTERS, currentFiscalYearBE, isBEYear, isCapped, payoutNote, workflowActions,
} from "../../../lib/welfare"
import { EmptyState, ErrorState, Tabs, panelId, tabId, useSubTab } from "../../../components/ui"
import SelectDropdown from "../../../components/SelectDropdown"
import ReportPdfButton from "../../../components/ReportPdfButton"
import { employeeName } from "../../../components/hr/positionUtils"
import { getCachedPersonnel, loadPersonnel, subscribePersonnel } from "../../../components/hr/personnelCache"
import ClaimsTable from "../../../components/hr/welfare/ClaimsTable"
import ClaimEntrySheet from "../../../components/hr/welfare/ClaimEntrySheet"
import ClaimDetailSheet from "../../../components/hr/welfare/ClaimDetailSheet"
import ClaimActionSheet from "../../../components/hr/welfare/ClaimActionSheet"

const ID_BASE = "hr-welfare"
const SUBS = ["queue", "topay", "all"]
const fieldCls = cx(baseField, "!rounded-xl !px-3 !py-2 md:!text-sm")
const smallBtn = "!h-9 !px-3 !text-xs md:!text-sm"

const asList = (d) => (Array.isArray(d) ? d : d?.items ?? d?.claims ?? [])

/** รายชื่อเจ้าหน้าที่ (แคชเดียวกับ EmployeePicker) → ใช้แปลง user_id เป็นชื่อ */
function usePersonnel() {
  const [people, setPeople] = useState(() => getCachedPersonnel() ?? [])
  useEffect(() => {
    let alive = true
    const off = subscribePersonnel((p) => { if (alive && p) setPeople(p) })
    loadPersonnel().then((p) => { if (alive && p) setPeople(p) }).catch(() => {})
    return () => { alive = false; off() }
  }, [])
  return people
}

export default function HRWelfareTab() {
  const uid = useId()
  const { can } = useCan()
  const canView = can("hr.welfare.view")
  const canSubmit = can("hr.welfare.submit")
  const canApprove = can("hr.welfare.approve")
  const canBoard = can("hr.welfare.board")
  const canReports = can("hr.reports.welfare")
  const meId = getUser()?.id ?? null

  const [sub, setSub] = useSubTab(SUBS, canApprove || !canSubmit ? "queue" : "topay")
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(canView)
  const [error, setError] = useState("")
  const [settings, setSettings] = useState(null)
  const [rates, setRates] = useState([])

  const [type, setType] = useState("")
  const [year, setYear] = useState(String(currentFiscalYearBE()))
  const [person, setPerson] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const [entryOpen, setEntryOpen] = useState(false)
  const [detail, setDetail] = useState(null)   // claim
  const [action, setAction] = useState(null)   // { claim, mode }

  const people = usePersonnel()
  const nameById = useMemo(() => new Map(people.map((p) => [String(p.id), employeeName(p)])), [people])
  const nameOf = useCallback(
    (c) => c.user_name || c.employee_name || c.user_display_name || nameById.get(String(c.user_id)) || `รหัส ${c.user_id}`,
    [nameById],
  )
  const patientOf = useCallback(
    (c) => (c.claim_type === "checkup" || c.dependant_id == null
      ? "ตัวเจ้าหน้าที่"
      : c.dependant_name || c.patient_name || `ผู้มีสิทธิ์ #${c.dependant_id}`),
    [],
  )

  const yearOk = year === "" || isBEYear(year)

  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setError("")
    const p = new URLSearchParams()
    if (type) p.set("claim_type", type)
    if (year && isBEYear(year)) p.set("cap_year", year)
    if (person) p.set("user_id", person)
    try {
      setClaims(asList(await apiAuth(`/hr/welfare/claims${p.toString() ? `?${p}` : ""}`)))
    } catch (err) {
      setError(apiDetail(err) || "โหลดคำขอเบิกไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [canView, type, year, person])

  useEffect(() => { if (yearOk) load() }, [load, yearOk])

  useEffect(() => {
    if (!canView) return
    let alive = true
    apiAuth("/hr/welfare/settings").then((s) => { if (alive) setSettings(s) }).catch(() => {})
    return () => { alive = false }
  }, [canView])

  // ตารางเพดานค่าการศึกษา — โหลดเมื่อเปิดฟอร์มครั้งแรก
  useEffect(() => {
    if (!entryOpen || rates.length) return
    let alive = true
    apiAuth("/hr/welfare/education-rates").then((r) => { if (alive) setRates(asList(r)) }).catch(() => {})
    return () => { alive = false }
  }, [entryOpen, rates.length])

  const ctx = useMemo(() => ({
    canApprove, canSubmit, canBoard, boardRequired: !!settings?.board_required, meId,
  }), [canApprove, canSubmit, canBoard, settings?.board_required, meId])

  const queue = useMemo(() => claims.filter((c) => c.status === "submitted"), [claims])
  const topay = useMemo(() => claims.filter((c) => c.status === "approved" || c.status === "board_approved"), [claims])
  const all = useMemo(() => (statusFilter ? claims.filter((c) => c.status === statusFilter) : claims), [claims, statusFilter])
  const rows = sub === "queue" ? queue : sub === "topay" ? topay : all
  const cappedInQueue = queue.filter(isCapped).length

  const tabs = [
    { value: "queue", label: "รออนุมัติ", count: loading ? undefined : queue.length || null },
    { value: "topay", label: "รอจ่าย", count: loading ? undefined : topay.length || null },
    { value: "all", label: "ทั้งหมด" },
  ]

  const replaceClaim = (next) => {
    if (!next?.id) { load(); return }
    setClaims((list) => list.map((c) => (c.id === next.id ? { ...c, ...next } : c)))
  }

  const rowAction = (c) => {
    const primary = workflowActions(c, ctx).find((a) => a.primary)
    if (primary) {
      return (
        <button type="button" onClick={(e) => { e.stopPropagation(); setAction({ claim: c, mode: primary.mode }) }}
          className={cx(primary.mode === "paid" ? neutralBtnCls : primaryBtnCls, smallBtn, "whitespace-nowrap")}>
          {primary.label}
        </button>
      )
    }
    const note = payoutNote(c, ctx.boardRequired)
    return note ? <span className="block max-w-[14rem] text-left text-xs text-gray-500 dark:text-gray-400">{note}</span> : null
  }

  const emptyFor = () => {
    const filtered = !!(type || person || year)
    if (sub === "queue") return <EmptyState title="ไม่มีคำขอรออนุมัติ" description={filtered ? "ลองล้างตัวกรองหรือเปลี่ยนปี" : "คำขอที่ HR บันทึกจากแบบฟอร์มจะมารอที่นี่"} />
    if (sub === "topay") return <EmptyState title="ไม่มีรายการรอจ่าย" description="คำขอที่อนุมัติแล้วและยังไม่จ่ายจะแสดงที่นี่" />
    return (
      <EmptyState
        title={statusFilter || filtered ? "ไม่พบคำขอตามตัวกรอง" : "ยังไม่มีคำขอเบิกสวัสดิการ"}
        description={statusFilter || filtered ? "ลองเปลี่ยนสถานะ ประเภท หรือปี" : "เริ่มจากปุ่ม “บันทึกคำขอเบิก” เมื่อได้รับแบบฟอร์มจากเจ้าหน้าที่"}
        action={canSubmit && !filtered && !statusFilter ? (
          <button type="button" onClick={() => setEntryOpen(true)} className={primaryBtnCls}>
            <Plus aria-hidden="true" className="size-4" />บันทึกคำขอเบิก
          </button>
        ) : undefined}
      />
    )
  }

  const personOptions = useMemo(() => [
    { value: "", label: "เจ้าหน้าที่ทุกคน" },
    ...people.map((p) => ({ value: String(p.id), label: employeeName(p), sublabel: `รหัส ${p.id}`, keywords: [String(p.id)] })),
  ], [people])

  if (!canView) {
    return (
      <div className="space-y-4">
        {canSubmit && (
          <div className="flex justify-end">
            <button type="button" onClick={() => setEntryOpen(true)} className={primaryBtnCls}><Plus aria-hidden="true" className="size-4" />บันทึกคำขอเบิก</button>
          </div>
        )}
        <div className={cardCls}><EmptyState title="บัญชีนี้บันทึกคำขอได้อย่างเดียว" description="ไม่มีสิทธิ์ดูรายการคำขอเบิกสวัสดิการ" /></div>
        {entryOpen && <ClaimEntrySheet open onClose={() => setEntryOpen(false)} educationRates={rates} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* แถวบน: แท็บย่อย + เครื่องมือ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tabs items={tabs} value={sub} onChange={setSub} ariaLabel="คำขอเบิกสวัสดิการ" idBase={ID_BASE} />
          <button type="button" onClick={load} aria-label="โหลดใหม่" title="โหลดใหม่" className={iconBtnCls}>
            <RotateCw aria-hidden="true" className={cx("size-4", loading && "animate-spin motion-reduce:animate-none")} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canReports && (
            <>
              <ReportPdfButton
                label={`สรุปการเบิก ปีงบ ${isBEYear(year) ? year : currentFiscalYearBE()}`}
                getPath={() => `/hr/reports/welfare/claims?fiscal_year=${isBEYear(year) ? year : currentFiscalYearBE()}`}
                fallbackName={`welfare_claims_${isBEYear(year) ? year : currentFiscalYearBE()}.pdf`}
                className={cx(neutralBtnCls, "!h-10")}
              />
              <ReportPdfButton
                label="ทะเบียนผู้มีสิทธิ์"
                getPath={() => "/hr/reports/welfare/dependants"}
                fallbackName="welfare_dependants.pdf"
                className={cx(neutralBtnCls, "!h-10")}
              />
            </>
          )}
          {canSubmit && (
            <button type="button" onClick={() => setEntryOpen(true)} className={cx(primaryBtnCls, "!h-10")}>
              <Plus aria-hidden="true" className="size-4" />บันทึกคำขอเบิก
            </button>
          )}
        </div>
      </div>

      {/* ตัวกรอง */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-48">
          <span id={`${uid}-type-l`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">ประเภท</span>
          <SelectDropdown id={`${uid}-type`} size="sm" showSwatch={false} ariaLabelledby={`${uid}-type-l`}
            options={[{ value: "", label: "ทุกประเภท" }, ...CLAIM_TYPES]} value={type} onChange={setType} />
        </div>
        <div className="w-28">
          <label htmlFor={`${uid}-year`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">ปีวงเงิน (พ.ศ.)</label>
          <input id={`${uid}-year`} type="text" inputMode="numeric" maxLength={4} value={year} placeholder="ทุกปี"
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
            aria-invalid={!yearOk || undefined} aria-describedby={`${uid}-year-hint`}
            className={cx(fieldCls, "tabular-nums", !yearOk && "!border-red-500 dark:!border-red-400")} />
          <span id={`${uid}-year-hint`} className="sr-only">ค่ารักษานับตามปีงบประมาณ เม.ย.–มี.ค. ค่าการศึกษานับตามปีการศึกษา เว้นว่างเพื่อดูทุกปี</span>
        </div>
        <div className="w-full sm:w-64">
          <span id={`${uid}-person-l`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">เจ้าหน้าที่</span>
          <SelectDropdown id={`${uid}-person`} size="sm" showSwatch={false} searchable ariaLabelledby={`${uid}-person-l`}
            searchPlaceholder="ค้นหาชื่อหรือรหัส" emptyText="ไม่พบเจ้าหน้าที่"
            options={personOptions} value={person} onChange={setPerson} />
        </div>
        {sub === "all" && (
          <div className="w-full sm:w-52">
            <span id={`${uid}-status-l`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">สถานะ</span>
            <SelectDropdown id={`${uid}-status`} size="sm" showSwatch={false} ariaLabelledby={`${uid}-status-l`}
              options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
          </div>
        )}
        {!loading && !error && (
          <p className="pb-2 text-sm tabular-nums text-gray-500 dark:text-gray-400 sm:ml-auto" aria-live="polite">
            {rows.length} รายการ
            {sub === "queue" && cappedInQueue > 0 && (
              <span className="text-amber-700 dark:text-amber-300"> · {cappedInQueue} รายการตามสิทธิ์ต่ำกว่าที่ขอ</span>
            )}
          </p>
        )}
      </div>

      <div role="tabpanel" id={panelId(ID_BASE, sub)} aria-labelledby={tabId(ID_BASE, sub)} tabIndex={0} className={tabPanelCls}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <ClaimsTable
            claims={rows}
            loading={loading}
            nameOf={nameOf}
            patientOf={patientOf}
            onOpen={(c) => setDetail(c)}
            action={rowAction}
            empty={emptyFor()}
          />
        )}
      </div>

      {settings?.payout_route === "payroll" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ตั้งค่าให้จ่ายพร้อมเงินเดือน — คำขอที่อนุมัติจะเข้าสลิปเป็น “เงินช่วยเหลือสวัสดิการ” และเป็น “จ่ายแล้ว” เมื่อปิดงวด
        </p>
      )}

      {entryOpen && (
        <ClaimEntrySheet
          open
          initialUserId={person}
          educationRates={rates}
          onClose={() => setEntryOpen(false)}
          onSaved={() => { if (sub !== "queue") setSub("queue"); load() }}
        />
      )}
      {detail && (
        <ClaimDetailSheet
          claim={detail}
          personName={nameOf(detail)}
          patientName={patientOf(detail)}
          ctx={ctx}
          onClose={() => setDetail(null)}
          onAction={(c, mode) => { setDetail(null); setAction({ claim: c, mode }) }}
        />
      )}
      {action && (
        <ClaimActionSheet
          claim={action.claim}
          mode={action.mode}
          personName={nameOf(action.claim)}
          payoutRoute={settings?.payout_route || "separate"}
          onClose={() => setAction(null)}
          onDone={(next) => { setAction(null); replaceClaim(next) }}
        />
      )}
    </div>
  )
}

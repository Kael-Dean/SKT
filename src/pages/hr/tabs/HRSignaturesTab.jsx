// src/pages/hr/tabs/HRSignaturesTab.jsx
// ลายเซ็นอิเล็กทรอนิกส์ของเจ้าหน้าที่ — HR อัปโหลด / เปลี่ยน / ลบ และนำเข้าหลายไฟล์พร้อมจับคู่ชื่อ
// ระบบใส่ลายเซ็นในใบลาและหนังสือรับรองเงินเดือนให้เอง เฉพาะคนที่ทำรายการนั้นจริง
//   GET/PUT/DELETE /hr/signatures… — spec: handoff/api-handoff-e-signature.md
// backend ยังไม่มี endpoint → แสดงรายชื่อ + แจ้งว่ารอระบบหลังบ้าน ปุ่มอัปโหลดปิดไว้
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CircleAlert, FolderOpen, History, ImageUp, Search, Trash2, Upload } from "lucide-react"
import { getCachedPersonnel, loadPersonnel } from "../../../components/hr/personnelCache"
import { employeeName } from "../../../components/hr/positionUtils"
import ComboBox from "../../../components/ComboBox"
import SignatureRequestsPanel from "../../../components/signature/SignatureRequestsPanel"
import SignatureHistorySheet from "../../../components/signature/SignatureHistorySheet"
import { ConfirmDialog, EmptyState, ErrorState, Sheet, SkeletonTableRows, Tabs, panelId, tabId, toast, useSubTab } from "../../../components/ui"
import { apiDetail } from "../../../lib/apiErrors"
import { useCan } from "../../../lib/permissions"
import { listSignatureRequests } from "../../../lib/signatures"
import {
  checkSignatureFile,
  deleteSignature,
  listSignatures,
  loadSignatureImage,
  matchPerson,
  nameFromFilename,
  uploadSignature,
} from "../../../lib/signatures"
import {
  badgeNeutral,
  badgeSuccess,
  badgePending,
  baseField,
  cardCls,
  cx,
  helpTextCls,
  iconBtnCls,
  neutralBtnCls,
  primaryBtnCls,
  segmentedCls,
  segmentedItemActiveCls,
  segmentedItemCls,
  tabPanelCls,
} from "../../../lib/styles"

const errMsg = (e, fallback) => apiDetail(e) || e?.message || fallback
const thaiDate = (v) => {
  if (!v) return ""
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
}

/** พื้น "กระดาษ" ใต้ลายเซ็น — สว่างทั้งสองโหมด เพราะหมึกน้ำเงินเข้มจะมองไม่เห็นบนพื้นมืด */
const paperCls = "bg-[#f7f5ef] ring-1 ring-inset ring-black/5 dark:bg-[#e9e6dc]"

// ─── รูปย่อลายเซ็น (โหลดเมื่อเลื่อนมาเห็น) ──────────────────────────────────────
const thumbCache = new Map() // `${userId}:${sha}` → Promise<dataUri|null>

function SignatureThumb({ userId, version, name }) {
  const ref = useRef(null)
  const [src, setSrc] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let alive = true
    const key = `${userId}:${version ?? ""}`
    if (!thumbCache.has(key)) thumbCache.set(key, loadSignatureImage(userId).catch(() => null))
    thumbCache.get(key).then((s) => alive && setSrc(s))
    return () => { alive = false }
  }, [visible, userId, version])

  return (
    <div ref={ref} className={cx("flex h-12 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:w-36", paperCls)}>
      {src ? (
        <img src={src} alt={`ลายมือชื่อ ${name}`} className="max-h-10 max-w-[92%] object-contain" draggable="false" />
      ) : (
        <span className="h-3 w-16 animate-pulse rounded bg-black/5" aria-hidden="true" />
      )}
    </div>
  )
}

// ─── นำเข้าหลายไฟล์ ────────────────────────────────────────────────────────────
const MATCH_TEXT = {
  exact: ["ชื่อตรงกัน", badgeSuccess],
  first: ["ตรงบางส่วน — ตรวจก่อน", badgePending],
  manual: ["เลือกเอง", badgeNeutral],
  none: ["ไม่พบชื่อนี้ — เลือกเจ้าหน้าที่", badgePending],
}

function BulkImportSheet({ open, onClose, people, signed, onDone, canUpload }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const dirRef = useRef(null)

  const options = useMemo(
    () => people.map((p) => ({ value: String(p.id), label: employeeName(p), subLabel: p.position_display || `รหัส ${p.id}` })),
    [people],
  )
  const nameById = useMemo(() => new Map(people.map((p) => [String(p.id), employeeName(p)])), [people])

  // object URL ของพรีวิว — คืนตอนเลือกชุดใหม่ / ปิด / ออกจากหน้า (ไม่ใช่ทุกครั้งที่สถานะแถวเปลี่ยน)
  const urlsRef = useRef([])
  const releaseUrls = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    urlsRef.current = []
  }
  useEffect(() => releaseUrls, [])
  useEffect(() => {
    if (!open) {
      releaseUrls()
      setRows([])
    }
  }, [open])

  const pick = async (fileList) => {
    releaseUrls()
    const files = [...(fileList ?? [])].filter((f) => /\.png$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, "th"))
    const next = await Promise.all(files.map(async (file, i) => {
      const problem = await checkSignatureFile(file)
      const m = matchPerson(file.name, people)
      const preview = URL.createObjectURL(file)
      urlsRef.current.push(preview)
      return {
        key: `${i}:${file.name}`,
        file,
        preview,
        label: nameFromFilename(file.name),
        userId: m.person ? String(m.person.id) : "",
        confidence: m.confidence,
        include: !problem && m.confidence === "exact",
        problem,
        status: "", // "" | "uploading" | "done" | "error"
        error: "",
      }
    }))
    setRows(next)
    if (!files.length) toast.error("ไม่พบไฟล์ PNG ในที่เลือก")
  }

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  // คนเดียวกันถูกเลือกให้หลายไฟล์ = ชน (อัปโหลดได้แค่ไฟล์เดียว)
  const dupes = useMemo(() => {
    const count = new Map()
    rows.filter((r) => r.include && r.userId).forEach((r) => count.set(r.userId, (count.get(r.userId) ?? 0) + 1))
    return new Set([...count].filter(([, n]) => n > 1).map(([id]) => id))
  }, [rows])

  const ready = rows.filter((r) => r.include && r.userId && !r.problem && r.status !== "done" && !dupes.has(r.userId))
  const done = rows.filter((r) => r.status === "done").length
  const stats = {
    exact: rows.filter((r) => r.confidence === "exact").length,
    review: rows.filter((r) => r.confidence !== "exact").length,
  }

  const upload = async () => {
    setBusy(true)
    const queue = [...ready]
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        update(r.key, { status: "uploading", error: "" })
        try {
          await uploadSignature(r.userId, r.file, { source: "import" })
          update(r.key, { status: "done" })
        } catch (e) {
          update(r.key, { status: "error", error: errMsg(e, "อัปโหลดไม่สำเร็จ") })
        }
      }
    }
    await Promise.all([worker(), worker(), worker()])
    setBusy(false)
    onDone()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      busy={busy}
      size="full"
      title="นำเข้าลายเซ็นหลายไฟล์"
      subtitle="ระบบจับคู่จากชื่อไฟล์ เช่น 001.นายสมชาย ใจดี.png — ตรวจคู่ที่ไม่ตรงก่อนอัปโหลด"
      footer={rows.length ? (
        <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:justify-end md:gap-2">
          <p className={cx(helpTextCls, "col-span-2 md:mr-auto")} aria-live="polite">
            {!canUpload ? `ตรวจการจับคู่ได้ — อัปโหลดได้เมื่อระบบหลังบ้านพร้อม` : busy ? `กำลังอัปโหลด… ${done} ไฟล์เสร็จแล้ว` : `เลือกไว้ ${ready.length} ไฟล์ · อัปโหลดแล้ว ${done} ไฟล์`}
          </p>
          <button type="button" className={cx(neutralBtnCls, "!h-12 md:!h-10")} onClick={onClose} disabled={busy}>
            {done ? "ปิด" : "ยกเลิก"}
          </button>
          <button type="button" className={cx(primaryBtnCls, "!h-12 gap-2 md:!h-10")} onClick={upload} disabled={busy || !ready.length || !canUpload}>
            <Upload className="size-4" aria-hidden="true" />
            อัปโหลด {ready.length} ไฟล์
          </button>
        </div>
      ) : null}
    >
      <input ref={fileRef} type="file" accept="image/png" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = "" }} />
      <input ref={dirRef} type="file" multiple hidden webkitdirectory="" onChange={(e) => { pick(e.target.files); e.target.value = "" }} />

      {!rows.length ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 px-6 py-12 text-center dark:border-line-strong">
          <ImageUp className="size-10 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium text-gray-900 dark:text-gray-100">เลือกไฟล์ลายเซ็น PNG พื้นโปร่งใส</p>
            <p className={helpTextCls}>ตั้งชื่อไฟล์เป็นชื่อ-นามสกุลของเจ้าของลายเซ็น · ไม่เกิน 1 MB ต่อไฟล์</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={cx(primaryBtnCls, "!h-11 gap-2")} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" /> เลือกไฟล์
            </button>
            <button type="button" className={cx(neutralBtnCls, "!h-11 gap-2")} onClick={() => dirRef.current?.click()}>
              <FolderOpen className="size-4" aria-hidden="true" /> เลือกทั้งโฟลเดอร์
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-gray-700 dark:text-gray-200">
              ทั้งหมด <b className="tabular-nums">{rows.length}</b> ไฟล์ · ชื่อตรงกัน <b className="tabular-nums">{stats.exact}</b>
            </span>
            {stats.review > 0 && (
              <span className="text-amber-700 dark:text-amber-300">ต้องตรวจ {stats.review} ไฟล์ (ยังไม่ได้เลือกให้อัปโหลด)</span>
            )}
            <button type="button" className="ml-auto text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-300" onClick={() => fileRef.current?.click()} disabled={busy}>
              เลือกไฟล์ใหม่
            </button>
          </div>

          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-gray-200/70 dark:divide-line dark:ring-line">
            {rows.map((r) => {
              const [mText, mCls] = MATCH_TEXT[r.confidence] ?? MATCH_TEXT.none
              const dup = r.include && dupes.has(r.userId)
              const replacing = r.userId && signed.has(r.userId)
              return (
                <li key={r.key} className={cx("flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap", r.status === "done" && "bg-emerald-50/60 dark:bg-emerald-500/[.06]")}>
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-indigo-600"
                    aria-label={`อัปโหลด ${r.label}`}
                    checked={r.include}
                    disabled={busy || !!r.problem || r.status === "done"}
                    onChange={(e) => update(r.key, { include: e.target.checked })}
                  />
                  <div className={cx("flex h-12 w-28 shrink-0 items-center justify-center rounded-lg sm:w-36", paperCls)}>
                    <img src={r.preview} alt="" className="max-h-10 max-w-[92%] object-contain" />
                  </div>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={r.file.name}>{r.label || r.file.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={mCls}>{mText}</span>
                      {replacing && r.status !== "done" && <span className="text-gray-500 dark:text-gray-400">แทนที่ลายเซ็นเดิม</span>}
                    </p>
                  </div>
                  <div className="w-full min-w-0 sm:w-64">
                    <ComboBox
                      size="sm"
                      options={options}
                      value={r.userId}
                      onChange={(v) => update(r.key, { userId: v, confidence: "manual", include: !r.problem })}
                      placeholder="— เลือกเจ้าหน้าที่ —"
                      title="เลือกเจ้าของลายเซ็น"
                      ariaLabel={`เจ้าของลายเซ็นไฟล์ ${r.label}`}
                      disabled={busy || r.status === "done"}
                      error={dup}
                    />
                    {(r.problem || dup || r.error) && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-red-600 dark:text-red-400" role="alert">
                        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                        {r.problem || r.error || `เลือก ${nameById.get(r.userId)} ซ้ำกับไฟล์อื่น`}
                      </p>
                    )}
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs font-medium" aria-live="polite">
                    {r.status === "uploading" && <span className="text-indigo-600 dark:text-indigo-300">กำลังส่ง…</span>}
                    {r.status === "done" && <span className="text-emerald-700 dark:text-emerald-300">เสร็จแล้ว</span>}
                    {r.status === "error" && <span className="text-red-600 dark:text-red-400">ไม่สำเร็จ</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Sheet>
  )
}

// ─── หน้าหลัก ────────────────────────────────────────────────────────────────
// ─── แท็บย่อย: ลายเซ็นทั้งหมด | คำขอเปลี่ยนลายเซ็น ───────────────────────────────
export default function HRSignaturesTab() {
  const { can } = useCan()
  const canManage = can("hr.signatures.manage")
  const canApprove = can("hr.signatures.approve")
  const subs = [canManage && "list", canApprove && "requests"].filter(Boolean)
  const [sub, setSub] = useSubTab(subs, subs[0] ?? "list")
  const [pendingCount, setPendingCount] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!canApprove) return
    let alive = true
    listSignatureRequests("pending").then((r) => alive && setPendingCount(r.ready ? r.rows.length : null)).catch(() => {})
    return () => { alive = false }
  }, [canApprove, tick])

  if (subs.length < 2) return canApprove && !canManage ? <SignatureRequestsPanel /> : <SignatureListPanel />

  return (
    <div className="space-y-4">
      <Tabs
        items={[
          { value: "list", label: "ลายเซ็นทั้งหมด" },
          { value: "requests", label: "คำขอเปลี่ยนลายเซ็น", count: pendingCount || null },
        ]}
        value={sub}
        onChange={setSub}
        ariaLabel="ลายเซ็นอิเล็กทรอนิกส์"
        idBase="hr-signatures"
      />
      <div role="tabpanel" id={panelId("hr-signatures", sub)} aria-labelledby={tabId("hr-signatures", sub)} tabIndex={0} className={tabPanelCls}>
        {sub === "requests" ? <SignatureRequestsPanel onChanged={() => setTick((n) => n + 1)} /> : <SignatureListPanel key={tick} />}
      </div>
    </div>
  )
}

function SignatureListPanel() {
  const [historyOf, setHistoryOf] = useState(null)
  const [people, setPeople] = useState(() => getCachedPersonnel() ?? [])
  const [sigs, setSigs] = useState({ ready: true, rows: [] })
  const [state, setState] = useState({ loading: true, error: "" })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all") // all | has | missing
  const [bulkOpen, setBulkOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null) // person
  const [delState, setDelState] = useState({ loading: false, error: "" })
  const fileRef = useRef(null)
  const targetRef = useRef(null)

  const refreshSigs = useCallback(() => listSignatures().then(setSigs), [])

  useEffect(() => {
    let alive = true
    setState({ loading: true, error: "" })
    Promise.all([loadPersonnel(), listSignatures()])
      .then(([p, s]) => { if (alive) { setPeople(p); setSigs(s); setState({ loading: false, error: "" }) } })
      .catch((e) => alive && setState({ loading: false, error: errMsg(e, "โหลดข้อมูลลายเซ็นไม่สำเร็จ") }))
    return () => { alive = false }
  }, [attempt])

  const sigById = useMemo(() => new Map(sigs.rows.map((r) => [String(r.user_id), r])), [sigs.rows])
  const signed = useMemo(() => new Set(sigById.keys()), [sigById])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people
      .filter((p) => (filter === "has" ? sigById.has(String(p.id)) : filter === "missing" ? !sigById.has(String(p.id)) : true))
      .filter((p) => !q || `${employeeName(p)} ${p.position_display ?? ""} ${p.id}`.toLowerCase().includes(q))
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "th"))
  }, [people, sigById, filter, query])

  const total = people.length
  const have = people.filter((p) => sigById.has(String(p.id))).length

  const startUpload = (person) => {
    targetRef.current = person
    fileRef.current?.click()
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    const person = targetRef.current
    if (!file || !person) return
    const problem = await checkSignatureFile(file)
    if (problem) return toast.error(problem)
    setBusyId(person.id)
    try {
      await uploadSignature(person.id, file)
      await refreshSigs()
      toast.success(`บันทึกลายเซ็นของ ${employeeName(person)} แล้ว`)
    } catch (err) {
      toast.error(errMsg(err, "อัปโหลดลายเซ็นไม่สำเร็จ"))
    } finally {
      setBusyId(null)
    }
  }

  const doDelete = async () => {
    const person = confirmDel
    setDelState({ loading: true, error: "" })
    try {
      await deleteSignature(person.id)
      await refreshSigs()
      setConfirmDel(null)
      setDelState({ loading: false, error: "" })
      toast.success(`ลบลายเซ็นของ ${employeeName(person)} แล้ว`)
    } catch (err) {
      setDelState({ loading: false, error: errMsg(err, "ลบลายเซ็นไม่สำเร็จ") })
    }
  }

  if (state.error) return <ErrorState message={state.error} onRetry={() => setAttempt((n) => n + 1)} />

  const disabled = !sigs.ready

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/png" hidden onChange={onFile} />

      {!sigs.ready && !state.loading && (
        <div role="status" className="flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>ระบบหลังบ้านยังไม่เปิดรับลายเซ็น — อัปโหลดได้เมื่อ backend อัปเดตตามสเปก ระหว่างนี้เอกสารยังพิมพ์ได้ตามปกติ แต่ช่องลงชื่อจะยังว่าง</p>
        </div>
      )}

      <section className={cx(cardCls, "overflow-hidden")} aria-label="ลายเซ็นของเจ้าหน้าที่">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4 dark:border-line">
          <div className="min-w-0">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              มีลายเซ็นแล้ว{" "}
              <b className="text-base tabular-nums text-gray-900 dark:text-gray-100">{state.loading ? "–" : have}</b>
              <span className="tabular-nums"> / {state.loading ? "–" : total} คน</span>
            </p>
            <p className={helpTextCls}>ใส่ในใบลาและหนังสือรับรองให้อัตโนมัติ เฉพาะคนที่ยื่น อนุมัติ หรือตรวจรายการนั้นจริง</p>
          </div>
          <button type="button" className={cx(primaryBtnCls, "!h-11 ml-auto gap-2")} onClick={() => setBulkOpen(true)} disabled={state.loading}>
            <ImageUp className="size-4" aria-hidden="true" />
            นำเข้าหลายไฟล์
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <label className="relative w-full min-w-0 sm:w-72">
            <span className="sr-only">ค้นหาเจ้าหน้าที่</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ ตำแหน่ง รหัส"
              className={cx(baseField, "!rounded-lg !py-2 !pl-9 !pr-3 md:!text-sm")}
            />
          </label>
          <div className={cx(segmentedCls, "sm:!w-auto")} role="group" aria-label="กรองตามสถานะลายเซ็น">
            {[["all", "ทั้งหมด", total], ["has", "มีแล้ว", have], ["missing", "ยังไม่มี", total - have]].map(([k, l, n]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cx(segmentedItemCls, "whitespace-nowrap", filter === k && segmentedItemActiveCls)}>
                {l}
                {!state.loading && <span className="ml-1.5 tabular-nums opacity-60">{n}</span>}
              </button>
            ))}
          </div>
        </div>

        {state.loading ? (
          <div className="px-4 pb-4"><SkeletonTableRows rows={6} /></div>
        ) : !visible.length ? (
          <EmptyState
            title={query ? "ไม่พบเจ้าหน้าที่ที่ค้นหา" : filter === "missing" ? "ทุกคนมีลายเซ็นแล้ว" : "ยังไม่มีลายเซ็นในระบบ"}
            description={!query && filter !== "missing" ? "กด “นำเข้าหลายไฟล์” แล้วเลือกโฟลเดอร์ลายเซ็น ระบบจะจับคู่ชื่อให้" : undefined}
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-line">
            {visible.map((p) => {
              const sig = sigById.get(String(p.id))
              const name = employeeName(p)
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">{name}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {p.position_display || "ยังไม่มีตำแหน่ง"}
                      {sig?.uploaded_at && <> · อัปเดต {thaiDate(sig.uploaded_at)}</>}
                    </p>
                  </div>
                  {sig ? (
                    <SignatureThumb userId={p.id} version={sig.sha256 ?? sig.uploaded_at} name={name} />
                  ) : (
                    <span className="flex h-12 w-28 shrink-0 items-center justify-center text-xs text-gray-400 sm:w-36 dark:text-gray-500">
                      ยังไม่มีลายเซ็น
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={cx(neutralBtnCls, "!h-11 gap-1.5 md:!h-9")}
                      onClick={() => startUpload(p)}
                      disabled={disabled || busyId === p.id}
                    >
                      <Upload className="size-4" aria-hidden="true" />
                      {busyId === p.id ? "กำลังส่ง…" : sig ? "เปลี่ยน" : "อัปโหลด"}
                    </button>
                    <button
                      type="button"
                      className={iconBtnCls}
                      aria-label={`ประวัติการเปลี่ยนลายเซ็นของ ${name}`}
                      title="ประวัติการเปลี่ยนลายเซ็น"
                      onClick={() => setHistoryOf({ id: p.id, name })}
                      disabled={disabled}
                    >
                      <History className="size-4" aria-hidden="true" />
                    </button>
                    {sig && (
                      <button
                        type="button"
                        className={cx(iconBtnCls, "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10")}
                        aria-label={`ลบลายเซ็นของ ${name}`}
                        title="ลบลายเซ็น"
                        onClick={() => { setDelState({ loading: false, error: "" }); setConfirmDel(p) }}
                        disabled={disabled || busyId === p.id}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <SignatureHistorySheet person={historyOf} onClose={() => setHistoryOf(null)} />

      <BulkImportSheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        people={people}
        signed={signed}
        canUpload={sigs.ready}
        onDone={() => { thumbCache.clear(); refreshSigs() }}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="ลบลายเซ็นนี้?"
        description={confirmDel ? `เอกสารที่พิมพ์หลังจากนี้จะไม่มีลายเซ็นของ ${employeeName(confirmDel)} จนกว่าจะอัปโหลดใหม่ (เอกสารเก่ายังตรวจย้อนได้)` : ""}
        confirmLabel="ลบลายเซ็น"
        tone="danger"
        loading={delState.loading}
        loadingLabel="กำลังลบ…"
        error={delState.error}
        onConfirm={doDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  )
}

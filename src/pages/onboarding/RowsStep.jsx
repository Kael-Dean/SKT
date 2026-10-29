// src/pages/onboarding/RowsStep.jsx
// Generic list section: education · work · criminal · license.
// `embedded` = the same list outside onboarding (license editor on MyProfile, allowed after
// completion): no step header / confirm bar.
// Every add / edit / delete is a PUT { rows, delete_ids } that writes immediately (the
// payload comes back and re-renders the list). "ไม่มีประวัติ" (work + criminal) = PUT
// { none }. "บันทึกและไปต่อ" only confirms.
import { useState } from "react"
import { Plus } from "lucide-react"
import { ConfirmDialog, StickyActionBar, toast } from "../../components/ui"
import { LICENSE_TYPE_OPTIONS, NONE_SECTIONS, isLifetimeLicense, readValidation, saveSection, sectionMeta } from "../../lib/onboarding"
import { cx, focusRingCls } from "../../lib/styles"
import { AddRowButton, RowEditorSheet, RowItem } from "./RowEditor"
import { ED_LEVEL_OPTIONS } from "../../lib/education"
import { missingKeys, rowBody, thaiDate, useSectionFlow } from "./sectionFlow"
import { Frame, MissingHint, ProblemPanel, SectionCard, StepHeader } from "./shared"

const thaiYear = (iso) => (iso ? `พ.ศ. ${Number(String(iso).slice(0, 4)) + 543}` : "")
const range = (a, b) => {
  const from = thaiYear(a)
  const to = thaiYear(b)
  if (from && to) return `${from} ถึง ${to}`
  if (from) return `ตั้งแต่ ${from}`
  return to ? `ถึง ${to}` : ""
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const licenseExpiry = (r) => {
  if (isLifetimeLicense(r.license_type)) return "ตลอดชีพ"
  if (!r.expiry_date) return ""
  const expired = String(r.expiry_date).slice(0, 10) < todayIso()
  return `${expired ? "หมดอายุแล้ว" : "หมดอายุ"} ${thaiDate(r.expiry_date)}`
}

const ROW_SECTIONS = {
  education: {
    noun: "วุฒิการศึกษา",
    columns: [
      { key: "ed_level", label: "ระดับการศึกษา", type: "select", options: ED_LEVEL_OPTIONS, required: true, placeholder: "เลือกระดับการศึกษา" },
      { key: "inst_name", label: "ชื่อสถาบัน", required: true },
      { key: "from_date", label: "ปีที่เริ่ม", type: "year", edge: "start" },
      { key: "to_date", label: "ปีที่จบ", type: "year", edge: "end", minFrom: "from_date" },
    ],
    title: (r) => r.ed_level || "ไม่ระบุระดับ",
    lines: (r) => [r.inst_name, range(r.from_date, r.to_date)],
    empty: "ยังไม่มีวุฒิการศึกษา เพิ่มอย่างน้อย 1 รายการ",
  },
  work: {
    noun: "ที่ทำงานเดิม",
    columns: [
      { key: "company_name", label: "ชื่อที่ทำงาน", required: true, wide: true },
      { key: "position", label: "ตำแหน่ง", wide: true },
      { key: "from_date", label: "ปีที่เริ่ม", type: "year", edge: "start" },
      { key: "to_date", label: "ปีที่ออก", type: "year", edge: "end", minFrom: "from_date" },
    ],
    title: (r) => r.company_name || "ไม่ระบุชื่อที่ทำงาน",
    lines: (r) => [r.position, range(r.from_date, r.to_date)],
    empty: "เพิ่มที่ทำงานก่อนหน้า หรือเลือก “ไม่มีประวัติการทำงาน”",
    noneLabel: "ไม่มีประวัติการทำงาน",
    noneHelp: "ที่นี่เป็นที่ทำงานแห่งแรก",
  },
  criminal: {
    noun: "คดีความ",
    columns: [
      { key: "charge", label: "ข้อหา", required: true, wide: true },
      { key: "court", label: "ศาล" },
      { key: "case_date", label: "วันที่", type: "date" },
      { key: "outcome", label: "ผลคดี", wide: true },
    ],
    title: (r) => r.charge || "ไม่ระบุข้อหา",
    lines: (r) => [[r.court, thaiDate(r.case_date)].filter(Boolean).join(" · "), r.outcome],
    empty: "ระบุคดีความตามจริง หรือเลือก “ไม่มีประวัติคดีความ”",
    noneLabel: "ไม่มีประวัติคดีความ",
    noneHelp: "ไม่เคยถูกดำเนินคดี",
  },
  license: {
    noun: "ใบขับขี่",
    columns: [
      {
        key: "license_type", label: "ประเภทใบขับขี่", type: "select", options: LICENSE_TYPE_OPTIONS, required: true, wide: true,
        placeholder: "เลือกประเภทตามกรมการขนส่งทางบก",
        // lifetime licenses have no expiry date (backend 422s if one is sent)
        onChange: (v) => (isLifetimeLicense(v) ? { expiry_date: "" } : null),
      },
      { key: "license_no", label: "เลขที่ใบขับขี่", required: true },
      { key: "expiry_date", label: "วันหมดอายุ", type: "date", required: true, showIf: (f) => !isLifetimeLicense(f.license_type) },
    ],
    title: (r) => r.license_type || "ไม่ระบุประเภท",
    lines: (r) => [[r.license_no && `เลขที่ ${r.license_no}`, licenseExpiry(r)].filter(Boolean).join(" · ")],
    empty: "เพิ่มใบขับขี่ทุกใบที่มี หรือเลือก “ไม่มีใบขับขี่”",
    noneLabel: "ไม่มีใบขับขี่",
    noneHelp: "ไม่มีใบขับขี่ประเภทใดเลย",
  },
}

export default function RowsStep({ sectionKey, data, handlers, onBack, onPayload, embedded = false }) {
  const meta = sectionMeta(sectionKey)
  const cfg = ROW_SECTIONS[sectionKey]
  const rows = data?.values?.[sectionKey] ?? []
  const hasNone = NONE_SECTIONS.includes(sectionKey)
  const none = Boolean(data?.none_flags?.[sectionKey])
  const addId = `ob-${sectionKey}-add`
  const flow = useSectionFlow(sectionKey, { ...handlers, fallbackId: addId })

  const [editor, setEditor] = useState(null) // { row|null, key }
  const [editorBusy, setEditorBusy] = useState(false)
  const [editorErr, setEditorErr] = useState({ message: "", missing: [] })
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [noneBusy, setNoneBusy] = useState(false)

  const serverMissing = data?.sections?.[sectionKey]?.missing ?? []
  const listFlagged = !embedded && ((serverMissing.includes("rows") && rows.length === 0 && !none) || flow.problem?.missing?.includes("rows"))

  const put = async (body) => {
    const payload = await saveSection(sectionKey, body)
    onPayload?.(payload)
    flow.setProblem(null)
    return payload
  }

  const openEditor = (row) => {
    setEditorErr({ message: "", missing: [] })
    setEditor({ row, key: `${row?.id ?? "new"}-${Date.now()}` })
  }

  const saveRow = async (form) => {
    const original = editor?.row ?? null
    const miss = missingKeys(cfg.columns, form, !original)
    if (miss.length) return setEditorErr({ message: "", missing: miss })
    const body = rowBody(cfg.columns, form, original)
    if (original && Object.keys(body).length === 0) return setEditor(null)
    setEditorBusy(true)
    try {
      const row = original ? { id: original.id, ...body } : body
      await put({ rows: [row], ...(hasNone && none ? { none: false } : {}) })
      setEditor(null)
      toast.success(original ? "แก้ไขแล้ว" : `เพิ่ม${cfg.noun}แล้ว`)
    } catch (err) {
      if (err?.status === 409) {
        setEditor(null)
        handlers?.onLocked?.()
      } else setEditorErr(readValidation(err))
    } finally {
      setEditorBusy(false)
    }
  }

  const doDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await put({ delete_ids: [toDelete.id] })
      toast.success("ลบแล้ว")
      setToDelete(null)
    } catch (err) {
      setToDelete(null)
      if (err?.status === 409) handlers?.onLocked?.()
      else toast.error("ลบไม่สำเร็จ", { description: readValidation(err).message || err?.message })
    } finally {
      setDeleting(false)
    }
  }

  const toggleNone = async () => {
    setNoneBusy(true)
    try {
      await put({ none: !none })
    } catch (err) {
      if (err?.status === 409) handlers?.onLocked?.()
      else toast.error("บันทึกไม่สำเร็จ", { description: readValidation(err).message || err?.message })
    } finally {
      setNoneBusy(false)
    }
  }

  const headingId = `ob-${sectionKey}-title`

  return (
    <section aria-labelledby={embedded ? undefined : headingId}>
      {!embedded && <StepHeader id={headingId} title={meta.label} purpose={meta.purpose} />}

      <div className={flow.shake ? `animate-ob-shake-${flow.shake}` : undefined}>
        {hasNone && (
          <div className="mb-4">
            <button
              type="button"
              role="switch"
              aria-checked={none}
              disabled={noneBusy || rows.length > 0}
              onClick={toggleNone}
              className={cx(
                "flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 transition-colors duration-150",
                "disabled:cursor-not-allowed dark:bg-surface dark:shadow-none",
                none ? "ring-indigo-300 dark:ring-indigo-400/40" : "ring-gray-200/70 dark:ring-line",
                rows.length > 0 && "opacity-60",
                focusRingCls,
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-gray-900 dark:text-gray-100">{cfg.noneLabel}</span>
                <span className="block text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {rows.length > 0 ? "มีรายการอยู่แล้ว ลบรายการทั้งหมดก่อนถ้าจะเลือกข้อนี้" : cfg.noneHelp}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cx(
                  "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
                  none ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-300 dark:bg-gray-600",
                )}
              >
                <span
                  className={cx(
                    "inline-block size-6 rounded-full bg-white shadow-sm transition-transform duration-200",
                    none ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
          </div>
        )}

        {!(hasNone && none && rows.length === 0) && (
          <Frame flagged={listFlagged}>
            <SectionCard className={embedded ? "!bg-transparent !p-0 !shadow-none !ring-0" : ""}>
              {rows.length > 0 ? (
                <ul className="mb-4 divide-y divide-gray-100 dark:divide-line">
                  {rows.map((r) => (
                    <RowItem
                      key={r.id}
                      title={cfg.title(r)}
                      lines={cfg.lines(r)}
                      onEdit={() => openEditor(r)}
                      onDelete={() => setToDelete(r)}
                      editLabel={`แก้ไข ${cfg.title(r)}`}
                      deleteLabel={`ลบ ${cfg.title(r)}`}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mb-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{cfg.empty}</p>
              )}
              <AddRowButton id={addId} onClick={() => openEditor(null)}>
                <Plus aria-hidden="true" className="size-5" strokeWidth={2} />
                เพิ่ม{cfg.noun}
              </AddRowButton>
            </SectionCard>
          </Frame>
        )}
        {listFlagged && <MissingHint>{hasNone ? `เพิ่มอย่างน้อย 1 รายการ หรือเลือก “${cfg.noneLabel}”` : "เพิ่มอย่างน้อย 1 รายการ"}</MissingHint>}
      </div>

      {!embedded && (
        <>
          <ProblemPanel problem={flow.problem} />

          <StickyActionBar
            secondary={onBack ? { label: "ย้อนกลับ", onClick: onBack, disabled: flow.busy } : undefined}
            primary={{ label: "บันทึกและไปต่อ", tone: "primary", onClick: () => flow.submit(null), loading: flow.busy }}
          />
        </>
      )}

      <RowEditorSheet
        open={Boolean(editor)}
        openKey={editor?.key}
        title={editor?.row ? `แก้ไข${cfg.noun}` : `เพิ่ม${cfg.noun}`}
        columns={cfg.columns}
        initial={editor?.row ?? null}
        busy={editorBusy}
        error={editorErr.message}
        missing={editorErr.missing}
        onSubmit={saveRow}
        onClose={() => !editorBusy && setEditor(null)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`ลบ${cfg.noun}นี้?`}
        description={toDelete ? cfg.title(toDelete) : ""}
        confirmLabel="ลบ"
        tone="danger"
        loading={deleting}
        loadingLabel="กำลังลบ…"
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  )
}

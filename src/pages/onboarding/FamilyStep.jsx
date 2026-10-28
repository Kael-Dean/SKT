// src/pages/onboarding/FamilyStep.jsx
// Family rows (บิดา มารดา คู่สมรส บุตร). Rules (api-handoff §3.4):
//  · rows the employee adds/edits become hr_verified:false → badge "รอ HR ตรวจสอบ"
//  · delete only when can_delete; other rows → "แจ้ง HR" (3F category family / family_other)
//  · editing an hr_verified row flips it to unverified → warn first
//  · edit sends only changed keys; omit `relationship` when the row holds an imported value
//    outside RELATIONSHIPS and the user did not change it
//  · section is "missing" spouse_row / children_count → explain + link to personal
import { useState } from "react"
import { Baby, HeartHandshake, Plus } from "lucide-react"
import { ConfirmDialog, StickyActionBar, toast } from "../../components/ui"
import { MISSING_MESSAGES, RELATIONSHIPS, readValidation, saveSection, sectionMeta } from "../../lib/onboarding"
import { badgeNeutral, badgePending, badgeSuccess, cx, focusRingCls } from "../../lib/styles"
import { AddRowButton, RowEditorSheet, RowItem } from "./RowEditor"
import { blank, missingKeys, rowBody, thaiDate, useSectionFlow } from "./sectionFlow"
import { ProblemPanel, SectionCard, StepHeader } from "./shared"

const COLUMNS = [
  { key: "relationship", label: "ความสัมพันธ์", type: "select", options: RELATIONSHIPS, required: true, placeholder: "เลือกความสัมพันธ์" },
  { key: "first_name", label: "ชื่อ", required: true },
  { key: "last_name", label: "นามสกุล" },
  { key: "birthday", label: "วันเกิด", type: "date" },
  { key: "is_twin", label: "เป็นแฝด", type: "checkbox", help: "เฉพาะบุตร" },
]

const linkCls = cx(
  "inline-flex min-h-touch items-center rounded-lg text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline md:min-h-8 dark:text-indigo-300",
  focusRingCls,
)

function RuleNotice({ icon, title, children, action }) {
  const Icon = icon
  return (
    <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-400/25">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-relaxed text-amber-950 dark:text-amber-100">{title}</p>
        <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-200/90">{children}</p>
        {action}
      </div>
    </div>
  )
}

export default function FamilyStep({ data, handlers, onBack, onGoStep, onReport, onPayload }) {
  const meta = sectionMeta("family")
  const rows = data?.values?.family ?? []
  const personal = data?.values?.personal ?? {}
  const missing = data?.sections?.family?.missing ?? []
  const flow = useSectionFlow("family", handlers)

  const [editor, setEditor] = useState(null)
  const [editorBusy, setEditorBusy] = useState(false)
  const [editorErr, setEditorErr] = useState({ message: "", missing: [] })
  const [pendingEdit, setPendingEdit] = useState(null) // { form } waiting for the verified-row warning
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const childRows = rows.filter((r) => r.relationship === "บุตร").length
  const spouseRows = rows.filter((r) => r.relationship === "คู่สมรส").length

  const put = async (body) => {
    const payload = await saveSection("family", body)
    onPayload?.(payload)
    flow.setProblem(null)
    return payload
  }

  const openEditor = (row) => {
    setEditorErr({ message: "", missing: [] })
    setEditor({ row, key: `${row?.id ?? "new"}-${Date.now()}` })
  }

  const buildBody = (form, original) => {
    const body = rowBody(COLUMNS, form, original)
    if (original && !RELATIONSHIPS.includes(original.relationship) && (blank(form.relationship) || form.relationship === original.relationship)) {
      delete body.relationship
    }
    return body
  }

  const commit = async (form) => {
    const original = editor?.row ?? null
    const body = buildBody(form, original)
    if (original && Object.keys(body).length === 0) return setEditor(null)
    setEditorBusy(true)
    try {
      await put({ rows: [original ? { id: original.id, ...body } : body] })
      setEditor(null)
      toast.success(original ? "แก้ไขแล้ว" : "เพิ่มสมาชิกครอบครัวแล้ว", { description: "รอ HR ตรวจสอบ" })
    } catch (err) {
      if (err?.status === 409) {
        setEditor(null)
        handlers?.onLocked?.()
      } else setEditorErr(readValidation(err))
    } finally {
      setEditorBusy(false)
    }
  }

  const saveRow = (form) => {
    const original = editor?.row ?? null
    // imported relationship outside the 4 values: not required to re-pick when editing
    const cols = original && !RELATIONSHIPS.includes(original.relationship) ? COLUMNS.filter((c) => c.key !== "relationship") : COLUMNS
    const miss = missingKeys(cols, form, !original)
    if (miss.length) return setEditorErr({ message: "กรอกช่องที่มีเครื่องหมาย * ให้ครบ", missing: miss })
    if (original?.hr_verified && Object.keys(buildBody(form, original)).length) return setPendingEdit({ form })
    commit(form)
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
      else
        toast.error("ลบไม่ได้", {
          description: typeof err?.data?.detail === "string" ? err.data.detail : readValidation(err).message,
        })
    } finally {
      setDeleting(false)
    }
  }

  const headingId = "ob-family-title"
  const editRow = editor?.row
  const editInitial = editRow
    ? { ...editRow, relationship: RELATIONSHIPS.includes(editRow.relationship) ? editRow.relationship : "" }
    : null

  return (
    <section aria-labelledby={headingId}>
      <StepHeader id={headingId} title={meta.label} purpose={meta.purpose} />

      {(missing.includes("spouse_row") || missing.includes("children_count")) && (
        <div className="mb-4 space-y-3" aria-live="polite">
          {missing.includes("spouse_row") && (
            <RuleNotice
              icon={HeartHandshake}
              title={MISSING_MESSAGES.spouse_row}
              action={
                <button type="button" className={linkCls} onClick={() => onGoStep("personal")}>
                  สถานภาพไม่ถูกต้อง แก้ในข้อมูลส่วนตัว
                </button>
              }
            >
              ข้อมูลส่วนตัวระบุสถานภาพเป็น “{personal.m_status}” แต่ยังไม่มีคู่สมรสในรายการ ({spouseRows} คน)
            </RuleNotice>
          )}
          {missing.includes("children_count") && (
            <RuleNotice
              icon={Baby}
              title={MISSING_MESSAGES.children_count}
              action={
                <button type="button" className={linkCls} onClick={() => onGoStep("personal")}>
                  จำนวนบุตรไม่ถูกต้อง แก้ในข้อมูลส่วนตัว
                </button>
              }
            >
              ข้อมูลส่วนตัวระบุบุตร {personal.children_number ?? 0} คน ในรายการมีบุตร {childRows} คน
            </RuleNotice>
          )}
        </div>
      )}

      <div className={flow.shake ? `animate-ob-shake-${flow.shake}` : undefined}>
        <SectionCard>
          {rows.length > 0 ? (
            <ul className="mb-4 divide-y divide-gray-100 dark:divide-line">
              {rows.map((r) => {
                const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ"
                return (
                  <RowItem
                    key={r.id}
                    title={name}
                    badge={
                      <>
                        <span className={badgeNeutral}>{r.relationship || "ไม่ระบุ"}</span>
                        {r.hr_verified ? (
                          <span className={badgeSuccess}>HR ตรวจสอบแล้ว</span>
                        ) : (
                          <span className={badgePending}>รอ HR ตรวจสอบ</span>
                        )}
                      </>
                    }
                    lines={[
                      [r.birthday ? `เกิด ${thaiDate(r.birthday)}` : "", r.is_twin ? "แฝด" : ""].filter(Boolean).join(" · "),
                    ]}
                    extra={
                      !r.can_delete ? (
                        <button
                          type="button"
                          className={linkCls}
                          onClick={() => onReport?.("family", "family_other", `${r.relationship ?? ""} ${name}`.trim())}
                        >
                          ต้องการลบรายการนี้ แจ้ง HR
                        </button>
                      ) : null
                    }
                    onEdit={() => openEditor(r)}
                    onDelete={r.can_delete ? () => setToDelete(r) : undefined}
                    editLabel={`แก้ไข ${name}`}
                    deleteLabel={`ลบ ${name}`}
                  />
                )
              })}
            </ul>
          ) : (
            <p className="mb-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
              ยังไม่มีสมาชิกครอบครัวในระบบ ถ้าไม่มีคู่สมรสและบุตร ข้ามไปขั้นถัดไปได้
            </p>
          )}
          <AddRowButton onClick={() => openEditor(null)}>
            <Plus aria-hidden="true" className="size-5" strokeWidth={2} />
            เพิ่มสมาชิกครอบครัว
          </AddRowButton>
        </SectionCard>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        รายการที่รอ HR ตรวจสอบยังไม่ถูกนับในสวัสดิการ สิทธิ์ของคนนั้นเริ่มหลังจาก HR ตรวจสอบแล้ว
      </p>

      <ProblemPanel problem={flow.problem} />

      <StickyActionBar
        secondary={onBack ? { label: "ย้อนกลับ", onClick: onBack, disabled: flow.busy } : undefined}
        primary={{ label: "บันทึกและไปต่อ", tone: "primary", onClick: () => flow.submit(null), loading: flow.busy }}
      />

      <RowEditorSheet
        open={Boolean(editor)}
        openKey={editor?.key}
        title={editRow ? "แก้ไขสมาชิกครอบครัว" : "เพิ่มสมาชิกครอบครัว"}
        subtitle={
          editRow && !RELATIONSHIPS.includes(editRow.relationship) && editRow.relationship
            ? `ความสัมพันธ์เดิม: ${editRow.relationship} (เลือกใหม่เฉพาะเมื่อต้องการเปลี่ยน)`
            : undefined
        }
        columns={COLUMNS}
        initial={editInitial}
        busy={editorBusy}
        error={editorErr.message}
        missing={editorErr.missing}
        onSubmit={saveRow}
        onClose={() => !editorBusy && setEditor(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingEdit)}
        title="แก้ข้อมูลที่ HR ตรวจสอบแล้ว?"
        description="เมื่อบันทึก รายการนี้จะกลับไปเป็น “รอ HR ตรวจสอบ” และยังไม่ถูกนับในสวัสดิการจนกว่า HR จะตรวจสอบอีกครั้ง"
        confirmLabel="บันทึกการแก้ไข"
        tone="primary"
        loading={editorBusy}
        onConfirm={async () => {
          const f = pendingEdit?.form
          setPendingEdit(null)
          if (f) await commit(f)
        }}
        onCancel={() => setPendingEdit(null)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="ลบสมาชิกครอบครัวนี้?"
        description={toDelete ? [toDelete.relationship, toDelete.first_name, toDelete.last_name].filter(Boolean).join(" ") : ""}
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

// src/pages/hr/tabs/PersonnelActivitiesTab.jsx
// ช่องในโปรไฟล์พนักงาน (HRPersonnelDetail): ประวัติกิจกรรม — ประชุม / สัมมนา / ฝึกอบรม / สอบ (3G · PR 45)
//   GET    /hr/employees/{id}/activities              (hr.employee.activities.view → hr.employee.view)
//   POST / PATCH / DELETE …/activities[/{aid}]        (hr.employee.activities.edit → hr.employee.edit_personal)
// props: { employeeId, employeeName }
// รายการใช้ <ActivityList> ตัวเดียวกับหน้า "ข้อมูลส่วนตัว" ของพนักงาน (อ่านอย่างเดียว)
import { useCallback, useEffect, useRef, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { apiDetail } from "../../../lib/apiErrors"
import { deleteActivity, fetchEmployeeActivities } from "../../../lib/activities"
import { useCan } from "../../../lib/permissions"
import { cardPaddedCls, cx, iconBtnCls, primaryBtnCls } from "../../../lib/styles"
import { ConfirmDialog, toast } from "../../../components/ui"
import ActivityList from "../../../components/hr/ActivityList"
import ActivityEditSheet from "../../../components/hr/ActivityEditSheet"

export default function PersonnelActivitiesTab({ employeeId, employeeName }) {
  const { can } = useCan()
  const canEdit = can("hr.employee.activities.edit")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  // editing: undefined = ปิด · null = เพิ่มใหม่ · object = แก้ไขรายการนั้น
  const [editing, setEditing] = useState(undefined)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [delErr, setDelErr] = useState("")
  const [freshId, setFreshId] = useState(null)     // กิจกรรมที่เพิ่งเพิ่ม → เปิดออก + tint
  const [leavingId, setLeavingId] = useState(null) // กิจกรรมที่เพิ่งลบ → ยุบหายก่อนเอาออก
  const leaveTimer = useRef(0)
  useEffect(() => () => clearTimeout(leaveTimer.current), [])

  const load = useCallback(() => {
    if (employeeId == null) return undefined
    let alive = true
    setLoading(true)
    setError("")
    fetchEmployeeActivities(employeeId)
      .then((list) => { if (alive) setRows(list) })
      .catch((e) => { if (alive) setError(apiDetail(e) || "โหลดประวัติกิจกรรมไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [employeeId])

  useEffect(() => load(), [load])

  const confirmDelete = async () => {
    if (!delTarget) return
    setDeleting(true)
    setDelErr("")
    try {
      await deleteActivity(employeeId, delTarget.id)
      const goneId = delTarget.id
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      setLeavingId(goneId)
      clearTimeout(leaveTimer.current)
      leaveTimer.current = setTimeout(() => {
        setRows((list) => list.filter((a) => a.id !== goneId))
        setLeavingId(null)
      }, reduce ? 0 : 300)
      toast.success("ลบกิจกรรมแล้ว", { description: delTarget.title })
      setDelTarget(null)
    } catch (e) {
      setDelErr(apiDetail(e) || "ลบไม่สำเร็จ ลองใหม่อีกครั้ง")
    } finally {
      setDeleting(false)
    }
  }

  const addBtn = (
    <button type="button" onClick={() => setEditing(null)} className={cx(primaryBtnCls, "inline-flex items-center gap-1.5 min-h-touch md:min-h-9 md:!py-1.5 md:!text-sm")}>
      <Plus aria-hidden="true" className="size-4" /> เพิ่มกิจกรรม
    </button>
  )

  const rowActions = canEdit
    ? (a) => (
      <>
        <button type="button" onClick={() => setEditing(a)} className={iconBtnCls} aria-label={`แก้ไข ${a.title}`} title="แก้ไข">
          <Pencil aria-hidden="true" className="size-4" />
        </button>
        <button type="button" onClick={() => { setDelErr(""); setDelTarget(a) }} className={cx(iconBtnCls, "hover:!text-red-600 dark:hover:!text-red-400")} aria-label={`ลบ ${a.title}`} title="ลบ">
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </>
    )
    : undefined

  const examCount = rows.filter((a) => a.activity_type === "exam").length

  return (
    <section aria-labelledby="pd-activities-h" aria-busy={loading || undefined} className={cardPaddedCls}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="pd-activities-h" className="text-sm font-semibold text-gray-900 dark:text-gray-100">ประวัติกิจกรรม</h2>
          {!loading && !error && rows.length > 0 && (
            <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {rows.length} รายการ{examCount > 0 ? ` · สอบ ${examCount} ครั้ง` : ""}
            </p>
          )}
        </div>
        {canEdit && rows.length > 0 && addBtn}
      </div>

      <ActivityList
        items={rows}
        loading={loading}
        error={error}
        onRetry={load}
        actions={rowActions}
        freshId={freshId}
        leavingId={leavingId}
        onFreshEnd={() => setFreshId(null)}
        emptyTitle="ยังไม่มีประวัติกิจกรรม"
        emptyDescription={`บันทึกการประชุม สัมมนา ฝึกอบรม หรือการสอบของ${employeeName || "พนักงานคนนี้"} พร้อมใบประกาศ`}
        emptyAction={canEdit ? addBtn : null}
      />

      {canEdit && (
        <ActivityEditSheet
          open={editing !== undefined}
          employeeId={employeeId}
          employeeName={employeeName}
          activity={editing ?? null}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            if (!editing && saved?.id != null) setFreshId(saved.id)
            load()
          }}
          onFilesChanged={() => load()}
        />
      )}

      <ConfirmDialog
        open={Boolean(delTarget)}
        title="ลบกิจกรรม"
        description={delTarget ? `ลบ "${delTarget.title}" และไฟล์แนบทั้งหมดของกิจกรรมนี้ — กู้คืนไม่ได้` : ""}
        confirmLabel="ลบกิจกรรม"
        tone="danger"
        loading={deleting}
        loadingLabel="กำลังลบ…"
        error={delErr}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDelTarget(null) }}
      />
    </section>
  )
}

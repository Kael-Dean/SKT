// src/pages/hr/tabs/PersonnelDependantsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ช่องในโปรไฟล์พนักงาน (HRPersonnelDetail): ผู้มีสิทธิ์รับสวัสดิการ (3P B2)
//   GET    /hr/employees/{id}/dependants          (hr.welfare.dependants.view)
//   POST   /hr/employees/{id}/dependants          ┐
//   PATCH  /hr/dependants/{id}                    ├ hr.employees.editPersonal
//   DELETE /hr/dependants/{id}  (soft delete)     ┘
//   GET    /hr/employees/{id}/welfare-balance      (hr.welfare.view) — สิทธิ์คงเหลือใต้รายชื่อ
// props: { employeeId, employeeName }
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { useCan } from "../../../lib/permissions"
import { cardPaddedCls, cx, iconBtnCls, neutralBtnCls } from "../../../lib/styles"
import { currentAcademicYearBE, dependantName, sortDependants } from "../../../lib/welfare"
import { ConfirmDialog, EmptyState, ErrorState, SkeletonText, toast } from "../../../components/ui"
import DependantsList from "../../../components/hr/welfare/DependantsList"
import DependantSheet from "../../../components/hr/welfare/DependantSheet"
import WelfareBalanceCard from "../../../components/hr/welfare/WelfareBalanceCard"

export default function PersonnelDependantsTab({ employeeId, employeeName }) {
  const { can } = useCan()
  const canEdit = can("hr.employees.editPersonal")
  const canBalance = can("hr.welfare.view")

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sheet, setSheet] = useState(null)        // { dependant: object|null }
  const [removing, setRemoving] = useState(null)  // dependant
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState("")
  const [version, setVersion] = useState(0)       // รีโหลดยอดคงเหลือเมื่อรายชื่อเปลี่ยน

  const load = useCallback(async () => {
    if (employeeId == null) return
    setLoading(true)
    setError("")
    try {
      const d = await apiAuth(`/hr/employees/${encodeURIComponent(employeeId)}/dependants`)
      setRows(sortDependants(Array.isArray(d) ? d : d?.items ?? []))
    } catch (err) {
      setError(apiDetail(err) || "โหลดรายชื่อผู้มีสิทธิ์ไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { load() }, [load])

  const afterChange = () => { load(); setVersion((v) => v + 1) }

  const confirmDelete = async () => {
    if (!removing) return
    setDeleting(true)
    setDeleteErr("")
    try {
      await apiAuth(`/hr/dependants/${removing.id}`, { method: "DELETE" })
      toast.success("ลบผู้มีสิทธิ์แล้ว", { description: `${dependantName(removing)} — คำขอเบิกเดิมยังผูกกับบุคคลนี้ตามเดิม` })
      setRemoving(null)
      afterChange()
    } catch (err) {
      setDeleteErr(apiDetail(err) || "ลบไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  const rowActions = canEdit ? (d) => (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setSheet({ dependant: d })} className={iconBtnCls}
        aria-label={`แก้ไข ${dependantName(d)}`} title="แก้ไข">
        <Pencil aria-hidden="true" className="size-4" />
      </button>
      <button type="button" onClick={() => { setDeleteErr(""); setRemoving(d) }}
        className={cx(iconBtnCls, "hover:!text-red-600 dark:hover:!text-red-400")}
        aria-label={`ลบ ${dependantName(d)}`} title="ลบ">
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </div>
  ) : undefined

  return (
    <section aria-labelledby="pd-dependants-h" className={cardPaddedCls}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="pd-dependants-h" className="text-sm font-semibold text-gray-900 dark:text-gray-100">ผู้มีสิทธิ์รับสวัสดิการ</h2>
          {!loading && rows.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ระบบตรวจสิทธิ์ตามระเบียบ 13 (ค่ารักษา) และ 14 (ค่าการศึกษาบุตร) ให้อัตโนมัติ
            </p>
          )}
        </div>
        {canEdit && (
          <button type="button" onClick={() => setSheet({ dependant: null })} className={cx(neutralBtnCls, "!h-10 md:!h-9")}>
            <Plus aria-hidden="true" className="size-4" />
            เพิ่มผู้มีสิทธิ์
          </button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div aria-busy="true"><SkeletonText lines={3} /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          className="!py-8"
          title="ยังไม่มีผู้มีสิทธิ์"
          description={canEdit
            ? "เพิ่มบิดา มารดา คู่สมรส และบุตร เพื่อให้เบิกค่ารักษาพยาบาลและค่าการศึกษาบุตรได้"
            : "ยังไม่ได้บันทึกบิดา มารดา คู่สมรส หรือบุตรของเจ้าหน้าที่คนนี้"}
        />
      ) : (
        <DependantsList items={rows} actions={rowActions} />
      )}

      {canBalance && employeeId != null && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-line">
          <WelfareBalanceCard bare employeeId={employeeId} academicYear={currentAcademicYearBE()} refreshKey={version} />
        </div>
      )}

      {sheet && (
        <DependantSheet
          open
          employeeId={employeeId}
          employeeName={employeeName}
          dependant={sheet.dependant}
          onClose={() => setSheet(null)}
          onSaved={afterChange}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        title="ลบผู้มีสิทธิ์?"
        description={removing ? `${dependantName(removing)} จะไม่แสดงในรายชื่อและเบิกสวัสดิการเพิ่มไม่ได้ คำขอเบิกที่บันทึกไว้แล้วยังอยู่ครบ` : ""}
        confirmLabel="ลบ"
        tone="danger"
        loading={deleting}
        loadingLabel="กำลังลบ…"
        error={deleteErr}
        onConfirm={confirmDelete}
        onCancel={() => setRemoving(null)}
      />
    </section>
  )
}

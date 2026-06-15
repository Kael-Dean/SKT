import { useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import {
  cx, baseField, labelCls, modalCardCls, modalTitleCls,
  submitBtnCls, secondaryBtnCls, resetBtnCls, cardCls,
} from "../../../lib/styles"
import { Badge, EmptyState } from "../../../components/ui"

const ROLE = { ADMIN: 1, HA: 4 }

export default function DebtProgramsTab({ roleId, programs, onProgramsChanged }) {
  const canManage = roleId === ROLE.ADMIN || roleId === ROLE.HA

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ prog_name: "", description: "" })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  if (!canManage) {
    return (
      <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
        ไม่มีสิทธิ์เข้าถึงส่วนนี้
      </div>
    )
  }

  function openAdd() {
    setForm({ prog_name: "", description: "" })
    setSaveMsg("")
    setModal({ mode: "add" })
  }

  function openEdit(record) {
    setForm({ prog_name: record.prog_name, description: record.description || "" })
    setSaveMsg("")
    setModal({ mode: "edit", record })
  }

  function openDelete(record) {
    setSaveMsg("")
    setModal({ mode: "delete", record })
  }

  function closeModal() {
    setModal(null)
    setSaveMsg("")
  }

  async function handleSave() {
    if (!form.prog_name.trim()) {
      setSaveMsg("กรุณากรอกชื่อโปรแกรม")
      return
    }
    setSaving(true)
    setSaveMsg("")
    try {
      const body = { prog_name: form.prog_name.trim(), description: form.description.trim() || null }
      if (modal.mode === "add") {
        await apiAuth("/debt/programs", { method: "POST", body })
      } else {
        await apiAuth(`/debt/programs/${modal.record.id}`, { method: "PATCH", body })
      }
      closeModal()
      onProgramsChanged()
    } catch (e) {
      setSaveMsg(e.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    setSaveMsg("")
    try {
      await apiAuth(`/debt/programs/${modal.record.id}`, { method: "DELETE" })
      closeModal()
      onProgramsChanged()
    } catch (e) {
      setSaveMsg(e.message || "ลบไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          รายการโปรแกรมหนี้ทั้งหมด ({programs.length} รายการ)
        </p>
        <button onClick={openAdd} className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm")}>
          + เพิ่มโปรแกรม
        </button>
      </div>

      {programs.length === 0 ? (
        <div className={cx(cardCls, "overflow-hidden")}>
          <EmptyState
            title="ยังไม่มีโปรแกรมหนี้"
            description="เพิ่มโปรแกรมหนี้รายการแรกเพื่อเริ่มบันทึกยอดหนี้คงค้างของแต่ละสาขา"
            action={
              <button
                type="button"
                onClick={openAdd}
                className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
              >
                + เพิ่มโปรแกรม
              </button>
            }
          />
        </div>
      ) : (
        <div className={cx(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ชื่อโปรแกรม</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">คำอธิบาย</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">สถานะ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {programs.map((p, i) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.prog_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{p.description || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.is_active !== false ? "success" : "danger"}>
                        {p.is_active !== false ? "ใช้งาน" : "ปิดใช้"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => openDelete(p)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && modal.mode !== "delete" && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-md w-full")}>
              <h2 className={cx(modalTitleCls, "mb-5")}>
                {modal.mode === "add" ? "เพิ่มโปรแกรมหนี้" : "แก้ไขโปรแกรมหนี้"}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>ชื่อโปรแกรม <span className="text-red-500">*</span></label>
                  <input
                    className={baseField}
                    value={form.prog_name}
                    onChange={(e) => setForm((f) => ({ ...f, prog_name: e.target.value }))}
                    placeholder="เช่น โครงการสินเชื่อเกษตรกร"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className={labelCls}>คำอธิบาย</label>
                  <textarea
                    className={cx(baseField, "resize-none")}
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="รายละเอียดโปรแกรม (ไม่จำเป็น)"
                  />
                </div>
              </div>
              {saveMsg && (
                <p className="mt-3 text-sm text-red-500 dark:text-red-400">{saveMsg}</p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeModal} className={resetBtnCls} disabled={saving}>
                  ยกเลิก
                </button>
                <button onClick={handleSave} className={submitBtnCls} disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Delete Modal */}
      {modal?.mode === "delete" && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-sm w-full")}>
              <h2 className={cx(modalTitleCls, "mb-2")}>ยืนยันการลบ</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ต้องการลบโปรแกรม <span className="font-semibold text-gray-900 dark:text-gray-100">"{modal.record.prog_name}"</span> ใช่หรือไม่?
              </p>
              {saveMsg && (
                <p className="mt-3 text-sm text-red-500 dark:text-red-400">{saveMsg}</p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeModal} className={resetBtnCls} disabled={saving}>
                  ยกเลิก
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-sm cursor-pointer hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {saving ? "กำลังลบ…" : "ยืนยันลบ"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}

// src/pages/work/MyWelfare.jsx
// ─────────────────────────────────────────────────────────────────────────────
// สวัสดิการของฉัน (3P / 3G) — GET /personnel/me/welfare?academic_year=
//   → { claims: ClaimOut[], balance: {...welfare-balance}, dependants: DependantOut[] }
// อ่านอย่างเดียว: เจ้าหน้าที่ยังยื่นแบบฟอร์มกระดาษที่ฝ่ายบุคคล (HR เป็นผู้บันทึก)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react"
import { Info } from "lucide-react"
import PageTitle from "../../components/PageTitle"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { cardCls, cardPaddedCls, cx } from "../../lib/styles"
import { currentAcademicYearBE, sortDependants } from "../../lib/welfare"
import { EmptyState, ErrorState, SkeletonText } from "../../components/ui"
import { WelfareBalanceView } from "../../components/hr/welfare/WelfareBalanceCard"
import ClaimsTable from "../../components/hr/welfare/ClaimsTable"
import ClaimDetailSheet from "../../components/hr/welfare/ClaimDetailSheet"
import DependantsList from "../../components/hr/welfare/DependantsList"

const patientOf = (c, deps) => {
  if (c.claim_type === "checkup" || c.dependant_id == null) return "ตัวเอง"
  const d = deps.find((x) => x.id === c.dependant_id)
  return c.dependant_name || (d ? [d.first_name, d.last_name].filter(Boolean).join(" ") : `ผู้มีสิทธิ์ #${c.dependant_id}`)
}

export default function MyWelfare() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await apiAuth(`/personnel/me/welfare?academic_year=${currentAcademicYearBE()}`))
    } catch (err) {
      setError(apiDetail(err) || "โหลดข้อมูลสวัสดิการไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const claims = Array.isArray(data?.claims) ? data.claims : []
  const deps = sortDependants(Array.isArray(data?.dependants) ? data.dependants : [])
  const pOf = (c) => patientOf(c, deps)

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <PageTitle title="สวัสดิการของฉัน" />

      <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        ยื่นเบิกค่ารักษาพยาบาล ตรวจสุขภาพ หรือค่าการศึกษาบุตร ด้วยแบบฟอร์มพร้อมใบเสร็จที่ฝ่ายบุคคล — หน้านี้ใช้ติดตามสถานะและดูสิทธิ์คงเหลือ
      </p>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <section aria-labelledby="mw-balance-h" className={cardPaddedCls}>
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <h2 id="mw-balance-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">สิทธิ์คงเหลือ</h2>
              {data?.balance?.fiscal_year && <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">ปีงบประมาณ {data.balance.fiscal_year} (เม.ย.–มี.ค.)</span>}
            </div>
            {loading ? <SkeletonText lines={4} /> : data?.balance ? (
              <WelfareBalanceView balance={data.balance} />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีข้อมูลสิทธิ์</p>
            )}
          </section>

          <section aria-labelledby="mw-claims-h" className="space-y-3">
            <h2 id="mw-claims-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">คำขอเบิกของฉัน</h2>
            <ClaimsTable
              claims={claims}
              loading={loading}
              showPerson={false}
              patientOf={pOf}
              onOpen={setDetail}
              skeletonRows={3}
              empty={<EmptyState title="ยังไม่มีคำขอเบิก" description="เมื่อฝ่ายบุคคลบันทึกแบบฟอร์มของคุณแล้ว สถานะจะแสดงที่นี่" />}
            />
          </section>

          <section aria-labelledby="mw-family-h" className={cx(cardCls, "p-5")}>
            <h2 id="mw-family-h" className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">ครอบครัวที่ได้รับสิทธิ์</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">ข้อมูลไม่ถูกต้องหรือมีสมาชิกเพิ่ม (เช่น บุตรเกิดใหม่) แจ้งฝ่ายบุคคลเพื่อแก้ไข</p>
            {loading ? <SkeletonText lines={3} /> : deps.length ? (
              <DependantsList items={deps} />
            ) : (
              <EmptyState className="!py-8" title="ยังไม่มีข้อมูลครอบครัว" description="แจ้งฝ่ายบุคคลเพื่อบันทึกบิดา มารดา คู่สมรส และบุตร ก่อนยื่นเบิกให้ครอบครัว" />
            )}
          </section>
        </>
      )}

      {detail && (
        <ClaimDetailSheet readOnly claim={detail} patientName={pOf(detail)} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

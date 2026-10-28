// src/pages/RiceSpecCreate.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import { cx, baseField, fieldDisabled, helpTextCls, submitBtnCls, resetBtnCls, secondaryBtnCls, neutralBtnCls, spinnerCls } from "../../lib/styles"
import { Card, CardHeader, PageLoader, ErrorState, StickyActionBar, toast } from "../../components/ui"
import SpecComboField from "../../components/SpecComboField"
import { useIsPhone } from "../../hooks/useMediaQuery"
import PageTitle from "../../components/PageTitle"
import { backState } from "../../lib/drill"
import {
  SPEC_API,
  STATIC_MASTERS,
  LOAD_LIST_ERROR,
  SPECIES_LABEL_KEY,
  VARIANT_LABEL_KEY,
  emptySpecOptions,
  fetchOptions,
  speciesUrl,
  variantsUrl,
  specErrorMessage,
  specPreviewName,
  toInt,
} from "../../lib/riceSpec"

/** ---------- หน้าเพิ่ม “รหัสข้าว” (ProductSpec) ---------- */
function RiceSpecCreate() {
  const isPhone = useIsPhone()

  /** --- options --- */
  const [opts, setOpts] = useState(emptySpecOptions)

  const [loading, setLoading] = useState({
    static: false,
    species: false,
    variants: false,
  })

  // โหลดครั้งแรกเสร็จหรือยัง — ใช้ตัดสินว่าจะโชว์ skeleton เต็มหน้าหรือ inline
  const [firstLoaded, setFirstLoaded] = useState(false)

  const [loadErr, setLoadErr] = useState({}) // per list error message

  const safeFetch = async ({ key, url, labelKey, transform }) => {
    try {
      const mapped = await fetchOptions(url, labelKey, transform)
      setLoadErr((p) => ({ ...p, [key]: undefined }))
      return mapped
    } catch (e) {
      console.error("load", key, "failed:", e)
      setLoadErr((p) => ({ ...p, [key]: LOAD_LIST_ERROR }))
      return []
    }
  }

  const loadStaticMasters = async () => {
    setLoading((p) => ({ ...p, static: true }))
    try {
      const lists = await Promise.all(STATIC_MASTERS.map((m) => safeFetch(m)))
      setOpts((p) => ({
        ...p,
        ...Object.fromEntries(STATIC_MASTERS.map((m, i) => [m.key, lists[i]])),
      }))
    } finally {
      setLoading((p) => ({ ...p, static: false }))
    }
  }

  const loadSpecies = async (productIdStr) => {
    const pid = toInt(productIdStr)
    if (!Number.isFinite(pid)) {
      setOpts((p) => ({ ...p, species: [], variants: [] }))
      return
    }

    setLoading((p) => ({ ...p, species: true }))
    try {
      const list = await safeFetch({ key: "species", url: speciesUrl(pid), labelKey: SPECIES_LABEL_KEY })
      setOpts((p) => ({ ...p, species: list }))
    } finally {
      setLoading((p) => ({ ...p, species: false }))
    }
  }

  const loadVariants = async (speciesIdStr) => {
    const sid = toInt(speciesIdStr)
    if (!Number.isFinite(sid)) {
      setOpts((p) => ({ ...p, variants: [] }))
      return
    }

    setLoading((p) => ({ ...p, variants: true }))
    try {
      const list = await safeFetch({ key: "variants", url: variantsUrl(sid), labelKey: VARIANT_LABEL_KEY })
      setOpts((p) => ({ ...p, variants: list }))
    } finally {
      setLoading((p) => ({ ...p, variants: false }))
    }
  }

  /** --- form --- */
  const [form, setForm] = useState({
    product_id: "",
    species_id: "",
    variant_id: "",
    product_year: "",
    condition_id: "",
    field_type: "",
    program: "",
    business_type: "",
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [submitError, setSubmitError] = useState("")

  // refs + focus order
  const productRef = useRef(null)
  const speciesRef = useRef(null)
  const variantRef = useRef(null)
  const yearRef = useRef(null)
  const conditionRef = useRef(null)
  const fieldTypeRef = useRef(null)
  const programRef = useRef(null)
  const businessRef = useRef(null)
  const submitRef = useRef(null)

  const focusOrder = [
    productRef,
    speciesRef,
    variantRef,
    yearRef,
    conditionRef,
    fieldTypeRef,
    programRef,
    businessRef,
    submitRef,
  ]

  const focusNextFromEl = (el) => {
    const i = focusOrder.findIndex((r) => r?.current === el)
    const next = focusOrder[Math.min(i + 1, focusOrder.length - 1)]
    try {
      next?.current?.focus?.()
    } catch {
      // element gone (re-render) — focus stays where it is
    }
  }

  /** --- initial load --- */
  useEffect(() => {
    loadStaticMasters().finally(() => setFirstLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** --- dependent loads --- */
  useEffect(() => {
    // product changed -> reload species
    const pid = form.product_id
    setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
    setOpts((p) => ({ ...p, species: [], variants: [] }))
    if (pid) loadSpecies(pid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id])

  useEffect(() => {
    // species changed -> reload variants
    const sid = form.species_id
    setForm((p) => ({ ...p, variant_id: "" }))
    setOpts((p) => ({ ...p, variants: [] }))
    if (sid) loadVariants(sid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.species_id])

  const reloadAll = async () => {
    await loadStaticMasters()
    if (form.product_id) await loadSpecies(form.product_id)
    if (form.species_id) await loadVariants(form.species_id)
  }

  const validate = () => {
    const e = {}

    if (!form.product_id) e.product_id = "เลือกประเภทสินค้า"
    if (!form.species_id) e.species_id = "เลือกชนิด/สายพันธุ์"
    if (!form.variant_id) e.variant_id = "เลือกพันธุ์/รูปแบบ"

    // กันกรณีได้ค่าที่ไม่ใช่ตัวเลข
    ;[
      "product_id",
      "species_id",
      "variant_id",
      "product_year",
      "condition_id",
      "field_type",
      "program",
      "business_type",
    ].forEach((k) => {
      if (!form[k]) return
      if (!Number.isFinite(toInt(form[k]))) e[k] = "รูปแบบรหัสไม่ถูกต้อง"
    })

    setErrors(e)
    if (Object.keys(e).length) toast.error("กรอกไม่ครบ", { description: Object.values(e)[0] })
    return Object.keys(e).length === 0
  }

  const buildPayload = () => {
    const payload = {
      product_id: toInt(form.product_id),
      species_id: toInt(form.species_id),
      variant_id: toInt(form.variant_id),
    }

    if (form.product_year) payload.product_year = toInt(form.product_year)
    if (form.condition_id) payload.condition_id = toInt(form.condition_id)
    if (form.field_type) payload.field_type = toInt(form.field_type)
    if (form.program) payload.program = toInt(form.program)
    if (form.business_type) payload.business_type = toInt(form.business_type)

    return payload
  }

  const reset = () => {
    setForm({
      product_id: "",
      species_id: "",
      variant_id: "",
      product_year: "",
      condition_id: "",
      field_type: "",
      program: "",
      business_type: "",
    })
    setErrors({})
    setResult(null)
    setSubmitError("")
    setOpts((p) => ({ ...p, species: [], variants: [] }))
    productRef.current?.focus?.()
  }

  const submit = async () => {
    setSubmitError("")
    if (!validate()) return

    const payload = buildPayload()

    try {
      setSubmitting(true)
      const res = await apiAuth(SPEC_API.createSpec, {
        method: "POST",
        body: payload,
      })
      setResult(res)
      setErrors({})
      toast.success("สร้างรหัสข้าวแล้ว", { description: res?.prod_name || undefined })
    } catch (err) {
      console.error(err)
      // 400 = product not Phase 1 / species not under product / variant not under species —
      // backend `detail` explains which, so specErrorMessage shows it as-is
      const { title, message } = specErrorMessage(err)
      setSubmitError(message)
      toast.error(title, { description: message })
    } finally {
      setSubmitting(false)
    }
  }

  // สรุปตัวเลือก (ไว้ตรวจทานเท่านั้น — ไม่ส่งไป backend; prod_name backend สร้างเองตามรูปแบบ AMC)
  const previewName = useMemo(() => specPreviewName(form, opts), [form, opts])

  // ผลลัพธ์หลังสร้าง: แปลง id ที่ได้กลับมาเป็นชื่อจากรายการตัวเลือกในหน้า (แปลงไม่ได้ = ไม่แสดงแถวนั้น)
  const resultSpecRows = useMemo(() => {
    if (!result) return []
    const nameOf = (arr, v) =>
      v == null || v === "" ? null : (arr || []).find((x) => String(x.id) === String(v))?.label || null
    return [
      { label: "ประเภทสินค้า", value: nameOf(opts.products, result.product_id) },
      { label: "ชนิด/สายพันธุ์", value: nameOf(opts.species, result.species_id) },
      { label: "พันธุ์/รูปแบบ", value: nameOf(opts.variants, result.variant_id) },
      { label: "ปีผลผลิต", value: nameOf(opts.years, result.product_year) },
      { label: "สภาพ/เงื่อนไข", value: nameOf(opts.conditions, result.condition_id) },
      { label: "ประเภทนา", value: nameOf(opts.fieldTypes, result.field_type) },
      { label: "โปรแกรม", value: nameOf(opts.programs, result.program) },
      { label: "ประเภทธุรกิจ", value: nameOf(opts.businessTypes, result.business_type) },
    ].filter((r) => r.value)
  }, [result, opts])

  const anyLoading = loading.static || loading.species || loading.variants

  // โหลด master ครั้งแรกล้มเหลวทั้งหมด → โชว์ ErrorState พร้อมปุ่มลองใหม่
  const staticAllFailed =
    firstLoaded &&
    !loading.static &&
    opts.products.length === 0 &&
    opts.years.length === 0 &&
    opts.conditions.length === 0 &&
    opts.fieldTypes.length === 0 &&
    opts.programs.length === 0 &&
    opts.businessTypes.length === 0 &&
    Object.values(loadErr).some(Boolean)

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="w-full p-4 md:p-6 lg:p-8">
        <PageTitle title="เพิ่มรหัสข้าว" />

        <Card className="mb-4 md:mb-6">
          <CardHeader
            title="ข้อมูลรหัสข้าว"
            subtitle="ช่องที่มี * เป็นช่องบังคับ"
            action={
              <Link to="/spec/manage" state={backState("เพิ่มรหัสข้าว")} className={cx(neutralBtnCls, "shrink-0")}>
                จัดการรหัสข้าว
              </Link>
            }
          />
          {/* hint สิทธิ์ */}
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="font-semibold">หมายเหตุ</div>
            <div className="text-sm leading-relaxed">
              สร้างรหัสข้าวได้เฉพาะผู้ดูแลระบบและบัญชี HA
            </div>
          </div>

          {/* โหลด master */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              {anyLoading && <span className={cx(spinnerCls, "!border-indigo-400/40 !border-t-indigo-500")} aria-hidden="true" />}
              {anyLoading ? "กำลังโหลดรายการ..." : "โหลดรายการตัวเลือกแล้ว"}
            </div>
            <button
              type="button"
              onClick={reloadAll}
              disabled={anyLoading}
              className={cx(secondaryBtnCls, "!px-4 !py-2 !text-sm min-h-touch md:min-h-0")}
            >
              โหลดรายการใหม่
            </button>
          </div>

          {staticAllFailed ? (
            <ErrorState
              message="โหลดรายการตัวเลือกไม่สำเร็จ ตรวจสอบการเชื่อมต่อหรือสิทธิ์การเข้าถึง แล้วลองใหม่อีกครั้ง"
              onRetry={reloadAll}
            />
          ) : !firstLoaded ? (
            <PageLoader variant="spinner" message="กำลังโหลดรายการตัวเลือก…" />
          ) : (
          <>
          {/* แถวตัวเลือก */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpecComboField
              label="ประเภทสินค้า"
              required
              buttonRef={productRef}
              value={form.product_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, product_id: v }))
                setErrors((p) => ({ ...p, product_id: undefined }))
              }}
              options={opts.products}
              loading={loading.static}
              errorText={errors.product_id || loadErr.products}
              onEnterNext={() => focusNextFromEl(productRef.current)}
            />

            <SpecComboField
              label="ชนิด/สายพันธุ์"
              searchable
              required
              buttonRef={speciesRef}
              value={form.species_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, species_id: v }))
                setErrors((p) => ({ ...p, species_id: undefined }))
              }}
              options={opts.species}
              disabled={!form.product_id}
              loading={loading.species}
              placeholder={form.product_id ? "— เลือก —" : "— เลือกประเภทสินค้าก่อน —"}
              errorText={errors.species_id || loadErr.species}
              onEnterNext={() => focusNextFromEl(speciesRef.current)}
            />

            <SpecComboField
              label="พันธุ์/รูปแบบ"
              searchable
              required
              buttonRef={variantRef}
              value={form.variant_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, variant_id: v }))
                setErrors((p) => ({ ...p, variant_id: undefined }))
              }}
              options={opts.variants}
              disabled={!form.species_id}
              loading={loading.variants}
              placeholder={form.species_id ? "— เลือก —" : "— เลือกสายพันธุ์ก่อน —"}
              errorText={errors.variant_id || loadErr.variants}
              onEnterNext={() => focusNextFromEl(variantRef.current)}
            />

            <SpecComboField
              label="ปีผลผลิต"
              buttonRef={yearRef}
              value={form.product_year}
              onChange={(v) => {
                setForm((p) => ({ ...p, product_year: v }))
                setErrors((p) => ({ ...p, product_year: undefined }))
              }}
              options={opts.years}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.product_year || loadErr.years}
              onEnterNext={() => focusNextFromEl(yearRef.current)}
            />

            <SpecComboField
              label="สภาพ/เงื่อนไข"
              buttonRef={conditionRef}
              value={form.condition_id}
              onChange={(v) => {
                setForm((p) => ({ ...p, condition_id: v }))
                setErrors((p) => ({ ...p, condition_id: undefined }))
              }}
              options={opts.conditions}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.condition_id || loadErr.conditions}
              onEnterNext={() => focusNextFromEl(conditionRef.current)}
            />

            <SpecComboField
              label="ประเภทนา"
              buttonRef={fieldTypeRef}
              value={form.field_type}
              onChange={(v) => {
                setForm((p) => ({ ...p, field_type: v }))
                setErrors((p) => ({ ...p, field_type: undefined }))
              }}
              options={opts.fieldTypes}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.field_type || loadErr.fieldTypes}
              onEnterNext={() => focusNextFromEl(fieldTypeRef.current)}
            />

            <SpecComboField
              label="โปรแกรม"
              buttonRef={programRef}
              value={form.program}
              onChange={(v) => {
                setForm((p) => ({ ...p, program: v }))
                setErrors((p) => ({ ...p, program: undefined }))
              }}
              options={opts.programs}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.program || loadErr.programs}
              onEnterNext={() => focusNextFromEl(programRef.current)}
            />

            <SpecComboField
              label="ประเภทธุรกิจ"
              buttonRef={businessRef}
              value={form.business_type}
              onChange={(v) => {
                setForm((p) => ({ ...p, business_type: v }))
                setErrors((p) => ({ ...p, business_type: undefined }))
              }}
              options={opts.businessTypes}
              loading={loading.static}
              placeholder="— ไม่ระบุ —"
              errorText={errors.business_type || loadErr.businessTypes}
              onEnterNext={() => focusNextFromEl(businessRef.current)}
            />
          </div>

          {/* preview */}
          <div className="mt-5">
            <div className="text-sm text-slate-600 dark:text-slate-300">สรุปที่เลือก</div>
            <div
              className={cx(
                "mt-2 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-base md:text-lg leading-relaxed",
                "ring-1",
                previewName
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60"
                  : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700/60"
              )}
              aria-live="polite"
            >
              {previewName || "— เลือกข้อมูลเพื่อแสดงตัวอย่าง —"}
            </div>
            <p className={helpTextCls}>
              * ชื่อรหัสข้าวระบบตั้งให้หลังบันทึก (เช่น ข้าวเปลือกหอมมะลิสด - ERM ปกติ นาปี 2568/2569)
            </p>
          </div>

          {/* submit error */}
          {submitError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-200" role="alert">
              <div className="font-semibold">บันทึกไม่สำเร็จ</div>
              <div className="text-sm leading-relaxed">{submitError}</div>
            </div>
          )}
          </>
          )}
        </Card>

        {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม (submitRef อยู่ใน Enter chain) */}
        {isPhone ? (
          <StickyActionBar
            summary={<p className="truncate text-gray-900 dark:text-gray-100">{previewName || "ยังไม่ได้เลือกสเปค"}</p>}
            secondary={{ label: "ล้างฟอร์ม", onClick: reset, disabled: submitting }}
            primary={{ label: submitting ? "กำลังบันทึก…" : "บันทึก", onClick: submit, loading: submitting }}
          />
        ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            ref={submitRef}
            disabled={submitting}
            onClick={submit}
            className={submitBtnCls}
            aria-busy={submitting ? "true" : "false"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submit()
              }
            }}
          >
            {submitting && <span className={spinnerCls} aria-hidden="true" />}
            {submitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>

          <button
            type="button"
            onClick={reset}
            disabled={submitting}
            className={resetBtnCls}
          >
            รีเซ็ต
          </button>
        </div>
        )}

        {/* ผลลัพธ์ */}
        {result && (
          <Card className="mt-6">
            <CardHeader
              title="สร้างรหัสข้าวสำเร็จ"
              action={
                <Link to="/spec/manage" state={backState("เพิ่มรหัสข้าว")} className={cx(neutralBtnCls, "shrink-0")}>
                  ดูในรายการรหัสข้าว
                </Link>
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[15px] md:text-base">
              <div className="md:col-span-2">
                <div className="text-slate-500 dark:text-slate-300">ชื่อรหัสข้าว</div>
                <div className="font-semibold">{result.prod_name ?? "—"}</div>
              </div>
              {result.id != null && (
                <div>
                  <div className="text-slate-500 dark:text-slate-300">รหัส</div>
                  <div className="font-semibold tabular-nums">{result.id}</div>
                </div>
              )}
              {resultSpecRows.map((r) => (
                <div key={r.label}>
                  <div className="text-slate-500 dark:text-slate-300">{r.label}</div>
                  <div className="font-semibold">{r.value}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* tiny note for disabled input style (คงไว้เผื่อใช้) */}
        <div className="hidden">
          <input className={cx(baseField, fieldDisabled)} readOnly value="" />
        </div>
      </div>
    </div>
  )
}

export default RiceSpecCreate

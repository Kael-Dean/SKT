// src/pages/work/RiceSpecManage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// /spec/manage — "จัดการรหัสข้าว": list / edit / hide ProductSpec rows.
//
// Backend (um_backend Phase1/spec_route.py + Order_route.py):
//   GET /order/form/search   ACTIVE specs only (= what the trading dropdowns show)
//   PUT /spec/{id}           partial update; prod_name is rebuilt by the backend;
//                            null fields are ignored → an optional field that has a
//                            value cannot be cleared back to "ไม่ระบุ".
//                            {status: "INACTIVE"} hides it, {status: "ACTIVE"} restores.
//   No DELETE, no GET /spec/{id}, no list of INACTIVE specs → the hidden list on this
//   page is what *this device* hid (localStorage), plus "เปิดการแสดงด้วยรหัส".
// Shared endpoint map / loaders / labels: src/lib/riceSpec.js (also used by /spec/create).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus } from "lucide-react"
import { apiAuth } from "../../lib/api"
import {
  cx,
  baseField,
  focusRingCls,
  helpTextCls,
  labelCls,
  neutralBtnCls,
  primaryBtnCls,
  secondaryBtnCls,
  spinnerCls,
} from "../../lib/styles"
import {
  Badge,
  Card,
  ConfirmDialog,
  DataList,
  EmptyState,
  ErrorState,
  SearchField,
  Sheet,
  SkeletonTableRows,
  toast,
} from "../../components/ui"
import Can from "../../components/Can"
import PageTitle from "../../components/PageTitle"
import SelectDropdown from "../../components/SelectDropdown"
import SpecComboField from "../../components/SpecComboField"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { useCan } from "../../lib/permissions"
import { backState } from "../../lib/drill"
import {
  SPEC_API,
  SPEC_FIELDS,
  STATIC_MASTERS,
  LOAD_LIST_ERROR,
  SPECIES_LABEL_KEY,
  VARIANT_LABEL_KEY,
  emptySpecForm,
  emptySpecOptions,
  fetchOptions,
  speciesUrl,
  variantsUrl,
  specErrorMessage,
  specPreviewName,
  toInt,
  withCurrent,
} from "../../lib/riceSpec"

const PERM = "stock.spec.manage"

/* ---------- hidden-on-this-device list (localStorage) ---------- */
const HIDDEN_KEY = "skt.riceSpec.hidden.v1"

function readHidden() {
  try {
    const arr = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")
    return Array.isArray(arr) ? arr.filter((x) => x && x.id != null) : []
  } catch {
    return []
  }
}

function writeHidden(list) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(list))
  } catch {
    // storage full / private mode — the list is a convenience only
  }
}

const formFromSpec = (spec) =>
  Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, spec?.[f.key] == null ? "" : String(spec[f.key])]))

const idOf = (spec) => String(spec?.id ?? "")

const listOf = (data) => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])

/* ---------- small pieces ---------- */
const rowBtnCls = cx(neutralBtnCls, "!h-9 !px-3 max-md:!h-11")
const hideBtnCls = cx(
  "inline-flex h-9 max-md:h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold cursor-pointer",
  "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10",
  "transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed",
  focusRingCls,
)

function Muted({ children = "—" }) {
  return <span className="text-slate-400 dark:text-slate-500">{children}</span>
}

/* ======================================================================== */
export default function RiceSpecManage() {
  const isPhone = useIsPhone()
  const { can } = useCan()
  const canManage = can(PERM)

  /* ---------- active specs ---------- */
  const [specs, setSpecs] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState("")

  /* ---------- hidden on this device ---------- */
  const [hidden, setHidden] = useState(readHidden)
  const updateHidden = useCallback((fn) => {
    setHidden((prev) => {
      const next = fn(prev)
      writeHidden(next)
      return next
    })
  }, [])

  /* ---------- master data ---------- */
  const [opts, setOpts] = useState(emptySpecOptions)
  const [staticLoading, setStaticLoading] = useState(true)
  const [staticErr, setStaticErr] = useState({})
  // dependent lists cached per parent id: { [productId]: [{id,label}] }
  const [speciesBy, setSpeciesBy] = useState({})
  const [variantsBy, setVariantsBy] = useState({})
  const [pending, setPending] = useState({}) // { "s:12": true, "v:40": true }
  const [depErr, setDepErr] = useState({}) // same keys → message
  const inflight = useRef(new Map())

  const loadStatic = useCallback(async () => {
    setStaticLoading(true)
    const results = await Promise.all(
      STATIC_MASTERS.map(async (m) => {
        try {
          return [m.key, await fetchOptions(m.url, m.labelKey, m.transform), undefined]
        } catch (e) {
          console.error("load", m.key, "failed:", e)
          return [m.key, [], LOAD_LIST_ERROR]
        }
      }),
    )
    setOpts((p) => ({ ...p, ...Object.fromEntries(results.map(([k, v]) => [k, v])) }))
    setStaticErr(Object.fromEntries(results.map(([k, , err]) => [k, err])))
    setStaticLoading(false)
  }, [])

  /** Load (once) the species of a product / variants of a species into the cache. */
  const ensureDep = useCallback((kind, parentId, { force = false } = {}) => {
    const pid = toInt(parentId)
    if (!Number.isFinite(pid)) return Promise.resolve([])
    const key = `${kind}:${pid}`
    if (!force && inflight.current.has(key)) return inflight.current.get(key)

    const url = kind === "s" ? speciesUrl(pid) : variantsUrl(pid)
    const labelKey = kind === "s" ? SPECIES_LABEL_KEY : VARIANT_LABEL_KEY
    const setCache = kind === "s" ? setSpeciesBy : setVariantsBy
    setPending((p) => ({ ...p, [key]: true }))
    const promise = fetchOptions(url, labelKey)
      .then((list) => {
        setCache((p) => ({ ...p, [pid]: list }))
        setDepErr((p) => ({ ...p, [key]: undefined }))
        return list
      })
      .catch((e) => {
        console.error("load", key, "failed:", e)
        inflight.current.delete(key) // allow a retry
        setDepErr((p) => ({ ...p, [key]: LOAD_LIST_ERROR }))
        return []
      })
      .finally(() => setPending((p) => ({ ...p, [key]: false })))
    inflight.current.set(key, promise)
    return promise
  }, [])

  const loadSpecs = useCallback(async () => {
    setListLoading(true)
    setListError("")
    try {
      const rows = listOf(await apiAuth(SPEC_API.activeSpecs))
      setSpecs(rows)
      // something hidden here was re-enabled elsewhere → it is active again, forget it
      const activeIds = new Set(rows.map(idOf))
      updateHidden((prev) => prev.filter((h) => !activeIds.has(String(h.id))))
      // resolve species / variant labels for the table (few distinct parents)
      new Set(rows.map((r) => r.product_id).filter((v) => v != null)).forEach((pid) => ensureDep("s", pid))
      new Set(rows.map((r) => r.species_id).filter((v) => v != null)).forEach((sid) => ensureDep("v", sid))
    } catch (e) {
      console.error("load specs failed:", e)
      setListError(
        e?.status === 0
          ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"
          : "โหลดรายการรหัสข้าวไม่สำเร็จ ลองใหม่อีกครั้ง",
      )
    } finally {
      setListLoading(false)
    }
  }, [ensureDep, updateHidden])

  useEffect(() => {
    loadStatic()
    loadSpecs()
  }, [loadStatic, loadSpecs])

  /* ---------- label lookups ---------- */
  const labels = useMemo(() => {
    const toMap = (arr) => Object.fromEntries((arr || []).map((o) => [o.id, o.label]))
    return {
      products: toMap(opts.products),
      species: toMap(Object.values(speciesBy).flat()),
      variants: toMap(Object.values(variantsBy).flat()),
    }
  }, [opts.products, speciesBy, variantsBy])

  const labelOf = (map, v) => (v == null || v === "" ? null : map[String(v)] || null)

  /* ---------- search / filter / sort ---------- */
  const [q, setQ] = useState("")
  const [productFilter, setProductFilter] = useState("")
  const [sortDir, setSortDir] = useState("asc")

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = specs.filter((s) => {
      if (productFilter && String(s.product_id) !== productFilter) return false
      if (!needle) return true
      return String(s.id).includes(needle) || String(s.prod_name || "").toLowerCase().includes(needle)
    })
    const dir = sortDir === "asc" ? 1 : -1
    return filtered.sort((a, b) => (Number(a.id) - Number(b.id)) * dir)
  }, [specs, q, productFilter, sortDir])

  const productFilterOptions = useMemo(
    () => [{ value: "", label: "ทุกประเภทสินค้า" }, ...opts.products.map((p) => ({ value: p.id, label: p.label }))],
    [opts.products],
  )

  const filtersActive = q.trim() !== "" || productFilter !== ""
  const clearFilters = () => {
    setQ("")
    setProductFilter("")
  }

  /* ---------- edit sheet ---------- */
  const [editing, setEditing] = useState(null) // the spec row being edited
  const [form, setForm] = useState(emptySpecForm)
  const [initial, setInitial] = useState(emptySpecForm)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null) // { title, message }

  const openEdit = (spec) => {
    const f = formFromSpec(spec)
    setEditing(spec)
    setForm(f)
    setInitial(f)
    setFormErrors({})
    setSaveError(null)
    // keep prefilled values: just make sure their option lists are in the cache
    if (f.product_id) ensureDep("s", f.product_id)
    if (f.species_id) ensureDep("v", f.species_id)
  }

  const closeEdit = () => {
    if (saving) return
    setEditing(null)
  }

  const setField = (key, value) => {
    setSaveError(null)
    setFormErrors((p) => ({ ...p, [key]: undefined }))
    setForm((p) => {
      if (key === "product_id") {
        if (value === p.product_id) return p
        return { ...p, product_id: value, species_id: "", variant_id: "" }
      }
      if (key === "species_id") {
        if (value === p.species_id) return p
        return { ...p, species_id: value, variant_id: "" }
      }
      return { ...p, [key]: value }
    })
    if (key === "product_id" && value) ensureDep("s", value)
    if (key === "species_id" && value) ensureDep("v", value)
  }

  const formOpts = useMemo(
    () => ({
      ...opts,
      species: speciesBy[form.product_id] || [],
      variants: variantsBy[form.species_id] || [],
    }),
    [opts, speciesBy, variantsBy, form.product_id, form.species_id],
  )

  const changedKeys = useMemo(
    () => SPEC_FIELDS.map((f) => f.key).filter((k) => String(form[k] ?? "") !== String(initial[k] ?? "")),
    [form, initial],
  )

  const previewName = useMemo(() => specPreviewName(form, formOpts), [form, formOpts])

  const hasLockedOptional = SPEC_FIELDS.some((f) => !f.required && !!initial[f.key])

  // the error banner sits under the fields — bring it into view (sheet body scrolls)
  const saveErrorRef = useRef(null)
  useEffect(() => {
    if (saveError) saveErrorRef.current?.scrollIntoView({ block: "nearest" })
  }, [saveError])

  const fieldState = (f) => {
    const key = f.key
    if (key === "species_id") {
      const k = `s:${toInt(form.product_id)}`
      return { loading: !!pending[k], loadErr: depErr[k], disabled: !form.product_id }
    }
    if (key === "variant_id") {
      const k = `v:${toInt(form.species_id)}`
      return { loading: !!pending[k], loadErr: depErr[k], disabled: !form.species_id }
    }
    return { loading: staticLoading, loadErr: staticErr[f.opts], disabled: false }
  }

  const validate = () => {
    const e = {}
    if (!form.product_id) e.product_id = "เลือกประเภทสินค้า"
    if (!form.species_id) e.species_id = "เลือกชนิด/สายพันธุ์"
    if (!form.variant_id) e.variant_id = "เลือกพันธุ์/รูปแบบ"
    SPEC_FIELDS.forEach((f) => {
      // backend ignores null → a set optional field can only be changed, never cleared
      if (!f.required && initial[f.key] && !form[f.key]) e[f.key] = "ล้างกลับเป็น “ไม่ระบุ” ไม่ได้ เลือกค่าอื่นแทน"
      if (form[f.key] && !Number.isFinite(toInt(form[f.key]))) e[f.key] = "รูปแบบรหัสไม่ถูกต้อง"
    })
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const save = async () => {
    if (!editing || saving) return
    if (changedKeys.length === 0) return
    if (!validate()) return
    const payload = Object.fromEntries(changedKeys.map((k) => [k, toInt(form[k])]))
    const id = editing.id
    try {
      setSaving(true)
      setSaveError(null)
      const res = await apiAuth(SPEC_API.updateSpec(id), { method: "PUT", body: payload })
      const updated = res && typeof res === "object" ? { ...editing, ...res } : { ...editing, ...payload }
      setSpecs((prev) => prev.map((s) => (idOf(s) === String(id) ? updated : s)))
      setEditing(null)
      toast.success("บันทึกการแก้ไขแล้ว", { description: updated.prod_name || `รหัส ${id}` })
    } catch (err) {
      console.error(err)
      setSaveError(specErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  /* ---------- hide (INACTIVE) ---------- */
  const [hideTarget, setHideTarget] = useState(null)
  const [hiding, setHiding] = useState(false)
  const [hideError, setHideError] = useState("")

  const askHide = (spec) => {
    setHideError("")
    setHideTarget(spec)
  }

  /* ---------- show again (ACTIVE) ---------- */
  const [enablingId, setEnablingId] = useState(null)

  const enableSpec = useCallback(
    async (id, fallback) => {
      const key = String(id)
      setEnablingId(key)
      try {
        const res = await apiAuth(SPEC_API.updateSpec(key), { method: "PUT", body: { status: "ACTIVE" } })
        const spec = res && typeof res === "object" && res.id != null ? res : { ...fallback, id: toInt(key), status: "ACTIVE" }
        setSpecs((prev) => (prev.some((s) => idOf(s) === key) ? prev.map((s) => (idOf(s) === key ? { ...s, ...spec } : s)) : [...prev, spec]))
        updateHidden((prev) => prev.filter((h) => String(h.id) !== key))
        if (spec.product_id != null) ensureDep("s", spec.product_id)
        if (spec.species_id != null) ensureDep("v", spec.species_id)
        toast.success("เปิดการแสดงแล้ว", { description: spec.prod_name || `รหัส ${key}` })
        return { ok: true }
      } catch (err) {
        console.error(err)
        const { title, message } = specErrorMessage(err)
        toast.error(err?.status === 404 ? "ไม่พบรหัสนี้" : title === "บันทึกไม่สำเร็จ" ? "เปิดการแสดงไม่สำเร็จ" : title, {
          description: message,
        })
        return { ok: false, status: err?.status }
      } finally {
        setEnablingId(null)
      }
    },
    [ensureDep, updateHidden],
  )

  const confirmHide = async () => {
    if (!hideTarget) return
    const spec = hideTarget
    const key = idOf(spec)
    try {
      setHiding(true)
      setHideError("")
      await apiAuth(SPEC_API.updateSpec(key), { method: "PUT", body: { status: "INACTIVE" } })
      setSpecs((prev) => prev.filter((s) => idOf(s) !== key))
      updateHidden((prev) => [
        {
          id: spec.id,
          prod_name: spec.prod_name || "",
          product_id: spec.product_id ?? null,
          species_id: spec.species_id ?? null,
          variant_id: spec.variant_id ?? null,
          hiddenAt: new Date().toISOString(),
        },
        ...prev.filter((h) => String(h.id) !== key),
      ])
      setHideTarget(null)
      toast.success("ปิดการแสดงแล้ว", {
        description: spec.prod_name || `รหัส ${key}`,
        action: { label: "เลิกทำ", onClick: () => enableSpec(key, spec) },
      })
    } catch (err) {
      console.error(err)
      setHideError(specErrorMessage(err).message)
    } finally {
      setHiding(false)
    }
  }

  /* ---------- enable by id ---------- */
  const [enableInput, setEnableInput] = useState("")
  const [enableInputErr, setEnableInputErr] = useState("")

  const submitEnableById = async (e) => {
    e.preventDefault()
    const raw = enableInput.trim()
    if (!/^\d+$/.test(raw)) {
      setEnableInputErr("ใส่รหัสเป็นตัวเลข")
      return
    }
    const key = String(Number(raw))
    if (specs.some((s) => idOf(s) === key)) {
      setEnableInputErr("")
      toast.info("รหัสนี้แสดงอยู่แล้ว", { description: specs.find((s) => idOf(s) === key)?.prod_name })
      return
    }
    setEnableInputErr("")
    const res = await enableSpec(key, hidden.find((h) => String(h.id) === key) || {})
    if (res.ok) setEnableInput("")
    else setEnableInputErr(res.status === 404 ? "ไม่พบรหัสนี้" : "เปิดการแสดงรหัสนี้ไม่ได้ ลองใหม่อีกครั้ง")
  }

  /* ---------- render helpers ---------- */
  const productLabel = (s) => labelOf(labels.products, s.product_id)
  const speciesLabel = (s) => labelOf(labels.species, s.species_id)
  const variantLabel = (s) => labelOf(labels.variants, s.variant_id)

  const rowActions = (s) =>
    canManage ? (
      <div className="flex items-center justify-end gap-1">
        <button type="button" className={rowBtnCls} onClick={() => openEdit(s)} aria-label={`แก้ไข ${s.prod_name || `รหัส ${s.id}`}`}>
          <Pencil className="size-4" aria-hidden="true" />
          แก้ไข
        </button>
        <button type="button" className={hideBtnCls} onClick={() => askHide(s)} aria-label={`ปิดการแสดง ${s.prod_name || `รหัส ${s.id}`}`}>
          <EyeOff className="size-4" aria-hidden="true" />
          ปิดการแสดง
        </button>
      </div>
    ) : null

  const emptyAll = (
    <EmptyState
      title="ยังไม่มีรหัสข้าวที่แสดงอยู่"
      description="เพิ่มรหัสข้าวใหม่ หรือเปิดการแสดงรหัสเดิมจากส่วนด้านล่าง"
      action={
        <Can perm={PERM}>
          <Link to="/spec/create" state={backState("จัดการรหัสข้าว")} className={primaryBtnCls}>
            <Plus className="size-4" aria-hidden="true" />
            เพิ่มรหัสข้าว
          </Link>
        </Can>
      }
    />
  )
  const emptyFiltered = (
    <EmptyState
      title="ไม่พบรหัสข้าวที่ตรงกับเงื่อนไข"
      description="ลองคำค้นอื่น หรือล้างตัวกรอง"
      action={
        <button type="button" className={neutralBtnCls} onClick={clearFilters}>
          ล้างตัวกรอง
        </button>
      }
    />
  )
  const emptyNode = specs.length === 0 ? emptyAll : emptyFiltered

  const ariaSort = sortDir === "asc" ? "ascending" : "descending"
  const COLS = canManage ? 7 : 6

  /* ======================================================================== */
  return (
    <div className="w-full p-4 md:p-6 text-[15px] md:text-base text-slate-900 dark:text-slate-100">
      <PageTitle title="จัดการรหัสข้าว" />

      {/* ---------- toolbar ---------- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <SearchField
            id="spec-search"
            value={q}
            onChange={setQ}
            open={false}
            placeholder="ค้นหาชื่อรหัสข้าว หรือเลขรหัส"
            ariaLabel="ค้นหารหัสข้าว"
          />
        </div>
        <div className="md:w-60">
          <SelectDropdown
            ariaLabel="กรองตามประเภทสินค้า"
            options={productFilterOptions}
            value={productFilter}
            onChange={setProductFilter}
            loading={staticLoading}
            placeholder="ทุกประเภทสินค้า"
            showSwatch={false}
          />
        </div>
        <Can perm={PERM}>
          <Link to="/spec/create" state={backState("จัดการรหัสข้าว")} className={cx(secondaryBtnCls, "!px-4 !py-2.5 !text-sm min-h-touch md:min-h-11 shrink-0")}>
            <Plus className="size-4" aria-hidden="true" />
            เพิ่มรหัสข้าว
          </Link>
        </Can>
      </div>

      <div className="mt-3 mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
        <p aria-live="polite">
          {listLoading
            ? "กำลังโหลดรายการ…"
            : listError
              ? " "
              : filtersActive
                ? `พบ ${rows.length.toLocaleString("th-TH")} จาก ${specs.length.toLocaleString("th-TH")} รหัส`
                : `รหัสที่แสดงอยู่ ${specs.length.toLocaleString("th-TH")} รหัส`}
        </p>
        <p className="text-slate-500 dark:text-slate-400">ลบรหัสข้าวยังทำไม่ได้ — ใช้ปิดการแสดงแทน</p>
      </div>

      {/* ---------- active list ---------- */}
      {listError ? (
        <ErrorState message={listError} onRetry={loadSpecs} />
      ) : isPhone ? (
        <DataList
          items={rows}
          keyOf={(s) => idOf(s)}
          loading={listLoading}
          skeletonRows={5}
          title={(s) => s.prod_name || <Muted>ไม่มีชื่อ</Muted>}
          subtitle={(s) => <span className="tabular-nums">รหัส {s.id}</span>}
          badge={() => <Badge tone="success">แสดงอยู่</Badge>}
          fields={[
            { label: "ประเภทสินค้า", value: (s) => productLabel(s) || <Muted /> },
            { label: "ชนิด/สายพันธุ์", value: (s) => speciesLabel(s) || <Muted /> },
            { label: "พันธุ์/รูปแบบ", value: (s) => variantLabel(s) || <Muted />, span: 2 },
          ]}
          actions={canManage ? rowActions : undefined}
          emptyState={emptyNode}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="text-left text-sm text-slate-600 dark:text-slate-300">
                <tr className="sticky top-0 z-10 bg-slate-50 dark:bg-raised">
                  <th scope="col" aria-sort={ariaSort} className="w-24 px-4 py-2.5 font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                      className={cx("-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:text-slate-900 dark:hover:text-white cursor-pointer", focusRingCls)}
                    >
                      รหัส
                      {sortDir === "asc" ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />}
                      <span className="sr-only">{sortDir === "asc" ? "(น้อยไปมาก กดเพื่อเรียงมากไปน้อย)" : "(มากไปน้อย กดเพื่อเรียงน้อยไปมาก)"}</span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">ชื่อรหัสข้าว</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold whitespace-nowrap">ประเภทสินค้า</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold whitespace-nowrap">ชนิด/สายพันธุ์</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold whitespace-nowrap">พันธุ์/รูปแบบ</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">สถานะ</th>
                  {canManage && (
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                      <span className="sr-only">การกระทำ</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-line">
                {listLoading && <SkeletonTableRows rows={8} cols={COLS} />}
                {!listLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={COLS} className="p-0">
                      {emptyNode}
                    </td>
                  </tr>
                )}
                {!listLoading &&
                  rows.map((s) => (
                    <tr key={idOf(s)} className="align-middle hover:bg-slate-50/70 dark:hover:bg-white/[.03]">
                      <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{s.id}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100 min-w-64 break-words">
                        {s.prod_name || <Muted>ไม่มีชื่อ</Muted>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{productLabel(s) || <Muted />}</td>
                      <td className="px-4 py-2.5">{speciesLabel(s) || <Muted />}</td>
                      <td className="px-4 py-2.5">{variantLabel(s) || <Muted />}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone="success">แสดงอยู่</Badge>
                      </td>
                      {canManage && <td className="px-3 py-1.5 whitespace-nowrap">{rowActions(s)}</td>}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ---------- hidden specs ---------- */}
      <section aria-labelledby="hidden-specs-title" className="mt-8">
        <h2 id="hidden-specs-title" className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100">
          รหัสที่ปิดการแสดง
        </h2>
        <p className={cx(helpTextCls, "!mt-1 max-w-[70ch]")}>
          รหัสที่ปิดการแสดงจะไม่อยู่ในรายการซื้อ ขาย และคลังสินค้า รายการนี้จำเฉพาะรหัสที่ปิดจากเครื่องนี้ —
          ถ้าปิดจากเครื่องอื่น ให้เปิดด้วยเลขรหัส
        </p>

        <Card className="mt-3">
          <Can
            perm={PERM}
            fallback={<p className="text-sm text-slate-600 dark:text-slate-300">คุณดูรายการได้อย่างเดียว เปิดการแสดงรหัสไม่ได้</p>}
          >
            <form onSubmit={submitEnableById} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
              <div className="sm:w-56">
                <label htmlFor="enable-spec-id" className={labelCls}>
                  เปิดการแสดงด้วยรหัส
                </label>
                <input
                  id="enable-spec-id"
                  inputMode="numeric"
                  autoComplete="off"
                  value={enableInput}
                  onChange={(e) => {
                    setEnableInput(e.target.value.replace(/[^\d]/g, ""))
                    setEnableInputErr("")
                  }}
                  placeholder="เช่น 125"
                  aria-invalid={enableInputErr ? true : undefined}
                  aria-describedby={enableInputErr ? "enable-spec-id-err" : undefined}
                  className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm tabular-nums", enableInputErr && "!border-red-500")}
                />
              </div>
              <button
                type="submit"
                className={cx(neutralBtnCls, "sm:mb-px")}
                disabled={!enableInput || enablingId != null}
                aria-busy={enablingId != null && enablingId === String(Number(enableInput)) ? "true" : undefined}
              >
                {enablingId != null && enablingId === String(Number(enableInput)) && <span className={cx(spinnerCls, "!border-slate-400/40 !border-t-slate-600")} aria-hidden="true" />}
                เปิดการแสดง
              </button>
            </form>
            {enableInputErr && (
              <p id="enable-spec-id-err" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {enableInputErr}
              </p>
            )}
          </Can>

          <div className="mt-4 border-t border-slate-200/70 pt-3 dark:border-line">
            {hidden.length === 0 ? (
              <p className="py-2 text-sm text-slate-500 dark:text-slate-400">ยังไม่มีรหัสที่ปิดจากเครื่องนี้</p>
            ) : (
              <ul className="divide-y divide-slate-200/70 dark:divide-line">
                {hidden.map((h) => {
                  const key = String(h.id)
                  const busy = enablingId === key
                  return (
                    <li key={key} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium break-words">{h.prod_name || <Muted>ไม่มีชื่อ</Muted>}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span className="tabular-nums">รหัส {h.id}</span>
                          <Badge tone="neutral">ปิดการแสดง</Badge>
                        </div>
                      </div>
                      <Can perm={PERM}>
                        <button
                          type="button"
                          className={cx(rowBtnCls, "self-start sm:self-auto")}
                          onClick={() => enableSpec(key, h)}
                          disabled={enablingId != null}
                          aria-busy={busy ? "true" : undefined}
                          aria-label={`เปิดการแสดง ${h.prod_name || `รหัส ${h.id}`}`}
                        >
                          {busy && <span className={cx(spinnerCls, "!border-slate-400/40 !border-t-slate-600")} aria-hidden="true" />}
                          เปิดการแสดง
                        </button>
                      </Can>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      </section>

      {/* ---------- edit sheet ---------- */}
      <Sheet
        open={!!editing}
        onClose={closeEdit}
        busy={saving}
        size="lg"
        title="แก้ไขรหัสข้าว"
        subtitle={editing ? `รหัส ${editing.id}` : undefined}
        footer={
          <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
            <button type="button" className={cx(neutralBtnCls, "max-md:h-12")} onClick={closeEdit} disabled={saving}>
              ยกเลิก
            </button>
            <button
              type="button"
              className={cx(primaryBtnCls, "max-md:h-12")}
              onClick={save}
              disabled={saving || changedKeys.length === 0}
              aria-busy={saving ? "true" : "false"}
            >
              {saving && <span className={spinnerCls} aria-hidden="true" />}
              {saving ? "กำลังบันทึก…" : changedKeys.length ? `บันทึก (${changedKeys.length} ช่อง)` : "ยังไม่มีการแก้ไข"}
            </button>
          </div>
        }
      >
        {editing && (
          <div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200/70 dark:bg-white/[.03] dark:ring-line">
              <div className="text-slate-500 dark:text-slate-400">ชื่อปัจจุบัน</div>
              <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100 break-words">{editing.prod_name || "—"}</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {SPEC_FIELDS.map((f) => {
                const st = fieldState(f)
                const value = form[f.key]
                const base = formOpts[f.opts] || []
                const options = !st.loading && value === initial[f.key] ? withCurrent(base, value) : base
                return (
                  <SpecComboField
                    key={f.key}
                    label={f.label}
                    required={f.required}
                    searchable={f.key === "species_id" || f.key === "variant_id" ? true : "auto"}
                    value={value}
                    onChange={(v) => setField(f.key, v)}
                    options={options}
                    loading={st.loading}
                    disabled={st.disabled || saving}
                    placeholder={
                      st.disabled
                        ? f.key === "species_id"
                          ? "— เลือกประเภทสินค้าก่อน —"
                          : "— เลือกสายพันธุ์ก่อน —"
                        : f.required
                          ? "— เลือก —"
                          : "— ไม่ระบุ —"
                    }
                    errorText={formErrors[f.key] || st.loadErr}
                  />
                )
              })}
            </div>
            {hasLockedOptional && (
              <p className={helpTextCls}>ช่องที่ไม่บังคับซึ่งเลือกไว้แล้ว เปลี่ยนเป็นค่าอื่นได้ แต่ล้างกลับเป็น “ไม่ระบุ” ไม่ได้</p>
            )}

            <div className="mt-5">
              <div className="text-sm text-slate-600 dark:text-slate-300">สรุปที่เลือก</div>
              <div
                className={cx(
                  "mt-1.5 rounded-xl px-3 py-2.5 ring-1 break-words",
                  changedKeys.length
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60"
                    : "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-white/[.03] dark:text-slate-200 dark:ring-line",
                )}
                aria-live="polite"
              >
                {previewName || "—"}
              </div>
              <p className={helpTextCls}>ระบบตั้งชื่อรหัสข้าวใหม่ให้เองหลังบันทึก</p>
            </div>

            {saveError && (
              <div
                ref={saveErrorRef}
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-200"
                role="alert"
              >
                <div className="font-semibold">{saveError.title}</div>
                <div className="text-sm leading-relaxed break-words">{saveError.message}</div>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* ---------- hide confirm ---------- */}
      <ConfirmDialog
        open={!!hideTarget}
        title="ปิดการแสดงรหัสข้าวนี้?"
        description="รหัสนี้จะไม่อยู่ในรายการให้เลือกตอนซื้อ ขาย และคลังสินค้า รายการที่บันทึกไว้แล้วไม่เปลี่ยน เปิดการแสดงกลับได้ภายหลัง"
        confirmLabel="ปิดการแสดง"
        loadingLabel="กำลังปิดการแสดง…"
        tone="danger"
        loading={hiding}
        error={hideError}
        onConfirm={confirmHide}
        onCancel={() => !hiding && setHideTarget(null)}
      >
        {hideTarget && (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200/70 dark:bg-white/[.03] dark:ring-line">
            <div className="font-medium text-slate-900 dark:text-slate-100 break-words">{hideTarget.prod_name || "—"}</div>
            <div className="mt-0.5 tabular-nums text-slate-500 dark:text-slate-400">รหัส {hideTarget.id}</div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

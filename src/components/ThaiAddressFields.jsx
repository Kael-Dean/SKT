// src/components/ThaiAddressFields.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Thai address block: house no. / moo / soi / road + cascading จังหวัด → อำเภอ → ตำบล
// (shared ComboBox, search + phone picker sheet) with the postal code filled from the
// chosen ตำบล. Values are NAMES (strings), not ids — that is what the backend stores.
//
//   <ThaiAddressFields value={addr} onChange={(patch) => setAddr((a) => ({ ...a, ...patch }))}
//     idPrefix="ob-addr" required={["h_address", "province", …]} isFlagged={(k) => …}
//     renderHint={(k) => <Hint/>} />
//
//   value       { h_address, mhoo, soi, road, province, district, sub_district, postal_code }
//   onChange    receives a partial patch (cascade clears the levels below a change)
//   isFlagged   (key) → true wraps that control in the caller's "needs attention" frame
//   frame       (key, control) → node — lets the caller wrap each control (onboarding uses
//               it for the amber "missing" ring); default returns the control as is
//   renderHint  (key) → node shown under the control
// Data: useThaiAddressData (fetch-on-demand from /public/data/thai, 2.2MB not bundled).
// Province is NOT locked here (MemberSignup locks Surin; this block is for anyone).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react"
import ComboBox from "./ComboBox"
import { useThaiAddressData } from "../hooks/useThaiAddressData"
import { baseField, cx, helpTextCls, labelCls } from "../lib/styles"

const clean = (x) => String(x ?? "").replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|เขต|ตำบล|ต\.|แขวง)\s*/, "").trim()
const byThai = (a, b) => a.label.localeCompare(b.label, "th")
/** Keep a prefilled name selectable even when it is not spelled like the dataset. */
const withCurrent = (opts, current) =>
  current && !opts.some((o) => o.value === current) ? [{ value: current, label: current }, ...opts] : opts

const TEXT_FIELDS = [
  { key: "h_address", label: "บ้านเลขที่", autoComplete: "address-line1", span: "" },
  { key: "mhoo", label: "หมู่", inputMode: "numeric", span: "" },
  { key: "soi", label: "ซอย", span: "" },
  { key: "road", label: "ถนน", span: "" },
]

export default function ThaiAddressFields({
  value = {},
  onChange,
  idPrefix = "addr",
  required = [],
  frame = (_k, node) => node,
  renderHint,
  disabled = false,
}) {
  const data = useThaiAddressData()
  const { provinces, districts, subdistricts, keys, ready, error } = data
  const PK = keys.prov
  const DK = keys.dist
  const SK = keys.subd

  const provinceRow = useMemo(
    () => (ready && value.province ? provinces.find((p) => clean(p?.[PK.name]) === clean(value.province)) : null),
    [ready, provinces, PK.name, value.province],
  )
  const districtRow = useMemo(() => {
    if (!ready || !value.district) return null
    return districts.find(
      (d) =>
        clean(d?.[DK.name]) === clean(value.district) &&
        (!provinceRow || String(d?.[DK.provId]) === String(provinceRow?.[PK.id])),
    )
  }, [ready, districts, DK.name, DK.provId, PK.id, provinceRow, value.district])

  const provinceOptions = useMemo(
    () => withCurrent(provinces.map((p) => ({ value: p[PK.name], label: p[PK.name] })).sort(byThai), value.province),
    [provinces, PK.name, value.province],
  )
  const districtOptions = useMemo(() => {
    if (!provinceRow) return withCurrent([], value.district)
    const list = districts
      .filter((d) => String(d?.[DK.provId]) === String(provinceRow[PK.id]))
      .map((d) => ({ value: d[DK.name], label: d[DK.name] }))
      .sort(byThai)
    return withCurrent(list, value.district)
  }, [districts, DK.provId, DK.name, PK.id, provinceRow, value.district])
  const subOptions = useMemo(() => {
    if (!districtRow) return withCurrent([], value.sub_district)
    const list = subdistricts
      .filter((s) => String(s?.[SK.distId]) === String(districtRow[DK.id]))
      .map((s) => ({ value: s[SK.name], label: s[SK.name], subLabel: s?.[SK.zip] != null ? String(s[SK.zip]) : undefined }))
      .sort(byThai)
    return withCurrent(list, value.sub_district)
  }, [subdistricts, SK.distId, SK.name, SK.zip, DK.id, districtRow, value.sub_district])

  const zipFor = (subName) => {
    if (!districtRow) return ""
    const row = subdistricts.find(
      (s) => String(s?.[SK.distId]) === String(districtRow[DK.id]) && clean(s?.[SK.name]) === clean(subName),
    )
    return row?.[SK.zip] != null ? String(row[SK.zip]) : ""
  }

  const req = (k) => required.includes(k)
  const label = (k, children) => (
    <label htmlFor={`${idPrefix}-${k}`} className={labelCls}>
      {children}
      {req(k) && (
        <>
          <span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">*</span>
          <span className="sr-only"> (จำเป็น)</span>
        </>
      )}
    </label>
  )

  const loadingAddr = !ready && !error

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
      {TEXT_FIELDS.map((f) => (
        <div key={f.key} className={cx("min-w-0", f.key === "h_address" || f.key === "road" ? "col-span-2 md:col-span-1" : "col-span-1")}>
          {label(f.key, f.label)}
          {frame(
            f.key,
            <input
              id={`${idPrefix}-${f.key}`}
              type="text"
              className={baseField}
              value={value[f.key] ?? ""}
              inputMode={f.inputMode}
              autoComplete={f.autoComplete}
              disabled={disabled}
              aria-required={req(f.key) || undefined}
              onChange={(e) => onChange?.({ [f.key]: e.target.value })}
            />,
          )}
          {renderHint?.(f.key)}
        </div>
      ))}

      <div className="col-span-2 min-w-0">
        {label("province", "จังหวัด")}
        {frame(
          "province",
          <ComboBox
            id={`${idPrefix}-province`}
            options={provinceOptions}
            value={value.province ?? ""}
            onChange={(v) => {
              if (v === value.province) return
              onChange?.({ province: v, district: "", sub_district: "", postal_code: "" })
            }}
            placeholder={loadingAddr ? "กำลังโหลดรายชื่อจังหวัด…" : "เลือกจังหวัด"}
            loading={loadingAddr}
            disabled={disabled}
            searchable
            title="จังหวัด"
            ariaLabel="จังหวัด"
          />,
        )}
        {renderHint?.("province")}
      </div>

      <div className="col-span-2 min-w-0">
        {label("district", "อำเภอ/เขต")}
        {frame(
          "district",
          <ComboBox
            id={`${idPrefix}-district`}
            options={districtOptions}
            value={value.district ?? ""}
            onChange={(v) => {
              if (v === value.district) return
              onChange?.({ district: v, sub_district: "", postal_code: "" })
            }}
            placeholder={value.province ? "เลือกอำเภอ/เขต" : "เลือกจังหวัดก่อน"}
            disabled={disabled || !value.province}
            searchable
            title="อำเภอ/เขต"
            ariaLabel="อำเภอ/เขต"
          />,
        )}
        {renderHint?.("district")}
      </div>

      <div className="col-span-2 min-w-0">
        {label("sub_district", "ตำบล/แขวง")}
        {frame(
          "sub_district",
          <ComboBox
            id={`${idPrefix}-sub_district`}
            options={subOptions}
            value={value.sub_district ?? ""}
            onChange={(v) => {
              const zip = zipFor(v)
              onChange?.(zip ? { sub_district: v, postal_code: zip } : { sub_district: v })
            }}
            placeholder={value.district ? "เลือกตำบล/แขวง" : "เลือกอำเภอก่อน"}
            disabled={disabled || !value.district}
            searchable
            title="ตำบล/แขวง"
            ariaLabel="ตำบล/แขวง"
          />,
        )}
        {renderHint?.("sub_district")}
      </div>

      <div className="col-span-2 min-w-0">
        {label("postal_code", "รหัสไปรษณีย์")}
        {frame(
          "postal_code",
          <input
            id={`${idPrefix}-postal_code`}
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            className={cx(baseField, "tabular-nums")}
            value={value.postal_code ?? ""}
            disabled={disabled}
            aria-required={req("postal_code") || undefined}
            aria-describedby={`${idPrefix}-postal_code-help`}
            onChange={(e) => onChange?.({ postal_code: e.target.value.replace(/\D/g, "").slice(0, 5) })}
          />,
        )}
        {renderHint?.("postal_code") ?? null}
        <p id={`${idPrefix}-postal_code-help`} className={helpTextCls}>
          ตัวเลข 5 หลัก เติมให้อัตโนมัติเมื่อเลือกตำบล
        </p>
      </div>

      {error && (
        <p role="alert" className="col-span-2 text-sm text-red-600 md:col-span-4 dark:text-red-400">
          โหลดรายชื่อจังหวัดไม่สำเร็จ{" "}
          <button type="button" onClick={data.reload} className="font-semibold underline underline-offset-2">
            ลองอีกครั้ง
          </button>
        </p>
      )}
    </div>
  )
}

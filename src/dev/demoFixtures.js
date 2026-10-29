// src/dev/demoFixtures.js — DEV / DEMO ONLY (used by ./onboardingMock.js)
// ─────────────────────────────────────────────────────────────────────────────
// Believable data for the self-service pages a staff member (role 5) visits after onboarding,
// so the onboarding tour lands on full pages instead of empty states. Shapes follow what the
// pages read (LeaveRequest, OutOfOffice, MyPayslipsPanel, MySalaryCert, LoanRequest, MyWelfare,
// MyProfile, notifications, branch switcher). Submissions are kept in memory for the session.
//
//   demoFixture(path, method, url, body, values) → [status, body] | null (not handled)
// ─────────────────────────────────────────────────────────────────────────────

const iso = (d) => d.toISOString().slice(0, 10)
const daysAgo = (n) => new Date(Date.now() - n * 864e5)
const at = (n, hh = "09:00") => `${iso(daysAgo(n))}T${hh}:00+07:00`
const BE = (d = new Date()) => d.getFullYear() + 543

const BRANCHES = [
  { id: 1, branch_name: "สำนักงานใหญ่" },
  { id: 3, branch_name: "สาขาเมืองสุรินทร์" },
  { id: 5, branch_name: "สาขาปราสาท" },
  { id: 7, branch_name: "สาขาศีขรภูมิ" },
]
const FORM_DEFAULTS = {
  display_name: "นายสมชาย ใจดี",
  position_title: "เจ้าหน้าที่การตลาด",
  branch_name: "สาขาเมืองสุรินทร์",
  department_name: "ฝ่ายการตลาด",
}

let nextId = 900
const state = {
  leaves: [
    { id: 301, leave_type_name: "ลาป่วย", status: "approved", stage: "approved", from_date: iso(daysAgo(40)), to_date: iso(daysAgo(39)),
      from_time: null, to_time: null, total_days: 2, address_during_leave: "112 หมู่ 4 ต.นอกเมือง อ.เมืองสุรินทร์", contact_during_leave: "0812345678",
      comment: "ไข้หวัด", justification: "justified", justification_note: null, check_role: null },
    { id: 302, leave_type_name: "ลากิจส่วนตัว", status: "approved", stage: "approved", from_date: iso(daysAgo(18)), to_date: iso(daysAgo(18)),
      from_time: null, to_time: null, total_days: 1, address_during_leave: "", contact_during_leave: "0812345678",
      comment: "ติดต่อราชการที่อำเภอ", justification: "justified", justification_note: null, check_role: null },
  ],
  ooo: [
    { id: 401, request_date: iso(daysAgo(6)), time_out: "13:30:00", time_back: "15:30:00", request_type: "work",
      place: "ตลาดสดเทศบาลเมืองสุรินทร์", reason: "สำรวจราคาข้าวเปลือกหน้าร้าน", status: "approved", stage: "approved", justification: "justified" },
    { id: 402, request_date: iso(daysAgo(2)), time_out: "10:00:00", time_back: "11:30:00", request_type: "work",
      place: "สาขาปราสาท", reason: "ส่งเอกสารสัญญาซื้อขาย", status: "pending_branch_head", stage: "pending_branch_head" },
  ],
  certs: [
    { id: 501, status: "approved", purpose_type: "document", copies_count: 1, requested_at: at(55), purpose_detail: "ยื่นขอวีซ่าท่องเที่ยว",
      recipient_name: "สถานทูตญี่ปุ่น", supervisor_name: "นางสาวพิมพ์ใจ ศรีสุข", supervisor_opinion: "agree", supervisor_comment: "เห็นควรอนุมัติ",
      supervisor_at: at(54), manager_comment: "อนุมัติ", approved_at: at(53) },
  ],
  loans: [
    { id: 601, purpose_code: "education", loan_amount: 60000, repayment_months: 24, monthly_principal: 2500, disbursed_on: iso(daysAgo(210)),
      status: "active", rejected_reason: null, guarantor_1_name: "นายวิทยา ดีงาม", guarantor_2_name: "นางสาวอำไพ มั่นคง",
      schedule: Array.from({ length: 24 }, (_, i) => ({
        due_date: iso(new Date(new Date().getFullYear(), new Date().getMonth() - 6 + i, 25)),
        installment_amount: 2500 + Math.round(((60000 - 2500 * i) * 0.06) / 12),
        remaining_balance: 60000 - 2500 * (i + 1),
        paid: i < 7,
      })) },
  ],
  issues: [],
}

const NOTIFICATIONS = [
  { id: 1, kind: "info", ref_type: "out_of_office", ref_id: 401, message: "คำขอออกนอกสถานที่ของคุณได้รับอนุมัติแล้ว", created_at: at(6, "11:20"), read_at: null },
  { id: 2, kind: "info", ref_type: "leave", ref_id: 302, message: "ใบลากิจส่วนตัวของคุณได้รับอนุมัติแล้ว", created_at: at(19, "15:05"), read_at: null },
  { id: 3, kind: "info", ref_type: "salary_cert", ref_id: 501, message: "หนังสือรับรองเงินเดือนพร้อมดาวน์โหลด", created_at: at(53, "10:40"), read_at: at(52) },
]

function payslips() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1)
    const ot = i === 1 ? 1200 : 0
    const gross = 18500 + 1500 + ot
    const ded = 925 + 185 + 3233 + 250
    return {
      id: 7000 + i, month: iso(new Date(m.getTime() - m.getTimezoneOffset() * 6e4)).slice(0, 8) + "01",
      base_salary: 18500, position_allowance: 1500, add_holiday_pay: ot, income_tax: 250, deduct_ss: 925, deduct_reserve: 185,
      deduct_loan: 3233, gross_income: gross, total_deductions: ded, final_payout: gross - ded, days_worked: null,
    }
  })
}

function loanPreview(u) {
  const amount = Number(u.searchParams.get("amount")) || 0
  let months = Number(u.searchParams.get("repayment_months")) || 0
  const mp = Number(u.searchParams.get("monthly_principal")) || 0
  if (!months && mp) months = Math.ceil(amount / mp)
  months = Math.min(Math.max(months || 12, 1), 60)
  const principal = Math.ceil(amount / months)
  const rows = []
  let bal = amount, totalInterest = 0
  for (let n = 1; n <= months; n++) {
    const p = Math.min(principal, bal)
    const interest = Math.round((bal * 0.06) / 12)
    totalInterest += interest
    bal -= p
    const due = new Date(); due.setMonth(due.getMonth() + n, 25)
    rows.push({ no: n, due_date: iso(due), principal: p, interest, installment: p + interest, balance_after: bal })
  }
  return { instalments: months, monthly_principal: principal, max_installment: rows[0]?.installment ?? 0, total_interest: totalInterest, rows, warnings: [] }
}

function welfare() {
  return {
    balance: {
      fiscal_year: BE(),
      medical: { cap: 20000, used: 3450, remaining: 16550 },
      private_opd: { cap: 5000, used: 1200, remaining: 3800 },
      private_ipd: { cap: 15000, used: 0, remaining: 15000 },
      checkup: { cap: 3000, used: 0, taken: false },
      education: [{ dependant_id: 21, name: "ด.ช.ภูมิ ใจดี", eligible: true, reason: null, used: 2000 }],
    },
    claims: [
      { id: 801, claim_type: "medical", status: "paid", requested_amount: 1200, eligible_amount: 1200, approved_amount: 1200,
        service_date: iso(daysAgo(70)), dependant_id: null, dependant_name: null },
      { id: 802, claim_type: "medical", status: "approved", requested_amount: 2250, eligible_amount: 2250, approved_amount: 2250,
        service_date: iso(daysAgo(25)), dependant_id: 11, dependant_name: "นางสมหญิง ใจดี" },
      { id: 803, claim_type: "education", status: "paid", requested_amount: 2000, eligible_amount: 2000, approved_amount: 2000,
        receipt_date: iso(daysAgo(120)), academic_year: BE(), dependant_id: 21, dependant_name: "ด.ช.ภูมิ ใจดี" },
    ],
    dependants: [
      { id: 11, first_name: "สมหญิง", last_name: "ใจดี", relationship: "คู่สมรส", age: 34, medical_eligible: true, education_eligible: false, education_reason: "ไม่ใช่บุตร" },
      { id: 21, first_name: "ด.ช.ภูมิ", last_name: "ใจดี", relationship: "บุตร", child_order: 1, age: 8, is_twin: false, medical_eligible: true, education_eligible: true },
      { id: 12, first_name: "สมศรี", last_name: "ใจดี", relationship: "มารดา", age: 66, medical_eligible: true, education_eligible: false, education_reason: "ไม่ใช่บุตร" },
    ],
  }
}

export function demoFixture(path, method, u, body, values) {
  const ok = (b) => [200, b]
  if (method === "GET") {
    switch (path) {
      case "/personnel/me":
        return ok({
          id: 42, user_id: 42, username: "somchai", email: values.account.email ?? "somchai.j@amcsurin.com", account_status: "registered",
          first_name: "สมชาย", last_name: "ใจดี", role_id: 5, position: 12, branch_location: 3,
          tenure: { text: "6 ปี 7 เดือน", years: 6, months: 7 },
          personnel_info: { ...values.personal, age: 36 },
          address: { ...values.address },
          education: values.education,
          work_experiences: values.work,
          criminal_records: values.criminal,
        })
      case "/personnel/me/form-defaults": return ok(FORM_DEFAULTS)
      case "/personnel/me/notifications": return ok(NOTIFICATIONS)
      case "/auth/my-branches": return ok(BRANCHES.filter((b) => b.id === 3))
      case "/order/branch/search": return ok(BRANCHES)
      case "/hr/positions": return ok([{ id: 12, title: "เจ้าหน้าที่การตลาด" }])
      case "/personnel/me/position": return ok({ position_display: "เจ้าหน้าที่การตลาด · ฝ่ายการตลาด" })
      case "/personnel/me/branches": return ok({ home_branch: { id: 3, branch_name: "สาขาเมืองสุรินทร์" }, extra_branches: [] })
      case "/personnel/me/financial":
        return ok({
          financial: { current_salary: 18500 },
          leave_quota: { year: BE(), annual_leave: 10, annual_leave_carried_over: 0, sick_leave: 30, business_leave: 6, maturity_leave: 0,
            paternity_leave: 15, religious_leave: 0, military_leave: 0, training_leave: 0, ow_leave: 0, accompany_leave: 0 },
        })
      case "/hr/leave-types":
        return ok([
          { id: 1, type: "ลาป่วย", days: 30, is_active: true, max_days: 30 },
          { id: 2, type: "ลากิจส่วนตัว", days: 6, is_active: true, max_days: 6 },
          { id: 3, type: "ลาพักผ่อน", days: 10, is_active: true, max_days: 10 },
          { id: 4, type: "ลาคลอดบุตร", days: 98, is_active: true, max_days: 98, code: "maternity" },
          { id: 5, type: "ลาอุปสมบท", days: 120, is_active: true, max_days: 120 },
        ])
      case "/personnel/me/leave-defaults":
        return ok({ address_during_leave: "112 หมู่ 4 ถ.สุรินทร์-ปราสาท ต.นอกเมือง อ.เมืองสุรินทร์ จ.สุรินทร์ 32000", contact_during_leave: "0812345678" })
      case "/hr/holidays": {
        const y = new Date().getFullYear()
        return ok([`${y}-12-05`, `${y}-12-10`, `${y}-12-31`, `${y}-10-13`, `${y}-10-23`].map((d) => ({ holiday_date: d, is_active: true })))
      }
      case "/personnel/me/leaves": return ok(state.leaves)
      case "/hr/out-of-office/settings": return ok({ work_start: "08:30:00", work_end: "16:30:00", half_day_hours: 4 })
      case "/personnel/me/out-of-office": return ok(state.ooo)
      case "/personnel/me/payroll": return ok(payslips())
      case "/personnel/me/salary-cert-requests": return ok(state.certs)
      case "/personnel/me/loans/eligibility":
        return ok({ max_amount: 150000, service_months: 79, service_cap: 200000, income_cap: 150000, salary: 18500, multiple: 8,
          latest_net_pay: payslips()[0].final_payout, retirement_date: "2050-09-30", warnings: [] })
      case "/personnel/me/loans/preview": return ok(loanPreview(u))
      case "/personnel/me/loans": return ok(state.loans)
      case "/personnel/me/welfare": return ok(welfare())
      case "/personnel/me/issues": return ok(state.issues)
      case "/personnel/me/activities":
        return ok([
          { id: 1, activity_type: "training", title: "อบรมการใช้งานระบบ HR กลาง", start_date: iso(daysAgo(30)), end_date: iso(daysAgo(30)), hours: 3,
            organizer: "ฝ่ายบุคคล", location: "ห้องประชุมสำนักงานใหญ่", result: "ผ่าน" },
          { id: 2, activity_type: "seminar", title: "สัมมนาการตลาดข้าวหอมมะลิ", start_date: iso(daysAgo(90)), end_date: iso(daysAgo(89)), hours: 12,
            organizer: "ธ.ก.ส. สำนักงานจังหวัดสุรินทร์", location: "โรงแรมทองธารินทร์" },
        ])
    }
    const slip = path.match(/^\/personnel\/me\/payroll\/(\d+)$/)
    if (slip) return ok(payslips().find((p) => p.id === Number(slip[1])) ?? {})
    return null
  }

  // submissions: keep them so the list updates like the real thing
  if (path === "/personnel/me/leaves" && (method === "PUT" || method === "POST")) {
    const row = { id: nextId++, status: "pending", stage: "pending_branch_head", leave_type_name: body.leave_type_name ?? "ลา", total_days: body.total_days ?? 1, ...body }
    state.leaves.unshift(row)
    return ok(row)
  }
  if (path === "/personnel/me/out-of-office" && method === "POST") {
    const row = { id: nextId++, status: "pending_branch_head", stage: "pending_branch_head", ...body }
    state.ooo.unshift(row)
    return ok(row)
  }
  if (path === "/personnel/me/salary-cert-requests" && method === "POST") {
    const row = { id: nextId++, status: "pending_supervisor", requested_at: new Date().toISOString(), copies_count: 1, ...body }
    state.certs.unshift(row)
    return ok(row)
  }
  if (path === "/personnel/me/loans" && method === "POST") {
    const row = { id: nextId++, status: "pending", created_at: new Date().toISOString(), schedule: [], ...body }
    state.loans.unshift(row)
    return ok(row)
  }
  if (path === "/personnel/me/report-issue" && method === "POST") {
    const row = { id: nextId++, status: "pending", created_at: new Date().toISOString(), attachments: [], ...body }
    state.issues.unshift(row)
    return ok({ status: "created", id: row.id })
  }
  const cancel = path.match(/^\/personnel\/me\/(leaves|out-of-office)\/(\d+)\/cancel$/)
  if (cancel) {
    const list = cancel[1] === "leaves" ? state.leaves : state.ooo
    const row = list.find((r) => r.id === Number(cancel[2]))
    if (row) Object.assign(row, { status: "cancelled", stage: "cancelled" })
    return ok(row ?? {})
  }
  if (/^\/personnel\/me\/notifications\/(\d+|read-all)\/?(read)?$/.test(path)) {
    const id = path.match(/notifications\/(\d+)/)?.[1]
    for (const n of NOTIFICATIONS) if (!id || n.id === Number(id)) n.read_at ??= new Date().toISOString()
    return ok({})
  }
  return null
}

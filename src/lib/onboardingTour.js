// src/lib/onboardingTour.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTENT of the self-service tour (onboarding PR 59, api-handoff §6.7). No React here.
// The overlay (components/onboarding/TourOverlay.jsx) walks these stops in order over the
// real pages; run state lives in ./tourState.js.
//
//   key      stable id
//   route    page to open for this stop (omit → centered card, no navigation)
//   target   value of a `data-tour="…"` attribute on that page (omit → centered card)
//   title    card heading
//   purpose  one line: what this menu is for
//   policy   short bullets from the co-op regulations
//   figures  "leave-balance" → the card also shows the person's own quota chips
//   sidebar  true → the menu drawer (Sidebar) is opened for this stop
//
// Copy rules: short Thai sentences, no em dash, one idea per bullet.
// ─────────────────────────────────────────────────────────────────────────────

export const TOUR_STOPS = [
  {
    key: "self-service",
    route: "/home",
    target: "self-service-menu",
    sidebar: true, // opens the menu drawer for this stop
    title: "เมนูบริการตนเอง",
    purpose: "รวมทุกเรื่องของตัวคุณเองไว้ที่เดียว ทั้งการลา สลิปเงินเดือน เงินกู้ และข้อมูลส่วนตัว",
    // TODO(FRD): ร่าง — รอ FRD เขียนจากระเบียบข้อ 10 / 13-14 / 15, Vivid ตรวจก่อนปล่อย
    policy: [
      "เปิดได้จากปุ่มเมนูมุมซ้ายบนทุกหน้า",
      "ทุกคำขอจะส่งให้หัวหน้าหรือ HR อนุมัติตามลำดับ",
    ],
  },
  {
    key: "leave",
    route: "/leave-request",
    target: "leave",
    title: "การลา",
    purpose: "ยื่นใบลาและดูประวัติการลาของคุณ",
    figures: "leave-balance",
    // TODO(FRD): ร่าง — รอ FRD เขียนจากระเบียบข้อ 10 / 13-14 / 15, Vivid ตรวจก่อนปล่อย
    policy: [
      "ประเภทการลา: ลาป่วย ลากิจส่วนตัว ลาพักผ่อน และอื่น ๆ ตามระเบียบ",
      "ลากิจและลาพักผ่อนควรยื่นล่วงหน้า ลาป่วยยื่นย้อนหลังได้เมื่อกลับมาทำงาน",
      "ลาป่วยติดต่อกันหลายวันอาจต้องแนบใบรับรองแพทย์",
    ],
  },
  {
    key: "out-of-office",
    route: "/out-of-office",
    target: "out-of-office",
    title: "ขอออกนอกสถานที่",
    purpose: "แจ้งเมื่อต้องออกไปทำงานนอกสำนักงานในเวลางาน",
    // TODO(FRD): ร่าง — รอ FRD เขียนจากระเบียบข้อ 10 / 13-14 / 15, Vivid ตรวจก่อนปล่อย
    policy: [
      "ยื่นก่อนออกไป หรือภายในวันเดียวกัน",
      "หัวหน้าสาขาหรือฝ่ายเป็นผู้อนุมัติ",
    ],
  },
  {
    key: "payslips",
    route: "/my-payslips",
    target: "payslips",
    title: "สลิปเงินเดือน",
    purpose: "ดูและดาวน์โหลดสลิปเงินเดือนย้อนหลังของคุณ",
    // TODO(FRD): ร่าง — รอ FRD เขียนจากระเบียบข้อ 10 / 13-14 / 15, Vivid ตรวจก่อนปล่อย
    policy: [
      "สลิปของเดือนจะขึ้นหลังจากฝ่ายบัญชีปิดงวดเงินเดือน",
      "ยอดไม่ตรง แจ้งผ่านเมนูแจ้งแก้ไขข้อมูล",
    ],
  },
  {
    key: "salary-cert",
    route: "/my-salary-cert",
    target: "salary-cert",
    title: "หนังสือรับรองเงินเดือน",
    purpose: "ขอหนังสือรับรองเงินเดือนไว้ใช้ยื่นธนาคารหรือหน่วยงานอื่น",
    // TODO(FRD): ร่าง — รอ FRD เขียนจากระเบียบข้อ 10 / 13-14 / 15, Vivid ตรวจก่อนปล่อย
    policy: [
      "ยื่นคำขอแล้ว HR จะออกหนังสือให้ภายในไม่กี่วันทำการ",
      "ติดตามสถานะและดาวน์โหลดหนังสือได้จากหน้านี้",
    ],
  },
  {
    key: "loan",
    route: "/loan-request",
    target: "loan",
    title: "เงินกู้",
    purpose: "ตรวจสิทธิ์กู้ ดูค่างวดโดยประมาณ และยื่นคำขอกู้เงินกองทุนสงเคราะห์",
    // TODO(FRD): ร่าง — รอ FRD เขียนจากระเบียบข้อ 10 / 13-14 / 15, Vivid ตรวจก่อนปล่อย
    policy: [
      "วงเงินและจำนวนงวดขึ้นกับอายุงานและเงินเดือน",
      "ต้องมีผู้ค้ำประกัน 2 คน",
      "ค่างวดหักจากเงินเดือนทุกเดือน",
    ],
  },
  {
    key: "welfare",
    route: "/my-welfare",
    target: "welfare",
    title: "สวัสดิการ",
    purpose: "สิทธิ์สวัสดิการของคุณและครอบครัว เช่น ค่ารักษาพยาบาลและค่าเล่าเรียนบุตร",
    // TODO(FRD): ร่าง — รอ FRD เขียนจากระเบียบข้อ 10 / 13-14 / 15, Vivid ตรวจก่อนปล่อย
    policy: [
      "สิทธิ์ของสมาชิกครอบครัวเริ่มนับหลังจาก HR ตรวจสอบข้อมูลแล้ว",
      "ดูสิทธิ์และประวัติการเบิกของคุณได้ที่หน้านี้",
    ],
  },
  {
    key: "report-issue",
    route: "/my-profile",
    target: "report-issue",
    title: "แจ้งแก้ไขข้อมูล",
    purpose: "ต่อจากนี้ ถ้าข้อมูลของคุณเปลี่ยน ให้กดปุ่มนี้เพื่อส่งคำขอแก้ไข",
    // TODO(FRD): ร่าง — รอ FRD เขียนจากระเบียบข้อ 10 / 13-14 / 15, Vivid ตรวจก่อนปล่อย
    policy: [
      "ข้อมูลที่กรอกวันนี้ถูกบันทึกแล้ว แก้เองโดยตรงไม่ได้อีก",
      "ทุกการแก้ไขเป็นคำขอที่ HR ตรวจสอบและอนุมัติ",
      "ติดตามสถานะคำขอได้ในหน้าข้อมูลส่วนตัว",
    ],
  },
]

export const TOUR_LENGTH = TOUR_STOPS.length

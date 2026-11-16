// src/pages/admin/onboardingRegistry.js
// ─────────────────────────────────────────────────────────────────────────────
// What the gallery lists. Steps and their words come from the real sources, so this page cannot
// drift from the real thing. `who` / `when` / `often` describe what the gate code does: when you change a
// gate (lib/searchIntro.js, lib/installIntro.js, AppLayout's onboarding gate), change its text here.
//
//   preview  "wizard" | "wizard-locked" | a PreviewHost kind | null
//   noPreview  why not, when preview is null
//   phoneReason  shown instead of the button on phones, when the real one never runs there
//   seenKey  (userId) → the storage key that remembers it, for the read-only status line
// ─────────────────────────────────────────────────────────────────────────────
import { BANNER_STATES, bannerCopy } from "../../components/onboarding/bannerCopy"
import { INSTALL_INTRO_STEPS } from "../../components/onboarding/installIntroSteps"
import { SEARCH_INTRO_STEPS } from "../../components/onboarding/searchIntroSteps"
import { INSTALL_GUIDE, PLATFORM_TABS } from "../../lib/installGuideContent"
import { hasSeenInstallIntro, installIntroKey } from "../../lib/installIntro"
import { DRAFT_TTL_DAYS } from "../../lib/onboardingDraft"
import { SECTIONS } from "../../lib/onboarding"
import { TOUR_LENGTH, TOUR_STOPS } from "../../lib/onboardingTour"
import { hasSeenSearchIntro, searchIntroKey } from "../../lib/searchIntro"
import { SELF_SERVICE_MENUS } from "../../lib/sidebarMenus"
import { INTRO_COPY, WELCOME_POINTS } from "../onboarding/introContent"

const HARD_LOCK_NOTE =
  "ตอนนี้แทบไม่มีใครเห็น เพราะ AppLayout พาคนที่ยังทำไม่เสร็จไป /onboarding ก่อนเสมอ ส่วนระหว่างทัวร์เมนูปลดล็อกแล้ว"

const stripStars = (text) => text.replaceAll("*", "")

const wizardSteps = [
  { key: "welcome", title: INTRO_COPY.welcome.title, detail: WELCOME_POINTS.map((p) => p.text).join(" · "), step: "welcome" },
  ...SECTIONS.map((s) => ({ key: s.key, title: s.label, detail: s.purpose, step: s.key })),
  { key: "ready", title: INTRO_COPY.ready.title, detail: INTRO_COPY.ready.body, step: "ready" },
  { key: "done", title: INTRO_COPY.done.title, detail: INTRO_COPY.done.body, step: "done" },
]

const gatedMenus = SELF_SERVICE_MENUS.filter((item) => item.gated).map((item) => item.label)

const guideGroups = PLATFORM_TABS.map((tab) => ({
  key: tab.value,
  title: tab.label,
  variants: INSTALL_GUIDE[tab.value].variants.map((variant) => ({
    key: variant.value,
    title: variant.label,
    steps: variant.steps.map((step) => stripStars(step.text)),
  })),
}))

export const ONBOARDING_ITEMS = [
  {
    key: "wizard",
    name: "กรอกข้อมูลเริ่มต้น",
    teaches: `พาพนักงานใหม่กรอกและยืนยันข้อมูลของตัวเอง ${SECTIONS.length} หัวข้อ ก่อนเริ่มใช้เมนูอื่น`,
    who: "บัญชีที่ GET /personnel/me/onboarding ตอบข้อมูลกลับมา ถ้าตอบ 404 (Super Admin, บัญชีล็อกอินอย่างเดียว) จะไม่ต้องทำ",
    when: "หลังเปลี่ยนรหัสผ่านครั้งแรก AppLayout พามาหน้านี้ทุกครั้งจนกว่าจะเสร็จ และเมื่อ API ตอบ 403 ONBOARDING_REQUIRED",
    often: `ครั้งเดียว ทำต่อจากที่ค้างได้ HR เปิดให้กรอกใหม่หรือยกเว้นได้ ที่พิมพ์ค้างไว้เก็บในเครื่อง ${DRAFT_TTL_DAYS} วัน`,
    steps: wizardSteps,
    preview: "wizard",
  },
  {
    key: "tour",
    name: "ทัวร์เมนูบริการตนเอง",
    teaches: `พาดู ${TOUR_LENGTH} เมนูบริการตนเองบนหน้าจริง ว่าแต่ละเมนูใช้ทำอะไรและใช้อย่างไร`,
    who: "คนที่ยืนยันข้อมูลครบทุกหัวข้อแล้ว และยังไม่เสร็จ onboarding",
    when: "เมื่อกด “เริ่มทัวร์เมนู” ในขั้น “ข้อมูลครบแล้ว” เมนูไหนเปิดไม่ได้หรือหาจุดไม่เจอใน 3 วินาที จะแสดงการ์ดกลางจอแทน",
    often: "จบเมื่อกด “ส่งข้อมูลยืนยัน” ที่จุดสุดท้าย “พักก่อน” กลับไปขั้นข้อมูลครบ จุดที่ค้างอยู่ใน sessionStorage ปิดแท็บแล้วเริ่มใหม่",
    steps: TOUR_STOPS.map((stop) => ({ key: stop.key, title: stop.title, detail: stop.purpose, meta: stop.route })),
    preview: "tour",
    note: "เปิดหน้าจริงของบัญชีคุณ ถ้าเข้าหน้านั้นไม่ได้ จะเห็นการ์ดกลางจอแทนจุดที่ชี้ สิทธิ์ลาในจุดการลาเป็นตัวเลขของบัญชีคุณเอง",
  },
  {
    key: "search",
    name: "แนะนำช่องค้นหาฟังก์ชัน",
    teaches: "ค้นหาฟังก์ชันจากช่องบนหัวเว็บได้ทุกหน้า พิมพ์ผิดก็เจอ",
    who: "ทุกคนที่ล็อกอิน บนจอกว้าง 768px ขึ้นไป ที่ทำ onboarding เสร็จแล้วหรือไม่ต้องทำ และโหลดสิทธิ์เสร็จแล้ว",
    when: "หลังหน้านิ่ง 0.8 วินาที เมื่อเห็นช่องค้นหา แท็บเปิดอยู่ ไม่มี sheet หรือ dialog เปิด ไม่ได้กำลังพิมพ์ และไม่ได้อยู่ในทัวร์",
    often:
      "ครั้งเดียวต่อบัญชี เห็นจากเครื่องไหนแล้วเครื่องอื่นไม่ขึ้นอีก (จำที่ server ผ่าน /auth/me/ui-flags) ถ้า backend ยังไม่มี endpoint นี้ จะเป็นครั้งเดียวต่อบัญชีต่อเบราว์เซอร์ นับว่าเห็นแล้วทันทีที่เปิด",
    steps: SEARCH_INTRO_STEPS.map((step) => ({ key: step.key, title: step.title, detail: step.lines.join(" ") })),
    preview: "search",
    phoneReason: "ของจริงไม่แสดงบนมือถือ เพราะช่องค้นหาซ่อนอยู่ เปิดจากจอกว้าง 768px ขึ้นไปเพื่อดูตัวอย่าง",
    seenKey: searchIntroKey,
    hasSeen: hasSeenSearchIntro,
  },
  {
    key: "install-intro",
    name: "แนะนำการติดตั้งแอป",
    teaches: "บอกว่าติดตั้งแอปลงเครื่องได้ เปิดจากไอคอนแล้วเต็มจอ และพาไปคู่มือติดตั้ง",
    who: "ทุกคนที่ล็อกอินและยังไม่ได้เปิดจากแอปที่ติดตั้ง ที่ทำ onboarding เสร็จแล้วหรือไม่ต้องทำ ทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์",
    when: "หลังหน้านิ่ง 1.5 วินาที ไม่อยู่หน้า /buy หรือ /sales ไม่มีแถบปุ่มล่างจอ ไม่มี overlay เปิด แท็บเปิดอยู่ ไม่ได้กำลังพิมพ์ และไม่ได้อยู่ในทัวร์ จอกว้าง 768px ขึ้นไปต้องเห็นแนะนำช่องค้นหาก่อน",
    often: "ครั้งเดียวต่อบัญชีต่อเบราว์เซอร์ นับว่าเห็นแล้วทันทีที่เปิด ปิดแล้วยังเปิดคู่มือได้จากเมนู “ติดตั้งแอป” ถ้าติดตั้งสำเร็จระหว่างเปิดอยู่จะปิดเอง",
    steps: INSTALL_INTRO_STEPS.map((step) => ({ key: step.key, title: step.title, detail: step.lines.join(" ") })),
    preview: "install-intro",
    seenKey: installIntroKey,
    hasSeen: hasSeenInstallIntro,
  },
  {
    key: "guide",
    name: "คู่มือติดตั้งแอป",
    teaches: "วิธีติดตั้งแอปทีละขั้น ตามอุปกรณ์และเบราว์เซอร์",
    who: "ทุกคนที่ยังไม่ได้เปิดจากแอปที่ติดตั้ง รวมคนที่ยังไม่ล็อกอิน",
    when: "กด “ติดตั้งแอป” ในเมนูด้านข้างหรือหน้าเข้าสู่ระบบ หรือ “ดูวิธีติดตั้ง” ในขั้นสุดท้ายของแนะนำการติดตั้งแอป",
    often: "ทุกครั้งที่กด ไม่เก็บสถานะ",
    groups: guideGroups,
    preview: "guide",
    note: "ปุ่ม “ติดตั้งเลย” ไม่เปิดหน้าต่างติดตั้งจริงในโหมดตัวอย่าง",
  },
  {
    key: "banner",
    name: "แถบทำต่อบนหน้าหลัก",
    teaches: "เตือนว่ายังเหลืออะไร และพากลับไปทำต่อ",
    who: "คนที่ยังไม่เสร็จ onboarding",
    when: `บนหน้าหลัก ซ่อนระหว่างทัวร์ ${HARD_LOCK_NOTE}`,
    often: "ทุกครั้งที่เปิดหน้าหลัก จนกว่าจะเสร็จ",
    steps: BANNER_STATES.map(({ key, ob, tour }) => {
      const copy = bannerCopy(ob, tour)
      return { key, title: copy.title, detail: `${copy.sub} · ปุ่ม “${copy.cta}”` }
    }),
    preview: "banner",
  },
  {
    key: "locked",
    name: "เมนูล็อกระหว่างยังไม่เสร็จ",
    teaches: "บอกว่าเมนูบริการตนเองจะเปิดเมื่อกรอกข้อมูลครบ",
    who: "คนที่ยังยืนยันข้อมูลไม่ครบ",
    when: `กดเมนูที่ล็อกในเมนูด้านข้าง การ์ดหน้าหลัก หรือผลค้นหา แล้วพาไปหน้ากรอกข้อมูลพร้อมข้อความ ${HARD_LOCK_NOTE}`,
    often: "ทุกครั้งที่กดเมนูที่ล็อก",
    steps: gatedMenus.map((label) => ({ key: label, title: label })),
    stepsHeading: "เมนูที่ล็อก",
    preview: "wizard-locked",
    note: "ตัวอย่างแสดงข้อความแจ้งเตือนบนหน้ากรอกข้อมูล ไม่ได้แสดงไอคอนล็อกบนเมนู",
  },
  {
    key: "password",
    name: "เปลี่ยนรหัสผ่านครั้งแรก",
    teaches: "บังคับตั้งรหัสผ่านใหม่แทนรหัสเริ่มต้น",
    who: "บัญชีที่ account_status เป็น new",
    when: "ทันทีหลังล็อกอิน ก่อนเข้าทุกหน้าในระบบ",
    often: "ครั้งเดียวต่อบัญชี",
    steps: [
      { key: "current", title: "กรอกรหัสผ่านปัจจุบัน" },
      { key: "new", title: "ตั้งรหัสผ่านใหม่", detail: "อย่างน้อย 8 ตัวอักษร ไม่ซ้ำรหัสเดิม ไม่ใช่รหัสพนักงาน" },
      { key: "confirm", title: "ยืนยันรหัสผ่านใหม่" },
    ],
    preview: null,
    noPreview: "ไม่มีตัวอย่าง: ฟอร์มนี้เปลี่ยนรหัสผ่านจริงของบัญชีที่ล็อกอินอยู่ และหน้านี้เปิดได้เฉพาะบัญชีที่ account_status เป็น new",
  },
]

export const RELATED_LINKS = [
  {
    key: "hr-progress",
    label: "ความคืบหน้ากรอกข้อมูลเริ่มต้น",
    detail: "HR ใช้ติดตาม เปิดให้กรอกใหม่ หรือยกเว้นรายคน เป็นงานของ HR ไม่ใช่ onboarding",
    to: "/hr/dashboard?tab=onboarding",
    perm: "hr.onboarding.list",
  },
]

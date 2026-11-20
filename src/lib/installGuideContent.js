// src/lib/installGuideContent.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTENT of the install guide (components/InstallGuide.jsx). No React here.
//
//   step.text   one instruction. *x* renders bold (the label to look for on screen)
//   step.hint   optional second line
//   step.art    scene name in components/InstallGuideArt.jsx. The picture is decoration:
//               the text must say everything on its own.
//
// Facts researched Nov 2026. Browser menus change between versions: only state what is here.
// Thai menu labels are the ones Apple shows. For the rest use the English label and the position,
// because the Thai wording could not be confirmed.
//
// Copy rules (same as onboardingTour.js): short Thai sentences, no em dash, one idea per line.
// ─────────────────────────────────────────────────────────────────────────────

/** short_name in public/manifest.webmanifest: the name under the installed icon. */
export const APP_NAME = "AMC สกต.สุรินทร์"

export const PLATFORM_TABS = [
  { value: "desktop", label: "คอมพิวเตอร์" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iPhone / iPad" },
]

export const WORDING_NOTE = "ชื่อเมนูอาจต่างเล็กน้อยตามรุ่นและภาษาของเครื่อง ถ้าไม่ตรง ให้ดูตำแหน่งตามรูป"

const NEEDS_INTERNET = "ต้องต่ออินเทอร์เน็ตทุกครั้ง เพราะแอปไม่ได้เก็บข้อมูลไว้ในเครื่อง"
const NO_BROWSER_BAR = "เปิดแล้วจะไม่มีแถบของเบราว์เซอร์"

const TROUBLE_IN_APP = {
  problem: "เปิดลิงก์จากแอปอื่น เช่น LINE หรือ Facebook",
  fix: "เบราว์เซอร์ในแอปเหล่านี้ติดตั้งไม่ได้ ให้เปิดลิงก์ในเบราว์เซอร์ของเครื่องก่อน",
}
const TROUBLE_PRIVATE = {
  problem: "เปิดอยู่ในโหมดส่วนตัว (Private / Incognito)",
  fix: "ปิดโหมดส่วนตัว แล้วเปิดหน้านี้ในหน้าต่างปกติ",
}
const TROUBLE_INSTALLED = {
  problem: "อาจติดตั้งไว้แล้ว",
  fix: `ค้นหา ${APP_NAME} ในรายการแอปของเครื่อง`,
}
const TROUBLE_MANAGED = {
  problem: "เป็นเครื่องที่องค์กรดูแล",
  fix: "เครื่องแบบนี้อาจถูกตั้งค่าไม่ให้ติดตั้ง ให้สอบถามผู้ดูแลเครื่อง",
}

export const INSTALL_GUIDE = {
  desktop: {
    switchLabel: "เลือกเบราว์เซอร์ที่ใช้อยู่",
    defaultVariant: "chrome",
    openHint: `เปิดจากไอคอน ${APP_NAME} ในรายการแอปของเครื่อง`,
    variants: [
      {
        value: "chrome",
        label: "Chrome",
        steps: [
          {
            text: "ถ้ามีไอคอนติดตั้งด้านขวาของแถบที่อยู่ ให้กดไอคอนนั้น",
            hint: "กดแล้วข้ามไปข้อ 5 ถ้าไม่มีไอคอน ให้ทำข้อ 2 ต่อ",
            art: "desktopInstallIcon",
          },
          { text: "กดปุ่มสามจุดมุมขวาบนของหน้าต่าง Chrome", art: "chromeKebab" },
          {
            text: "เลือก *Cast, save, and share*",
            hint: "รุ่นเก่าใช้ชื่อ *Save and share*",
            art: "chromeMenu",
          },
          { text: "เลือก *Install page as app*", art: "chromeSubmenu" },
          { text: "กด *Install* ในกล่องที่ขึ้นมา เพื่อยืนยัน", art: "desktopConfirm" },
        ],
      },
      {
        value: "edge",
        label: "Edge",
        steps: [
          { text: "กดปุ่มสามจุดมุมขวาบนของหน้าต่าง Edge", art: "edgeDots" },
          { text: "เลือก *Apps*", art: "edgeMenu" },
          { text: "เลือก *Install this site as an app*", art: "edgeSubmenu" },
          { text: "กด *Install* ในกล่องที่ขึ้นมา เพื่อยืนยัน", art: "edgeConfirm" },
        ],
      },
      {
        value: "safari",
        label: "Safari บน Mac",
        note: "ใช้ได้กับ macOS Sonoma 14 ขึ้นไป",
        steps: [
          { text: "เปิดเมนู *File* ที่แถบเมนูด้านบนของจอ", art: "macFile" },
          {
            text: "เลือก *Add to Dock*",
            hint: "หรือกดปุ่มแชร์ (Share) ของ Safari แล้วเลือก *Add to Dock*",
            art: "macFileMenu",
          },
          { text: "กด *Add* ในกล่องที่ขึ้นมา เพื่อยืนยัน", art: "macConfirm" },
        ],
      },
    ],
    after: [
      `ติดตั้งจาก Chrome หรือ Edge: ไอคอน ${APP_NAME} จะอยู่ในรายการแอปของเครื่อง`,
      `ติดตั้งจาก Safari บน Mac: ไอคอน ${APP_NAME} จะอยู่ใน Dock`,
      NO_BROWSER_BAR,
      NEEDS_INTERNET,
    ],
    trouble: [
      {
        problem: "ไม่เห็นไอคอนติดตั้งใน Chrome",
        fix: "ไอคอนนี้ไม่ได้ขึ้นทุกครั้ง ให้ใช้ปุ่มสามจุดแทน ตามข้อ 2",
      },
      {
        problem: "ใช้ Firefox บนคอมพิวเตอร์",
        fix: "Firefox บนคอมพิวเตอร์ไม่มีเมนูติดตั้ง ให้ใช้ Chrome หรือ Edge",
      },
      TROUBLE_PRIVATE,
      TROUBLE_INSTALLED,
      TROUBLE_MANAGED,
      TROUBLE_IN_APP,
    ],
  },

  android: {
    switchLabel: "เลือกเบราว์เซอร์ที่ใช้อยู่",
    defaultVariant: "chrome",
    openHint: `เปิดจากไอคอน ${APP_NAME} ที่หน้าจอหลักหรือในรายการแอป`,
    variants: [
      {
        value: "chrome",
        label: "Chrome",
        steps: [
          { text: "แตะปุ่มสามจุดที่แถบที่อยู่ของ Chrome", art: "androidKebab" },
          {
            text: "เลือก *Add to Home screen*",
            hint: "บางรุ่นแสดง *Install app* ให้แตะอันนั้นได้เลย",
            art: "androidMenu",
          },
          { text: "แตะ *Install* แล้วยืนยัน", art: "androidConfirm" },
          { text: `ไอคอน ${APP_NAME} จะอยู่ที่หน้าจอหลักหรือในรายการแอป`, art: "androidHome" },
        ],
      },
      {
        value: "samsung",
        label: "Samsung Internet",
        steps: [
          {
            text: "แตะปุ่มเมนูสามขีดที่มุมขวาล่าง",
            hint: "ถ้าแถบที่อยู่มีไอคอนติดตั้ง จะแตะไอคอนนั้นแทนก็ได้",
            art: "samsungButton",
          },
          { text: "เลือก *Add page to*", art: "samsungMenu" },
          { text: "เลือก *Home screen*", art: "samsungTarget" },
        ],
      },
    ],
    after: [
      `ไอคอน ${APP_NAME} จะอยู่ที่หน้าจอหลักหรือในรายการแอป`,
      NO_BROWSER_BAR,
      NEEDS_INTERNET,
    ],
    trouble: [TROUBLE_IN_APP, TROUBLE_PRIVATE, TROUBLE_INSTALLED, TROUBLE_MANAGED],
  },

  ios: {
    switchLabel: "เลือกเบราว์เซอร์ที่ใช้อยู่ (Safari เลือกตามรุ่น iOS ของเครื่อง)",
    defaultVariant: "ios26",
    openHint: `เปิดจากไอคอน ${APP_NAME} ที่หน้าจอโฮม`,
    variants: [
      {
        value: "ios26",
        label: "Safari iOS 26+",
        steps: [
          {
            text: "แตะปุ่มสามจุดข้างแถบที่อยู่",
            hint: "ถ้าจัดแท็บแบบ Bottom หรือ Top จะเห็นปุ่มแชร์เลย ให้ข้ามไปข้อ 2",
            art: "ios26Dots",
          },
          { text: "แตะปุ่มแชร์ (Share) รูปสี่เหลี่ยมมีลูกศรชี้ขึ้น", art: "ios26Share" },
          {
            text: "เลื่อนรายการลง แล้วแตะ *เพิ่มไปยังหน้าจอโฮม* (Add to Home Screen)",
            hint: "ถ้าเห็น *View More* ให้แตะก่อน",
            art: "iosSheet",
          },
          {
            text: "เปิดสวิตช์ *เปิดเป็นเว็บแอป* (Open as Web App) ค้างไว้",
            hint: "ถ้าปิดสวิตช์นี้ จะได้แค่ที่คั่นหน้าธรรมดา",
            art: "iosToggle",
          },
          { text: "แตะ *เพิ่ม* (Add)", art: "iosAdd26" },
        ],
      },
      {
        value: "iosOld",
        label: "Safari รุ่นเก่า",
        steps: [
          {
            text: "แตะปุ่มแชร์ (Share) รูปสี่เหลี่ยมมีลูกศรชี้ขึ้น",
            hint: "iPhone อยู่ด้านล่าง iPad อยู่มุมขวาบน",
            art: "iosShareOld",
          },
          {
            text: "เลื่อนรายการลง แล้วแตะ *เพิ่มไปยังหน้าจอโฮม* (Add to Home Screen)",
            art: "iosSheet",
          },
          { text: "แตะ *เพิ่ม* (Add)", art: "iosAddOld" },
        ],
      },
      {
        value: "chrome",
        label: "Chrome",
        note: "ใช้ได้กับ iOS 16.4 ขึ้นไป",
        steps: [
          {
            text: "แตะปุ่มแชร์ (Share) ด้านขวาของแถบที่อยู่",
            hint: "รูปสี่เหลี่ยมมีลูกศรชี้ขึ้น ถ้าย้ายแถบที่อยู่ไว้ด้านล่าง ปุ่มจะอยู่ด้านล่าง",
            art: "chromeIosShare",
          },
          {
            text: "แตะ *View More* (ดูเพิ่มเติม) แถวล่างสุดของหน้าต่างแชร์",
            hint: "ปุ่มวงกลมรูปลูกศรชี้ลง อยู่ขวาสุด",
            art: "chromeIosMore",
          },
          { text: "แตะ *Add to Home Screen* (เพิ่มไปยังหน้าจอโฮม)", art: "chromeIosAdd" },
          {
            text: "แตะ *เพิ่ม* (Add)",
            hint: "ถ้ามีสวิตช์ *เปิดเป็นเว็บแอป* (Open as Web App) ให้เปิดค้างไว้",
            art: "iosAdd26",
          },
        ],
      },
    ],
    after: [
      `ไอคอน ${APP_NAME} จะอยู่ที่หน้าจอโฮม`,
      NO_BROWSER_BAR,
      NEEDS_INTERNET,
      "อาจต้องเข้าสู่ระบบอีกครั้ง เพราะแอปที่ติดตั้งแยกที่เก็บข้อมูลจากเบราว์เซอร์",
    ],
    trouble: [
      {
        problem: "ติดตั้งแล้ว แต่เปิดเป็นหน้าเว็บในเบราว์เซอร์",
        fix: "สวิตช์เปิดเป็นเว็บแอปถูกปิดไว้ จึงได้แค่ที่คั่นหน้า ให้ทำใหม่โดยเปิดสวิตช์ค้างไว้",
      },
      TROUBLE_IN_APP,
      TROUBLE_PRIVATE,
      TROUBLE_INSTALLED,
      TROUBLE_MANAGED,
    ],
  },
}

/** Which browser/version tab opens first on this device. */
export function defaultVariant({ platform, browser, iosMajor }) {
  if (platform === "ios") {
    if (browser === "chrome") return "chrome"
    return iosMajor !== null && iosMajor < 26 ? "iosOld" : "ios26"
  }
  const guide = INSTALL_GUIDE[platform]
  return guide.variants.some((v) => v.value === browser) ? browser : guide.defaultVariant
}

/** Warning for this browser, or null. The in-app case is about the app it runs inside. */
export function browserWarning({ platform, browser, inApp }) {
  const target = platform === "ios" ? "Safari หรือ Chrome" : platform === "android" ? "Chrome" : "Chrome หรือ Edge"
  if (inApp) {
    return {
      kind: "inApp",
      title: `ติดตั้งจากในแอป ${inApp} ไม่ได้`,
      lines: ["เบราว์เซอร์ในแอปนี้ไม่มีเมนูติดตั้ง", `คัดลอกลิงก์ แล้วเปิดใน ${target}`],
    }
  }
  if (platform === "ios") return null
  if (INSTALL_GUIDE[platform].variants.some((v) => v.value === browser)) return null
  if (browser === "firefox" && platform === "desktop") {
    return {
      kind: "unsupported",
      title: "Firefox บนคอมพิวเตอร์ติดตั้งแอปไม่ได้",
      lines: [`คัดลอกลิงก์ แล้วเปิดใน ${target}`],
    }
  }
  return {
    kind: "unsupported",
    title: "เบราว์เซอร์นี้ไม่มีในคู่มือ",
    lines: [`ให้ใช้ ${target} เพื่อติดตั้ง`, "คัดลอกลิงก์ แล้วเปิดในเบราว์เซอร์นั้น"],
  }
}

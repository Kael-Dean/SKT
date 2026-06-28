import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

// ─────────────────────────────────────────────────────────────────────────────
// แลนดิ้งเพจ "ถักทอ" — งานถักมือแฮนด์เมด
// Port จาก Claude Design (project: แลนดิ้งเพจสินค้าผ้าถัก) เป็น React standalone
// เต็มจอ ไม่มี Sidebar/Topbar — scroll-driven hero + reveal-on-view เหมือนต้นฉบับ
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#B07A56"

const PRODUCTS = [
  { type: "ผ้าพันคอ", name: "ผ้าพันคอไหมพรม “ละมุน”", desc: "ไหมพรมเนื้อนุ่ม โทนสีเอิร์ธ ใส่ได้ทุกฤดู", price: "฿890", ph: "รูปผ้าพันคอ" },
  { type: "หมวก", name: "หมวกบีนนี่ถักมือ “อุ่นไอ”", desc: "ทรงพอดีศีรษะ อุ่นสบายในวันลมหนาว", price: "฿650", ph: "รูปหมวกไหมพรม" },
  { type: "กระเป๋า", name: "กระเป๋าถักคล้องไหล่ “สาน”", desc: "ลายถักแน่น จุของได้สบาย ทนทาน", price: "฿1,290", ph: "รูปกระเป๋าถัก" },
  { type: "ผ้าพันคอ", name: "ผ้าพันคอโครเชต์ “ปอย”", desc: "ลายโครเชต์โปร่ง เบาสบาย พลิ้วไหว", price: "฿790", ph: "รูปผ้าพันคอ" },
  { type: "หมวก", name: "หมวกปีกถัก “ร่มไม้”", desc: "ปีกกว้างกันแดด สไตล์งานคราฟต์", price: "฿980", ph: "รูปหมวกปีก" },
  { type: "กระเป๋า", name: "กระเป๋าคลัตช์ถัก “จิ๋ว”", desc: "ใบเล็กกะทัดรัด พกพาง่าย น่ารัก", price: "฿590", ph: "รูปกระเป๋าคลัตช์" },
]

const STEPS = [
  { no: "01", title: "คัดเส้นไหม", desc: "เลือกเส้นไหมและไหมพรมคุณภาพ โทนสีจากธรรมชาติ" },
  { no: "02", title: "ออกแบบลาย", desc: "ร่างลวดลายและจับคู่โทนสีให้กลมกลืนในแต่ละชิ้น" },
  { no: "03", title: "ถักด้วยมือ", desc: "บรรจงถักทีละชิ้น ใช้เวลาหลายวันต่อหนึ่งชิ้น" },
  { no: "04", title: "ตรวจคุณภาพ", desc: "ตรวจทุกฝีเข็มและความเรียบร้อยก่อนส่งมอบ" },
  { no: "05", title: "ส่งถึงมือคุณ", desc: "ห่อด้วยใจ พร้อมจัดส่งถึงหน้าบ้านคุณ" },
]

const CONTACTS = [
  { label: "LINE", value: "@thaktho", href: "#" },
  { label: "Instagram", value: "@thaktho.studio", href: "#" },
  { label: "Facebook", value: "ถักทอ Studio", href: "#" },
  { label: "โทร", value: "08x-xxx-xxxx", href: "#" },
]

const REVEAL = "opacity:0;transform:translateY(28px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1);"

function imgSlot(text, { bg = "#ECE6D6", color = "#9A937C", radius = 0 } = {}) {
  return `<div style="width:100%;aspect-ratio:4/5;display:flex;align-items:center;justify-content:center;background:${bg};color:${color};font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.08em;text-align:center;padding:18px;${radius ? `border-radius:${radius}px;` : ""}">${text}</div>`
}

function buildHTML(year) {
  const products = PRODUCTS.map(
    (p) => `
      <article data-reveal style="${REVEAL}background:#FBF9F2;border:1px solid #E2DBC8;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;">
        ${imgSlot(p.ph)}
        <div style="padding:22px 22px 24px;display:flex;flex-direction:column;gap:8px;flex:1;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9A937C;">${p.type}</div>
          <h3 style="margin:0;font-family:'Trirong',serif;font-weight:500;font-size:22px;color:#2B2A22;">${p.name}</h3>
          <p style="margin:0;font-size:14.5px;line-height:1.6;color:#6B6552;flex:1;">${p.desc}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;">
            <span style="font-family:'Trirong',serif;font-size:21px;color:#2B2A22;">${p.price}</span>
            <span class="tk-buy" style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);border:1px solid var(--accent);border-radius:999px;padding:7px 15px;cursor:pointer;transition:background .25s ease,color .25s ease;">สั่งซื้อ</span>
          </div>
        </div>
      </article>`
  ).join("")

  const steps = STEPS.map(
    (s) => `
      <div data-reveal style="${REVEAL}display:grid;grid-template-columns:clamp(70px,12vw,140px) 1fr;gap:clamp(20px,4vw,48px);align-items:baseline;padding:clamp(26px,3.5vh,40px) 0;border-top:1px solid #D3CAB2;">
        <div style="font-family:'Trirong',serif;font-weight:300;font-size:clamp(42px,6vw,84px);line-height:1;color:var(--accent);">${s.no}</div>
        <div>
          <h3 style="margin:0;font-family:'Trirong',serif;font-weight:500;font-size:clamp(22px,2.6vw,30px);color:#2B2A22;">${s.title}</h3>
          <p style="margin:10px 0 0;font-size:16px;line-height:1.7;color:#6B6552;max-width:560px;">${s.desc}</p>
        </div>
      </div>`
  ).join("")

  const contacts = CONTACTS.map(
    (c) => `
      <a href="${c.href}" data-reveal class="tk-contact" style="opacity:0;transform:translateY(20px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .35s cubic-bezier(.2,.7,.2,1),border-color .35s ease;text-decoration:none;display:flex;flex-direction:column;gap:8px;padding:24px 16px;background:#FBF9F2;border:1px solid #E2DBC8;border-radius:16px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9A937C;">${c.label}</span>
        <span style="font-size:16px;color:#2B2A22;font-weight:500;">${c.value}</span>
      </a>`
  ).join("")

  return `
  <section data-hero-wrap style="position:relative;height:340vh;background:var(--hero-bg);">
    <div data-hero-stage style="position:sticky;top:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:var(--hero-bg);">
      <div data-glow style="position:absolute;left:50%;top:50%;width:82vmin;height:82vmin;border-radius:50%;background:radial-gradient(circle, rgba(130,139,107,0.5), rgba(130,139,107,0) 70%);transform:translate(-50%,-50%) scale(0.7);opacity:0.25;pointer-events:none;filter:blur(8px);"></div>
      <div data-hint style="position:absolute;top:max(40px,7vh);left:0;right:0;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.35em;text-transform:uppercase;color:#8A8470;">เลื่อนลง&nbsp;&nbsp;↓</div>
      <h1 style="position:relative;margin:0;font-family:'Trirong',serif;font-weight:500;font-size:clamp(82px,17vw,264px);line-height:0.92;letter-spacing:-0.015em;color:#2B2A22;text-align:center;">
        <span data-ch style="display:inline-block;opacity:0;will-change:opacity,transform,filter;">ถั</span><span data-ch style="display:inline-block;opacity:0;will-change:opacity,transform,filter;">ก</span><span data-ch style="display:inline-block;opacity:0;will-change:opacity,transform,filter;">ท</span><span data-ch style="display:inline-block;opacity:0;will-change:opacity,transform,filter;">อ</span>
      </h1>
      <div data-sub style="position:relative;margin-top:30px;font-family:'IBM Plex Mono',monospace;font-size:clamp(11px,1.1vw,14px);letter-spacing:0.3em;text-transform:uppercase;color:var(--accent);opacity:0;">Handmade Knitwear · Crafted by Hand</div>
      <p data-intro style="position:relative;margin:34px auto 0;max-width:640px;padding:0 24px;text-align:center;font-size:clamp(17px,2vw,24px);line-height:1.78;color:#4A4636;opacity:0;">งานถักมือทุกชิ้น ร้อยเรียงจากเส้นไหมและไหมพรมคัดสรร อบอุ่นเหมือนของขวัญทำมือ — สำหรับคนที่คุณรัก และตัวคุณเอง</p>
    </div>
  </section>

  <section style="position:relative;background:#F2EEE3;padding:clamp(90px,12vh,150px) 24px;">
    <div style="max-width:1180px;margin:0 auto;">
      <div data-reveal style="${REVEAL}max-width:700px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:var(--accent);margin-bottom:18px;">01 — คอลเลกชัน</div>
        <h2 style="margin:0;font-family:'Trirong',serif;font-weight:500;font-size:clamp(34px,4.5vw,60px);line-height:1.1;letter-spacing:-0.01em;color:#2B2A22;">งานถักที่คัดสรร<br>ทีละชิ้นด้วยมือ</h2>
        <p style="margin:22px 0 0;font-size:17px;line-height:1.7;color:#6B6552;max-width:540px;">ผ้าพันคอ หมวกไหมพรม และกระเป๋า ในโทนสีธรรมชาติ — เลือกชิ้นที่ใช่ หรือสั่งทำในแบบของคุณเอง</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px;margin-top:clamp(48px,6vh,72px);">
        ${products}
      </div>
    </div>
  </section>

  <section style="background:#3B4232;color:#ECE7D9;padding:clamp(100px,14vh,170px) 24px;">
    <div style="max-width:1120px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:clamp(40px,6vw,80px);align-items:center;">
      <div data-reveal style="opacity:0;transform:translateY(28px);transition:opacity 1s cubic-bezier(.2,.7,.2,1),transform 1s cubic-bezier(.2,.7,.2,1);">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#A9B08C;margin-bottom:18px;">02 — เรื่องราวของเรา</div>
        <h2 style="margin:0;font-family:'Trirong',serif;font-weight:400;font-size:clamp(30px,4vw,52px);line-height:1.2;color:#F3EFE2;">เริ่มจากไหมพรมหนึ่งกลุ่ม<br>กับเวลาว่างในวันฝนตก</h2>
        <p style="margin:26px 0 0;font-size:16.5px;line-height:1.85;color:#CFCBB8;">ถักทอเกิดจากความหลงใหลในงานถักมือ เราเลือกเส้นไหมและไหมพรมคุณภาพ ย้อมโทนสีจากธรรมชาติ แล้วบรรจงถักทีละชิ้นอย่างใส่ใจ</p>
        <p style="margin:18px 0 0;font-size:16.5px;line-height:1.85;color:#CFCBB8;">ทุกชิ้นจึงไม่เหมือนกันเสียทีเดียว — เพราะมันคืองานทำมือจริง ๆ ที่ซ่อนความตั้งใจไว้ในทุกฝีเข็ม</p>
        <div style="margin-top:30px;font-family:'Trirong',serif;font-style:italic;font-size:20px;color:#A9B08C;">— ปอย, ผู้ก่อตั้งถักทอ</div>
      </div>
      <div data-reveal style="opacity:0;transform:translateY(28px);transition:opacity 1s cubic-bezier(.2,.7,.2,1) .1s,transform 1s cubic-bezier(.2,.7,.2,1) .1s;">
        ${imgSlot("ภาพช่างฝีมือ / บรรยากาศงานถัก", { bg: "#4A5240", color: "#A9B08C", radius: 18 })}
      </div>
    </div>
  </section>

  <section style="background:#EAE3D2;padding:clamp(100px,13vh,160px) 24px;">
    <div style="max-width:1080px;margin:0 auto;">
      <div data-reveal style="${REVEAL}max-width:700px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:var(--accent);margin-bottom:18px;">03 — ขั้นตอนงานแฮนด์เมด</div>
        <h2 style="margin:0;font-family:'Trirong',serif;font-weight:500;font-size:clamp(34px,4.5vw,58px);line-height:1.1;letter-spacing:-0.01em;color:#2B2A22;">กว่าจะเป็นงานถักหนึ่งชิ้น</h2>
      </div>
      <div style="margin-top:clamp(40px,5vh,64px);">
        ${steps}
      </div>
    </div>
  </section>

  <section style="background:#F2EEE3;padding:clamp(100px,14vh,170px) 24px;">
    <div style="max-width:860px;margin:0 auto;text-align:center;">
      <div data-reveal style="${REVEAL}">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:var(--accent);margin-bottom:18px;">04 — สั่งซื้อ &amp; ติดต่อ</div>
        <h2 style="margin:0;font-family:'Trirong',serif;font-weight:500;font-size:clamp(34px,4.5vw,58px);line-height:1.12;letter-spacing:-0.01em;color:#2B2A22;">อยากได้ชิ้นไหน<br>ทักมาคุยกันได้เลย</h2>
        <p style="margin:22px auto 0;max-width:520px;font-size:17px;line-height:1.7;color:#6B6552;">รับทำตามสั่ง เลือกสีและลายได้เอง ตอบกลับทุกข้อความภายใน 24 ชั่วโมง</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px;margin-top:48px;">
        ${contacts}
      </div>
      <a href="#" class="tk-cta" style="display:inline-block;margin-top:44px;background:var(--accent);color:#FBF9F2;font-size:16px;font-weight:500;text-decoration:none;padding:18px 42px;border-radius:999px;transition:opacity .3s ease;">สั่งทำชิ้นพิเศษ — Custom Order</a>
    </div>
  </section>

  <footer style="background:#3B4232;color:#ECE7D9;padding:clamp(56px,8vh,80px) 24px;">
    <div style="max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-family:'Trirong',serif;font-size:30px;font-weight:500;">ถักทอ</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#A9B08C;margin-top:6px;">Handmade Knitwear</div>
      </div>
      <div style="font-size:13px;color:#9DA384;font-family:'IBM Plex Mono',monospace;letter-spacing:0.05em;">© ${year} ถักทอ studio · ทำด้วยมือ ทำด้วยใจ</div>
    </div>
  </footer>`
}

export default function ThakthoLanding() {
  const navigate = useNavigate()
  const rootRef = useRef(null)

  useEffect(() => {
    // โหลดฟอนต์เฉพาะหน้านี้ (Trirong / IBM Plex Sans Thai / IBM Plex Mono)
    const fontLink = document.createElement("link")
    fontLink.rel = "stylesheet"
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=Trirong:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Sans+Thai:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
    document.head.appendChild(fontLink)

    const root = rootRef.current
    if (!root) return
    const scroller = root
    const wrap = root.querySelector("[data-hero-wrap]")
    const chars = Array.from(root.querySelectorAll("[data-ch]"))
    const sub = root.querySelector("[data-sub]")
    const intro = root.querySelector("[data-intro]")
    const hint = root.querySelector("[data-hint]")
    const glow = root.querySelector("[data-glow]")

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
    const smooth = (t) => t * t * (3 - 2 * t)

    let ticking = false
    const update = () => {
      if (!wrap) return
      const vh = scroller.clientHeight || window.innerHeight || 800
      const wrapRect = wrap.getBoundingClientRect()
      const rootTop = scroller.getBoundingClientRect().top
      const relTop = wrapRect.top - rootTop
      const total = Math.max(wrapRect.height - vh, 1)
      const p = clamp(-relTop / total, 0, 1)

      const n = chars.length || 1
      const cStart = 0.06, cEnd = 0.5
      const base = clamp((p - cStart) / (cEnd - cStart), 0, 1)
      const reveal = base * n
      chars.forEach((el, i) => {
        const cp = clamp(reveal - i, 0, 1)
        const e = smooth(cp)
        el.style.opacity = e
        el.style.transform = "translateY(" + ((1 - e) * 0.45).toFixed(3) + "em)"
        el.style.filter = "blur(" + ((1 - e) * 10).toFixed(2) + "px)"
      })

      if (glow) {
        glow.style.opacity = (0.22 + base * 0.55).toFixed(3)
        glow.style.transform = "translate(-50%,-50%) scale(" + (0.7 + base * 0.5).toFixed(3) + ")"
      }

      const s = clamp((p - 0.5) / 0.1, 0, 1)
      if (sub) {
        sub.style.opacity = s
        sub.style.transform = "translateY(" + ((1 - s) * 14).toFixed(2) + "px)"
      }

      const it = smooth(clamp((p - 0.6) / 0.26, 0, 1))
      if (intro) {
        intro.style.opacity = it
        intro.style.transform = "translateY(" + ((1 - it) * 18).toFixed(2) + "px)"
        intro.style.filter = "blur(" + ((1 - it) * 4).toFixed(2) + "px)"
      }

      if (hint) hint.style.opacity = clamp(1 - p * 7, 0, 1)
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        update()
        ticking = false
      })
    }
    scroller.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    update()

    const revealEls = Array.from(root.querySelectorAll("[data-reveal]"))
    let io
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.style.opacity = "1"
              e.target.style.transform = "none"
              io.unobserve(e.target)
            }
          })
        },
        { root: scroller, threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
      )
      revealEls.forEach((el) => io.observe(el))
    } else {
      revealEls.forEach((el) => {
        el.style.opacity = "1"
        el.style.transform = "none"
      })
    }

    return () => {
      scroller.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (io) io.disconnect()
      if (fontLink.parentNode) fontLink.parentNode.removeChild(fontLink)
    }
  }, [])

  const year = new Date().getFullYear()

  return (
    <div
      ref={rootRef}
      style={{
        fontFamily: "'IBM Plex Sans Thai', sans-serif",
        color: "#2B2A22",
        background: "#F2EEE3",
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        width: "100%",
        scrollBehavior: "smooth",
        WebkitFontSmoothing: "antialiased",
        ["--accent"]: ACCENT,
        ["--hero-bg"]: "#F2EEE3",
      }}
    >
      <style>{`
        [data-thaktho] ::selection{background:#828B6B;color:#F2EEE3;}
        [data-thaktho] .tk-buy:hover{background:var(--accent);color:#FBF9F2;}
        [data-thaktho] .tk-contact:hover{border-color:var(--accent);transform:translateY(-4px);}
        [data-thaktho] .tk-cta:hover{opacity:0.88;}
        .tk-back:hover{border-color:var(--accent);color:var(--accent);}
      `}</style>

      {/* ปุ่มย้อนกลับไปหน้า showcase */}
      <button
        type="button"
        onClick={() => navigate("/showcase")}
        className="tk-back"
        style={{
          position: "fixed",
          top: "22px",
          left: "22px",
          zIndex: 50,
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          padding: "8px 15px",
          borderRadius: "999px",
          border: "1px solid #D8CFB8",
          background: "rgba(251,249,242,0.82)",
          backdropFilter: "blur(6px)",
          color: "#6B6552",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "12px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: "pointer",
          transition: "border-color .25s ease, color .25s ease",
        }}
      >
        ← กลับ
      </button>

      <div data-thaktho dangerouslySetInnerHTML={{ __html: buildHTML(year) }} />
    </div>
  )
}

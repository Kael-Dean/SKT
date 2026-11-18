/* overlay.js — วาดกรอบแดง + วงกลมเลขกำกับ ลงบนหน้าจริง (inject ผ่าน javascript_tool ก่อนแคปภาพ)
 *
 * วิธีใช้ตอนถ่ายภาพ (Claude in Chrome): เก็บโค้ดไฟล์นี้ลง localStorage ของหน้า staging หนึ่งครั้ง
 *   (localStorage.__ovsrc = โค้ดทั้งไฟล์) แล้วทุกหน้าเรียก  (0,eval)(localStorage.__ovsrc); window.__ov([...])  ก่อน screenshot
 *   (ดึงจาก http://localhost ไม่ได้ — CSP ของหน้าบล็อก fetch)
 *
 * ใช้:   window.__ov([ [1,'t:ปีบัญชี'], [2,'t:ช่วงประเมิน..แจ้งผู้ประเมิน',{pad:6}], [3,'s:table|0'], [4,'r:48,176,300,40'] ])
 * target:
 *   e:ข้อความ           เหมือน t: แต่ต้องตรงทั้งข้อความ
 *   t:ข้อความ           element ที่ลึกที่สุดซึ่งข้อความขึ้นต้นด้วยข้อความนี้ (ต่อท้าย |k = ตัวที่ k, เริ่ม 0)
 *   t:ก..ข              กรอบรวมของสอง element (ก ถึง ข)
 *   s:css|k             querySelectorAll(css)[k]
 *   r:x,y,w,h           สี่เหลี่ยมดิบ (px ของ viewport)
 *   opts: {pad, up, side}  pad = ระยะขยายออก (ค่าเริ่มต้น 7), up = ไต่ขึ้นไป parent N ชั้น, side = 'tl'|'t'|'l'|'tr'|'bl'
 * กติกา: กรอบขยายออกด้านนอกเสมอ (ไม่ทับข้อความของ element) — ถ้าชนข้อความอื่นจะลด pad ลง (ต่ำสุด 2)
 *        วงกลมอยู่นอกกรอบ มุมซ้ายบน (-14,-14) ถ้าล้นจอ/ทับข้อความ ย้ายไปเหนือกรอบหรือซ้ายกรอบ
 */
(function () {
  const BORDER = 2, R = 11 // รัศมีวงกลม
  const clean = () => document.querySelectorAll('.__mk').forEach((e) => e.remove())
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }

  function textRects() {
    const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = w.nextNode())) {
      if (!norm(n.nodeValue)) continue
      const p = n.parentElement
      if (!p || p.closest('.__mk, script, style')) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const r of rg.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue
        const top = document.elementFromPoint(cx, cy)
        if (!top || !(p === top || p.contains(top) || top.contains(p))) continue // ถูกบัง (เช่นหลัง modal)
        out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, el: p })
      }
    }
    return out
  }

  function find(spec, opts) {
    let rect, owner = null
    if (spec.startsWith('r:')) {
      const [x, y, w, h] = spec.slice(2).split(',').map(Number)
      return { l: x, t: y, r: x + w, b: y + h, el: null }
    }
    const one = (s) => {
      let el
      if (s.startsWith('s:')) { const [q, k] = s.slice(2).split('|'); el = [...document.querySelectorAll(q)].filter(vis)[+(k || 0)] }
      else {
        const exact = s.startsWith('e:')
        const [txt, k] = s.replace(/^[te]:/, '').split('|')
        const all = [...document.querySelectorAll('body *')].filter((e) => vis(e) && !e.closest('.__mk') && (exact ? norm(e.textContent) === txt : norm(e.textContent).startsWith(txt)))
        const deepest = all.filter((e) => !all.some((o) => o !== e && e.contains(o)))
        el = deepest[+(k || 0)]
      }
      if (!el) return null
      for (let i = 0; i < (opts.up || 0); i++) el = el.parentElement || el
      return el
    }
    const parts = spec.includes('..') && !spec.startsWith('r:') ? spec.split('..') : [spec]
    const els = parts.map((p, i) => one(i ? (spec.startsWith('e:') ? 'e:' : 't:') + p : p)).filter(Boolean)
    if (!els.length) return null
    const rs = els.map((e) => e.getBoundingClientRect())
    return { l: Math.min(...rs.map((r) => r.left)), t: Math.min(...rs.map((r) => r.top)), r: Math.max(...rs.map((r) => r.right)), b: Math.max(...rs.map((r) => r.bottom)), el: els }
  }

  const hit = (a, b, m = 0) => a.l < b.r - m && a.r > b.l + m && a.t < b.b - m && a.b > b.t + m

  window.__ov = function (items) {
    clean()
    const texts = textRects(), log = [], boxes = []
    for (const [n, spec, opts0] of items) {
      const opts = opts0 || {}
      const f = find(spec, opts)
      if (!f) { log.push('MISS ' + n + ' ' + spec); continue }
      const own = Array.isArray(f.el) ? f.el : f.el ? [f.el] : []
      const foreign = f.el
        ? texts.filter((t) => !own.some((o) => o === t.el || o.contains(t.el)))
        : texts.filter((t) => { const cx = (t.l + t.r) / 2, cy = (t.t + t.b) / 2; return !(cx > f.l && cx < f.r && cy > f.t && cy < f.b) }) // r: = ข้อความที่อยู่ในกรอบถือว่าเป็นของ target
      let pad = opts.pad ?? 7, box
      for (; pad >= 2; pad--) {
        box = { l: f.l - pad - BORDER, t: f.t - pad - BORDER, r: f.r + pad + BORDER, b: f.b + pad + BORDER }
        if (!foreign.some((t) => hit(box, t, 1))) break
      }
      if (pad < 2) { pad = 2; box = { l: f.l - 2 - BORDER, t: f.t - 2 - BORDER, r: f.r + 2 + BORDER, b: f.b + 2 + BORDER } }
      // ตำแหน่งวงกลม
      const cands = {
        tl: [box.l - 6, box.t - 6], // มุมซ้ายบน
        tr: [box.r + 6, box.t - 6], // มุมขวาบน (opts.side='tr')
        bl: [box.l - 6, box.b + 6], // มุมซ้ายบน ชิดนอกกรอบ (center อยู่ประมาณ (-14,-14) จากมุมของ element)
        t: [box.l + R + 6, box.t - R - 3],
        l: [box.l - R - 3, box.t + R + 6],
      }
      const order = opts.side ? [opts.side, 'tl', 't', 'l'] : ['tl', 't', 'l']
      let cp = null
      for (const k of order) {
        const [cx, cy] = cands[k]
        const c = { l: cx - R - 2, t: cy - R - 2, r: cx + R + 2, b: cy + R + 2 }
        const off = c.l < 1 || c.t < 1 || c.r > innerWidth - 1 || c.b > innerHeight - 1
        if (!off && !texts.some((t) => hit(c, t, 0)) && !boxes.some((b2) => hit(c, b2, 0))) { cp = [cx, cy]; break }
      }
      if (!cp) { // เลือกตำแหน่งที่อยู่ในจอ แล้วยอมรับ
        for (const k of order) { const [cx, cy] = cands[k]; if (cx > R + 1 && cy > R + 1) { cp = [cx, cy]; break } }
        cp = cp || [Math.max(R + 2, cands.tl[0]), Math.max(R + 2, cands.tl[1])]
        log.push('BADGE-FALLBACK ' + n)
      }
      const b = document.createElement('div'); b.className = '__mk'
      b.style.cssText = `position:fixed;z-index:2147483000;pointer-events:none;box-sizing:border-box;border:${BORDER}px solid #dc2626;border-radius:8px;left:${box.l}px;top:${box.t}px;width:${box.r - box.l}px;height:${box.b - box.t}px`
      const c = document.createElement('div'); c.className = '__mk'; c.textContent = n
      c.style.cssText = `position:fixed;z-index:2147483001;pointer-events:none;box-sizing:border-box;background:#dc2626;color:#fff;font:700 13px/1 sans-serif;width:${R * 2}px;height:${R * 2}px;border-radius:50%;display:flex;align-items:center;justify-content:center;left:${cp[0] - R}px;top:${cp[1] - R}px;box-shadow:0 0 0 3px #fff`
      document.body.append(b, c)
      boxes.push(box)
      log.push(n + ':pad' + pad)
    }
    return log.join(' ')
  }
  window.__ovClear = clean
})()

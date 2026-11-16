// public/boot-guard.js: classic script, runs before the hashed bundle.
//
// After a deploy, a reload can still get an OLD index.html from the CDN / HTTP
// cache (GCS default max-age 3600). That HTML points at assets/index-<oldhash>.js
// and .css which the deploy deleted → both 404 → the static boot screen stays
// forever. A URL with a fresh query string misses those caches, so:
//
//   1. an /assets/ script or stylesheet fails to load, or
//   2. the app has not mounted after BOOT_TIMEOUT_MS
//   → location.replace(<same url>?_r=<now>) once. src/main.jsx strips `_r`.
//
// Loop guard: one automatic retry per RETRY_WINDOW_MS (sessionStorage). After that
// the boot screen shows a manual "ลองใหม่" button instead of reloading again.
// Must stay a separate file: the CSP (script-src 'self') blocks inline scripts.
;(function () {
  var KEY = "amc:boot-retry-at"
  var RETRY_WINDOW_MS = 30000
  var BOOT_TIMEOUT_MS = 20000
  var done = false

  function freshUrl() {
    var url = new URL(window.location.href)
    url.searchParams.set("_r", String(Date.now()))
    return url.pathname + url.search + url.hash
  }

  function showManualRetry() {
    var root = document.getElementById("root")
    var p = root && root.querySelector("p")
    if (!p || p.getAttribute("data-retry")) return
    p.setAttribute("data-retry", "1")
    p.textContent = "โหลดไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"
    var btn = document.createElement("button")
    btn.type = "button"
    btn.textContent = "ลองใหม่"
    btn.style.cssText =
      "min-height:44px;padding:0 24px;border:0;border-radius:12px;background:#4f46e5;color:#fff;font:600 16px sans-serif;cursor:pointer"
    btn.onclick = function () {
      window.location.replace(freshUrl())
    }
    p.parentNode.appendChild(btn)
  }

  function recover() {
    if (done || window.__amcBooted) return
    done = true
    var last = 0
    try {
      last = Number(sessionStorage.getItem(KEY)) || 0
      if (Date.now() - last < RETRY_WINDOW_MS) return showManualRetry()
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch (e) {
      return showManualRetry() // no sessionStorage → never auto-reload (no loop guard)
    }
    window.location.replace(freshUrl())
  }

  // Load errors of <script>/<link> don't bubble → listen in the capture phase.
  window.addEventListener(
    "error",
    function (event) {
      var el = event.target
      if (!el || el === window) return
      var src = (el.tagName === "SCRIPT" && el.src) || (el.tagName === "LINK" && el.rel === "stylesheet" && el.href) || ""
      if (src.indexOf("/assets/") !== -1) recover()
    },
    true
  )

  setTimeout(function () {
    if (!window.__amcBooted && navigator.onLine !== false) recover()
  }, BOOT_TIMEOUT_MS)
})()

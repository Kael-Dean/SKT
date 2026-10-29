// vite.demo.config.js — client demo build: `npm run build:demo`
// ─────────────────────────────────────────────────────────────────────────────
// The REAL app with the fake backend (src/dev/onboardingMock.js) baked in, packed into ONE
// HTML file (demo/skt-demo.html) that opens straight from disk (file://) — no server, no API.
// Differences from the production build (vite.config.js):
//   · VITE_DEMO=1 → mock always on + HashRouter (src/main.jsx)
//   · every JS/CSS/font/image inlined; /logo/*.png from public/ become data URIs
//   · CSP <meta> removed (it forbids inline scripts, which is all this file is)
// Never deploy this file — it is a sales/demo artifact only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const OUT_DIR = 'demo/.build'
const OUT_FILE = 'demo/skt-demo.html'

const dataUri = (publicPath) =>
  `data:image/png;base64,${readFileSync(resolve('public', publicPath.replace(/^\//, ''))).toString('base64')}`

/** asset("/logo/x.png") → "data:image/png;base64,…" (and the same paths in index.html). */
function inlinePublicLogos() {
  const CALL = /asset\(\s*(["'`])(\/logo\/[\w.-]+\.png)\1\s*\)/g
  return {
    name: 'demo-inline-public-logos',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.[jt]sx?$/.test(id) || id.includes('node_modules') || !code.includes('/logo/')) return null
      return code.replace(CALL, (_, _q, p) => JSON.stringify(dataUri(p)))
    },
    transformIndexHtml(html) {
      return html
        .replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '')
        .replace(/href="(\/logo\/[\w.-]+\.png)"/g, (_, p) => `href="${dataUri(p)}"`)
    },
  }
}

/** After Vite has written the build, pull the JS + CSS into index.html → one self-contained file.
 *  (Done on disk, not in generateBundle: Vite finalises the chunk code after user plugins run.) */
function singleFile() {
  return {
    name: 'demo-single-file',
    apply: 'build',
    closeBundle() {
      const read = (rel) => readFileSync(resolve(OUT_DIR, rel.replace(/^\.?\//, '')), 'utf8')
      const html = read('index.html')
        .replace(/<script([^>]*)\ssrc="([^"]+)"([^>]*)><\/script>/g, (_, a, src, b) =>
          `<script${a}${b}>${read(src).replace(/<\/script/gi, '<\\/script')}</script>`)
        .replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => `<style>${read(href)}</style>`)
        .replace(/<link rel="modulepreload"[^>]*>/g, '')
      writeFileSync(OUT_FILE, html)
      rmSync(OUT_DIR, { recursive: true, force: true })
    },
  }
}

export default defineConfig({
  base: './',
  publicDir: false, // logos are inlined above; the Thai address JSON is bundled by the mock
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  plugins: [inlinePublicLogos(), react(), tailwindcss(), singleFile()],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    assetsInlineLimit: () => true, // fonts, background image → data URIs
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 100_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})

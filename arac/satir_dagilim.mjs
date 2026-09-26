// Satır bazında: en koyu yuvarlağın normalize değeri ve (en koyu - satır medyanı)
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'
const require = createRequire(import.meta.url); const jpeg = require('jpeg-js'); const { PNG } = require('pngjs'); let cv = require('@techstark/opencv-js')
if (cv instanceof Promise) cv = await cv; else if (!cv.Mat) await new Promise(r => { cv.onRuntimeInitialized = r })
const { okuyucuOlustur } = await import('../src/omr/okuyucu.js')
const geo = JSON.parse(fs.readFileSync('../src/omr/geometri.json'))
const refPng = PNG.sync.read(fs.readFileSync('../src/omr/referans.png'))
const referans = new cv.Mat(refPng.height, refPng.width, cv.CV_8UC4); referans.data.set(refPng.data)
const ok = okuyucuOlustur(cv, geo, { referans, debug: true })
const D = {}; const ekle = (k, v) => (D[k] = D[k] || []).push(v)
const sinir = Number(process.env.SINIR || 1e9)
for (const kok of process.argv.slice(2)) {
  const g = JSON.parse(fs.readFileSync(path.join(kok, 'gercek.json')))
  let n = 0
  for (const [dosya, gg] of Object.entries(g.kagitlar)) {
    if (++n > sinir) break
    const raw = jpeg.decode(fs.readFileSync(path.join(kok, 'kagitlar', dosya)), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 })
    const m = new cv.Mat(raw.height, raw.width, cv.CV_8UC4); m.data.set(raw.data)
    const r = ok.oku(m, { gorseller: false }); m.delete()
    if (!r.tamam) continue
    const { taban, kontrast } = r._esikC
    for (const [qs, c] of Object.entries(gg.cevaplar)) {
      const p = r._puan[+qs].map(v => (v - taban) / kontrast)
      const s = [...p].sort((a, b) => a - b)
      const maks = s[4], med = s[2]
      let tur = c.tur
      if (tur === 'bos') tur = c.silgi != null ? 'bos+silgi' : c.nokta != null ? 'bos+nokta' : 'bos'
      else if (['tam', 'kismi', 'tasmis', 'hafif'].includes(tur)) tur = tur + (c.silgi != null ? '+silgi' : '')
      ekle(tur + ':maks', maks); ekle(tur + ':fark', maks - med)
      if (['tam', 'kismi', 'tasmis', 'hafif'].includes(c.tur)) ekle(c.tur + ':isaret', p[c.k])
    }
  }
}
const q = (a, x) => a[Math.min(a.length - 1, Math.floor(x * a.length))]
for (const k of Object.keys(D).sort()) {
  const a = D[k].sort((x, y) => x - y)
  console.log(k.padEnd(20), 'n=' + String(a.length).padStart(6), 'min', a[0].toFixed(2), 'p1', q(a, .01).toFixed(2), 'p5', q(a, .05).toFixed(2), 'med', q(a, .5).toFixed(2), 'p95', q(a, .95).toFixed(2), 'p99', q(a, .99).toFixed(2), 'p999', q(a, .999).toFixed(2), 'max', a[a.length - 1].toFixed(2))
}

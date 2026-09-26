// Ad/soyad ve numara sütunlarında: boş sütunun (en koyu, en koyu-ikinci) ve gerçek harfin değerleri
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'
const require = createRequire(import.meta.url); const jpeg = require('jpeg-js'); const { PNG } = require('pngjs'); let cv = require('@techstark/opencv-js')
if (cv instanceof Promise) cv = await cv; else if (!cv.Mat) await new Promise(r => { cv.onRuntimeInitialized = r })
const { okuyucuOlustur } = await import('../src/omr/okuyucu.js')
const geo = JSON.parse(fs.readFileSync('../src/omr/geometri.json'))
const refPng = PNG.sync.read(fs.readFileSync('../src/omr/referans.png'))
const referans = new cv.Mat(refPng.height, refPng.width, cv.CV_8UC4); referans.data.set(refPng.data)
const ok = okuyucuOlustur(cv, geo, { referans, debug: true })
const D = {}; const ekle = (k, v) => (D[k] = D[k] || []).push(v)
for (const kok of process.argv.slice(2)) {
  const g = JSON.parse(fs.readFileSync(path.join(kok, 'gercek.json')))
  for (const [dosya, gg] of Object.entries(g.kagitlar)) {
    const raw = jpeg.decode(fs.readFileSync(path.join(kok, 'kagitlar', dosya)), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 })
    const m = new cv.Mat(raw.height, raw.width, cv.CV_8UC4); m.data.set(raw.data)
    const r = ok.oku(m, { gorseller: false }); m.delete()
    if (!r.tamam) continue
    for (const alan of ['ad', 'soyad']) {
      if (gg[alan + '_zor']) continue
      const { taban, kontrast } = r._esikI
      const metin = (gg[alan] || '')
      r._isimPuan[alan].forEach((sut, s) => {
        const n = sut.map(v => (v - taban) / kontrast)
        const sir = [...n].sort((a, b) => b - a)
        const ch = metin[s]
        if (ch && ch !== ' ') { ekle('harf:deger', n[geo.harfler.indexOf(ch)]); ekle('harf:fark', n[geo.harfler.indexOf(ch)] - Math.max(...n.filter((_, k) => k !== geo.harfler.indexOf(ch)))) }
        else { ekle('bosSutun:maks', sir[0]); ekle('bosSutun:fark', sir[0] - sir[1]) }
      })
    }
    if (!gg.no_zor) {
      const { taban, kontrast } = r._esikN
      r._noPuan.forEach(sut => {
        const n = sut.map(v => (v - taban) / kontrast)
        const sir = [...n].sort((a, b) => b - a)
        if (sir[0] > 0.45) { ekle('rakam:deger', sir[0]); ekle('rakam:fark', sir[0] - sir[1]) }
        else { ekle('bosHane:maks', sir[0]); ekle('bosHane:fark', sir[0] - sir[1]) }
      })
    }
  }
}
const q = (a, x) => a[Math.min(a.length - 1, Math.floor(x * a.length))]
for (const k of Object.keys(D).sort()) {
  const a = D[k].sort((x, y) => x - y)
  console.log(k.padEnd(16), 'n=' + String(a.length).padStart(6), 'min', a[0].toFixed(2), 'p1', q(a, .01).toFixed(2), 'p5', q(a, .05).toFixed(2), 'med', q(a, .5).toFixed(2), 'p95', q(a, .95).toFixed(2), 'p99', q(a, .99).toFixed(2), 'p999', q(a, .999).toFixed(2), 'max', a[a.length - 1].toFixed(2))
}

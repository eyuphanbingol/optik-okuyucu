// İşaret türlerine göre normalize koyuluk dağılımı: (puan - taban) / kontrast
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'
const require = createRequire(import.meta.url); const jpeg = require('jpeg-js'); const { PNG } = require('pngjs'); let cv = require('@techstark/opencv-js')
if (cv instanceof Promise) cv = await cv; else if (!cv.Mat) await new Promise(r => { cv.onRuntimeInitialized = r })
const { okuyucuOlustur } = await import('../src/omr/okuyucu.js')
const geo = JSON.parse(fs.readFileSync('../src/omr/geometri.json'))
const refPng = PNG.sync.read(fs.readFileSync('../src/omr/referans.png'))
const referans = new cv.Mat(refPng.height, refPng.width, cv.CV_8UC4); referans.data.set(refPng.data)
const ok = okuyucuOlustur(cv, geo, { referans, debug: true })
const D = {}
const ekle = (k, v) => (D[k] = D[k] || []).push(v)
for (const kok of process.argv.slice(2)) {
  const g = JSON.parse(fs.readFileSync(path.join(kok, 'gercek.json')))
  for (const [dosya, gg] of Object.entries(g.kagitlar)) {
    const raw = jpeg.decode(fs.readFileSync(path.join(kok, 'kagitlar', dosya)), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 })
    const m = new cv.Mat(raw.height, raw.width, cv.CV_8UC4); m.data.set(raw.data)
    const r = ok.oku(m, { gorseller: false }); m.delete()
    if (!r.tamam) continue
    const { taban, kontrast } = r._esikC
    const n = v => (v - taban) / kontrast
    for (const [qs, c] of Object.entries(gg.cevaplar)) {
      const p = r._puan[+qs]
      const isaretli = new Set()
      if (['tam', 'kismi', 'tasmis', 'hafif'].includes(c.tur)) { ekle(c.tur, n(p[c.k])); isaretli.add(c.k) }
      if (c.tur === 'cift') c.k.forEach(k => { ekle('cift', n(p[k])); isaretli.add(k) })
      if (c.silgi != null && !isaretli.has(c.silgi)) { ekle('silgi', n(p[c.silgi])); isaretli.add(c.silgi) }
      if (c.nokta != null && !isaretli.has(c.nokta)) { ekle('nokta', n(p[c.nokta])); isaretli.add(c.nokta) }
      for (let k = 0; k < 5; k++) if (!isaretli.has(k)) ekle('bos', n(p[k]))
    }
    // ad/soyad: gerçek harfin koyuluğu ve diğerleri (çift harf ve silgi ayrıca)
    const nI = v => (v - r._esikI.taban) / r._esikI.kontrast
    const harf = geo.harfler
    for (const alan of ['ad', 'soyad']) {
      const metin = (gg[alan] || '').padEnd(13, ' ')
      r._isimPuan[alan].forEach((sut, s) => {
        const ch = metin[s]
        const hk = ch && ch !== ' ' ? harf.indexOf(ch) : -1
        const sirali = sut.map((v, k) => [nI(v), k]).sort((a, b) => b[0] - a[0])
        if (hk >= 0) ekle('isim_harf', nI(sut[hk]))
        const digerMax = sirali.find(([, k]) => k !== hk)
        if (!gg[alan + '_zor']) ekle('isim_diger_max', digerMax[0])
      })
    }
    const nN = v => (v - r._esikN.taban) / r._esikN.kontrast
    r._noPuan.forEach(sut => { const s2 = sut.map(nN).sort((a, b) => b - a); if (s2[0] > 0.3) ekle('no_isaret', s2[0]); ekle('no_ikinci', s2[s2[0] > 0.3 ? 1 : 0]) })
  }
}
const yuzde = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))]
for (const [k, a] of Object.entries(D)) {
  a.sort((x, y) => x - y)
  console.log(k.padEnd(7), 'n=' + String(a.length).padStart(6), 'min', a[0].toFixed(2), 'p1', yuzde(a, .01).toFixed(2), 'p5', yuzde(a, .05).toFixed(2), 'medyan', yuzde(a, .5).toFixed(2), 'p95', yuzde(a, .95).toFixed(2), 'p99', yuzde(a, .99).toFixed(2), 'max', a[a.length - 1].toFixed(2))
}
fs.writeFileSync(process.env.CIKTI || '/dev/null', JSON.stringify(D))

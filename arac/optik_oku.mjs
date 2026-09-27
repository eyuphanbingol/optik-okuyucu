// Optik okuyucunun kendi çekirdeğiyle (src/omr/okuyucu.js) bir klasördeki kâğıt görüntülerini okur.
//   node arac/optik_oku.mjs <klasor>     (klasor/liste.json: ["dosya.jpg", ...])  ->  klasor/sonuc.json
// Tarayıcıdaki okuyucuyla aynı kod ve aynı form ölçüleri kullanılır.
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
const require = createRequire(import.meta.url)
const jpeg = require('jpeg-js')
const { PNG } = require('pngjs')
const cvp = require('@techstark/opencv-js')
const { okuyucuOlustur } = await import('../src/omr/okuyucu.js')
const geo = JSON.parse(fs.readFileSync(new URL('../src/omr/geometri.json', import.meta.url)))

let cv = cvp
if (cv instanceof Promise) cv = await cv
else if (!cv.Mat) await new Promise(r => { cv.onRuntimeInitialized = r })

const refPng = PNG.sync.read(fs.readFileSync(new URL('../src/omr/referans.png', import.meta.url)))
const referans = new cv.Mat(refPng.height, refPng.width, cv.CV_8UC4); referans.data.set(refPng.data)
const ok = okuyucuOlustur(cv, geo, { referans })
referans.delete()

function yukle(dosya) {
  const b = fs.readFileSync(dosya)
  let raw
  if (dosya.endsWith('.png')) { const p = PNG.sync.read(b); raw = { width: p.width, height: p.height, data: p.data } }
  else raw = jpeg.decode(b, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 })
  const m = new cv.Mat(raw.height, raw.width, cv.CV_8UC4)
  m.data.set(raw.data)
  return m
}

const kok = process.argv[2]
const liste = JSON.parse(fs.readFileSync(path.join(kok, 'liste.json')))
const sonuc = {}
for (const dosya of liste) {
  const m = yukle(path.join(kok, dosya))
  const r = ok.oku(m, { gorseller: false }); m.delete()
  if (!r.tamam) { sonuc[dosya] = { tamam: false, mesaj: r.mesaj, hata: r.hata }; continue }
  sonuc[dosya] = {
    tamam: true,
    kitapcik: r.kitapcik.harf, kitapcikCift: r.kitapcik.cift || null, kitapcikNot: r.kitapcik.not || null,
    anahtar: r.anahtar,
    cevaplar: r.cevaplar.map(c => (c.tur === 'cevap' ? c.k : c.tur === 'cift' ? 'x' : null)),
    notlar: r.cevaplar.map((c, q) => (c.not ? `${q + 1}: ${c.not}` : null)).filter(Boolean),
    ad: r.ad.metin, soyad: r.soyad.metin, no: r.no.metin, adSupheli: !!(r.ad.supheli || r.soyad.supheli), noSupheli: !!r.no.supheli,
    guven: r.enDusukGuven,
  }
}
fs.writeFileSync(path.join(kok, 'sonuc.json'), JSON.stringify(sonuc))
console.log(`${Object.keys(sonuc).length} kâğıt okundu`)

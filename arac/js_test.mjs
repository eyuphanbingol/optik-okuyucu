// JS okuma çekirdeğini sahte kâğıtlarla test eder: node js_test.mjs <klasor>
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
const require = createRequire(import.meta.url)
const jpeg = require('jpeg-js')
const cvp = require('@techstark/opencv-js')
const { okuyucuOlustur } = await import('../src/omr/okuyucu.js')
const geo = JSON.parse(fs.readFileSync(process.env.GEO || new URL('../src/omr/geometri.json', import.meta.url)))

let cv = cvp
if (cv instanceof Promise) cv = await cv
else if (!cv.Mat) await new Promise(r => { cv.onRuntimeInitialized = r })

const kok = process.argv[2]
const secenek = process.argv[3] ? JSON.parse(process.argv[3]) : {}
const gercek = JSON.parse(fs.readFileSync(path.join(kok, 'gercek.json')))
const { PNG } = require('pngjs')
const refPng = PNG.sync.read(fs.readFileSync(process.env.REF || new URL('../src/omr/referans.png', import.meta.url)))
const referans = new cv.Mat(refPng.height, refPng.width, cv.CV_8UC4); referans.data.set(refPng.data)
const ok = okuyucuOlustur(cv, geo, { ...secenek, referans })
referans.delete()

function yukle(dosya) {
  const raw = jpeg.decode(fs.readFileSync(dosya), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 })
  const m = new cv.Mat(raw.height, raw.width, cv.CV_8UC4)
  m.data.set(raw.data)
  return m
}

const t0 = Date.now()
// anahtarlar
const anahtarlar = {}
for (const kit of Object.keys(gercek.anahtarlar)) {
  const m = yukle(path.join(kok, 'kagitlar', `anahtar_${kit}.jpg`))
  const r = ok.oku(m, { gorseller: false }); m.delete()
  if (!r.tamam) { console.log('ANAHTAR OKUNAMADI', kit, r.mesaj); continue }
  const a = {}
  r.cevaplar.forEach((c, q) => { if (c.tur === 'cevap') a[q] = c.k })
  const beklenen = gercek.anahtarlar[kit]
  const esit = Object.keys(beklenen).length === Object.keys(a).length && Object.entries(beklenen).every(([q, k]) => a[q] === k)
  console.log(`anahtar ${kit}: ${esit ? 'DOĞRU' : 'YANLIŞ!'} kitapçık=${r.kitapcik.harf} anahtarYuv=${r.anahtar}`)
  anahtarlar[kit] = a
}

const say = { kagit: 0, okunan: 0, red: 0, redKesik: 0, soru: 0, sessiz: 0, uyari: 0, temizUyari: 0,
  isim: 0, isimSessiz: 0, isimUyari: 0, isimZorYakalanan: 0, isimZor: 0, no: 0, noSessiz: 0, noUyari: 0, kitSessiz: 0 }
const redler = {}, hatalar = [], guvenler = [], pxmm = [], kivrim = [], sabitIyi = []
for (const [dosya, g] of Object.entries(gercek.kagitlar)) {
  say.kagit++
  const m = yukle(path.join(kok, 'kagitlar', dosya))
  const r = ok.oku(m, { gorseller: false }); m.delete()
  if (!r.tamam) {
    say.red++; if (g.kesik) say.redKesik++
    redler[r.hata] = (redler[r.hata] || 0) + 1
    if (!g.kesik) hatalar.push(['RED', dosya, g.mod, g.bukum, r.mesaj, r.pxmm?.toFixed?.(2), r.guven?.toFixed?.(2), r.blok, r.sabitIyi, r.kivrim])
    continue
  }
  say.okunan++
  guvenler.push(r.enDusukGuven); pxmm.push(r.pxmm); kivrim.push(r.kivrim); sabitIyi.push(r.sabitIyi)
  // kitapçık
  const kitG = g.kitapcik
  if (!r.kitapcik.not && !r.kitapcik.cift && (r.kitapcik.harf || null) !== (kitG || null)) { say.kitSessiz++; hatalar.push(['KITAPCIK', dosya, kitG, r.kitapcik]) }
  // ad soyad
  for (const alan of ['ad', 'soyad']) {
    say.isim++
    const zor = g[alan + '_zor']
    if (zor) say.isimZor++
    if (r[alan].supheli) { say.isimUyari++; if (zor) say.isimZorYakalanan++ }
    else if (r[alan].metin !== g[alan]) { say.isimSessiz++; hatalar.push(['ISIM', dosya, alan, g[alan], r[alan].metin]) }
  }
  say.no++
  if (r.no.supheli) say.noUyari++
  else if (r.no.metin !== g.no) { say.noSessiz++; hatalar.push(['NO', dosya, g.no, r.no.metin]) }
  // cevaplar
  for (const [qs, bek] of Object.entries(g.cevaplar)) {
    const q = +qs, c = r.cevaplar[q]
    say.soru++
    const not = !!c.not
    const temiz = bek.tur === 'tam' && bek.silgi == null && bek.nokta == null
    let dogru
    if (bek.tur === 'cift') dogru = c.tur === 'cift' || not
    else if (bek.tur === 'bos') dogru = c.tur === 'bos' || not
    else dogru = (c.tur === 'cevap' && c.k === bek.k) || not
    if (!dogru) { say.sessiz++; hatalar.push(['SORU', dosya, q + 1, bek, c]) }
    if (not) { say.uyari++; if (temiz) say.temizUyari++ }
  }
}
guvenler.sort(); pxmm.sort((a, b) => a - b)
console.log(JSON.stringify(say))
console.log('red sebepleri:', redler, '| en düşük hizalama güveni:', guvenler.slice(0, 3).map(v => v.toFixed(2)), '| px/mm min:', pxmm.slice(0, 3).map(v => v.toFixed(2)))
kivrim.sort((a, b) => b - a); sabitIyi.sort((a, b) => a - b)
console.log('en büyük kıvrım (px):', kivrim.slice(0, 3).map(v => v.toFixed(1)), '| en az iyi sabit nokta:', sabitIyi.slice(0, 3))
console.log(`süre: ${((Date.now() - t0) / 1000).toFixed(1)} sn, kâğıt başı ${((Date.now() - t0) / say.kagit).toFixed(0)} ms`)
for (const h of hatalar.slice(0, 30)) console.log('  ', JSON.stringify(h))
ok.kapat()

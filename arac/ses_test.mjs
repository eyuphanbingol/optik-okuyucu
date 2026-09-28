// "Okundu" ve uyarı seslerini WAV olarak yazar ve ölçer:  node arac/ses_test.mjs [klasör]
// Denetlenen: ses yüksek (tepe ≈ tam ölçek, ortalama güç yüksek), kırpılma yok, baskın frekanslar beklenen tonlar,
// başı ve sonu sessiz (tıkırtı yok), süre kısa (kâğıt değiştirmeyi yavaşlatmaz).
import fs from 'node:fs'
import path from 'node:path'
import { sesWav } from '../src/ses.js'

const klasor = process.argv[2] || '.'
let hata = 0
const kontrol = (k, m) => { console.log((k ? '  ✔ ' : '  ✘ ') + m); if (!k) hata++ }

function oku(b) {
  const d = new DataView(b)
  const n = d.getUint32(40, true) / 2, sr = d.getUint32(24, true)
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) x[i] = d.getInt16(44 + i * 2, true) / 32768
  return { x, sr }
}
// basit DFT ile belli aralıkta en güçlü frekans
function baskin(x, sr, a, b, f0, f1) {
  let enIyi = 0, enF = 0
  for (let f = f0; f <= f1; f += 5) {
    let re = 0, im = 0
    for (let i = a; i < b; i++) { const w = 2 * Math.PI * f * i / sr; re += x[i] * Math.cos(w); im -= x[i] * Math.sin(w) }
    const g = Math.hypot(re, im)
    if (g > enIyi) { enIyi = g; enF = f }
  }
  return enF
}

for (const [ad, tonlar] of [['basari', [1976, 2637]], ['uyari', [784, 523]]]) {
  const b = sesWav(ad)
  fs.writeFileSync(path.join(klasor, `${ad}.wav`), Buffer.from(b))
  const { x, sr } = oku(b)
  const sure = x.length / sr
  let tepe = 0, guc = 0, dolu = 0
  for (const v of x) { tepe = Math.max(tepe, Math.abs(v)); if (Math.abs(v) > 0.01) { guc += v * v; dolu++ } }
  const rms = Math.sqrt(guc / dolu)
  console.log(`${ad}: ${(sure * 1000).toFixed(0)} ms, tepe ${tepe.toFixed(3)}, ses varken RMS ${rms.toFixed(3)} (${(20 * Math.log10(rms)).toFixed(1)} dBFS)`)
  kontrol(tepe > 0.9 && tepe < 1, 'tam ölçeğe yakın, kırpılmasız')
  kontrol(rms > 0.45, 'yüksek ortalama güç')
  kontrol(Math.abs(x[0]) < 0.01 && Math.abs(x[x.length - 2]) < 0.01, 'başı ve sonu sessiz (tıkırtı yok)')
  kontrol(sure < 0.5, 'kısa (yarım saniyeden az)')
  const f1 = baskin(x, sr, Math.round(0.02 * sr), Math.round(0.07 * sr), 300, 3000)
  const b0 = Math.round((ad === 'basari' ? 0.14 : 0.23) * sr)
  const f2 = baskin(x, sr, b0, b0 + Math.round(0.05 * sr), 300, 3000)
  kontrol(Math.abs(f1 - tonlar[0]) <= 10 && Math.abs(f2 - tonlar[1]) <= 10, `tonlar ${f1} Hz → ${f2} Hz (beklenen ${tonlar.join(' → ')})`)
}
console.log(hata ? `${hata} HATA` : 'SONUÇ: BAŞARILI')
process.exit(hata ? 1 : 0)

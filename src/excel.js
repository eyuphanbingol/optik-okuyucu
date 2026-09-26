import { SIKLAR, puanla, adSoyad, soruPuani, yuvarla, baslikBicim } from './mantik.js'

const MAVI = 'FF1F4E78'
const YESIL = 'FFC6EFCE'
const KIRMIZI = 'FFFFC7CE'
const GRI = 'FFEDEDED'
const TURUNCU = 'FFFFE0B2'

function baslikSatiri(ws) {
  const r = ws.getRow(1)
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  r.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  r.height = 30
  r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAVI } } })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

function dolgu(c, argb) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }

export function dosyaAdi(sinav) {
  const ad = (sinav.ayar.sinavAdi || 'sinav').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '_') || 'sinav'
  const t = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${ad}_sonuclar_${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}.xlsx`
}

/** Sınav sonuçlarını Excel dosyasına (ArrayBuffer) döker. */
export async function excelOlustur(sinav) {
  const { default: ExcelJS } = await import('exceljs')
  const { ayar, anahtarlar, ogrenciler } = sinav
  const N = ayar.soruSayisi
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Optik Okuyucu'
  wb.created = new Date()

  const satirlar = ogrenciler.map((o, i) => {
    const a = anahtarlar[o.kitapcik]
    const p = a ? puanla(o, a, ayar) : null
    return { sira: i + 1, o, p }
  })

  // ---------------- Sonuçlar (okutma sırası)
  const ws = wb.addWorksheet('Sonuçlar', { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } })
  ws.columns = [
    { header: 'Sıra', key: 'sira', width: 6 },
    { header: 'Öğrenci No', key: 'no', width: 12 },
    { header: 'Adı', key: 'ad', width: 20 },
    { header: 'Soyadı', key: 'soyad', width: 20 },
    { header: 'Kitapçık', key: 'kitapcik', width: 10 },
    { header: 'Doğru', key: 'd', width: 8 },
    { header: 'Yanlış', key: 'y', width: 8 },
    { header: 'Boş', key: 'b', width: 8 },
    { header: 'Net', key: 'net', width: 9 },
    { header: 'Puan', key: 'puan', width: 9 },
    { header: 'Not', key: 'not', width: 40 },
  ]
  for (const { sira, o, p } of satirlar) {
    const r = ws.addRow({
      sira, no: o.no || '',
      ad: baslikBicim(o.ad), soyad: baslikBicim(o.soyad), kitapcik: o.kitapcik || '',
      d: p?.d, y: p?.y, b: p?.b, net: p?.net, puan: p?.puan,
      not: [...(o.notlar || []), p ? '' : 'Cevap anahtarı yok'].filter(Boolean).join('; '),
    })
    r.getCell('net').numFmt = '0.00'
    r.getCell('puan').numFmt = '0.00'
    if (o.notlar && o.notlar.length) dolgu(r.getCell('not'), TURUNCU)
  }
  baslikSatiri(ws)
  ws.autoFilter = { from: 'A1', to: 'K1' }

  // ---------------- Sıralama (puana göre)
  const wr = wb.addWorksheet('Sıralama')
  wr.columns = [
    { header: 'Derece', key: 'd', width: 8 }, { header: 'Öğrenci No', key: 'no', width: 12 },
    { header: 'Ad Soyad', key: 'ad', width: 32 }, { header: 'Kitapçık', key: 'k', width: 10 },
    { header: 'Net', key: 'net', width: 9 }, { header: 'Puan', key: 'puan', width: 9 },
  ]
  const sirali = satirlar.filter(s => s.p).sort((a, b) => b.p.puan - a.p.puan || b.p.net - a.p.net)
  let derece = 0, onceki = null
  sirali.forEach((s, i) => {
    if (onceki === null || s.p.puan !== onceki) { derece = i + 1; onceki = s.p.puan }
    const r = wr.addRow({ d: derece, no: s.o.no || '', ad: adSoyad(s.o), k: s.o.kitapcik, net: s.p.net, puan: s.p.puan })
    r.getCell('net').numFmt = '0.00'; r.getCell('puan').numFmt = '0.00'
  })
  baslikSatiri(wr)

  // ---------------- Cevaplar
  const wc = wb.addWorksheet('Cevaplar')
  wc.columns = [
    { header: 'Sıra', key: 's', width: 6 }, { header: 'Öğrenci No', key: 'no', width: 11 },
    { header: 'Ad Soyad', key: 'ad', width: 26 }, { header: 'Kitapçık', key: 'k', width: 9 },
    ...Array.from({ length: N }, (_, q) => ({ header: String(q + 1), key: 'q' + q, width: 4.2 })),
  ]
  for (const { sira, o, p } of satirlar) {
    const deger = { s: sira, no: o.no || '', ad: adSoyad(o), k: o.kitapcik || '' }
    for (let q = 0; q < N; q++) {
      const c = o.cevaplar[q]
      deger['q' + q] = c.t === 'c' ? SIKLAR[c.k] : c.t === 'x' ? c.ks.map(k => SIKLAR[k]).join('') : ''
    }
    const r = wc.addRow(deger)
    if (p) {
      for (let q = 0; q < N; q++) {
        const cell = r.getCell(5 + q)
        cell.alignment = { horizontal: 'center' }
        dolgu(cell, p.detay[q] === 'd' ? YESIL : p.detay[q] === 'y' ? KIRMIZI : GRI)
      }
    }
  }
  baslikSatiri(wc)

  // ---------------- Soru analizi
  const wa = wb.addWorksheet('Soru Analizi')
  wa.columns = [
    { header: 'Kitapçık', key: 'k', width: 10 }, { header: 'Soru', key: 'q', width: 7 },
    { header: 'Doğru cevap', key: 'dc', width: 12 }, { header: 'Doğru %', key: 'd', width: 10 },
    { header: 'Yanlış %', key: 'y', width: 10 }, { header: 'Boş %', key: 'b', width: 10 },
    { header: 'En çok seçilen yanlış şık', key: 'en', width: 26 }, { header: 'Öğrenci sayısı', key: 'n', width: 14 },
  ]
  for (const [kit, anahtar] of Object.entries(anahtarlar)) {
    const grup = satirlar.filter(s => s.p && s.o.kitapcik === kit)
    const n = grup.length
    for (let q = 0; q < N; q++) {
      let d = 0, y = 0, b = 0
      const yanlis = {}
      for (const s of grup) {
        const du = s.p.detay[q]
        if (du === 'd') d++; else if (du === 'y') y++; else b++
        const c = s.o.cevaplar[q]
        if (c.t === 'c' && c.k !== anahtar[q]) yanlis[SIKLAR[c.k]] = (yanlis[SIKLAR[c.k]] || 0) + 1
      }
      const en = Object.entries(yanlis).sort((a, b2) => b2[1] - a[1])[0]
      const r = wa.addRow({
        k: kit, q: q + 1, dc: SIKLAR[anahtar[q]],
        d: n ? yuvarla(100 * d / n, 1) : '', y: n ? yuvarla(100 * y / n, 1) : '', b: n ? yuvarla(100 * b / n, 1) : '',
        en: en ? `${en[0]} (${en[1]} kişi)` : '-', n,
      })
      if (n) dolgu(r.getCell('d'), d / n < 0.4 ? KIRMIZI : d / n >= 0.8 ? YESIL : 'FFFFFFFF')
    }
  }
  baslikSatiri(wa)

  // ---------------- Cevap anahtarı
  const wk = wb.addWorksheet('Cevap Anahtarı')
  wk.columns = [{ header: 'Kitapçık', key: 'k', width: 10 }, ...Array.from({ length: N }, (_, q) => ({ header: String(q + 1), key: 'q' + q, width: 4.2 }))]
  for (const [kit, anahtar] of Object.entries(anahtarlar)) {
    const d = { k: kit }
    for (let q = 0; q < N; q++) d['q' + q] = SIKLAR[anahtar[q]]
    wk.addRow(d)
  }
  baslikSatiri(wk)

  // ---------------- Bilgi
  const wi = wb.addWorksheet('Bilgi')
  const puanlar = satirlar.filter(s => s.p).map(s => s.p.puan)
  const ort = puanlar.length ? puanlar.reduce((a, b) => a + b, 0) / puanlar.length : 0
  const bilgi = [
    ['Sınav', ayar.sinavAdi || '-'],
    ['Tarih', new Date().toLocaleString('tr-TR')],
    ['Soru sayısı', N],
    ['Soru başı puan', yuvarla(soruPuani(ayar), 4)],
    ['Yanlış doğruyu götürür', ayar.yanlisGoturur ? `${ayar.yanlisGoturur} yanlış 1 doğru` : 'Hayır'],
    ['Çift işaretli soru', ayar.ciftIsaret === 'bos' ? 'Boş sayılır' : 'Yanlış sayılır'],
    ['Öğrenci sayısı', ogrenciler.length],
    ['Ortalama puan', yuvarla(ort, 2)],
    ['En yüksek puan', puanlar.length ? Math.max(...puanlar) : '-'],
    ['En düşük puan', puanlar.length ? Math.min(...puanlar) : '-'],
  ]
  wi.columns = [{ width: 26 }, { width: 36 }]
  bilgi.forEach(b => { const r = wi.addRow(b); r.getCell(1).font = { bold: true } })

  return wb.xlsx.writeBuffer()
}

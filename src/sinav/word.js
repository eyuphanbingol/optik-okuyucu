/*
 * Word (.docx) çıktısı. Öğretmen dosyayı Word'de açıp istediği gibi düzenleyebilsin diye
 * baskı görünümü (Baski.jsx) gerçek Word öğeleriyle kurulur: tablolar, sekmeler, sütunlar, sayfa numarası alanları.
 * Bu modül ve docx kütüphanesi yalnızca "Word olarak indir" tıklanınca yüklenir.
 */
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionAlign, HorizontalPositionRelativeFrom,
  ImageRun, LineRuleType, Packer, PageNumber, Paragraph, SectionType, ShadingType, Tab, TabStopType, Table, TableCell,
  TableLayoutType, TableRow, TextRun, TextWrappingSide, TextWrappingType, VerticalAlign, VerticalPositionRelativeFrom,
  WidthType, HeightRule, convertMillimetersToTwip as tw,
} from 'docx'
import { HARFLER, soruMu, sikDuzeni, gorselKimlikleri, puanMetni } from './model.js'
import { tumGruplar, kucukHarf } from './karistir.js'
import { temizle } from './metin.js'
import { gorselBaytlari } from './gorsel.js'
import { SAYFA } from './Baski.jsx'

// ------------------------------------------------------------------ ölçüler
const ICERIK_MM = SAYFA.g - SAYFA.sol - SAYFA.sag
const GIRINTI_MM = 7                       // soru numarasından sonra metnin başladığı yer
const px = mm => (mm / 25.4) * 96          // docx görsel boyutu piksel (96 dpi) ister
const YAZI_TIPI = { modern: 'Calibri', klasik: 'Times New Roman', arial: 'Arial' }
const GRI = '6B6B6B'
const CIZGI = 'A6A6A6'

const kenarYok = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const KENARSIZ = { top: kenarYok, bottom: kenarYok, left: kenarYok, right: kenarYok, insideHorizontal: kenarYok, insideVertical: kenarYok }
const ince = (renk = '000000', kalinlik = 6) => ({ style: BorderStyle.SINGLE, size: kalinlik, color: renk })
const CERCEVE = r => ({ top: ince(r), bottom: ince(r), left: ince(r), right: ince(r), insideHorizontal: ince(r), insideVertical: ince(r) })

// ------------------------------------------------------------------ HTML → Word metni
/**
 * Temizlenmiş HTML'i satırlara (paragraflara) ve biçimli metin parçalarına çevirir.
 * dönüş: [[{ metin, b, i, u, sup, sub, bosluk? }], ...]
 */
function satirlaraAyir(html) {
  const kok = new DOMParser().parseFromString(`<body>${temizle(html || '')}</body>`, 'text/html').body
  const satirlar = [[]]
  const son = () => satirlar[satirlar.length - 1]
  const kir = () => { if (son().length) satirlar.push([]) }
  const yurut = (dugum, b, liste) => {
    if (dugum.nodeType === 3) {
      const t = dugum.nodeValue.replace(/\s+/g, ' ')
      if (t && !(t === ' ' && !son().length)) son().push({ metin: t, ...b })
      return
    }
    if (dugum.nodeType !== 1) return
    const ad = dugum.tagName.toLowerCase()
    if (ad === 'br') { satirlar.push([]); return }
    if (ad === 'span' && dugum.classList.contains('bosluk')) { son().push({ bosluk: dugum.textContent.trim(), ...b }); return }
    const y = { ...b }
    if (ad === 'b' || ad === 'strong') y.b = true
    if (ad === 'i' || ad === 'em') y.i = true
    if (ad === 'u') y.u = true
    if (ad === 'sup') y.sup = true
    if (ad === 'sub') y.sub = true
    const st = dugum.getAttribute('style') || ''
    if (/font-weight:\s*(bold|[6-9]00)/.test(st)) y.b = true
    if (/font-style:\s*italic/.test(st)) y.i = true
    if (/text-decoration[^;]*underline/.test(st)) y.u = true
    const blok = ['div', 'p', 'li', 'ul', 'ol'].includes(ad)
    if (blok) kir()
    if (ad === 'ul' || ad === 'ol') {
      let n = 0
      for (const c of dugum.childNodes) {
        if (c.nodeType === 1 && c.tagName.toLowerCase() === 'li') {
          kir(); n++
          son().push({ metin: ad === 'ol' ? `${n}. ` : '•  ', ...y })
          for (const cc of c.childNodes) yurut(cc, y, true)
          kir()
        } else yurut(c, y, liste)
      }
      return
    }
    for (const c of dugum.childNodes) yurut(c, y, liste)
    if (blok) kir()
  }
  for (const c of kok.childNodes) yurut(c, {}, false)
  // baştaki / sondaki boşlukları ve boş satırları at
  const temiz = satirlar.map(s => {
    const k = s.slice()
    if (k[0]?.metin) k[0] = { ...k[0], metin: k[0].metin.replace(/^\s+/, '') }
    const z = k.length - 1
    if (k[z]?.metin) k[z] = { ...k[z], metin: k[z].metin.replace(/\s+$/, '') }
    return k.filter(p => p.bosluk !== undefined || p.metin)
  })
  while (temiz.length > 1 && !temiz[temiz.length - 1].length) temiz.pop()
  while (temiz.length > 1 && !temiz[0].length) temiz.shift()
  return temiz
}

/** Öğrenci kâğıdında boşluk: cevabın uzunluğuna göre alt çizgi (Word, Google Dokümanlar ve LibreOffice'te aynı görünür) */
const boslukCizgisi = cevap => '_'.repeat(Math.max(10, Math.min(30, Math.round((cevap || '').length * 1.15) + 7)))

function kosular(parcalar, ek = {}) {
  return parcalar.map(p => new TextRun({
    text: p.bosluk !== undefined ? boslukCizgisi(p.bosluk) : p.metin,
    bold: p.b || ek.bold || undefined,
    italics: p.i || ek.italics || undefined,
    underline: p.u ? {} : undefined,
    superScript: p.sup || undefined,
    subScript: p.sub || undefined,
    color: p.bosluk !== undefined ? '444444' : ek.color,
    size: ek.size,
  }))
}

// ------------------------------------------------------------------ yardımcılar
const bos = (secenek = {}) => new Paragraph({ children: [], ...secenek })

/** Hücre: kenarlıksız, içerik paragrafları */
const hucre = (children, genislikMm, s = {}) => new TableCell({
  children: children.length ? children : [bos()],
  width: { size: tw(genislikMm), type: WidthType.DXA },
  margins: { top: tw(0.4), bottom: tw(0.4), left: tw(s.sol ?? 0.8), right: tw(s.sag ?? 0.8) },
  verticalAlign: s.dikey || VerticalAlign.TOP,
  borders: s.kenar,
  shading: s.golge ? { type: ShadingType.CLEAR, fill: s.golge, color: 'auto' } : undefined,
  rowSpan: s.rowSpan,
  columnSpan: s.columnSpan,
})

const tablo = (satirlar, genislikler, s = {}) => new Table({
  rows: satirlar,
  columnWidths: genislikler.map(tw),
  width: { size: tw(genislikler.reduce((a, b) => a + b, 0)), type: WidthType.DXA },
  layout: TableLayoutType.FIXED,
  borders: s.kenar || KENARSIZ,
  indent: s.girinti ? { size: tw(s.girinti), type: WidthType.DXA } : undefined,
  alignment: s.hiza,
})

const satir = (hucreler, s = {}) => new TableRow({
  children: hucreler,
  cantSplit: true,
  height: s.yukseklik ? { value: tw(s.yukseklik), rule: s.tam ? HeightRule.EXACT : HeightRule.ATLEAST } : undefined,
})

// ------------------------------------------------------------------ belge kurucu
function kurucu(sinav, gorseller) {
  const a = sinav.ayar, bas = sinav.baslik
  const boy = Math.round((Number(a.yaziBoyutu) || 11) * 2)   // yarım punto
  const sutunSayisi = a.sutun === 2 ? 2 : 1
  const sutunMm = sutunSayisi === 2 ? (ICERIK_MM - SAYFA.sutunArasi) / 2 : ICERIK_MM
  const metinMm = sutunMm - GIRINTI_MM

  // ---------------- görsel
  function gorselKosusu(g, genislikMm, yan) {
    const v = g && gorseller.get(g.id)
    if (!v) return null
    const en = Math.max(8, Math.min(genislikMm, genislikMm * ((Number(g.genislik) || 50) / 100)))
    const w = px(en), h = w * (v.yukseklik / v.genislik)
    return new ImageRun({
      type: v.tur === 'image/png' ? 'png' : v.tur === 'image/gif' ? 'gif' : v.tur === 'image/bmp' ? 'bmp' : 'jpg',
      data: v.veri,
      transformation: { width: Math.round(w), height: Math.round(h) },
      floating: yan ? {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, align: HorizontalPositionAlign.RIGHT },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
        wrap: { type: TextWrappingType.SQUARE, side: TextWrappingSide.LEFT },
        margins: { left: tw(3) * 635, bottom: tw(1.5) * 635 },   // EMU (1 twip = 635 EMU)
      } : undefined,
      altText: { title: 'Görsel', description: 'Soru görseli', name: g.id },
    })
  }
  const hizaDon = h => (h === 'sol' ? AlignmentType.LEFT : h === 'sag' ? AlignmentType.RIGHT : AlignmentType.CENTER)

  // ---------------- başlık
  function baslikBloklari(grup, grupSayisi) {
    const sorular = grup.ogeler.filter(soruMu)
    const ikinci = [bas.ogretimYili && `${bas.ogretimYili} EĞİTİM-ÖĞRETİM YILI`, bas.sinif, bas.ders && `${bas.ders} DERSİ`].filter(Boolean).join(' ')
    const orta = [
      bas.okul && new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: bas.okul.toLocaleUpperCase('tr'), bold: true, size: boy + 1 })] }),
      ikinci && new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20 }, children: [new TextRun({ text: ikinci.toLocaleUpperCase('tr'), size: boy - 2 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: (bas.sinavAdi || 'SINAV').toLocaleUpperCase('tr'), bold: true, size: boy + 3 })] }),
    ].filter(Boolean)
    const grupG = 24
    const ust = grupSayisi > 1
      ? tablo([satir([
        hucre(orta, ICERIK_MM - grupG, { dikey: VerticalAlign.CENTER, sol: 2, sag: 2 }),
        hucre([
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: grup.harf, bold: true, size: 48 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GRUBU', bold: true, size: 14, characterSpacing: 20 })] }),
        ], grupG, { dikey: VerticalAlign.CENTER }),
      ], { yukseklik: 16 })], [ICERIK_MM - grupG, grupG], { kenar: CERCEVE('000000') })
      : tablo([satir([hucre(orta, ICERIK_MM, { dikey: VerticalAlign.CENTER, sol: 2, sag: 2 })], { yukseklik: 16 })], [ICERIK_MM], { kenar: CERCEVE('000000') })
    const bloklar = [ust]

    if (a.ogrenciBilgisi) {
      const g = [20, 62, 18, 22, 14, 22, 24]
      const th = (t, i) => hucre([new Paragraph({ children: [new TextRun({ text: t, bold: true, size: boy - 3 })] })], g[i], { dikey: VerticalAlign.CENTER, golge: 'F2F2F2', sol: 1.2 })
      const td = (i, t = '') => hucre([new Paragraph({ children: t ? [new TextRun({ text: t, size: boy - 2 })] : [] })], g[i], { dikey: VerticalAlign.CENTER, sol: 1.2 })
      const puanKutu = hucre([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PUAN', bold: true, size: 14, color: GRI })] })], g[6], { rowSpan: 2, dikey: VerticalAlign.TOP })
      const r1 = [th('Adı Soyadı', 0), td(1), th('Numarası', 2), td(3), th('Sınıfı', 4), td(5), puanKutu]
      const r2 = [th('Tarih', 0), td(1, bas.tarih), th('Süre', 2), td(3, bas.sure), th('İmza', 4), td(5)]
      bloklar.push(bos({ spacing: { after: 0, line: 100, lineRule: LineRuleType.EXACT } }))
      bloklar.push(tablo([satir(r1, { yukseklik: 7.5 }), satir(r2, { yukseklik: 7.5 })], g, { kenar: CERCEVE('000000') }))
    }

    if (a.puanTablosu && sorular.length) {
      for (let i = 0; i < sorular.length; i += 20) {
        const parca = sorular.slice(i, i + 20)
        const sonMu = i + 20 >= sorular.length
        const n = parca.length + (sonMu ? 1 : 0)
        const hucreG = (ICERIK_MM - 16) / Math.max(n, 10)
        const gen = [16, ...Array(n).fill(hucreG)]
        const k = (t, kalin) => hucre([new Paragraph({ alignment: AlignmentType.CENTER, children: t === '' ? [] : [new TextRun({ text: String(t), bold: kalin, size: boy - 4 })] })], hucreG, { dikey: VerticalAlign.CENTER, sol: 0.3, sag: 0.3 })
        const th = t => hucre([new Paragraph({ children: [new TextRun({ text: t, bold: true, size: boy - 4 })] })], 16, { dikey: VerticalAlign.CENTER, golge: 'F2F2F2' })
        const toplam = sorular.reduce((x, o) => x + (Number(o.puan) || 0), 0)
        bloklar.push(bos({ spacing: { after: 0, line: 100, lineRule: LineRuleType.EXACT } }))
        bloklar.push(tablo([
          satir([th('Soru'), ...parca.map(o => k(o.no, true)), ...(sonMu ? [k('Toplam', true)] : [])], { yukseklik: 5 }),
          satir([th('Puan'), ...parca.map(o => k(puanMetni(o.puan))), ...(sonMu ? [k(puanMetni(toplam), true)] : [])], { yukseklik: 5 }),
          satir([th('Alınan'), ...parca.map(() => k('')), ...(sonMu ? [k('')] : [])], { yukseklik: 7 }),
        ], gen, { kenar: CERCEVE('000000') }))
      }
    }

    if (bas.yonerge && satirlaraAyir(bas.yonerge).some(s => s.length)) {
      satirlaraAyir(bas.yonerge).forEach((s, i) => bloklar.push(new Paragraph({
        spacing: { before: i === 0 ? 120 : 0 },
        children: kosular(s, { italics: true, size: boy - 1 }),
      })))
    }
    bloklar.push(bos({ spacing: { after: 60 } }))
    return bloklar
  }

  // ---------------- sorular
  const sekmeler = [
    { type: TabStopType.LEFT, position: tw(GIRINTI_MM) },
    { type: TabStopType.RIGHT, position: tw(sutunMm) },
  ]

  /** Soru kökü: numara + metin (+ yan görsel) + puan. Sonraki bloklar bu paragraflara "keepNext" ile bağlanır. */
  function soruKoku(o) {
    const satirlar = satirlaraAyir(o.metin)
    const yan = o.gorsel && o.gorsel.konum === 'yan' ? gorselKosusu(o.gorsel, metinMm, true) : null
    const altGorsel = o.gorsel && o.gorsel.konum !== 'yan' ? gorselKosusu(o.gorsel, metinMm, false) : null
    const puan = a.puanGoster ? [new TextRun({ children: [new Tab(), `(${puanMetni(o.puan)} puan)`], italics: true, size: boy - 3, color: GRI })] : []
    const out = satirlar.map((s, i) => new Paragraph({
      keepNext: true, keepLines: true,
      tabStops: sekmeler,
      indent: { left: tw(GIRINTI_MM), hanging: i === 0 ? tw(GIRINTI_MM) : 0 },
      spacing: { before: i === 0 ? 160 : 0, after: 40 },
      children: [
        ...(i === 0 ? [new TextRun({ text: `${o.no}.`, bold: true }), new TextRun({ children: [new Tab()] })] : []),
        ...(i === 0 && yan ? [yan] : []),
        ...kosular(s),
        ...(i === satirlar.length - 1 ? puan : []),
      ],
    }))
    if (altGorsel) out.push(new Paragraph({ keepNext: true, alignment: hizaDon(o.gorsel.hiza), indent: { left: tw(GIRINTI_MM) }, spacing: { before: 60, after: 60, line: 240, lineRule: LineRuleType.AUTO }, children: [altGorsel] }))
    return out
  }

  /**
   * Soru bütün kalsın diye tüm paragraflar "sonrakiyle birlikte tut" işaretlidir; zinciri koparmak için
   * sorunun sonuna yüksekliği neredeyse sıfır bir paragraf eklenir (docx paragrafları sonradan değiştirilemez).
   */
  const kopar = liste => {
    liste.push(new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 40, lineRule: LineRuleType.EXACT } }))
    return liste
  }

  function coktan(o) {
    const out = soruKoku(o)
    const siklar = o.siklarSirali || o.siklar
    const d = sikDuzeni(o, a.sikDuzeni, sutunSayisi)
    const sikIcerik = (s, i, genislikMm, sonMu) => {
      const parcalar = satirlaraAyir(s.metin)
      const p = parcalar.map((ps, k) => new Paragraph({
        keepNext: !sonMu, keepLines: true,
        tabStops: [{ type: TabStopType.LEFT, position: tw(6) }],
        indent: { left: tw(6), hanging: k === 0 ? tw(6) : 0 },
        children: [...(k === 0 ? [new TextRun({ text: `${HARFLER[i]})`, bold: true }), new TextRun({ children: [new Tab()] })] : []), ...kosular(ps)],
      }))
      if (!p.length) p.push(new Paragraph({ children: [new TextRun({ text: `${HARFLER[i]})`, bold: true })] }))
      const g = s.gorsel && gorselKosusu(s.gorsel, genislikMm - 6, false)
      if (g) p.push(new Paragraph({ keepNext: !sonMu, indent: { left: tw(6) }, spacing: { before: 40, after: 40, line: 240, lineRule: LineRuleType.AUTO }, children: [g] }))
      return p
    }
    if (d === 'alt') {
      siklar.forEach((s, i) => {
        sikIcerik(s, i, metinMm, false).forEach(p => out.push(p))
      })
      out.push(new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 40, lineRule: LineRuleType.EXACT } }))
      return out
    }
    const kolon = d === 'yan' ? siklar.length : 2
    const hg = metinMm / kolon
    const satirlar = []
    for (let i = 0; i < siklar.length; i += kolon) {
      const hucreler = []
      for (let j = 0; j < kolon; j++) {
        const s = siklar[i + j]
        hucreler.push(hucre(s ? sikIcerik(s, i + j, hg, false) : [bos({ keepNext: true })], hg, { sol: 0, sag: 1.5 }))
      }
      satirlar.push(satir(hucreler))
    }
    out.push(tablo(satirlar, Array(kolon).fill(hg), { girinti: GIRINTI_MM }))
    out.push(new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 60, lineRule: LineRuleType.EXACT } }))
    return out
  }

  function dy(o) {
    const out = soruKoku(o)
    o.maddeler.forEach((m, i) => {
      const s = satirlaraAyir(m.metin)
      const sonMu = i === o.maddeler.length - 1
      s.forEach((ps, k) => out.push(new Paragraph({
        keepNext: !(sonMu && k === s.length - 1), keepLines: true,
        tabStops: [{ type: TabStopType.LEFT, position: tw(GIRINTI_MM + 9) }, { type: TabStopType.LEFT, position: tw(GIRINTI_MM + 15) }],
        indent: { left: tw(GIRINTI_MM + 15), hanging: k === 0 ? tw(15) : 0 },
        spacing: { after: 50 },
        children: [
          ...(k === 0 ? [new TextRun({ text: '(      )' }), new TextRun({ children: [new Tab(), `${kucukHarf(i)})`] }), new TextRun({ children: [new Tab()] })] : []),
          ...kosular(ps),
        ],
      })))
    })
    return out
  }

  function bosluk(o) {
    const out = soruKoku(o)
    if (o.havuz && o.havuzSirali?.length) {
      const kelimeler = []
      o.havuzSirali.forEach((k, i) => {
        if (i) kelimeler.push(new TextRun({ text: '   •   ', color: GRI }))
        kelimeler.push(new TextRun({ text: k, bold: true }))
      })
      out.push(tablo([satir([hucre([new Paragraph({ keepNext: true, children: kelimeler })], metinMm, { sol: 2.5, sag: 2.5 })])],
        [metinMm], { girinti: GIRINTI_MM, kenar: CERCEVE('000000') }))
      out.push(new Paragraph({ keepNext: true, children: [], spacing: { before: 0, after: 0, line: 80, lineRule: LineRuleType.EXACT } }))
    }
    o.cumleler.forEach((c, i) => {
      const s = satirlaraAyir(c.metin)
      const sonMu = i === o.cumleler.length - 1
      s.forEach((ps, k) => out.push(new Paragraph({
        keepNext: !(sonMu && k === s.length - 1), keepLines: true,
        tabStops: [{ type: TabStopType.LEFT, position: tw(GIRINTI_MM + 6) }],
        indent: { left: tw(GIRINTI_MM + 6), hanging: k === 0 ? tw(6) : 0 },
        spacing: { after: 70, line: 300 },
        children: [...(k === 0 ? [new TextRun({ text: `${kucukHarf(i)})` }), new TextRun({ children: [new Tab()] })] : []), ...kosular(ps)],
      })))
    })
    return out
  }

  function eslestirme(o) {
    const out = soruKoku(o)
    const sol = o.ciftler, sag = o.sagSirali || o.ciftler.map(c => ({ id: c.id, metin: c.sag }))
    const n = Math.max(sol.length, sag.length)
    const sabit = [11, 6, 6]
    const kalan = metinMm - sabit.reduce((x, y) => x + y, 0)
    const gen = [sabit[0], sabit[1], kalan * 0.5, sabit[2], kalan * 0.5]
    const p = (parcalar, s = {}) => new Paragraph({ keepNext: true, children: parcalar, ...s })
    const html = h => satirlaraAyir(h).map(ps => p(kosular(ps)))
    const satirlar = []
    for (let i = 0; i < n; i++) {
      satirlar.push(satir([
        hucre([p(sol[i] ? [new TextRun('(      )')] : [])], gen[0], { sol: 0 }),
        hucre([p(sol[i] ? [new TextRun({ text: `${i + 1}.`, bold: true })] : [])], gen[1], { sol: 0 }),
        hucre(sol[i] ? html(sol[i].sol) : [], gen[2]),
        hucre([p(sag[i] ? [new TextRun({ text: `${kucukHarf(i)})`, bold: true })] : [])], gen[3], { sol: 1.5 }),
        hucre(sag[i] ? html(sag[i].metin) : [], gen[4]),
      ], { yukseklik: 6.5 }))
    }
    out.push(tablo(satirlar, gen, { girinti: GIRINTI_MM }))
    out.push(new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 60, lineRule: LineRuleType.EXACT } }))
    return out
  }

  function klasik(o) {
    const out = soruKoku(o)
    const n = Number(o.satir) || 0
    if (n > 0 && o.alan !== 'bos') {
      const cizgi = { style: BorderStyle.DOTTED, size: 6, color: CIZGI }
      const kenar = { top: kenarYok, left: kenarYok, right: kenarYok, bottom: cizgi, insideHorizontal: cizgi, insideVertical: kenarYok }
      out.push(tablo(Array.from({ length: n }, () => satir([hucre([bos({ keepNext: true })], metinMm)], { yukseklik: 8, tam: true })), [metinMm], { girinti: GIRINTI_MM, kenar }))
      out.push(new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 60, lineRule: LineRuleType.EXACT } }))
    } else if (n > 0) {
      out.push(new Paragraph({ children: [], spacing: { before: 0, after: tw(n * 8) } }))
    } else {
      kopar(out)
    }
    return out
  }

  function bolum(o) {
    const out = satirlaraAyir(o.metin || '').map((s, i) => new Paragraph({
      keepNext: true, keepLines: true,
      spacing: { before: i === 0 ? 240 : 0, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 2 } },
      children: kosular(s, { bold: true, size: boy + 1 }),
    }))
    if (o.aciklama) satirlaraAyir(o.aciklama).forEach(s => out.push(new Paragraph({ keepNext: true, spacing: { after: 60 }, children: kosular(s, { italics: true, size: boy - 1 }) })))
    return out
  }

  const OGE = { coktan, dy, bosluk, eslestirme, klasik, bolum }
  const ogeBloklari = o => (OGE[o.tur] || klasik)(o)

  // ---------------- alt bilgi
  function altBilgi(grup, grupSayisi, toplamTuru) {
    const ogretmen = (bas.ogretmen || '').trim()      // kâğıtta "Öğretmen:" yazmaz, yalnızca ad soyad
    const sag = []
    if (grupSayisi > 1) sag.push(new TextRun({ text: `${grup.harf} grubu`, bold: true, size: 16 }))
    if (a.sayfaNo) {
      if (sag.length) sag.push(new TextRun({ text: '   ', size: 16 }))
      const toplam = toplamTuru === 'belge' ? [' / ', PageNumber.TOTAL_PAGES] : []
      sag.push(new TextRun({ children: ['Sayfa ', PageNumber.CURRENT, ...toplam], size: 16, color: GRI }))
    }
    return new Footer({
      children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: tw(ICERIK_MM) }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 } },
        children: [
          ...(a.altBilgi ? [new TextRun({ text: a.altBilgi, italics: true, size: 16, color: GRI })] : []),
          ...(ogretmen ? [new TextRun({ text: (a.altBilgi ? '    ' : '') + ogretmen, bold: true, size: 16, color: '333333' })] : []),
          new TextRun({ children: [new Tab()] }), ...sag,
        ],
      })],
    })
  }

  // ---------------- devam sayfalarının üst bilgisi (ilk sayfada büyük başlık olduğu için boş)
  function ustBilgi(grup, grupSayisi) {
    const ad = [bas.ders, bas.sinavAdi].filter(Boolean).join(' · ')
    return new Header({
      children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: tw(ICERIK_MM) }],
        children: [
          new TextRun({ text: ad, size: 15, color: GRI }),
          ...(grupSayisi > 1 ? [new TextRun({ children: [new Tab()] }), new TextRun({ text: `${grup.harf} grubu`, bold: true, size: 17 })] : []),
        ],
      })],
    })
  }
  const bosUst = () => new Header({ children: [new Paragraph({ children: [] })] })

  return { baslikBloklari, ogeBloklari, altBilgi, ustBilgi, bosUst, sutunSayisi, boy }
}

// ------------------------------------------------------------------ cevap anahtarı
function anahtarBolumu(sinav, gruplar, boy) {
  const b = sinav.baslik
  const alt = [b.okul, [b.sinif, b.ders, b.sinavAdi].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')
  const out = [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: tw(ICERIK_MM) }],
      children: [new TextRun({ text: 'CEVAP ANAHTARI', bold: true, size: 32 }), new TextRun({ children: [new Tab(), 'Öğretmen nüshası'], italics: true, size: 16, color: GRI })],
    }),
    new Paragraph({
      spacing: { after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 4 } },
      children: [new TextRun({ text: alt || 'Sınav', size: boy - 2, color: '404040' })],
    }),
  ]
  for (const g of gruplar) {
    const coktan = g.anahtar.filter(x => x.tur === 'coktan')
    const diger = g.anahtar.filter(x => x.tur !== 'coktan')
    const toplam = g.anahtar.reduce((t, x) => t + (Number(x.puan) || 0), 0)
    out.push(new Paragraph({
      keepNext: true, spacing: { before: 200, after: 80 },
      tabStops: [{ type: TabStopType.RIGHT, position: tw(ICERIK_MM) }],
      shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' },
      children: [
        new TextRun({ text: gruplar.length > 1 ? ` ${g.harf} GRUBU` : ' CEVAPLAR', bold: true, size: boy + 1 }),
        new TextRun({ children: [new Tab(), `${g.anahtar.length} soru · ${puanMetni(toplam)} puan `], size: boy - 3, color: GRI }),
      ],
    }))
    if (coktan.length) {
      const k = 10, gen = ICERIK_MM / k
      const satirlar = []
      for (let i = 0; i < coktan.length; i += k) {
        const parca = coktan.slice(i, i + k)
        satirlar.push(satir(Array.from({ length: k }, (_, j) => {
          const x = parca[j]
          return hucre(x ? [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(x.no), size: 14, color: GRI })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: x.kisa, bold: true, size: 26 })] }),
          ] : [bos()], gen, { dikey: VerticalAlign.CENTER })
        })))
      }
      out.push(tablo(satirlar, Array(k).fill(gen), { kenar: CERCEVE('BFBFBF') }))
      if (coktan.length === g.anahtar.length) {
        out.push(new Paragraph({
          spacing: { before: 100 },
          children: [new TextRun({ text: 'Optik anahtar: ', size: boy - 3, color: GRI }), new TextRun({ text: coktan.map(x => x.kisa).join(''), font: 'Consolas', bold: true, size: boy - 1 })],
        }))
      }
    }
    if (diger.length) {
      if (coktan.length) out.push(bos({ spacing: { after: 80 } }))
      const gen = [12, ICERIK_MM - 12 - 16, 16]
      const th = (t, g2, hiza) => hucre([new Paragraph({ alignment: hiza, children: [new TextRun({ text: t, bold: true, size: boy - 3 })] })], g2, { golge: 'F2F2F2', sol: 1.5 })
      const satirlar = [satir([th('No', gen[0], AlignmentType.CENTER), th('Cevap', gen[1]), th('Puan', gen[2], AlignmentType.CENTER)])]
      for (const x of diger) {
        const cevap = x.acik
          ? (x.uzun ? x.uzun.split('\n').map(s => new Paragraph({ children: [new TextRun({ text: s, size: boy - 1 })] })) : [new Paragraph({ children: [new TextRun({ text: 'Açık uçlu — örnek cevap girilmemiş', italics: true, color: GRI, size: boy - 2 })] })])
          : [new Paragraph({ children: [new TextRun({ text: x.uzun || '—', size: boy - 1 })] })]
        if (x.konu) cevap.push(new Paragraph({ children: [new TextRun({ text: x.konu, italics: true, size: 15, color: GRI })] }))
        satirlar.push(satir([
          hucre([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(x.no), bold: true })] })], gen[0]),
          hucre(cevap, gen[1], { sol: 1.5 }),
          hucre([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(puanMetni(x.puan))] })], gen[2]),
        ]))
      }
      out.push(tablo(satirlar, gen, { kenar: CERCEVE('BFBFBF') }))
    }
  }
  return out
}

// ------------------------------------------------------------------ ana işlev
/**
 * @param sinav  sınav kaydı
 * @param secim  { gruplar: [grup indeksleri], anahtar: cevap anahtarı eklensin mi }
 * @returns Blob (.docx)
 */
export async function wordOlustur(sinav, secim = {}) {
  const hepsi = tumGruplar(sinav)
  const secili = (secim.gruplar && secim.gruplar.length ? secim.gruplar : hepsi.map((_, i) => i)).map(i => hepsi[i]).filter(Boolean)
  const grupSayisi = hepsi.length

  // görseller önce belleğe alınır
  const gorseller = new Map()
  await Promise.all([...gorselKimlikleri(sinav)].map(async id => {
    try { const v = await gorselBaytlari(id); if (v && v.genislik && v.yukseklik) gorseller.set(id, v) } catch { /* görsel yoksa atlanır */ }
  }))

  const k = kurucu(sinav, gorseller)
  const a = sinav.ayar
  const sayfa = {
    size: { width: tw(SAYFA.g), height: tw(SAYFA.y) },
    margin: { top: tw(SAYFA.ust), bottom: tw(SAYFA.alt + SAYFA.altbilgi), left: tw(SAYFA.sol), right: tw(SAYFA.sag), header: tw(6), footer: tw(5), gutter: 0 },
  }
  const tekParca = secili.length === 1 && !secim.anahtar
  // "Sayfa 2 / 3": toplam yalnızca belge tek grup olduğunda yazılır (bölüm sayfa sayısı alanını her program desteklemiyor)
  const toplamTuru = tekParca ? 'belge' : 'yok'

  const bolumler = []
  for (const g of secili) {
    const altb = k.altBilgi(g, grupSayisi, toplamTuru)
    const ustb = { default: k.ustBilgi(g, grupSayisi), first: k.bosUst() }
    const baslik = k.baslikBloklari(g, grupSayisi)
    const govde = g.ogeler.flatMap(o => k.ogeBloklari(o))
    if (k.sutunSayisi === 1) {
      bolumler.push({
        properties: { type: SectionType.NEXT_PAGE, titlePage: true, page: { ...sayfa, pageNumbers: { start: 1 } } },
        headers: ustb,
        footers: { default: altb, first: altb },
        children: [...baslik, ...govde],
      })
    } else {
      bolumler.push({
        properties: { type: SectionType.NEXT_PAGE, titlePage: true, page: { ...sayfa, pageNumbers: { start: 1 } } },
        headers: ustb,
        footers: { default: altb, first: altb },
        children: baslik,
      })
      bolumler.push({
        properties: { type: SectionType.CONTINUOUS, page: sayfa, column: { count: 2, space: tw(SAYFA.sutunArasi), separate: true, equalWidth: true } },
        headers: { default: k.ustBilgi(g, grupSayisi) },
        footers: { default: altb },
        children: govde.length ? govde : [bos()],
      })
    }
  }
  if (secim.anahtar) {
    bolumler.push({
      properties: { type: SectionType.NEXT_PAGE, page: { ...sayfa, pageNumbers: { start: 1 } } },
      headers: { default: k.bosUst() },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Cevap anahtarı — öğrencilere dağıtılmaz', italics: true, size: 16, color: GRI })] })] }),
      },
      children: anahtarBolumu(sinav, hepsi.filter((_, i) => !secim.gruplar?.length || secim.gruplar.includes(i)), k.boy),
    })
  }
  if (!bolumler.length) bolumler.push({ properties: { page: sayfa }, children: [bos()] })

  const b = sinav.baslik
  const doc = new Document({
    creator: b.ogretmen || 'Optik Okuyucu — Sınav Hazırla',
    title: [b.ders, b.sinavAdi].filter(Boolean).join(' — ') || 'Sınav',
    description: 'Sınav Hazırla ile oluşturuldu',
    styles: {
      default: {
        document: {
          run: { font: YAZI_TIPI[a.yaziTipi] || 'Calibri', size: k.boy, language: { value: 'tr-TR' } },
          paragraph: { spacing: { after: 0, line: 264, lineRule: LineRuleType.AUTO } },
        },
      },
    },
    sections: bolumler,
  })
  return Packer.toBlob(doc)
}

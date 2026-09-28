/*
 * Sınav hazırlama: veri modeli (arayüzden bağımsız, test edilebilir).
 *
 * Sinav = { id, surum, olusturma, guncelleme, baslik, ayar, ogeler: [Oge] }
 * Oge türleri:
 *   bolum      : bölüm başlığı / yönerge (numarasız)
 *   coktan     : çoktan seçmeli (2-5 şık, tek doğru)
 *   dy         : doğru / yanlış (maddeler)
 *   bosluk     : boşluk doldurma (cümleler; boşluklar <span class="bosluk">cevap</span>)
 *   eslestirme : eşleştirme (sol-sağ çiftleri + çeldiriciler)
 *   klasik     : açık uçlu / kısa cevaplı (cevap alanı satır sayısı, örnek cevap)
 * Metin alanları sınırlı HTML içerir (b, i, u, sup, sub, br, div, ul/ol/li, span.bosluk) — bkz. metin.js
 */

import { duzMetin } from './metin.js'

export const SURUM = 1
export const HARFLER = 'ABCDE'
/** Gruplar A, B, C, D (optik formdaki kitapçık türleriyle aynı): tek grup ya da 2, 3, 4 grup */
export const GRUP_HARFLERI = 'ABCD'
export const MAKS_GRUP = GRUP_HARFLERI.length
/** Optik formdaki kitapçık türü sayısı (A, B, C, D) */
export const OPTIK_KITAPCIK = 4
export const grupSayisiSinirla = n => Math.max(1, Math.min(MAKS_GRUP, Math.round(Number(n) || 1)))
/** "A", "A–B", "A–F" gibi */
export const grupAraligi = n => (n <= 1 ? 'A' : `A–${GRUP_HARFLERI[grupSayisiSinirla(n) - 1]}`)

export const TURLER = {
  coktan: { ad: 'Çoktan seçmeli', kisa: 'Test', simge: 'liste', aciklama: 'A–E şıklı, tek doğru cevaplı' },
  dy: { ad: 'Doğru / Yanlış', kisa: 'D / Y', simge: 'dy', aciklama: 'İfadelerin doğru ya da yanlış olduğu' },
  bosluk: { ad: 'Boşluk doldurma', kisa: 'Boşluk', simge: 'bosluk', aciklama: 'Cümlelerdeki boşluklar, isteğe bağlı kelime havuzu' },
  eslestirme: { ad: 'Eşleştirme', kisa: 'Eşleştirme', simge: 'eslestirme', aciklama: 'İki sütundaki öğeleri eşleştirme' },
  klasik: { ad: 'Açık uçlu (klasik)', kisa: 'Klasik', simge: 'kalem', aciklama: 'Yazılı cevap, çizgili cevap alanı' },
  bolum: { ad: 'Bölüm başlığı', kisa: 'Bölüm', simge: 'baslik', aciklama: 'Yönerge / bölüm ayracı (numarasız)' },
}

export const yeniId = () => {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 12) } catch { /* yok */ }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function varsayilanBaslik(profil = {}) {
  const y = new Date().getFullYear(), ay = new Date().getMonth()
  const ogretimYili = ay >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
  return {
    okul: profil.okul || '',
    ogretimYili: profil.ogretimYili || ogretimYili,
    ders: profil.ders || '',
    sinif: '',
    sinavAdi: '',
    tarih: '',
    sure: '',
    ogretmen: profil.ogretmen || '',
    yonerge: '',
    logoSol: null,          // { id } — okul / kurum logosu (başlığın solunda)
    logoSag: null,          // { id } — ikinci logo (örn. MEB / üniversite), başlığın sağında
  }
}

export function varsayilanAyar() {
  return {
    grupSayisi: 1,
    soruKaristir: true,
    sikKaristir: true,
    tohum: Math.floor(Math.random() * 1e9),
    sutun: 1,
    yaziTipi: 'modern',     // modern | klasik | arial
    yaziBoyutu: 11,         // pt
    puanGoster: true,
    ogrenciBilgisi: true,
    puanTablosu: false,
    altBilgi: 'Başarılar dilerim.',
    sayfaNo: true,
    sikDuzeni: 'oto',       // oto | alt | iki | yan
  }
}

const sik = (metin = '') => ({ id: yeniId(), metin, gorsel: null })

export function yeniOge(tur, sec = {}) {
  const temel = { id: yeniId(), tur, puan: sec.puan ?? 0, konu: '' }
  switch (tur) {
    case 'coktan':
      return { ...temel, metin: sec.metin || '', gorsel: null, siklar: Array.from({ length: sec.sikSayisi || 4 }, () => sik()), dogru: null, sikKilit: false, duzen: 'oto' }
    case 'dy':
      return { ...temel, metin: sec.metin ?? 'Aşağıdaki ifadelerden doğru olanların başına <b>D</b>, yanlış olanların başına <b>Y</b> yazınız.', maddeler: Array.from({ length: sec.adet || 4 }, () => ({ id: yeniId(), metin: '', dogru: true })) }
    case 'bosluk':
      return { ...temel, metin: sec.metin ?? 'Aşağıdaki cümlelerde boş bırakılan yerlere uygun kelimeleri yazınız.', cumleler: Array.from({ length: sec.adet || 4 }, () => ({ id: yeniId(), metin: '' })), havuz: true, ekKelimeler: '' }
    case 'eslestirme':
      return { ...temel, metin: sec.metin ?? 'Aşağıdaki kavramları doğru açıklamalarla eşleştiriniz.', ciftler: Array.from({ length: sec.adet || 4 }, () => ({ id: yeniId(), sol: '', sag: '' })), ekSag: '' }
    case 'klasik':
      return { ...temel, metin: sec.metin || '', gorsel: null, satir: sec.satir ?? 6, alan: 'cizgili', cevap: '' }
    case 'bolum':
      return { id: temel.id, tur, metin: sec.metin || '', aciklama: sec.aciklama || '' }
    default:
      throw new Error('bilinmeyen soru türü: ' + tur)
  }
}

/** Yeni sınav. sablon: 'test' | 'yazili' | 'karma' | 'bos' */
export function yeniSinav({ sablon = 'bos', soruSayisi = 10, sikSayisi = 4, grupSayisi = 1, baslik = {}, profil = {} } = {}) {
  const n = Math.max(1, Math.min(100, Number(soruSayisi) || 10))
  let ogeler = []
  if (sablon === 'test') {
    ogeler = Array.from({ length: n }, () => yeniOge('coktan', { sikSayisi }))
  } else if (sablon === 'yazili') {
    ogeler = Array.from({ length: n }, () => yeniOge('klasik'))
  } else if (sablon === 'karma') {
    ogeler = [
      yeniOge('bolum', { metin: 'A) Doğru – Yanlış' }),
      yeniOge('dy', { adet: 5 }),
      yeniOge('bolum', { metin: 'B) Boşluk doldurma' }),
      yeniOge('bosluk', { adet: 5 }),
      yeniOge('bolum', { metin: 'C) Eşleştirme' }),
      yeniOge('eslestirme', { adet: 5 }),
      yeniOge('bolum', { metin: 'D) Çoktan seçmeli sorular' }),
      ...Array.from({ length: Math.min(n, 40) }, () => yeniOge('coktan', { sikSayisi })),
      yeniOge('bolum', { metin: 'E) Açık uçlu sorular' }),
      yeniOge('klasik'), yeniOge('klasik'),
    ]
  }
  ogeler = puanlariDagit(ogeler, 100)
  const ayar = varsayilanAyar()
  ayar.grupSayisi = grupSayisiSinirla(grupSayisi)
  const simdi = Date.now()
  return { id: yeniId(), surum: SURUM, olusturma: simdi, guncelleme: simdi, baslik: { ...varsayilanBaslik(profil), ...baslik }, ayar, ogeler }
}

export const soruMu = o => o.tur !== 'bolum'

/** Öğe id -> soru numarası (bölümler numarasız) */
export function numaralar(ogeler) {
  const m = new Map()
  let n = 0
  for (const o of ogeler) if (soruMu(o)) m.set(o.id, ++n)
  return m
}

export const soruSayisi = ogeler => ogeler.filter(soruMu).length
export const toplamPuan = ogeler => yuvarla(ogeler.filter(soruMu).reduce((a, o) => a + (Number(o.puan) || 0), 0))
export const yuvarla = (x, h = 2) => Math.round((x + Number.EPSILON) * 10 ** h) / 10 ** h
/** Kâğıtta ve ekranda puan: en çok iki ondalık, Türkçe virgül (8,33) */
export const puanMetni = p => yuvarla(Number(p) || 0, 2).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
/** Yalnızca çoktan seçmeli sorulardan oluşan sınav (optik formla okunabilecek tür) */
export const testMi = ogeler => { const s = ogeler.filter(soruMu); return s.length > 0 && s.every(o => o.tur === 'coktan') }

/**
 * Puanları eşit dağıtır.
 *  - Test (yalnız çoktan seçmeli): her soru tam olarak eşit puan alır (100 / 12 = 8,3333…). Optik okuyucu da
 *    her soruyu eşit sayar; kâğıttaki puan ile optiğin hesapladığı puan birebir aynı olur.
 *  - Karma / yazılı: her soruya tam sayı puan; artan puan son sorulara birer birer eklenir (4 x 10 + 3 x 20 = 100).
 */
export function puanlariDagit(ogeler, toplam = 100, esit = testMi(ogeler)) {
  const sorular = ogeler.filter(soruMu)
  const n = sorular.length
  if (!n) return ogeler
  if (esit || !Number.isInteger(toplam)) {
    const p = yuvarla(toplam / n, 4)
    return ogeler.map(o => (soruMu(o) ? { ...o, puan: p } : o))
  }
  const taban = Math.floor(toplam / n)
  let artan = toplam - taban * n
  const puan = new Map()
  // artan puanı sondaki sorulara ver (genelde zor / açık uçlu sorular sondadır)
  for (let i = n - 1; i >= 0; i--) {
    puan.set(sorular[i].id, taban + (artan > 0 ? 1 : 0))
    if (artan > 0) artan--
  }
  return ogeler.map(o => (puan.has(o.id) ? { ...o, puan: puan.get(o.id) } : o))
}

/** Öğeyi başka türe dönüştürür (metin ve puan korunur) */
export function turDegistir(o, tur) {
  if (o.tur === tur) return o
  const y = yeniOge(tur, { puan: o.puan })
  y.id = o.id
  if (tur !== 'bolum' && o.tur !== 'bolum') y.metin = o.metin
  else if (tur === 'bolum') y.metin = o.metin || ''
  if ('gorsel' in y && o.gorsel) y.gorsel = o.gorsel
  if (o.konu) y.konu = o.konu
  return y
}

/** Derin kopya + yeni kimlikler (soruyu çoğaltırken) */
export function ogeKopyala(o) {
  const k = JSON.parse(JSON.stringify(o))
  k.id = yeniId()
  for (const a of ['siklar', 'maddeler', 'cumleler', 'ciftler']) if (Array.isArray(k[a])) k[a] = k[a].map(x => ({ ...x, id: yeniId() }))
  if (o.tur === 'coktan' && o.dogru) {
    const i = o.siklar.findIndex(s => s.id === o.dogru)
    k.dogru = i >= 0 ? k.siklar[i].id : null
  }
  return k
}

/** Kullanılan tüm görsel kimlikleri */
export function gorselKimlikleri(sinav) {
  const s = new Set()
  for (const t of ['logoSol', 'logoSag']) if (sinav.baslik && sinav.baslik[t] && sinav.baslik[t].id) s.add(sinav.baslik[t].id)
  for (const o of sinav.ogeler) {
    if (o.gorsel && o.gorsel.id) s.add(o.gorsel.id)
    if (o.siklar) for (const k of o.siklar) if (k.gorsel && k.gorsel.id) s.add(k.gorsel.id)
  }
  return s
}

/** Sınav adını tek satırda */
export function sinavBaslikMetni(b) {
  const parca = [b.sinif, b.ders && `${b.ders}`, b.sinavAdi].filter(Boolean)
  return parca.join(' · ') || 'Adsız sınav'
}

/**
 * Hazırlanan sınavdaki eksikler (önizlemede ve optiğe aktarımda uyarı olarak gösterilir).
 * dönüş: [{ id, no, mesaj, agir }]
 */
export function eksikler(sinav, duz = s => s) {
  const no = numaralar(sinav.ogeler)
  const e = []
  const bos = h => !duz(h || '').trim()
  for (const o of sinav.ogeler) {
    const n = no.get(o.id)
    if (o.tur === 'coktan') {
      if (bos(o.metin) && !o.gorsel) e.push({ id: o.id, no: n, mesaj: `${n}. soruda soru metni boş` })
      if (!o.dogru) e.push({ id: o.id, no: n, mesaj: `${n}. sorunun doğru cevabı işaretlenmemiş`, agir: true })
      const bosSik = o.siklar.filter(s => bos(s.metin) && !s.gorsel).length
      if (bosSik) e.push({ id: o.id, no: n, mesaj: `${n}. soruda ${bosSik} boş şık var` })
    } else if (o.tur === 'dy') {
      if (!o.maddeler.length || o.maddeler.some(m => bos(m.metin))) e.push({ id: o.id, no: n, mesaj: `${n}. sorudaki ifadelerden biri boş` })
    } else if (o.tur === 'bosluk') {
      if (!o.cumleler.length || o.cumleler.some(c => !/class="bosluk"/.test(c.metin || ''))) e.push({ id: o.id, no: n, mesaj: `${n}. soruda boşluğu işaretlenmemiş cümle var` })
    } else if (o.tur === 'eslestirme') {
      if (!o.ciftler.length || o.ciftler.some(c => bos(c.sol) || bos(c.sag))) e.push({ id: o.id, no: n, mesaj: `${n}. sorudaki eşleştirmelerden biri eksik` })
    } else if (o.tur === 'klasik') {
      if (bos(o.metin) && !o.gorsel) e.push({ id: o.id, no: n, mesaj: `${n}. soruda soru metni boş` })
    }
  }
  return e
}

/**
 * Çoktan seçmeli şıkların kâğıttaki yerleşimi: 'alt' (alt alta) | 'iki' (iki sütun) | 'yan' (tek satırda yan yana)
 * Otomatikte şık uzunluğuna ve sayfa sütun sayısına göre seçilir.
 */
export function sikDuzeni(o, varsayilan = 'oto', sutun = 1) {
  if (o.duzen && o.duzen !== 'oto') return o.duzen
  if (varsayilan && varsayilan !== 'oto') return varsayilan
  const gorselli = o.siklar.some(s => s.gorsel)
  if (gorselli) return o.siklar.length > 3 ? 'iki' : 'yan'
  const uz = Math.max(0, ...o.siklar.map(s => duzMetin(s.metin).length))
  const k = sutun === 2 ? 0.5 : 1
  if (uz <= 11 * k * (5 / Math.max(3, o.siklar.length))) return 'yan'
  if (uz <= 32 * k) return 'iki'
  return 'alt'
}

/*
 * Gruplar (A, B, C, D): aynı sınavın karıştırılmış sürümleri ve cevap anahtarları.
 *
 *  - A grubu öğretmenin yazdığı sıradadır.
 *  - B, C, D: (ayar açıksa) sorular kendi bölümleri içinde karıştırılır, bölüm başlıkları yerinde kalır;
 *    çoktan seçmeli şıklar karıştırılır ("şıkları sabitle" işaretli sorular hariç).
 *  - Eşleştirmenin sağ sütunu ve boşluk doldurmanın kelime havuzu her grupta (A dahil) karıştırılır;
 *    yoksa cevaplar sıradan okunurdu.
 *  - Karıştırma tohuma bağlıdır: aynı sınav her açılışta aynı grupları üretir. "Yeniden karıştır" tohumu değiştirir.
 *
 * Karıştırma sürümü (ayar.karistirma):
 *  1 (eski sınavlar, alan yok): grubun sırası A'dan ve önceki gruplardan farklı; tek tek sorular yerinde kalabilir.
 *  2 (yeni sınavlar ve "Yeniden karıştır"): her soru mümkünse A'daki ve önceki gruplardaki yerinden başka yere gider,
 *    her sorunun doğru şıkkı mümkünse her grupta başka harfe düşer, diğer şıklar da yer değiştirir.
 *  Basılmış eski bir sınavın grupları (ve optiğe aktarılan anahtarları) değişmesin diye eski sınavlar 1'de kalır.
 */
import { GRUP_HARFLERI, HARFLER, soruMu, grupSayisiSinirla } from './model.js'

function karma(...parcalar) {
  let h = 2166136261 >>> 0
  for (const p of parcalar) {
    const s = String(p)
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
    h ^= 0x9e3779b9; h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function rastgele(tohum) {
  let a = tohum >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function karistir(dizi, r) {
  const a = [...dizi]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const ayniSira = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/** Sırayı karıştırır; mümkünse başlangıç sırasından (ve verilen yasak sıralardan) farklı olur. */
function farkliKaristir(dizi, tohum, yasaklar = []) {
  if (dizi.length < 2) return [...dizi]
  let en = null
  for (let deneme = 0; deneme < 24; deneme++) {
    const s = karistir(dizi, rastgele(karma(tohum, deneme)))
    if (ayniSira(s, dizi)) continue
    if (!yasaklar.some(y => ayniSira(y, s))) return s
    en = en || s
  }
  return en || [...dizi].reverse()
}

/** g. grubun sırası: 1..g grupları sırayla üretilir, her biri öncekilerden farklı olur */
function grupSirasi(ids, anahtar, g) {
  const siralar = []
  for (let k = 1; k <= g; k++) siralar.push(farkliKaristir(ids, karma(...anahtar, k), siralar))
  return siralar[g - 1]
}

// ------------------------------------------------------------------ sürüm 2: yer değişimi garantili karıştırma

/** n ≤ 6 için tüm sıralamalar (şıklar, küçük bölümler) */
function tumSiralar(n) {
  if (n <= 1) return [[...Array(n).keys()]]
  const sonuc = []
  for (const alt of tumSiralar(n - 1)) for (let i = 0; i <= alt.length; i++) sonuc.push([...alt.slice(0, i), n - 1, ...alt.slice(i)])
  return sonuc
}

/**
 * Önceki sıralarla (A ve önceki gruplar) çakışmayı en aza indiren sıra.
 * ceza(s): 0 en iyi. Küçük dizilerde tüm sıralar (tohuma göre karışık sırayla) denenir, büyüklerde 400 rastgele deneme.
 */
function enIyiSira(dizi, tohum, ceza) {
  const n = dizi.length
  if (n < 2) return [...dizi]
  let en = null, enCeza = Infinity
  const dene = s => {
    const c = ceza(s)
    if (c < enCeza) { en = s; enCeza = c }
    return c === 0
  }
  if (n <= 6) {
    const adaylar = karistir(tumSiralar(n), rastgele(karma(tohum, 'hepsi')))
    for (const p of adaylar) if (dene(p.map(i => dizi[i]))) break
  } else {
    for (let d = 0; d < 400; d++) if (dene(karistir(dizi, rastgele(karma(tohum, d))))) break
  }
  return en
}

/** Aynı yerde kalan öğe sayısı (her önceki sıra için ayrı sayılır) */
const cakisma = (s, onceki) => onceki.reduce((t, o) => t + s.reduce((u, x, i) => u + (o[i] === x ? 1 : 0), 0), 0)

// Aynı sıralar her çizimde yeniden aranmasın (yazarken soru metni değişir, kimlikler değişmez)
const onbellek = new Map()
function siralarAl(anahtar, ids, g, ceza) {
  const k = anahtar.join('|') + '#' + ids.join(',')
  let siralar = onbellek.get(k)
  if (!siralar) {
    if (onbellek.size > 4000) onbellek.clear()
    siralar = [ids]
    onbellek.set(k, siralar)
  }
  while (siralar.length <= g) {
    const onceki = [...siralar]
    siralar.push(enIyiSira(ids, karma(...anahtar, siralar.length), s => ceza(s, onceki)))
  }
  return siralar[g]
}

/** Soru sırası (sürüm 2): g. grup; her soru mümkünse A'daki ve önceki gruplardaki yerinden başka yerde */
function grupSirasi2(ids, anahtar, g) {
  return siralarAl(anahtar, ids, g, (s, onceki) => cakisma(s, onceki) + (onceki.some(o => ayniSira(o, s)) ? 1000 : 0))
}

/** Şık sırası (sürüm 2): doğru şık mümkünse her grupta başka harfte; diğer şıklar da mümkünse yer değiştirir */
function sikSirasi2(ids, dogru, anahtar, g) {
  return siralarAl([...anahtar, dogru ?? '-'], ids, g, (s, onceki) => {
    const d = dogru != null ? s.indexOf(dogru) : -1
    const dogruCakisma = d >= 0 ? onceki.filter(o => o[d] === dogru).length : 0
    return 100 * dogruCakisma + cakisma(s, onceki) + (onceki.some(o => ayniSira(o, s)) ? 1000 : 0)
  })
}

/** Eşleştirme sağ sütunu: hiçbir öğe kendi hizasında kalmasın (mümkünse) */
function duzensizKaristir(dizi, tohum) {
  if (dizi.length < 2) return [...dizi]
  for (let deneme = 0; deneme < 40; deneme++) {
    const s = karistir(dizi, rastgele(karma(tohum, 'd', deneme)))
    if (s.every((x, i) => x !== dizi[i])) return s
  }
  return [...dizi.slice(1), dizi[0]]
}

/** Metindeki boşluk cevapları (sırasıyla) */
export function bosluklar(html) {
  const c = []
  const re = /<span class="bosluk"[^>]*>([\s\S]*?)<\/span>/g
  let m
  while ((m = re.exec(html || ''))) c.push(m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim())
  return c
}

const virgulle = s => String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean)

/**
 * Bir grubun sürümü.
 * dönüş: { harf, g, ogeler: [{ ...oge, no, siklarSirali?, dogruHarf?, sagSirali?, havuzSirali? }], anahtar: [...] }
 */
export function grupOlustur(sinav, g = 0) {
  const { ayar } = sinav
  const harf = GRUP_HARFLERI[g] || 'A'
  const tohum = ayar.tohum || 0
  const s2 = (ayar.karistirma || 1) >= 2

  // ---- soru sırası: bölümler içinde karıştır
  let ogeler = sinav.ogeler
  if (g > 0 && ayar.soruKaristir) {
    const sonuc = []
    let parca = []
    const bosalt = (bolumIndex) => {
      if (parca.length) {
        // her grup A'dan ve kendinden önceki gruplardan farklı sırada (mümkünse)
        const sira = s2 ? grupSirasi2(parca.map(o => o.id), [tohum, 'soru2', bolumIndex], g)
          : grupSirasi(parca.map(o => o.id), [tohum, 'soru', bolumIndex], g)
        const byId = new Map(parca.map(o => [o.id, o]))
        for (const id of sira) sonuc.push(byId.get(id))
      }
      parca = []
    }
    let bolumNo = 0
    for (const o of ogeler) {
      if (o.tur === 'bolum') { bosalt(bolumNo++); sonuc.push(o) } else parca.push(o)
    }
    bosalt(bolumNo)
    ogeler = sonuc
  }

  let no = 0
  const cikti = ogeler.map(o => {
    if (!soruMu(o)) return { ...o }
    no++
    const y = { ...o, no }
    if (o.tur === 'coktan') {
      let sira = o.siklar.map(s => s.id)
      if (g > 0 && ayar.sikKaristir && !o.sikKilit) {
        sira = s2 ? sikSirasi2(sira, o.siklar.some(k => k.id === o.dogru) ? o.dogru : null, [tohum, 'sik2', o.id], g)
          : grupSirasi(sira, [tohum, 'sik', o.id], g)
      }
      const byId = new Map(o.siklar.map(s => [s.id, s]))
      y.siklarSirali = sira.map(id => byId.get(id))
      const i = sira.indexOf(o.dogru)
      y.dogruIndex = i >= 0 ? i : null
      y.dogruHarf = i >= 0 ? HARFLER[i] : null
    } else if (o.tur === 'eslestirme') {
      const sag = [
        ...o.ciftler.map(c => ({ id: c.id, metin: c.sag })),
        ...virgulle(o.ekSag).map((m, i) => ({ id: `ek${i}`, metin: m })),
      ]
      y.sagSirali = duzensizKaristir(sag.map(s => s.id), karma(tohum, 'es', o.id, g)).map(id => sag.find(s => s.id === id))
      y.eslesme = o.ciftler.map(c => y.sagSirali.findIndex(s => s.id === c.id))   // sol i -> sağ harf indeksi
    } else if (o.tur === 'bosluk') {
      const kelimeler = [...o.cumleler.flatMap(c => bosluklar(c.metin)), ...virgulle(o.ekKelimeler)]
      y.havuzSirali = o.havuz ? karistir(kelimeler, rastgele(karma(tohum, 'havuz', o.id, g))) : []
    }
    return y
  })
  return { harf, g, ogeler: cikti, anahtar: anahtarOlustur(cikti) }
}

export const kucukHarf = i => 'abcdefghijklmnopqrstuvwxyz'[i] || String(i + 1)

/** Cevap anahtarı satırları: [{ no, tur, puan, kisa, uzun }] */
export function anahtarOlustur(ogeler) {
  const a = []
  for (const o of ogeler) {
    if (!soruMu(o)) continue
    const s = { no: o.no, tur: o.tur, puan: o.puan, konu: o.konu || '' }
    if (o.tur === 'coktan') { s.kisa = o.dogruHarf || '?'; s.uzun = o.dogruHarf || 'işaretlenmemiş' }
    else if (o.tur === 'dy') { s.kisa = o.maddeler.map(m => (m.dogru ? 'D' : 'Y')).join(''); s.uzun = o.maddeler.map((m, i) => `${kucukHarf(i)}) ${m.dogru ? 'D' : 'Y'}`).join('   ') }
    else if (o.tur === 'bosluk') { s.uzun = o.cumleler.map((c, i) => `${kucukHarf(i)}) ${bosluklar(c.metin).join(' / ') || '—'}`).join('   '); s.kisa = '' }
    else if (o.tur === 'eslestirme') { s.uzun = o.eslesme.map((j, i) => `${i + 1}-${kucukHarf(j)}`).join('   '); s.kisa = '' }
    else if (o.tur === 'klasik') { s.uzun = o.cevap || ''; s.kisa = '' ; s.acik = true }
    a.push(s)
  }
  return a
}

export function tumGruplar(sinav) {
  const n = grupSayisiSinirla(sinav.ayar.grupSayisi || 1)
  return Array.from({ length: n }, (_, g) => grupOlustur(sinav, g))
}

/*
 * Uygulamanın saf mantığı (arayüzden bağımsız, test edilebilir):
 * puanlama, okuma sonuçlarını kayda çevirme, iki okumayı birleştirme, tekrar kontrolü.
 */
export const SIKLAR = 'ABCDE'
export const KITAPCIKLAR = 'ABCD'

export const varsayilanAyar = () => ({
  sinavAdi: '',
  soruSayisi: 20,
  soruPuani: 0,          // 0 = otomatik (100 / soru sayısı)
  yanlisGoturur: 0,      // 0 = götürmez, 3 ya da 4
  ciftIsaret: 'yanlis',  // 'yanlis' | 'bos'
})

export function soruPuani(ayar) {
  return ayar.soruPuani > 0 ? ayar.soruPuani : 100 / ayar.soruSayisi
}

export const yuvarla = (x, h = 2) => Math.round((x + Number.EPSILON) * 10 ** h) / 10 ** h
export const sayiTR = (x, h = 2) => yuvarla(x, h).toLocaleString('tr-TR', { minimumFractionDigits: h, maximumFractionDigits: h })

/** Öğrenci cevabı: {t:'c', k} işaretli | {t:'b'} boş | {t:'x', ks:[...]} çift işaret */
export function puanla(ogr, anahtar, ayar) {
  const N = ayar.soruSayisi
  let d = 0, y = 0, b = 0
  const detay = []
  for (let q = 0; q < N; q++) {
    const c = ogr.cevaplar[q] || { t: 'b' }
    let durum
    if (c.t === 'c') durum = c.k === anahtar[q] ? 'd' : 'y'
    else if (c.t === 'x') durum = ayar.ciftIsaret === 'bos' ? 'b' : 'y'
    else durum = 'b'
    if (durum === 'd') d++; else if (durum === 'y') y++; else b++
    detay.push(durum)
  }
  const g = Number(ayar.yanlisGoturur) || 0
  const net = g ? d - y / g : d
  const puan = Math.max(0, net) * soruPuani(ayar)
  return { d, y, b, net: yuvarla(net, 2), puan: yuvarla(puan, 2), detay }
}

/** Türkçe başlık biçimi: "AYŞE NUR YILMAZ" -> "Ayşe Nur Yılmaz" */
export function baslikBicim(s) {
  return (s || '').toLocaleLowerCase('tr-TR').split(' ').filter(Boolean)
    .map(k => k.charAt(0).toLocaleUpperCase('tr-TR') + k.slice(1)).join(' ')
}

export function adSoyad(o) {
  const t = [o.ad, o.soyad].filter(Boolean).join(' ')
  return t ? baslikBicim(t) : 'İsimsiz'
}

// ------------------------------------------------------------------
// İki bağımsız okumayı birleştirme (canlı kamerada "çift okuma onayı")
// Kural: iki okuma da emin ve aynı -> tamam; biri emin değil -> emin olmayan hali alınır (öğretmene sorulur);
//        ikisi de emin ama FARKLI -> çelişki (kâğıt tekrar okunur).
// ------------------------------------------------------------------
function cevapEmin(c) { return !c.not }
function cevapEsit(a, b) {
  if (a.tur !== b.tur) return false
  if (a.tur === 'cift') return a.k.join() === b.k.join()
  return a.k === b.k
}

export function okumalariBirlestir(r1, r2) {
  const celiski = []
  const cevaplar = r1.cevaplar.map((c1, q) => {
    const c2 = r2.cevaplar[q]
    if (cevapEmin(c1) && cevapEmin(c2)) {
      if (!cevapEsit(c1, c2)) celiski.push(`soru ${q + 1}`)
      return c1
    }
    return cevapEmin(c1) ? c2 : c1
  })
  const alan = (a, b, ad) => {
    if (!a.supheli && !b.supheli) { if (a.metin !== b.metin) celiski.push(ad); return a }
    return a.supheli ? a : b
  }
  const ad = alan(r1.ad, r2.ad, 'ad')
  const soyad = alan(r1.soyad, r2.soyad, 'soyad')
  const no = alan(r1.no, r2.no, 'no')
  let kitapcik = r1.kitapcik
  const kEmin = k => !k.not && !k.cift
  if (kEmin(r1.kitapcik) && kEmin(r2.kitapcik)) { if (r1.kitapcik.harf !== r2.kitapcik.harf) celiski.push('kitapçık') }
  else kitapcik = kEmin(r1.kitapcik) ? r2.kitapcik : r1.kitapcik
  let anahtar = r1.anahtar
  if (r1.anahtar !== r2.anahtar) {
    if (r1.anahtar === 'supheli' || r2.anahtar === 'supheli') anahtar = 'supheli'
    else celiski.push('anahtar')
  }
  if (celiski.length) return { tamam: false, celiski }
  return { tamam: true, sonuc: { ...r1, cevaplar, ad, soyad, no, kitapcik, anahtar } }
}

/** Aynı kâğıdın arka arkaya okunduğunu anlamak için ham imza */
export function hamImza(r) {
  const c = r.cevaplar.map(x => x.tur === 'cevap' ? x.k : x.tur === 'cift' ? 'x' + x.k.join('') : '-').join('')
  return [r.ad.metin, r.soyad.metin, r.no.metin, r.kitapcik.harf || '', c].join('|')
}

/** Kayıtlı öğrencinin imzası (tekrar okutma kontrolü) */
export function kayitImza(o, N) {
  const c = o.cevaplar.slice(0, N).map(x => x.t === 'c' ? x.k : x.t === 'x' ? 'x' + x.ks.join('') : '-').join('')
  return [o.no || '', o.ad || '', o.soyad || '', o.kitapcik || '', c].join('|')
}

// ------------------------------------------------------------------
// Okuma sonucu -> kontrol edilmesi gerekenler listesi
// ------------------------------------------------------------------
export function sorunlariBul(r, ayar, anahtarlar) {
  const sorunlar = []
  const N = ayar.soruSayisi
  const kitaplar = Object.keys(anahtarlar)
  if (r.anahtar !== 'hayir') sorunlar.push({ tur: 'anahtarIsaretli', mesaj: r.anahtar === 'evet' ? 'Bu kâğıtta CEVAP ANAHTARI yuvarlağı işaretli.' : 'CEVAP ANAHTARI yuvarlağında silik bir işaret var.' })
  if (r.ad.supheli || r.soyad.supheli) sorunlar.push({ tur: 'isim', mesaj: 'Ad / soyad kodlamasında net olmayan harf var.', notlar: [...r.ad.notlar, ...r.soyad.notlar] })
  else if (!r.ad.metin && !r.soyad.metin) sorunlar.push({ tur: 'isim', mesaj: 'Ad soyad kodlanmamış.', notlar: [] })
  if (r.no.supheli) sorunlar.push({ tur: 'no', mesaj: 'Öğrenci numarasında net olmayan hane var.', notlar: r.no.notlar })
  const k = r.kitapcik
  if (k.cift) sorunlar.push({ tur: 'kitapcik', mesaj: `Birden fazla kitapçık işaretli (${k.cift.join(', ')}).` })
  else if (!k.harf) {
    if (kitaplar.length > 1) sorunlar.push({ tur: 'kitapcik', mesaj: 'Kitapçık türü işaretlenmemiş.' })
  } else if (!anahtarlar[k.harf]) {
    sorunlar.push({ tur: 'kitapcik', mesaj: `${k.harf} kitapçığı için cevap anahtarı yok.` })
  } else if (k.not) sorunlar.push({ tur: 'kitapcik', mesaj: `Kitapçık türünde silik işaret var (${k.harf} okundu).` })
  for (let q = 0; q < N; q++) {
    const c = r.cevaplar[q]
    if (c.not) sorunlar.push({ tur: 'soru', q, mesaj: `${q + 1}. soru: ${c.not}`, okunan: c })
  }
  return sorunlar
}

/** Kitapçık harfini belirle (sorun yoksa) */
export function kitapcikSec(r, anahtarlar) {
  const kitaplar = Object.keys(anahtarlar)
  if (r.kitapcik.harf && anahtarlar[r.kitapcik.harf] && !r.kitapcik.cift) return r.kitapcik.harf
  if (!r.kitapcik.harf && !r.kitapcik.cift && kitaplar.length === 1) return kitaplar[0]
  return null
}

/** Soru için öğretmen kararı yoksa varsayılan: çift -> 'x', silik tek işaret -> işaretli şık, silik boş -> boş */
export function varsayilanKarar(c) {
  if (c.tur === 'cift') return { t: 'x', ks: c.k }
  if (c.tur === 'cevap') return { t: 'c', k: c.k }
  return { t: 'b' }
}

/** Okuma + öğretmen kararları -> kayıt */
export function kayitOlustur(r, { ad, soyad, no, kitapcik, kararlar = {} }, ayar) {
  const cevaplar = r.cevaplar.map((c, q) => kararlar[q] ?? varsayilanKarar(c))
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random()),
    ad: ad ?? r.ad.metin, soyad: soyad ?? r.soyad.metin, no: no ?? r.no.metin,
    kitapcik, cevaplar, notlar: [], zaman: Date.now(),
  }
}

/** Yeni kayıt, listedekilerle çakışıyor mu? */
export function tekrarKontrol(yeni, liste, N) {
  const imza = kayitImza(yeni, N)
  const ayni = liste.findIndex(o => kayitImza(o, N) === imza)
  if (ayni >= 0) return { tur: 'ayni', index: ayni }
  if (yeni.no) {
    const i = liste.findIndex(o => o.no && o.no === yeni.no)
    if (i >= 0) return { tur: 'ayniNo', index: i }
  } else if (yeni.ad || yeni.soyad) {
    const i = liste.findIndex(o => !o.no && o.ad === yeni.ad && o.soyad === yeni.soyad)
    if (i >= 0) return { tur: 'ayniIsim', index: i }
  }
  return null
}

/** Anahtar kâğıdı okumasından anahtar taslağı */
export function anahtarTaslagi(r, N) {
  const cevaplar = []
  const eksik = []
  for (let q = 0; q < N; q++) {
    const c = r.cevaplar[q]
    if (c.tur === 'cevap' && !c.not) cevaplar.push(c.k)
    else { cevaplar.push(null); eksik.push(q) }
  }
  let fazla = 0
  for (let q = N; q < r.cevaplar.length; q++) if (r.cevaplar[q].tur !== 'bos') fazla = q + 1
  return { cevaplar, eksik, fazla, kitapcik: r.kitapcik.harf || null, anahtarIsaretli: r.anahtar === 'evet' }
}

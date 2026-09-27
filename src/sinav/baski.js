/*
 * Yazdırma sırası (saf mantık, test edilebilir).
 *
 * secim = {
 *   kagit: bool          sınav kâğıtları
 *   kopya: 'grup' | 'ogrenci'   her gruptan bir asıl (fotokopi için) ya da öğrenci sayısı kadar
 *   ogrenci: number      öğrenci sayısı (kopya 'ogrenci' iken)
 *   gruplar: [indeks]    basılacak gruplar (öğrencilere sırayla dağıtılır: A, B, C, A, B, C…)
 *   optik: bool          her öğrenciye bir optik form (kâğıdının hemen arkasından)
 *   kitapcik: bool       optik formda öğrencinin kitapçık türü hazır işaretli
 *   optikAnahtar: bool   her grup için cevapları işaretli optik form (optik okuyucuda okutulur)
 *   anahtar: bool        cevap anahtarı tablosu (öğretmen nüshası)
 *   ciftTaraf: bool      çift taraflı yazıcı: her öğrencinin kâğıdı ve optik formu yeni yaprakta başlar
 * }
 * dönüş: [{ tur: 'kagit' | 'optik' | 'bos' | 'optikAnahtar' | 'anahtar', g, kisi }]
 */
export const MAKS_OGRENCI = 200

export function varsayilanBaskiSecimi(grupSayisi) {
  return { kagit: true, kopya: 'ogrenci', ogrenci: 30, gruplar: Array.from({ length: grupSayisi }, (_, i) => i), optik: false, kitapcik: true, optikAnahtar: false, anahtar: false, ciftTaraf: false }
}

/** Kaydedilmiş seçimi sınavın şimdiki grup sayısına uydurur */
export function baskiSecimiDuzelt(secim, grupSayisi) {
  const v = varsayilanBaskiSecimi(grupSayisi)
  const s = { ...v, ...(secim || {}) }
  s.gruplar = (Array.isArray(s.gruplar) ? s.gruplar : v.gruplar).filter(g => Number.isInteger(g) && g >= 0 && g < grupSayisi)
  s.gruplar = [...new Set(s.gruplar)].sort((a, b) => a - b)
  if (!s.gruplar.length) s.gruplar = v.gruplar
  s.ogrenci = Math.max(1, Math.min(MAKS_OGRENCI, Math.round(Number(s.ogrenci) || 1)))
  if (s.kopya !== 'grup') s.kopya = 'ogrenci'
  return s
}

/** Öğrenci -> grup dağılımı: [g, g, ...] */
export function dagilim(secim) {
  const gs = secim.gruplar
  if (secim.kopya === 'grup') return [...gs]
  return Array.from({ length: secim.ogrenci }, (_, i) => gs[i % gs.length])
}

/**
 * sayfaSayisi(g): g grubunun sınav kâğıdı kaç sayfa
 * optikUygun: optik form basılabilir mi (yalnız çoktan seçmeli, en çok 4 grup …)
 * anahtarUygun: işaretli anahtar formu basılabilir mi (tüm doğru cevaplar işaretli)
 */
export function baskiListesi(secim, sayfaSayisi, { optikUygun = true, anahtarUygun = true } = {}) {
  const liste = []
  const optik = secim.optik && optikUygun
  if (secim.kagit || optik) {
    dagilim(secim).forEach((g, kisi) => {
      if (secim.kagit) {
        const n = sayfaSayisi(g)
        for (let i = 0; i < n; i++) liste.push({ tur: 'kagit', g, kisi, sayfa: i })
        if (secim.ciftTaraf && n % 2 === 1) liste.push({ tur: 'bos', g, kisi })
      }
      if (optik) {
        liste.push({ tur: 'optik', g, kisi })
        if (secim.ciftTaraf) liste.push({ tur: 'bos', g, kisi })
      }
    })
  }
  if (secim.optikAnahtar && anahtarUygun) {
    for (const g of secim.gruplar) {
      liste.push({ tur: 'optikAnahtar', g })
      if (secim.ciftTaraf) liste.push({ tur: 'bos', g })
    }
  }
  if (secim.anahtar) liste.push({ tur: 'anahtar' })
  return liste
}

/** Liste -> ardışık bloklar (bir öğrencinin kâğıt sayfaları tek blokta çizilir) */
export function bloklar(liste) {
  const b = []
  for (const x of liste) {
    const son = b[b.length - 1]
    if (x.tur === 'kagit' && son && son.tur === 'kagit' && son.g === x.g && son.kisi === x.kisi) son.sayfa++
    else b.push(x.tur === 'kagit' ? { ...x, sayfa: 1 } : { ...x })
  }
  return b
}

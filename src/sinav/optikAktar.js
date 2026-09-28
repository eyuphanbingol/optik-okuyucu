/*
 * Hazırlanan test sınavının cevap anahtarlarını Optik Okuyucu'ya aktarır.
 * Gruplar optik formdaki kitapçık türlerine karşılık gelir: A grubu -> A kitapçığı, B -> B ...
 * Optik okuyucunun kendi kayıt biçimi kullanılır (src/depo.js); optik kodunda hiçbir değişiklik gerekmez.
 *
 * Hatasızlık kuralları:
 *  - Yalnızca çoktan seçmeli, en çok 80 soru, en çok 5 şık (A–E), en çok 4 grup (formda A–D kitapçık var).
 *  - Her sorunun doğru şıkkı işaretli ve gerçekten o sorunun şıklarından biri.
 *  - Optik okuyucu her soruyu eşit puanlar. Kâğıttaki puanlar eşit değilse aktarım yapılmaz; önce eşitlenir
 *    (aktarım penceresinde tek tıkla). Böylece kâğıtta yazan puan ile optiğin hesapladığı puan hep aynıdır.
 */
import { tumGruplar } from './karistir.js'
import { soruMu, sinavBaslikMetni, yuvarla, OPTIK_KITAPCIK, GRUP_HARFLERI, puanMetni } from './model.js'

export const OPTIK_SORU = 80
export const OPTIK_SIK = 5

/** Sorular eşit puanlı mı? { esit, puan, toplam, otomatik } — otomatik: optiğin kendi hesabı (100 / N) ile birebir aynı */
export function puanDurumu(sinav) {
  const sorular = sinav.ogeler.filter(soruMu)
  const puanlar = sorular.map(o => Number(o.puan) || 0)
  const toplam = puanlar.reduce((a, b) => a + b, 0)
  const esit = puanlar.length > 0 && puanlar.every(p => Math.abs(p - puanlar[0]) < 1e-6) && puanlar[0] > 0
  const otomatik = esit && Math.abs(toplam - 100) < 0.01
  const farkli = [...new Set(puanlar.map(p => puanMetni(p)))]
  return { esit, puan: puanlar[0] || 0, toplam: yuvarla(toplam, 2), otomatik, farkli }
}

/** Optik form basılabilir mi (doğru cevaplar henüz işaretlenmemiş olabilir): { tamam, neden } */
export function optikYapiUygun(sinav) {
  const sorular = sinav.ogeler.filter(soruMu)
  const g = Math.max(1, sinav.ayar.grupSayisi || 1)
  if (!sorular.length) return { tamam: false, neden: 'Sınavda soru yok.' }
  if (sorular.some(o => o.tur !== 'coktan')) return { tamam: false, neden: 'Optik form yalnızca çoktan seçmeli soruları okur. Sınavda başka türde sorular var.' }
  if (sorular.length > OPTIK_SORU) return { tamam: false, neden: `Optik formda en fazla ${OPTIK_SORU} soru var; bu sınavda ${sorular.length} soru var.` }
  if (g > OPTIK_KITAPCIK) return { tamam: false, grup: true, neden: `Optik formda ${OPTIK_KITAPCIK} kitapçık türü var (A, B, C, D); bu sınavda ${g} grup var. Optikle okumak için grup sayısını en çok ${OPTIK_KITAPCIK} yapın.` }
  if (sorular.some(o => o.siklar.length > OPTIK_SIK || o.siklar.length < 2)) return { tamam: false, neden: 'Optik formda şıklar A–E arasıdır; her soruda 2–5 şık olmalı.' }
  return { tamam: true }
}

/** Optik okuyucuya aktarılabilir mi (puan hariç): { tamam, neden } */
export function optigeAktarilabilir(sinav) {
  const y = optikYapiUygun(sinav)
  if (!y.tamam) return y
  const sorular = sinav.ogeler.filter(soruMu)
  const eksik = sorular.map((o, i) => (!o.dogru || !o.siklar.some(s => s.id === o.dogru) ? i + 1 : null)).filter(Boolean)
  if (eksik.length) return { tamam: false, neden: `Şu soruların doğru cevabı işaretlenmemiş: ${eksik.join(', ')}.` }
  return { tamam: true }
}

/** Grupların optik anahtarları: { A: [0..4, ...], B: [...] } (soru sırasıyla, şık indeksi) */
export function optikAnahtarlari(sinav) {
  const a = {}
  for (const g of tumGruplar(sinav).slice(0, OPTIK_KITAPCIK)) a[g.harf] = g.ogeler.filter(soruMu).map(o => o.dogruIndex)
  return a
}

/** Optik okuyucunun kayıt biçiminde yeni sınav durumu. Uygun değilse hata fırlatır (sessizce yanlış aktarım yok). */
export function optikDurumu(sinav) {
  const u = optigeAktarilabilir(sinav)
  if (!u.tamam) throw new Error(u.neden)
  const p = puanDurumu(sinav)
  if (!p.esit) throw new Error('Soru puanları eşit değil; optik okuyucu her soruyu eşit puanlar. Önce puanları eşitleyin.')
  const sorular = sinav.ogeler.filter(soruMu)
  const N = sorular.length
  const anahtarlar = {}
  for (const [harf, a] of Object.entries(optikAnahtarlari(sinav))) {
    if (a.length !== N || a.some(k => !Number.isInteger(k) || k < 0 || k >= OPTIK_SIK)) throw new Error(`${harf} grubunun anahtarı eksik.`)
    anahtarlar[harf] = [...a, ...Array(OPTIK_SORU - N).fill(null)]
  }
  if (!Object.keys(anahtarlar).every((k, i) => k === GRUP_HARFLERI[i])) throw new Error('Kitapçık harfleri sıralı değil.')
  return {
    // soruPuani 0 = optiğin kendi hesabı (100 / N): toplam 100 ise kesirli puanlar (8,33…) dahil birebir aynı sonucu verir
    ayar: { sinavAdi: sinavBaslikMetni(sinav.baslik), soruSayisi: N, soruPuani: p.otomatik ? 0 : yuvarla(p.puan, 4), yanlisGoturur: 0, ciftIsaret: 'yanlis' },
    anahtarlar,
    ogrenciler: [],
    ekran: 'okut',
    olusturma: Date.now(),
    kaynakSinav: sinav.id,
    // her kitapçıkta soruların sırası (soru kimlikleriyle): optikte soru iptal edilince aynı sorunun
    // diğer kitapçıklardaki numarası buradan bulunur
    soruKimlikleri: Object.fromEntries(tumGruplar(sinav).slice(0, OPTIK_KITAPCIK).map(g => [g.harf, g.ogeler.filter(soruMu).map(o => o.id)])),
  }
}

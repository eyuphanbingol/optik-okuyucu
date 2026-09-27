/*
 * Hazırlanan test sınavının cevap anahtarlarını Optik Okuyucu'ya aktarır.
 * Gruplar optik formdaki kitapçık türlerine karşılık gelir: A grubu -> A kitapçığı, B -> B ...
 * Optik okuyucunun kendi kayıt biçimi kullanılır (src/depo.js); optik kodunda hiçbir değişiklik gerekmez.
 */
import { tumGruplar } from './karistir.js'
import { soruMu, sinavBaslikMetni, yuvarla } from './model.js'

const OPTIK_SORU = 80

/** { tamam, neden } */
export function optigeAktarilabilir(sinav) {
  const sorular = sinav.ogeler.filter(soruMu)
  if (!sorular.length) return { tamam: false, neden: 'Sınavda soru yok.' }
  if (sorular.some(o => o.tur !== 'coktan')) return { tamam: false, neden: 'Optik form yalnızca çoktan seçmeli soruları okur. Sınavda başka türde sorular var.' }
  if (sorular.length > OPTIK_SORU) return { tamam: false, neden: `Optik formda en fazla ${OPTIK_SORU} soru var; bu sınavda ${sorular.length} soru var.` }
  if (sorular.some(o => o.siklar.length > 5)) return { tamam: false, neden: 'Optik formda en fazla 5 şık (A–E) var.' }
  const eksik = sorular.map((o, i) => (!o.dogru ? i + 1 : null)).filter(Boolean)
  if (eksik.length) return { tamam: false, neden: `Şu soruların doğru cevabı işaretlenmemiş: ${eksik.join(', ')}.` }
  return { tamam: true }
}

/** Optik okuyucunun kayıt biçiminde yeni sınav durumu */
export function optikDurumu(sinav) {
  const sorular = sinav.ogeler.filter(soruMu)
  const N = sorular.length
  const puanlar = sorular.map(o => Number(o.puan) || 0)
  const esit = puanlar.every(p => p === puanlar[0]) && puanlar[0] > 0
  // tüm sorular eşit puanlı ve toplam 100 ise optiğin otomatik puanı (100 / N) zaten aynıdır
  const soruPuani = esit && Math.abs(puanlar[0] * N - 100) > 1e-9 ? puanlar[0] : 0
  const anahtarlar = {}
  for (const g of tumGruplar(sinav)) {
    const a = g.ogeler.filter(soruMu).map(o => o.dogruIndex)
    anahtarlar[g.harf] = [...a, ...Array(OPTIK_SORU - a.length).fill(null)]
  }
  return {
    ayar: { sinavAdi: sinavBaslikMetni(sinav.baslik), soruSayisi: N, soruPuani, yanlisGoturur: 0, ciftIsaret: 'yanlis' },
    anahtarlar,
    ogrenciler: [],
    ekran: 'okut',
    olusturma: Date.now(),
    kaynakSinav: sinav.id,
    _puanUyari: !esit ? `Sorular farklı puanlı; optik okuyucu her soruyu eşit (${yuvarla(100 / N)} puan) sayar.` : null,
  }
}

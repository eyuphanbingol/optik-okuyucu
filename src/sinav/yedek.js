/*
 * Sınav yedek dosyası (.sinav): sınav + görselleri tek JSON dosyasında.
 * Başka cihaza taşımak ya da arşivlemek için. İçe aktarırken yeni kimlikler verilir (çakışma olmaz).
 */
import { gorselKimlikleri, yeniId } from './model.js'
import { gorselDataUrl, gorselDataUrldenKaydet } from './gorsel.js'
import { sinavKaydet } from './depo.js'

const TUR = 'optik-okuyucu-sinav'

export async function yedekOlustur(sinav) {
  const gorseller = {}
  for (const id of gorselKimlikleri(sinav)) {
    const g = await gorselDataUrl(id)
    if (g) gorseller[id] = g
  }
  return new Blob([JSON.stringify({ tur: TUR, surum: 1, tarih: new Date().toISOString(), sinav, gorseller })], { type: 'application/json' })
}

export function dosyaAdi(sinav, uzanti) {
  const b = sinav.baslik || {}
  const ad = [b.sinif, b.ders, b.sinavAdi].filter(Boolean).join(' ') || 'sinav'
  return ad.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80) + '.' + uzanti
}

export function indirBlob(blob, ad) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = ad
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 8000)
}

export async function yedektenYukle(dosya) {
  let veri
  try { veri = JSON.parse(await dosya.text()) } catch { throw new Error('Dosya okunamadı. Bu uygulamadan indirilen .sinav dosyasını seçin.') }
  if (!veri || veri.tur !== TUR || !veri.sinav || !Array.isArray(veri.sinav.ogeler)) throw new Error('Bu bir sınav yedek dosyası değil.')
  const sinav = JSON.parse(JSON.stringify(veri.sinav))
  sinav.id = yeniId()
  sinav.olusturma = sinav.guncelleme = Date.now()
  const yeniKimlik = new Map()
  for (const eski of Object.keys(veri.gorseller || {})) yeniKimlik.set(eski, yeniId())
  const donustur = g => (g && g.id && yeniKimlik.has(g.id) ? { ...g, id: yeniKimlik.get(g.id) } : g && g.id ? null : g)
  for (const o of sinav.ogeler) {
    if (o.gorsel) o.gorsel = donustur(o.gorsel)
    if (o.siklar) for (const s of o.siklar) if (s.gorsel) s.gorsel = donustur(s.gorsel)
  }
  if (sinav.baslik) for (const t of ['logoSol', 'logoSag']) if (sinav.baslik[t]) sinav.baslik[t] = donustur(sinav.baslik[t])
  for (const [eski, yeni] of yeniKimlik) await gorselDataUrldenKaydet(yeni, sinav.id, veri.gorseller[eski])
  await sinavKaydet(sinav)
  return sinav
}

/** Sınavın kopyası (görseller de kopyalanır: biri silinince diğeri etkilenmez) */
export async function sinavKopyala(sinav, adEki = ' (kopya)') {
  const { gorselGetir, gorselKaydet } = await import('./depo.js')
  const kopya = JSON.parse(JSON.stringify(sinav))
  kopya.id = yeniId()
  kopya.olusturma = kopya.guncelleme = Date.now()
  kopya.baslik = { ...kopya.baslik, sinavAdi: (kopya.baslik.sinavAdi || 'Adsız sınav') + adEki }
  const yeniKimlik = new Map()
  for (const eski of gorselKimlikleri(sinav)) {
    const g = await gorselGetir(eski)
    if (!g) continue
    const yeni = yeniId()
    await gorselKaydet({ ...g, id: yeni, sinavId: kopya.id })
    yeniKimlik.set(eski, yeni)
  }
  const donustur = g => (g && yeniKimlik.has(g.id) ? { ...g, id: yeniKimlik.get(g.id) } : g)
  for (const o of kopya.ogeler) {
    if (o.gorsel) o.gorsel = donustur(o.gorsel)
    if (o.siklar) for (const s of o.siklar) if (s.gorsel) s.gorsel = donustur(s.gorsel)
  }
  for (const t of ['logoSol', 'logoSag']) if (kopya.baslik[t]) kopya.baslik[t] = donustur(kopya.baslik[t])
  await sinavKaydet(kopya)
  return kopya
}

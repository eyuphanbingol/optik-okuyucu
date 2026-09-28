/*
 * Okul / kurum logosu. Sınav başlığında solda ve sağda birer logo olabilir (örn. okul logosu + MEB / üniversite logosu).
 * Eklenen logo öğretmen profiline de kopyalanır; yeni sınavlarda kendiliğinden gelir. Kaldırılırsa varsayılan da kalkar.
 * Her sınav logonun kendi kopyasını tutar (bir sınav silinince diğerleri etkilenmez).
 */
import { gorselEkle, gorselKopyala } from './gorsel.js'
import { profilGetir, profilKaydet, kullanilmayanGorselleriSil } from './depo.js'

export const PROFIL_GORSEL = '__profil'
export const LOGO_TARAFLARI = ['logoSol', 'logoSag']

async function profiliTemizle() {
  const p = profilGetir()
  await kullanilmayanGorselleriSil(PROFIL_GORSEL, new Set(LOGO_TARAFLARI.map(t => p[t]).filter(Boolean))).catch(() => {})
}

/** Dosyadan logo: sınava kaydeder ve varsayılan yapar. dönüş: { id } */
export async function logoEkle(dosya, sinavId, taraf) {
  const g = await gorselEkle(dosya, sinavId)
  try {
    const k = await gorselKopyala(g.id, PROFIL_GORSEL)
    if (k) { profilKaydet({ [taraf]: k.id }); await profiliTemizle() }
  } catch { /* varsayılan kaydedilemese de logo sınavda kalır */ }
  return { id: g.id }
}

/** Logo sınavdan kaldırılınca varsayılanı da kaldır */
export async function logoVarsayilaniKaldir(taraf) {
  profilKaydet({ [taraf]: null })
  await profiliTemizle()
}

/** Yeni sınav için varsayılan logoların kopyaları: { logoSol?: { id }, logoSag?: { id } } */
export async function varsayilanLogolar(sinavId) {
  const p = profilGetir()
  const sonuc = {}
  for (const t of LOGO_TARAFLARI) {
    if (!p[t]) continue
    try { const k = await gorselKopyala(p[t], sinavId); if (k) sonuc[t] = { id: k.id } } catch { /* yok */ }
  }
  return sonuc
}

// Sınav durumu tarayıcıda saklanır: sayfa yenilense ya da kapansa bile kaybolmaz.
// Hiçbir veri sunucuya gitmez (e-posta gönderimi hariç, o da sadece Excel dosyası).
const ANAHTAR = 'optik-okuyucu.sinav.v1'

export function yukle() {
  try {
    const s = localStorage.getItem(ANAHTAR)
    if (!s) return null
    const d = JSON.parse(s)
    if (!d || !d.ayar || !Array.isArray(d.ogrenciler)) return null
    return d
  } catch {
    return null
  }
}

export function kaydet(durum) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(durum))
    return true
  } catch {
    return false
  }
}

export function sil() {
  try { localStorage.removeItem(ANAHTAR) } catch { /* yok say */ }
}

// Sınav durumu sayfa yenilense ya da kapansa bile kaybolmaz.
// Giriş açıkken kullanıcının hesabında (Supabase) saklanır, tarayıcıya yazılmaz; giriş kapalıysa tarayıcıda saklanır.
import { girisAcik } from './giris/supabase.js'
import * as bulut from './giris/bulut.js'

const ANAHTAR = 'optik-okuyucu.sinav.v1'

export function yukle() {
  try {
    const s = girisAcik ? bulut.optikMetni() : localStorage.getItem(ANAHTAR)
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
    if (girisAcik) return bulut.optikYaz(JSON.stringify(durum))
    localStorage.setItem(ANAHTAR, JSON.stringify(durum))
    return true
  } catch {
    return false
  }
}

export function sil() {
  try {
    if (girisAcik) bulut.optikYaz(null)
    else localStorage.removeItem(ANAHTAR)
  } catch { /* yok say */ }
}

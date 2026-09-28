import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANAHTAR = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Ortam değişkenleri yoksa giriş sistemi kapalıdır ve uygulama eskisi gibi herkese açık çalışır. */
export const supabase = SUPABASE_URL && SUPABASE_ANAHTAR
  ? createClient(SUPABASE_URL, SUPABASE_ANAHTAR, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'optik-okuyucu.oturum' } })
  : null

export const girisAcik = !!supabase

// Supabase e-postayla giriş ister; kullanıcı adı bu sabit uzantıyla e-postaya çevrilir (api/admin.js ile aynı olmalı).
const EPOSTA_UZANTI = '@optik.local'
const ESKI_ONBELLEK = 'optik-okuyucu.yetki'
const HARF = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }

try { localStorage.removeItem(ESKI_ONBELLEK) } catch { /* yok */ }

export function kullaniciAdiNormal(s) {
  return String(s || '').trim().replace(/İ/g, 'i').toLowerCase().replace(/[çğıöşü]/g, h => HARF[h]).replace(/\s+/g, '')
}

export const epostaYap = ad => {
  const n = kullaniciAdiNormal(ad)
  return n.includes('@') ? n : n + EPOSTA_UZANTI
}

export function sifreUret(uzunluk = 10) {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = new Uint32Array(uzunluk)
  crypto.getRandomValues(r)
  return Array.from(r, x => abc[x % abc.length]).join('')
}

/**
 * Giriş yapan kullanıcının rolü, kurumu ve açık modülleri. Kurum yoksa null.
 * alan: verilerin ait olduğu yer (kurum kullanıcısında kurum, yöneticide kendi hesabı; SQL'deki alanim() ile aynı).
 */
export async function yetkiGetir(id) {
  const { data, error } = await supabase
    .from('profiller')
    .select('kullanici_adi, rol, kurum_id, kurumlar(ad, optik, sinav, aktif)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const k = data.kurumlar
  if (data.rol === 'admin') {
    return { rol: 'admin', kullaniciAdi: data.kullanici_adi, kurumAdi: 'Yönetici', optik: true, sinav: true, aktif: true, alan: data.kurum_id || id }
  }
  if (!k) return null
  return { rol: 'kurum', kullaniciAdi: data.kullanici_adi, kurumAdi: k.ad, optik: !!k.optik, sinav: !!k.sinav, aktif: !!k.aktif, alan: data.kurum_id }
}

const cikisGorevleri = []

/** Çıkıştan hemen önce (oturum hâlâ açıkken) çalışır: bekleyen kayıtları gönderme gibi. */
export function cikistaCalistir(gorev) { cikisGorevleri.push(gorev) }

export async function cikisYap() {
  for (const gorev of cikisGorevleri) {
    try { await gorev() } catch { /* çıkış yine de yapılır */ }
  }
  await supabase.auth.signOut().catch(() => {})
  if (window.location.hash) window.location.hash = '#/'
}

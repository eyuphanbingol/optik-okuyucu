import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const ANAHTAR = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Ortam değişkenleri yoksa giriş sistemi kapalıdır ve uygulama eskisi gibi herkese açık çalışır. */
export const supabase = URL && ANAHTAR
  ? createClient(URL, ANAHTAR, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'optik-okuyucu.oturum' } })
  : null

export const girisAcik = !!supabase

// Supabase e-postayla giriş ister; kullanıcı adı bu sabit uzantıyla e-postaya çevrilir (api/admin.js ile aynı olmalı).
const EPOSTA_UZANTI = '@optik.local'
const ONBELLEK = 'optik-okuyucu.yetki'
const HARF = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }

export function kullaniciAdiNormal(s) {
  return String(s || '').trim().replace(/İ/g, 'i').toLowerCase().replace(/[çğıöşü]/g, h => HARF[h]).replace(/\s+/g, '')
}

export const epostaYap = ad => kullaniciAdiNormal(ad) + EPOSTA_UZANTI

export function sifreUret(uzunluk = 10) {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = new Uint32Array(uzunluk)
  crypto.getRandomValues(r)
  return Array.from(r, x => abc[x % abc.length]).join('')
}

/** Giriş yapan kullanıcının rolü, kurumu ve açık modülleri. Kurum yoksa null. */
export async function yetkiGetir(id) {
  const { data, error } = await supabase
    .from('profiller')
    .select('kullanici_adi, rol, kurumlar(ad, optik, sinav, aktif)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const k = data.kurumlar
  const yetki = data.rol === 'admin'
    ? { rol: 'admin', kullaniciAdi: data.kullanici_adi, kurumAdi: 'Yönetici', optik: true, sinav: true, aktif: true }
    : k ? { rol: 'kurum', kullaniciAdi: data.kullanici_adi, kurumAdi: k.ad, optik: !!k.optik, sinav: !!k.sinav, aktif: !!k.aktif } : null
  try { localStorage.setItem(ONBELLEK, JSON.stringify({ id, yetki })) } catch { /* gizli sekme */ }
  return yetki
}

/** İnternet yokken son bilinen yetkiyle açılabilsin (sınıfta bağlantı kopabilir). */
export function onbellektenYetki(id) {
  try {
    const o = JSON.parse(localStorage.getItem(ONBELLEK) || 'null')
    return o && o.id === id ? o.yetki : null
  } catch { return null }
}

export async function cikisYap() {
  try { localStorage.removeItem(ONBELLEK) } catch { /* yok */ }
  await supabase.auth.signOut().catch(() => {})
  if (window.location.hash) window.location.hash = '#/'
}

/*
 * Yönetim paneli işlemleri (Vercel sunucu fonksiyonu): kurum ekle/değiştir/sil, kullanıcı ekle/sil, şifre değiştir.
 *
 * Gerekli ortam değişkenleri (Vercel > Project > Settings > Environment Variables):
 *   VITE_SUPABASE_URL           https://<proje>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   Supabase > Project Settings > API Keys > service_role / secret (GİZLİ: yalnızca sunucuda)
 *
 * Her istekte çağıranın oturum anahtarı doğrulanır; yalnızca rolü "admin" olan kullanıcı işlem yapabilir.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVIS = process.env.SUPABASE_SERVICE_ROLE_KEY
const EPOSTA_UZANTI = '@optik.local'
const AD_KALIBI = /^[a-z0-9._-]{3,32}$/
const HARF = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }

class Hata extends Error {
  constructor(mesaj, kod = 400) { super(mesaj); this.kod = kod }
}

const normal = s => String(s || '').trim().replace(/İ/g, 'i').toLowerCase().replace(/[çğıöşü]/g, h => HARF[h]).replace(/\s+/g, '')

function adDogrula(ad) {
  const n = normal(ad)
  if (!AD_KALIBI.test(n)) throw new Hata('Kullanıcı adı 3–32 karakter olmalı; yalnızca harf, rakam, nokta, tire ve alt çizgi kullanılabilir.')
  return n
}

function sifreDogrula(sifre) {
  const s = String(sifre || '')
  if (s.length < 6) throw new Hata('Şifre en az 6 karakter olmalı.')
  if (s.length > 72) throw new Hata('Şifre çok uzun.')
  return s
}

function kurumAdi(ad) {
  const a = String(ad || '').trim().replace(/\s+/g, ' ')
  if (!a) throw new Hata('Kurum adı boş olamaz.')
  if (a.length > 120) throw new Hata('Kurum adı çok uzun.')
  return a
}

async function kullaniciOlustur(sb, kurumId, kullaniciAdi, sifre) {
  const ad = adDogrula(kullaniciAdi)
  const parola = sifreDogrula(sifre)
  const { data: var_ } = await sb.from('profiller').select('id').eq('kullanici_adi', ad).maybeSingle()
  if (var_) throw new Hata(`"${ad}" kullanıcı adı zaten kullanılıyor.`)
  const { data, error } = await sb.auth.admin.createUser({
    email: ad + EPOSTA_UZANTI, password: parola, email_confirm: true, user_metadata: { kullanici_adi: ad },
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new Hata(`"${ad}" kullanıcı adı zaten kullanılıyor.`)
    throw new Hata('Kullanıcı oluşturulamadı: ' + error.message)
  }
  const { error: pHata } = await sb.from('profiller').insert({ id: data.user.id, kullanici_adi: ad, rol: 'kurum', kurum_id: kurumId })
  if (pHata) {
    await sb.auth.admin.deleteUser(data.user.id).catch(() => {})
    throw new Hata('Kullanıcı kaydedilemedi: ' + pHata.message)
  }
  return { id: data.user.id, kullanici_adi: ad }
}

async function kurumKullanicisi(sb, id) {
  const { data } = await sb.from('profiller').select('id, rol').eq('id', id).maybeSingle()
  if (!data) throw new Hata('Kullanıcı bulunamadı.', 404)
  if (data.rol !== 'kurum') throw new Hata('Yönetici hesabı buradan değiştirilemez.', 403)
  return data
}

const ISLEMLER = {
  async listele(sb) {
    const [{ data: kurumlar, error: e1 }, { data: kisiler, error: e2 }] = await Promise.all([
      sb.from('kurumlar').select('*').order('olusturma', { ascending: false }),
      sb.from('profiller').select('id, kullanici_adi, kurum_id, olusturma').eq('rol', 'kurum').order('olusturma'),
    ])
    if (e1 || e2) throw new Hata('Liste alınamadı: ' + (e1 || e2).message, 500)
    return { kurumlar: kurumlar.map(k => ({ ...k, kullanicilar: kisiler.filter(p => p.kurum_id === k.id) })) }
  },

  async kurumEkle(sb, g) {
    const ad = kurumAdi(g.ad)
    if (g.kullaniciAdi) { adDogrula(g.kullaniciAdi); sifreDogrula(g.sifre) }
    const { data: kurum, error } = await sb.from('kurumlar').insert({ ad, optik: !!g.optik, sinav: !!g.sinav }).select().single()
    if (error) throw new Hata('Kurum eklenemedi: ' + error.message, 500)
    if (g.kullaniciAdi) {
      try { await kullaniciOlustur(sb, kurum.id, g.kullaniciAdi, g.sifre) } catch (e) {
        await sb.from('kurumlar').delete().eq('id', kurum.id)
        throw e
      }
    }
    return { kurum }
  },

  async kurumGuncelle(sb, g) {
    if (!g.id) throw new Hata('Kurum belirtilmedi.')
    const d = {}
    if ('ad' in g) d.ad = kurumAdi(g.ad)
    for (const k of ['optik', 'sinav', 'aktif']) if (k in g) d[k] = !!g[k]
    if (!Object.keys(d).length) throw new Hata('Değişiklik yok.')
    const { error } = await sb.from('kurumlar').update(d).eq('id', g.id)
    if (error) throw new Hata('Kurum güncellenemedi: ' + error.message, 500)
    return {}
  },

  async kurumSil(sb, g) {
    if (!g.id) throw new Hata('Kurum belirtilmedi.')
    const { data: kisiler } = await sb.from('profiller').select('id').eq('kurum_id', g.id).eq('rol', 'kurum')
    for (const p of kisiler || []) await sb.auth.admin.deleteUser(p.id)
    const { error } = await sb.from('kurumlar').delete().eq('id', g.id)
    if (error) throw new Hata('Kurum silinemedi: ' + error.message, 500)
    return {}
  },

  async kullaniciEkle(sb, g) {
    if (!g.kurumId) throw new Hata('Kurum belirtilmedi.')
    const { data: k } = await sb.from('kurumlar').select('id').eq('id', g.kurumId).maybeSingle()
    if (!k) throw new Hata('Kurum bulunamadı.', 404)
    return { kullanici: await kullaniciOlustur(sb, g.kurumId, g.kullaniciAdi, g.sifre) }
  },

  async sifreDegistir(sb, g) {
    await kurumKullanicisi(sb, g.id)
    const { error } = await sb.auth.admin.updateUserById(g.id, { password: sifreDogrula(g.sifre) })
    if (error) throw new Hata('Şifre değiştirilemedi: ' + error.message, 500)
    return {}
  },

  async kullaniciSil(sb, g) {
    await kurumKullanicisi(sb, g.id)
    const { error } = await sb.auth.admin.deleteUser(g.id)
    if (error) throw new Hata('Kullanıcı silinemedi: ' + error.message, 500)
    return {}
  },
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method !== 'POST') throw new Hata('Yalnızca POST.', 405)
    if (!URL || !SERVIS) throw new Hata('Sunucu ayarları eksik: SUPABASE_SERVICE_ROLE_KEY tanımlanmamış.', 500)
    const sb = createClient(URL, SERVIS, { auth: { persistSession: false, autoRefreshToken: false } })

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) throw new Hata('Oturum yok.', 401)
    const { data: u, error } = await sb.auth.getUser(token)
    if (error || !u?.user) throw new Hata('Oturumun süresi dolmuş. Tekrar giriş yapın.', 401)
    const { data: p } = await sb.from('profiller').select('rol').eq('id', u.user.id).maybeSingle()
    if (p?.rol !== 'admin') throw new Hata('Bu işlem için yönetici yetkisi gerekir.', 403)

    const govde = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const islem = ISLEMLER[govde.islem]
    if (!islem) throw new Hata('Bilinmeyen işlem.')
    res.status(200).json({ tamam: true, ...(await islem(sb, govde)) })
  } catch (e) {
    res.status(e instanceof Hata ? e.kod : 500).json({ tamam: false, hata: e.message || 'Beklenmeyen hata.' })
  }
}

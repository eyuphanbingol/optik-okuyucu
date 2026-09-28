/*
 * Giriş açıkken tüm veriler Supabase'de, hesabın kendisinde saklanır; tarayıcıya hiçbir şey yazılmaz.
 *   sinavlar / gorseller (+ "gorseller" dosya kovası): kuruma ait, kurumun tüm kullanıcıları ortak görür
 *   kisisel.optik  : kullanıcının süren optik okuma oturumu (src/depo.js)
 *   kisisel.profil : öğretmen bilgileri (sinav/depo.js profilGetir / profilKaydet)
 * Optik okuyucu ve öğretmen bilgileri senkron okunur: giriş sırasında belleğe alınır, değişiklikler arkada gönderilir.
 */
import { supabase, cikistaCalistir, SUPABASE_URL, SUPABASE_ANAHTAR } from './supabase.js'

const KOVA = 'gorseller'
const PROFIL_GORSEL = '__profil'
const ESKI_OPTIK = 'optik-okuyucu.sinav.v1'
const ESKI_PROFIL = 'optik-okuyucu.ogretmen'
const ESKI_VT = 'optik-okuyucu-sinav'
const GORSEL_ONBELLEK = 60

const d = {
  kullanici: null,
  alan: null,
  token: null,
  optik: null,        // JSON metni
  profil: {},
  bekliyor: false,
  zaman: null,
  hata: false,
}
const gorselOnbellek = new Map()

supabase?.auth.onAuthStateChange((_, s) => { d.token = s?.access_token || null })

function hataFirlat(e) {
  throw e instanceof Error ? e : new Error(e?.message || 'Sunucuya kaydedilemedi.')
}

function hazir() {
  if (!d.alan) throw new Error('Oturum kapalı. Tekrar giriş yapın.')
}

// ------------------------------------------------------------------ oturum
export async function bulutHazirla(kullanici, alan, bildir = () => {}) {
  if (d.kullanici === kullanici && d.alan === alan) return
  await bulutKapat(false)
  const { data, error } = await supabase.from('kisisel').select('optik, profil').eq('kullanici_id', kullanici).maybeSingle()
  if (error) hataFirlat(error)
  d.kullanici = kullanici
  d.alan = alan
  d.optik = data?.optik ? JSON.stringify(data.optik) : null
  d.profil = data?.profil || {}
  try {
    await yereldenTasi(bildir)
  } catch {
    // taşınamayan veri tarayıcıda kalır, bir sonraki girişte yeniden denenir
  }
}

export async function bulutKapat(gonder = true) {
  if (gonder && d.kullanici) {
    try { await kisiselGonder() } catch { /* çıkış yine de yapılır */ }
  }
  clearTimeout(d.zaman)
  Object.assign(d, { kullanici: null, alan: null, optik: null, profil: {}, bekliyor: false, zaman: null, hata: false })
  gorselOnbellek.clear()
}

cikistaCalistir(() => bulutKapat(true))

// ------------------------------------------------------------------ kişisel kayıt (optik oturumu + öğretmen bilgileri)
function kisiselGovde() {
  return {
    kullanici_id: d.kullanici,
    optik: d.optik ? JSON.parse(d.optik) : null,
    profil: d.profil,
    guncelleme: new Date().toISOString(),
  }
}

function kisiselZamanla() {
  if (!d.kullanici) return
  d.bekliyor = true
  clearTimeout(d.zaman)
  d.zaman = setTimeout(() => { kisiselGonder().catch(() => {}) }, 500)
}

let kuyruk = Promise.resolve()

/** Bekleyen kişisel kaydı gönderir; istekler sırayla gider (eski kayıt yenisinin üstüne yazılamaz). */
function kisiselGonder() {
  clearTimeout(d.zaman)
  d.zaman = null
  const is = kuyruk.then(async () => {
    if (!d.kullanici || !d.bekliyor) return
    const kullanici = d.kullanici
    d.bekliyor = false
    const { error } = await supabase.from('kisisel').upsert(kisiselGovde())
    if (d.kullanici !== kullanici) return
    if (error) {
      d.hata = true
      d.bekliyor = true
      clearTimeout(d.zaman)
      d.zaman = setTimeout(() => { kisiselGonder().catch(() => {}) }, 4000)
      hataFirlat(error)
    }
    d.hata = false
  })
  kuyruk = is.catch(() => {})
  return is
}

/** Sayfa kapanırken bekleyen kaydı tarayıcının kapanışta da süren isteğiyle (keepalive) gönderir. */
function kapanirkenGonder() {
  if (!d.kullanici || !d.bekliyor || !d.token) return
  const govde = JSON.stringify(kisiselGovde())
  if (govde.length > 60000) { kisiselGonder().catch(() => {}); return }
  d.bekliyor = false
  clearTimeout(d.zaman)
  try {
    fetch(`${SUPABASE_URL}/rest/v1/kisisel?on_conflict=kullanici_id`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANAHTAR,
        Authorization: `Bearer ${d.token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: govde,
    }).catch(() => {})
  } catch { /* yok */ }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', kapanirkenGonder)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && d.bekliyor) kisiselGonder().catch(() => {})
  })
  window.addEventListener('online', () => { if (d.bekliyor) kisiselGonder().catch(() => {}) })
}

// src/depo.js (optik okuyucu) için: JSON metni okur / yazar. Yazma sonucu false ise son gönderim başarısız olmuştur.
export function optikMetni() {
  return d.kullanici ? d.optik : null
}

export function optikYaz(metin) {
  if (!d.kullanici) return false
  d.optik = metin
  kisiselZamanla()
  return !d.hata
}

export function profilGetir() {
  return d.kullanici ? JSON.parse(JSON.stringify(d.profil || {})) : {}
}

export function profilKaydet(p) {
  if (!d.kullanici) return
  d.profil = JSON.parse(JSON.stringify({ ...d.profil, ...p }))
  kisiselZamanla()
}

// ------------------------------------------------------------------ sınavlar
export async function sinavlariListele() {
  hazir()
  const { data, error } = await supabase.from('sinavlar').select('veri').eq('alan', d.alan).order('guncelleme', { ascending: false })
  if (error) hataFirlat(error)
  return data.map(r => r.veri)
}

export async function sinavGetir(id) {
  hazir()
  const { data, error } = await supabase.from('sinavlar').select('veri').eq('alan', d.alan).eq('id', id).maybeSingle()
  if (error) hataFirlat(error)
  return data ? data.veri : undefined
}

export async function sinavKaydet(sinav) {
  hazir()
  const kopya = JSON.parse(JSON.stringify(sinav))
  const { error } = await supabase.from('sinavlar').upsert(
    { alan: d.alan, id: kopya.id, veri: kopya, guncelleme: Math.round(kopya.guncelleme || Date.now()) },
    { onConflict: 'alan,id' },
  )
  if (error) hataFirlat(error)
  return kopya.id
}

export async function sinavSil(id) {
  hazir()
  const gorseller = await sinavGorselleri(id)
  await gorselleriSil(gorseller.map(g => g.id))
  const { error } = await supabase.from('sinavlar').delete().eq('alan', d.alan).eq('id', id)
  if (error) hataFirlat(error)
}

// ------------------------------------------------------------------ görseller  { id, sinavId, blob, genislik, yukseklik, tur }
// Öğretmen logoları kişiye özeldir: aynı kurumdaki başka kullanıcının logosu silinmesin diye sınav kimliğine kullanıcı eklenir.
const saklananSinav = s => (s === PROFIL_GORSEL ? `${PROFIL_GORSEL}:${d.kullanici}` : s)
const gercekSinav = s => (typeof s === 'string' && s.startsWith(PROFIL_GORSEL + ':') ? PROFIL_GORSEL : s)
const dosyaYolu = id => `${d.alan}/${id}`

function onbellegeKoy(g) {
  gorselOnbellek.delete(g.id)
  gorselOnbellek.set(g.id, g)
  while (gorselOnbellek.size > GORSEL_ONBELLEK) gorselOnbellek.delete(gorselOnbellek.keys().next().value)
}

const sayi = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : null)

export async function gorselKaydet(g) {
  hazir()
  const tur = g.tur || g.blob?.type || 'application/octet-stream'
  const { error: dosyaHatasi } = await supabase.storage.from(KOVA).upload(dosyaYolu(g.id), g.blob, { upsert: true, contentType: tur })
  if (dosyaHatasi) hataFirlat(dosyaHatasi)
  const { error } = await supabase.from('gorseller').upsert(
    { alan: d.alan, id: g.id, sinav_id: saklananSinav(g.sinavId), genislik: sayi(g.genislik), yukseklik: sayi(g.yukseklik), tur },
    { onConflict: 'alan,id' },
  )
  if (error) hataFirlat(error)
  onbellegeKoy({ ...g, tur })
  return g.id
}

export async function gorselGetir(id) {
  hazir()
  if (gorselOnbellek.has(id)) return { ...gorselOnbellek.get(id) }
  const { data: r, error } = await supabase.from('gorseller').select('sinav_id, genislik, yukseklik, tur').eq('alan', d.alan).eq('id', id).maybeSingle()
  if (error) hataFirlat(error)
  if (!r) return undefined
  const { data: ham, error: dosyaHatasi } = await supabase.storage.from(KOVA).download(dosyaYolu(id))
  if (dosyaHatasi) hataFirlat(dosyaHatasi)
  const blob = r.tur && ham.type !== r.tur ? new Blob([ham], { type: r.tur }) : ham
  const g = { id, sinavId: gercekSinav(r.sinav_id), blob, genislik: r.genislik, yukseklik: r.yukseklik, tur: r.tur }
  onbellegeKoy(g)
  return { ...g }
}

/** Sınavın görselleri (yalnızca bilgileri; dosyalar gerektiğinde gorselGetir ile iner). */
export async function sinavGorselleri(sinavId) {
  hazir()
  const { data, error } = await supabase.from('gorseller').select('id, sinav_id, genislik, yukseklik, tur').eq('alan', d.alan).eq('sinav_id', saklananSinav(sinavId))
  if (error) hataFirlat(error)
  return data.map(r => ({ id: r.id, sinavId: gercekSinav(r.sinav_id), genislik: r.genislik, yukseklik: r.yukseklik, tur: r.tur }))
}

async function gorselleriSil(kimlikler) {
  if (!kimlikler.length) return
  const { error: dosyaHatasi } = await supabase.storage.from(KOVA).remove(kimlikler.map(dosyaYolu))
  if (dosyaHatasi) hataFirlat(dosyaHatasi)
  const { error } = await supabase.from('gorseller').delete().eq('alan', d.alan).in('id', kimlikler)
  if (error) hataFirlat(error)
  for (const id of kimlikler) gorselOnbellek.delete(id)
}

export async function kullanilmayanGorselleriSil(sinavId, kullanilan) {
  const hepsi = await sinavGorselleri(sinavId)
  const silinecek = hepsi.filter(g => !kullanilan.has(g.id)).map(g => g.id)
  await gorselleriSil(silinecek)
  return silinecek.length
}

// ------------------------------------------------------------------ bu tarayıcıda kalmış eski verileri hesaba taşı
async function yereldenTasi(bildir) {
  let yazilacak = false
  const eskiOptik = yerelOku(ESKI_OPTIK)
  let eskiProfil = null
  try { eskiProfil = JSON.parse(yerelOku(ESKI_PROFIL) || 'null') } catch { yerelSil(ESKI_PROFIL) }
  if (eskiOptik && !d.optik) { d.optik = eskiOptik; yazilacak = true }
  if (eskiProfil && typeof eskiProfil === 'object' && !Object.keys(d.profil).length) { d.profil = eskiProfil; yazilacak = true }
  if (yazilacak) { d.bekliyor = true; await kisiselGonder() }
  if (eskiOptik && d.optik === eskiOptik) yerelSil(ESKI_OPTIK)
  if (eskiProfil && JSON.stringify(d.profil) === JSON.stringify(eskiProfil)) yerelSil(ESKI_PROFIL)

  await eskiVeritabaniniTasi(bildir)
}

function yerelOku(anahtar) {
  try { return localStorage.getItem(anahtar) } catch { return null }
}

function yerelSil(anahtar) {
  try { localStorage.removeItem(anahtar) } catch { /* yok */ }
}

async function eskiVeritabaniniTasi(bildir) {
  if (typeof indexedDB === 'undefined') return
  if (indexedDB.databases) {
    const liste = await indexedDB.databases().catch(() => null)
    if (liste && !liste.some(v => v.name === ESKI_VT)) return
  }
  const vt = await new Promise(res => {
    try {
      const r = indexedDB.open(ESKI_VT)
      r.onsuccess = () => res(r.result)
      r.onerror = () => res(null)
      r.onblocked = () => res(null)
    } catch { res(null) }
  })
  if (!vt) return
  const tumu = depo => (vt.objectStoreNames.contains(depo)
    ? new Promise((res, rej) => {
      const r = vt.transaction(depo, 'readonly').objectStore(depo).getAll()
      r.onsuccess = () => res(r.result || [])
      r.onerror = () => rej(r.error)
    })
    : Promise.resolve([]))
  let sinavlar, gorseller
  try {
    [sinavlar, gorseller] = await Promise.all([tumu('sinavlar'), tumu('gorseller')])
  } finally {
    vt.close()
  }

  if (sinavlar.length || gorseller.length) {
    const { data, error } = await supabase.from('sinavlar').select('id').eq('alan', d.alan)
    if (error) hataFirlat(error)
    const buluttaki = new Set(data.map(r => r.id))
    const toplam = sinavlar.length + gorseller.length
    let n = 0
    for (const g of gorseller) {
      bildir(`Bu cihazdaki sınavlar hesabınıza taşınıyor… ${++n}/${toplam}`)
      if (g && g.id && g.blob) await gorselKaydet(g)
    }
    for (const s of sinavlar) {
      bildir(`Bu cihazdaki sınavlar hesabınıza taşınıyor… ${++n}/${toplam}`)
      if (s && s.id && !buluttaki.has(s.id)) await sinavKaydet(s)
    }
  }

  await new Promise(res => {
    try {
      const r = indexedDB.deleteDatabase(ESKI_VT)
      r.onsuccess = r.onerror = r.onblocked = () => res()
    } catch { res() }
  })
}

/*
 * Sınavlar ve görseller tarayıcının kendi veritabanında (IndexedDB) saklanır: sunucuya hiçbir şey gitmez.
 * IndexedDB kullanılamıyorsa (bazı gizli pencereler) bellekte tutulur ve arayüz uyarır.
 */
const VT_AD = 'optik-okuyucu-sinav'
const VT_SURUM = 1
const PROFIL = 'optik-okuyucu.ogretmen'

let vtSoz = null
const bellek = { sinavlar: new Map(), gorseller: new Map() }
export let kalici = true

function vtAc() {
  if (vtSoz) return vtSoz
  vtSoz = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('yok')
      const istek = indexedDB.open(VT_AD, VT_SURUM)
      istek.onupgradeneeded = () => {
        const vt = istek.result
        if (!vt.objectStoreNames.contains('sinavlar')) vt.createObjectStore('sinavlar', { keyPath: 'id' })
        if (!vt.objectStoreNames.contains('gorseller')) {
          const g = vt.createObjectStore('gorseller', { keyPath: 'id' })
          g.createIndex('sinavId', 'sinavId')
        }
      }
      istek.onsuccess = () => resolve(istek.result)
      istek.onerror = () => { kalici = false; resolve(null) }
      istek.onblocked = () => { /* başka sekme eski sürümle açık */ }
    } catch {
      kalici = false
      resolve(null)
    }
  })
  return vtSoz
}

function islem(depo, kip, fn) {
  return vtAc().then(vt => new Promise((resolve, reject) => {
    if (!vt) { resolve(fn(null)); return }
    let sonuc
    const tx = vt.transaction(depo, kip)
    const d = tx.objectStore(depo)
    const r = fn(d)
    if (r && typeof r.onsuccess !== 'undefined') r.onsuccess = () => { sonuc = r.result }
    else sonuc = r
    tx.oncomplete = () => resolve(sonuc)
    tx.onerror = () => reject(tx.error || new Error('veritabanı hatası'))
    tx.onabort = () => reject(tx.error || new Error('veritabanı işlemi iptal edildi'))
  }))
}

// ------------------------------------------------------------------ sınavlar
export async function sinavlariListele() {
  const liste = await islem('sinavlar', 'readonly', d => (d ? d.getAll() : [...bellek.sinavlar.values()]))
  return (liste || []).sort((a, b) => (b.guncelleme || 0) - (a.guncelleme || 0))
}

export function sinavGetir(id) {
  return islem('sinavlar', 'readonly', d => (d ? d.get(id) : bellek.sinavlar.get(id)))
}

export function sinavKaydet(sinav) {
  const kopya = JSON.parse(JSON.stringify(sinav))
  return islem('sinavlar', 'readwrite', d => (d ? d.put(kopya) : bellek.sinavlar.set(kopya.id, kopya)))
}

export async function sinavSil(id) {
  const gorseller = await sinavGorselleri(id)
  await islem('gorseller', 'readwrite', d => {
    for (const g of gorseller) { if (d) d.delete(g.id); else bellek.gorseller.delete(g.id) }
  })
  return islem('sinavlar', 'readwrite', d => (d ? d.delete(id) : bellek.sinavlar.delete(id)))
}

// ------------------------------------------------------------------ görseller  { id, sinavId, blob, genislik, yukseklik, tur }
export function gorselKaydet(g) {
  return islem('gorseller', 'readwrite', d => (d ? d.put(g) : bellek.gorseller.set(g.id, g)))
}

export function gorselGetir(id) {
  return islem('gorseller', 'readonly', d => (d ? d.get(id) : bellek.gorseller.get(id)))
}

export function sinavGorselleri(sinavId) {
  return islem('gorseller', 'readonly', d => (d ? d.index('sinavId').getAll(sinavId) : [...bellek.gorseller.values()].filter(g => g.sinavId === sinavId)))
}

/** Sınavda artık kullanılmayan görselleri siler */
export async function kullanilmayanGorselleriSil(sinavId, kullanilan) {
  const hepsi = await sinavGorselleri(sinavId)
  const silinecek = hepsi.filter(g => !kullanilan.has(g.id))
  if (!silinecek.length) return 0
  await islem('gorseller', 'readwrite', d => { for (const g of silinecek) { if (d) d.delete(g.id); else bellek.gorseller.delete(g.id) } })
  return silinecek.length
}

// ------------------------------------------------------------------ öğretmen bilgileri (yeni sınavlarda hazır gelir)
export function profilGetir() {
  try { return JSON.parse(localStorage.getItem(PROFIL) || '{}') || {} } catch { return {} }
}

export function profilKaydet(p) {
  try { localStorage.setItem(PROFIL, JSON.stringify({ ...profilGetir(), ...p })) } catch { /* yok */ }
}

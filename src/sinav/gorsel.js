/*
 * Soru görselleri: yüklenen resim baskıya yetecek çözünürlükte küçültülür (uzun kenar en fazla 2000 px ≈ 300 dpi'da 17 cm),
 * veritabanına Blob olarak yazılır. Ekranda gösterim için adres (object URL) önbelleklenir.
 */
import { useEffect, useState } from 'react'
import { gorselGetir, gorselKaydet } from './depo.js'
import { yeniId } from './model.js'

const MAKS = 2000
const adresler = new Map()        // id -> { url, genislik, yukseklik }
const bekleyen = new Map()        // id -> Promise

async function coz(dosya) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(dosya, { imageOrientation: 'from-image' }) } catch { /* aşağıdaki yol */ }
  }
  const url = URL.createObjectURL(dosya)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Resim açılamadı. JPG, PNG ya da WEBP deneyin.')); img.src = url })
    return img
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
}

/** Dosyayı işler ve kaydeder. dönüş: { id, genislik, yukseklik } */
export async function gorselEkle(dosya, sinavId) {
  if (!dosya || !/^image\//.test(dosya.type || '')) throw new Error('Lütfen bir resim dosyası seçin (JPG, PNG, WEBP).')
  const kaynak = await coz(dosya)
  const w0 = kaynak.width || kaynak.naturalWidth, h0 = kaynak.height || kaynak.naturalHeight
  if (!w0 || !h0) throw new Error('Resim okunamadı.')
  const oran = Math.min(1, MAKS / Math.max(w0, h0))
  const w = Math.round(w0 * oran), h = Math.round(h0 * oran)
  const saydam = /png|gif|webp|svg/.test(dosya.type)
  let blob = dosya
  if (oran < 1 || /svg|gif|heic|heif|bmp|tiff/.test(dosya.type) || dosya.size > 2.5e6) {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const x = c.getContext('2d')
    if (!saydam) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h) }
    x.imageSmoothingQuality = 'high'
    x.drawImage(kaynak, 0, 0, w, h)
    blob = await new Promise(r => c.toBlob(r, saydam ? 'image/png' : 'image/jpeg', 0.9))
    if (!blob) throw new Error('Resim işlenemedi.')
  }
  if (kaynak.close) kaynak.close()
  const id = yeniId()
  await gorselKaydet({ id, sinavId, blob, genislik: w, yukseklik: h, tur: blob.type })
  adresler.set(id, { url: URL.createObjectURL(blob), genislik: w, yukseklik: h })
  return { id, genislik: w, yukseklik: h }
}

/** Görsel adresi (önbellekli) */
export function gorselAdresi(id) {
  if (!id) return Promise.resolve(null)
  if (adresler.has(id)) return Promise.resolve(adresler.get(id))
  if (!bekleyen.has(id)) {
    bekleyen.set(id, gorselGetir(id).then(g => {
      bekleyen.delete(id)
      if (!g || !g.blob) return null
      const v = { url: URL.createObjectURL(g.blob), genislik: g.genislik, yukseklik: g.yukseklik }
      adresler.set(id, v)
      return v
    }).catch(() => { bekleyen.delete(id); return null }))
  }
  return bekleyen.get(id)
}

export function useGorsel(id) {
  const [v, setV] = useState(() => (id && adresler.get(id)) || null)
  useEffect(() => {
    let iptal = false
    if (!id) { setV(null); return }
    if (adresler.has(id)) { setV(adresler.get(id)); return }
    gorselAdresi(id).then(x => { if (!iptal) setV(x) })
    return () => { iptal = true }
  }, [id])
  return v
}

/** Görselin başka bir sınava (ya da öğretmen profiline) kopyası: { id, genislik, yukseklik } */
export async function gorselKopyala(id, sinavId) {
  const g = await gorselGetir(id)
  if (!g || !g.blob) return null
  const yeni = yeniId()
  await gorselKaydet({ ...g, id: yeni, sinavId })
  return { id: yeni, genislik: g.genislik, yukseklik: g.yukseklik }
}

/** Word dışa aktarımı için ham baytlar */
export async function gorselBaytlari(id) {
  const g = await gorselGetir(id)
  if (!g || !g.blob) return null
  return { veri: new Uint8Array(await g.blob.arrayBuffer()), genislik: g.genislik, yukseklik: g.yukseklik, tur: g.blob.type }
}

/** Dışa aktarma (yedek dosyası) için data URL */
export async function gorselDataUrl(id) {
  const g = await gorselGetir(id)
  if (!g || !g.blob) return null
  return await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res({ url: f.result, genislik: g.genislik, yukseklik: g.yukseklik }); f.onerror = rej; f.readAsDataURL(g.blob) })
}

/** Yedekten görsel geri yükleme */
export async function gorselDataUrldenKaydet(id, sinavId, veri) {
  const blob = await (await fetch(veri.url)).blob()
  await gorselKaydet({ id, sinavId, blob, genislik: veri.genislik, yukseklik: veri.yukseklik, tur: blob.type })
}

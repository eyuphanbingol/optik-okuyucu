/*
 * Ana ekran <-> okuyucu köprüsü.
 *
 * Yükleme sırası (her adımın hatası ayrı ayrı raporlanır):
 *   1) OpenCV dosyası indirilir (ilerleme gösterilir, önbellekte kalır)
 *   2) Referans form görüntüsü çözülür
 *   3) Okuyucu arka plan iş parçacığında (Worker) başlatılır
 *   4) Worker herhangi bir sebeple çalışmazsa okuyucu ana ekranda çalıştırılır (yedek yol)
 */
import OkuyucuWorker from './worker.js?worker'
import referansUrl from './referans.png?url'
import geo from './geometri.json'
import cvBilgi from './opencv-surum.json'
import { okuyucuOlustur } from './okuyucu.js'

const WORKER_ZAMAN_ASIMI = 120000

let worker = null
let sayac = 0
const bekleyen = new Map()
let hazirSoz = null
let mod = null            // 'worker' | 'ana'
let anaOkuyucu = null
let anaCv = null

export function calismaModu() { return mod }

// ------------------------------------------------------------------ yardımcılar
/** Resim dosyasını / adresini ImageData'ya çevirir (EXIF yönü tarayıcı tarafından uygulanır). */
export function resimVerisi(kaynak) {
  return new Promise((resolve, reject) => {
    const url = typeof kaynak === 'string' ? kaynak : URL.createObjectURL(kaynak)
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, c.width, c.height))
      } catch (e) { reject(e) } finally { if (typeof kaynak !== 'string') URL.revokeObjectURL(url) }
    }
    img.onerror = () => {
      if (typeof kaynak !== 'string') URL.revokeObjectURL(url)
      reject(new Error('Resim açılamadı (desteklenmeyen biçim olabilir; JPG ya da PNG deneyin)'))
    }
    img.src = url
  })
}

async function indir(url, ilerleme) {
  let yanit
  try {
    yanit = await fetch(url, { cache: 'force-cache' })
  } catch (e) {
    throw new Error(`okuyucu dosyası indirilemedi (${e.message || 'ağ hatası'}). İnternet bağlantınızı kontrol edin.`)
  }
  if (!yanit.ok) throw new Error(`okuyucu dosyası sunucuda bulunamadı (HTTP ${yanit.status}: ${url}). Site yanlış yüklenmiş olabilir.`)
  const toplam = Number(yanit.headers.get('content-length')) || cvBilgi.boyut || 0
  if (!yanit.body || !yanit.body.getReader) {
    const b = await yanit.blob()
    ilerleme && ilerleme(1)
    return b
  }
  const okuyucu = yanit.body.getReader()
  const parcalar = []
  let alinan = 0
  for (;;) {
    const { done, value } = await okuyucu.read()
    if (done) break
    parcalar.push(value)
    alinan += value.length
    if (ilerleme && toplam) ilerleme(Math.min(alinan / toplam, 0.99))
  }
  ilerleme && ilerleme(1)
  return new Blob(parcalar, { type: 'text/javascript' })
}

// ------------------------------------------------------------------ worker yolu
function workerIstek(tip, veri = {}, aktar = []) {
  const id = ++sayac
  return new Promise((resolve, reject) => {
    bekleyen.set(id, { resolve, reject })
    worker.postMessage({ id, tip, ...veri }, aktar)
  })
}

function workerBaslat(cvBlob, cvUrl, ref) {
  return new Promise((resolve, reject) => {
    let bitti = false
    const zamanlayici = setTimeout(() => { if (!bitti) { bitti = true; reject(new Error('okuyucu iş parçacığı zamanında başlamadı')) } }, WORKER_ZAMAN_ASIMI)
    try {
      worker = new OkuyucuWorker()
    } catch (e) {
      clearTimeout(zamanlayici)
      reject(new Error('iş parçacığı oluşturulamadı: ' + (e.message || e)))
      return
    }
    worker.onmessage = (e) => {
      const p = bekleyen.get(e.data.id)
      if (!p) return
      bekleyen.delete(e.data.id)
      if (e.data.tamam) p.resolve(e.data)
      else p.reject(new Error(e.data.hata || 'okuyucu hatası'))
    }
    worker.onerror = (e) => {
      const ayrinti = e && e.message ? `${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}` : 'iş parçacığı dosyası yüklenemedi'
      for (const p of bekleyen.values()) p.reject(new Error(ayrinti))
      bekleyen.clear()
      if (!bitti) { bitti = true; clearTimeout(zamanlayici); reject(new Error(ayrinti)) }
    }
    workerIstek('hazir', { cvBlob, cvUrl, referans: { w: ref.width, h: ref.height, buf: ref.data.buffer } }, [ref.data.buffer])
      .then(() => { if (!bitti) { bitti = true; clearTimeout(zamanlayici); resolve() } })
      .catch(e => { if (!bitti) { bitti = true; clearTimeout(zamanlayici); reject(e) } })
  })
}

// ------------------------------------------------------------------ ana ekran (yedek) yolu
function scriptYukle(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('okuyucu dosyası sayfaya yüklenemedi'))
    document.head.appendChild(s)
  })
}

async function anaEkranBaslat(cvBlobUrl, cvUrl) {
  if (!window.cv) {
    try { await scriptYukle(cvBlobUrl) } catch { await scriptYukle(cvUrl) }
  }
  if (!window.cv) throw new Error('OpenCV yüklendi ama başlatılamadı')
  let c = window.cv
  if (typeof c === 'function' && !c.Mat) c = c()
  if (c && typeof c.then === 'function') c = await c
  if (!c.Mat) await new Promise(r => { c.onRuntimeInitialized = r })
  anaCv = c
  const r = await resimVerisi(referansUrl)
  const ref = anaCv.matFromImageData(r)
  anaOkuyucu = okuyucuOlustur(anaCv, geo, { referans: ref })
  ref.delete()
}

// ------------------------------------------------------------------ dışa açık
/**
 * Okuyucuyu yükler. ilerleme(oran 0..1, mesaj) çağrılır. Birden çok kez çağrılabilir.
 * Hata olursa hangi adımda olduğunu söyleyen mesajla reddeder.
 */
export function hazirla(ilerleme) {
  if (hazirSoz) return hazirSoz
  hazirSoz = (async () => {
    const cvUrl = new URL(cvBilgi.dosya, window.location.href).href
    ilerleme && ilerleme(0, 'Okuyucu indiriliyor…')
    const blob = await indir(cvUrl, o => ilerleme && ilerleme(o * 0.9, 'Okuyucu indiriliyor…'))
    const cvBlob = URL.createObjectURL(blob)
    ilerleme && ilerleme(0.92, 'Okuyucu hazırlanıyor…')
    let workerHatasi = null
    if (typeof Worker !== 'undefined') {
      try {
        const ref = await resimVerisi(referansUrl)
        await workerBaslat(cvBlob, cvUrl, ref)
        mod = 'worker'
        try { window.__optikMod = mod } catch { /* yok */ }
        ilerleme && ilerleme(1, 'Hazır')
        return
      } catch (e) {
        workerHatasi = e
        try { worker && worker.terminate() } catch { /* yok */ }
        worker = null
        console.warn('Okuyucu iş parçacığında başlatılamadı, ana ekranda çalıştırılacak:', e)
      }
    }
    try {
      await anaEkranBaslat(cvBlob, cvUrl)
      mod = 'ana'
      try { window.__optikMod = mod } catch { /* yok */ }
      ilerleme && ilerleme(1, 'Hazır')
    } catch (e) {
      throw new Error(`${workerHatasi ? `iş parçacığı: ${workerHatasi.message}; ` : ''}ana ekran: ${e.message}`)
    }
  })().catch(e => { hazirSoz = null; throw e })
  return hazirSoz
}

const bekle = () => new Promise(r => setTimeout(r, 0))

export async function isaretBul(imageData) {
  if (mod === 'worker') {
    const r = await workerIstek('isaret', { w: imageData.width, h: imageData.height, buf: imageData.data.buffer }, [imageData.data.buffer])
    return r.bulunan
  }
  if (mod === 'ana') {
    await bekle()
    const m = anaCv.matFromImageData(imageData)
    try { return anaOkuyucu.isaretleriBul(m, true) } finally { m.delete() }
  }
  throw new Error('Okuyucu hazır değil')
}

export async function kagitOku(imageData, gorseller = true) {
  if (mod === 'worker') {
    const r = await workerIstek('oku', { w: imageData.width, h: imageData.height, buf: imageData.data.buffer, gorseller }, [imageData.data.buffer])
    return r.sonuc
  }
  if (mod === 'ana') {
    await bekle()
    const m = anaCv.matFromImageData(imageData)
    try { return anaOkuyucu.oku(m, { gorseller }) } finally { m.delete() }
  }
  throw new Error('Okuyucu hazır değil')
}

/** {genislik, yukseklik, veri} -> dataURL (kontrol penceresinde göstermek için) */
export function gorselUrl(g) {
  if (!g) return null
  const c = document.createElement('canvas')
  c.width = g.genislik
  c.height = g.yukseklik
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(g.veri), g.genislik, g.yukseklik), 0, 0)
  return c.toDataURL('image/jpeg', 0.85)
}

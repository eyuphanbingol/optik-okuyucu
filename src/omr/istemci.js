/*
 * Ana ekran <-> okuyucu köprüsü.
 *
 * Yükleme sırası (her adımın hatası ayrı ayrı raporlanır):
 *   1) OpenCV indirilir (ilerleme gösterilir, önbellekte kalır). Bu sırada referans form görüntüsü de paralel çözülür.
 *      Hızlı sürüm varsa (küçük yapıştırıcı kod + ayrı .wasm) o indirilir: JS ayrıştırma/çözme yükü olmadan çok daha hızlı açılır.
 *   2) Okuyucu arka plan iş parçacığında (Worker) başlatılır
 *   3) Worker herhangi bir sebeple çalışmazsa okuyucu ana ekranda çalıştırılır (yedek yol)
 *   4) Hızlı sürümde herhangi bir sorun olursa tek parça OpenCV dosyasıyla eski yoldan yeniden denenir
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

/**
 * Dosyayı ilerleme bildirerek indirir. beklenenBoyut: dosyanın sıkıştırılmamış boyutu (derlemede yazılır).
 * Not: sunucu dosyayı sıkıştırarak gönderdiğinde content-length sıkıştırılmış boyuttur; okunan baytlar ise açılmış
 * haldedir. Bu yüzden oran, derlemede kaydedilen gerçek boyuta göre hesaplanır.
 */
async function indir(url, ilerleme, beklenenBoyut, tur) {
  let yanit
  try {
    yanit = await fetch(url, { cache: 'force-cache' })
  } catch (e) {
    throw new Error(`okuyucu dosyası indirilemedi (${e.message || 'ağ hatası'}). İnternet bağlantınızı kontrol edin.`)
  }
  if (!yanit.ok) throw new Error(`okuyucu dosyası sunucuda bulunamadı (HTTP ${yanit.status}: ${url}). Site yanlış yüklenmiş olabilir.`)
  const toplam = beklenenBoyut || Number(yanit.headers.get('content-length')) || 0
  if (!yanit.body || !yanit.body.getReader) {
    const b = await yanit.blob()
    ilerleme && ilerleme(1)
    return new Blob([b], { type: tur })
  }
  const okuyucu = yanit.body.getReader()
  const parcalar = []
  let alinan = 0
  let sonYuzde = -1
  for (;;) {
    const { done, value } = await okuyucu.read()
    if (done) break
    parcalar.push(value)
    alinan += value.length
    if (ilerleme && toplam) {
      // yalnızca yüzde değiştiğinde bildir: ekran her parçada yeniden çizilmez, indirme hızlanır
      const oran = Math.min(alinan / toplam, 0.99)
      const yuzde = Math.floor(oran * 100)
      if (yuzde !== sonYuzde) { sonYuzde = yuzde; ilerleme(oran) }
    }
  }
  ilerleme && ilerleme(1)
  return new Blob(parcalar, { type: tur })
}

// ------------------------------------------------------------------ worker yolu
function workerIstek(tip, veri = {}, aktar = []) {
  const id = ++sayac
  return new Promise((resolve, reject) => {
    bekleyen.set(id, { resolve, reject })
    worker.postMessage({ id, tip, ...veri }, aktar)
  })
}

/** İş parçacığını oluşturur (dosyası indirme sırasında paralel yüklensin diye erkenden çağrılır). */
function workerOlustur() {
  if (worker) return worker
  worker = new OkuyucuWorker()
  worker.onmessage = (e) => {
    const p = bekleyen.get(e.data.id)
    if (!p) return
    bekleyen.delete(e.data.id)
    if (e.data.tamam) p.resolve(e.data)
    else p.reject(new Error(e.data.hata || 'okuyucu hatası'))
  }
  worker.onerror = (e) => {
    const ayrinti = e && e.message ? `${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}` : 'iş parçacığı dosyası yüklenemedi'
    worker.__hata = ayrinti
    for (const p of bekleyen.values()) p.reject(new Error(ayrinti))
    bekleyen.clear()
  }
  return worker
}

function workerBaslat(cv, ref) {
  return new Promise((resolve, reject) => {
    let bitti = false
    const zamanlayici = setTimeout(() => { if (!bitti) { bitti = true; reject(new Error('okuyucu iş parçacığı zamanında başlamadı')) } }, WORKER_ZAMAN_ASIMI)
    try {
      workerOlustur()
    } catch (e) {
      clearTimeout(zamanlayici)
      reject(new Error('iş parçacığı oluşturulamadı: ' + (e.message || e)))
      return
    }
    if (worker.__hata) { clearTimeout(zamanlayici); reject(new Error(worker.__hata)); return }
    const onceki = worker.onerror
    worker.onerror = (e) => {
      onceki && onceki(e)
      if (!bitti) { bitti = true; clearTimeout(zamanlayici); reject(new Error(worker.__hata || 'iş parçacığı dosyası yüklenemedi')) }
    }
    // referans görüntünün kopyası gönderilir: iş parçacığı çalışmazsa ana ekran yedeği aynı görüntüyü kullanabilsin
    const refKopya = new Uint8Array(ref.data).buffer
    workerIstek('hazir', { ...cv, referans: { w: ref.width, h: ref.height, buf: refKopya } }, [refKopya])
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

async function cvBekle(c) {
  if (typeof c === 'function' && !c.Mat) c = c()
  if (c && typeof c.then === 'function') c = await c
  if (!c.Mat) await new Promise(r => { c.onRuntimeInitialized = r })
  return c
}

/** Hızlı sürüm: ayrı .wasm baytları + küçük yapıştırıcı kod. */
async function anaEkranAyriYukle(wasmBayt, yapistiriciUrl) {
  const modul = await WebAssembly.compile(wasmBayt)
  let reddet
  const hata = new Promise((_, r) => { reddet = r })
  window.__optikCvModul = {
    instantiateWasm(imports, basari) {
      WebAssembly.instantiate(modul, imports).then(i => basari(i, modul), reddet)
      return {}
    },
  }
  try {
    await scriptYukle(yapistiriciUrl)
    if (!window.cv) throw new Error('OpenCV yüklendi ama başlatılamadı')
    return await Promise.race([cvBekle(window.cv), hata])
  } finally {
    delete window.__optikCvModul
  }
}

async function anaEkranBaslat(yol, ref) {
  let c = null
  if (yol.wasmBayt) {
    try { c = await anaEkranAyriYukle(yol.wasmBayt, yol.yapistiriciUrl) } catch (e) {
      console.warn('OpenCV hızlı sürüm ana ekranda açılamadı, tek parça dosya deneniyor:', e)
      try { delete window.cv } catch { window.cv = undefined }
    }
  }
  if (!c) {
    if (!window.cv) {
      if (yol.cvBlobUrl) { try { await scriptYukle(yol.cvBlobUrl) } catch { await scriptYukle(yol.cvUrl) } }
      else await scriptYukle(yol.cvUrl)
    }
    if (!window.cv) throw new Error('OpenCV yüklendi ama başlatılamadı')
    c = await cvBekle(window.cv)
  }
  anaCv = c
  const refMat = anaCv.matFromImageData(ref)
  anaOkuyucu = okuyucuOlustur(anaCv, geo, { referans: refMat })
  refMat.delete()
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
    // indirme sürerken paralel: referans görüntüyü çöz, iş parçacığını oluştur
    const refSoz = resimVerisi(referansUrl)
    refSoz.catch(() => {})
    if (typeof Worker !== 'undefined') { try { workerOlustur() } catch { /* aşağıda tekrar denenir ve raporlanır */ } }

    // ---- OpenCV'yi indir: önce hızlı sürüm, olmazsa tek parça dosya
    const yol = { cvUrl }
    const bildir = o => ilerleme && ilerleme(o * 0.9, 'Okuyucu indiriliyor…')
    if (cvBilgi.ayri) {
      try {
        const wasmUrl = new URL(cvBilgi.ayri.wasm, window.location.href).href
        const blob = await indir(wasmUrl, bildir, cvBilgi.ayri.wasmBoyut, 'application/wasm')
        yol.wasmBayt = await blob.arrayBuffer()
        yol.yapistiriciUrl = new URL(cvBilgi.ayri.js, window.location.href).href
      } catch (e) {
        console.warn('OpenCV hızlı sürüm indirilemedi, tek parça dosya indiriliyor:', e)
      }
    }
    if (!yol.wasmBayt) {
      const blob = await indir(cvUrl, bildir, cvBilgi.boyut, 'text/javascript')
      yol.cvBlobUrl = URL.createObjectURL(blob)
    }
    ilerleme && ilerleme(0.92, 'Okuyucu hazırlanıyor…')
    const ref = await refSoz

    // ---- 1. yol: arka plan iş parçacığı
    let workerHatasi = null
    if (typeof Worker !== 'undefined') {
      try {
        await workerBaslat({ cvWasm: yol.wasmBayt, cvYapistirici: yol.yapistiriciUrl, cvBlob: yol.cvBlobUrl, cvUrl }, ref)
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
    // ---- 2. yol: ana ekran
    try {
      await anaEkranBaslat(yol, ref)
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

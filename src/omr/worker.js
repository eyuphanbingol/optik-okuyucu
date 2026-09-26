// Okuma işlemleri bu arka plan iş parçacığında yapılır; ekran donmaz.
// Klasik (module olmayan) iş parçacığıdır: tüm tarayıcılarda çalışır. OpenCV importScripts ile yüklenir.
import geo from './geometri.json'
import { okuyucuOlustur } from './okuyucu.js'

let cv = null
let okuyucu = null
let hazirlik = null

async function betikCalistir(adres) {
  // 1) klasik iş parçacığı: importScripts   2) modül iş parçacığı (geliştirme ortamı): kodu indirip çalıştır
  try {
    importScripts(adres)
    return
  } catch (e) { /* modül iş parçacığı olabilir: aşağıdaki yolu dene */ }
  const yanit = await fetch(adres)
  if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`)
  const kod = await yanit.text()
  ;(0, eval)(kod)
}

/** Hızlı sürüm: ayrı .wasm baytları derlenir, küçük yapıştırıcı kod bu derlenmiş modülü kullanır. */
async function ayriYukle(m) {
  const modul = await WebAssembly.compile(m.cvWasm)
  let reddet
  const hata = new Promise((_, r) => { reddet = r })
  self.__optikCvModul = {
    instantiateWasm(imports, basari) {
      WebAssembly.instantiate(modul, imports).then(i => basari(i, modul), reddet)
      return {}
    },
  }
  try {
    await betikCalistir(m.cvYapistirici)
    if (!self.cv) throw new Error('yapıştırıcı kod çalışmadı')
    let c = self.cv
    if (typeof c === 'function' && !c.Mat) c = c()
    if (c && typeof c.then === 'function') c = await Promise.race([c, hata])
    if (!c || !c.Mat) throw new Error('OpenCV başlatılamadı')
    return c
  } finally {
    delete self.__optikCvModul
  }
}

async function opencvYukle(m) {
  let hata = null
  if (m.cvWasm && m.cvYapistirici) {
    try {
      return await ayriYukle(m)
    } catch (e) {
      hata = e
      try { delete self.cv } catch { self.cv = undefined }
      console.warn('OpenCV hızlı sürüm açılamadı, tek parça dosya deneniyor:', e)
    }
  }
  for (const adres of [m.cvBlob, m.cvUrl].filter(Boolean)) {
    // 1) klasik iş parçacığı: importScripts
    try {
      importScripts(adres)
      if (self.cv) return self.cv
    } catch (e) {
      hata = e
    }
    // 2) modül iş parçacığı (geliştirme ortamı): importScripts kullanılamaz, kodu indirip çalıştır
    try {
      const kod = await (await fetch(adres)).text()
      ;(0, eval)(kod)
      if (self.cv) return self.cv
    } catch (e) {
      hata = e
    }
  }
  throw new Error('OpenCV iş parçacığına yüklenemedi: ' + (hata && hata.message ? hata.message : 'bilinmeyen'))
}

async function hazirla(m) {
  let c = await opencvYukle(m)
  if (typeof c === 'function' && !c.Mat) c = c()
  if (c && typeof c.then === 'function') c = await c
  if (!c.Mat) await new Promise(r => { c.onRuntimeInitialized = r })
  cv = c
  const ref = new cv.Mat(m.referans.h, m.referans.w, cv.CV_8UC4)
  ref.data.set(new Uint8Array(m.referans.buf))
  okuyucu = okuyucuOlustur(cv, geo, { referans: ref })
  ref.delete()
}

function aktarimlar(sonuc) {
  const t = []
  const ekle = g => { if (g && g.veri) t.push(g.veri.buffer) }
  if (sonuc && sonuc.gorsel) Object.values(sonuc.gorsel).forEach(ekle)
  if (sonuc && sonuc.soruGorsel) Object.values(sonuc.soruGorsel).forEach(ekle)
  return t
}

self.onmessage = async (e) => {
  const m = e.data
  try {
    if (m.tip === 'hazir') {
      if (!hazirlik) hazirlik = hazirla(m).catch(err => { hazirlik = null; throw err })
      await hazirlik
      self.postMessage({ id: m.id, tamam: true })
      return
    }
    if (!hazirlik) throw new Error('Okuyucu hazır değil')
    await hazirlik
    const mat = new cv.Mat(m.h, m.w, cv.CV_8UC4)
    mat.data.set(new Uint8Array(m.buf))
    try {
      if (m.tip === 'isaret') {
        self.postMessage({ id: m.id, tamam: true, bulunan: okuyucu.isaretleriBul(mat, true) })
      } else if (m.tip === 'oku') {
        const sonuc = okuyucu.oku(mat, { gorseller: m.gorseller !== false })
        self.postMessage({ id: m.id, tamam: true, sonuc }, aktarimlar(sonuc))
      }
    } finally {
      mat.delete()
    }
  } catch (err) {
    self.postMessage({ id: m.id, tamam: false, hata: String((err && err.message) || err) })
  }
}

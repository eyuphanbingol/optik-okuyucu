// Okuma işlemleri bu arka plan iş parçacığında yapılır; ekran donmaz.
// Klasik (module olmayan) iş parçacığıdır: tüm tarayıcılarda çalışır. OpenCV importScripts ile yüklenir.
import geo from './geometri.json'
import { okuyucuOlustur } from './okuyucu.js'

let cv = null
let okuyucu = null
let hazirlik = null

async function opencvYukle(m) {
  let hata = null
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

// OpenCV.js'i ayrı bir statik dosya olarak public/opencv/ altına kopyalar (derlemeden önce otomatik çalışır).
// Ayrı dosya: tarayıcı önbelleğinde uzun süre kalır, iş parçacığına importScripts ile yüklenir.
//
// HIZ: Paketteki opencv.js, WebAssembly kodunu dev bir metin olarak içinde taşır (13 MB). Tarayıcı bunu her açılışta
// JS olarak ayrıştırıp çözmek zorunda kalır. Bu betik ayrıca iki parçalı hızlı sürüm üretir:
//   opencv-<sürüm>.glue.js  (küçük yapıştırıcı kod, ~130 KB)   +   opencv-<sürüm>.wasm  (ikili kod)
// Okuyucu önce hızlı sürümü kullanır; herhangi bir sorun olursa otomatik olarak tek parça dosyaya döner.
// Parçalama başarısız olursa (ör. farklı bir OpenCV sürümü) yalnızca tek parça dosya kullanılır — eski davranış.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const paket = path.join(kok, 'node_modules', '@techstark', 'opencv-js')
const surum = JSON.parse(fs.readFileSync(path.join(paket, 'package.json'), 'utf8')).version
const kaynak = path.join(paket, 'dist', 'opencv.js')
const hedefKlasor = path.join(kok, 'public', 'opencv')
const hedefAd = `opencv-${surum}.js`
const yapistiriciAd = `opencv-${surum}.glue.js`
const wasmAd = `opencv-${surum}.wasm`
fs.mkdirSync(hedefKlasor, { recursive: true })
for (const f of fs.readdirSync(hedefKlasor)) if (![hedefAd, yapistiriciAd, wasmAd].includes(f)) fs.rmSync(path.join(hedefKlasor, f))
fs.copyFileSync(kaynak, path.join(hedefKlasor, hedefAd))
const bilgi = { dosya: `/opencv/${hedefAd}`, boyut: fs.statSync(kaynak).size }
console.log(`OpenCV kopyalandı: public/opencv/${hedefAd} (${(bilgi.boyut / 1e6).toFixed(1)} MB)`)

try {
  const { yapistirici, wasm } = await parcala(kaynak)
  fs.writeFileSync(path.join(hedefKlasor, yapistiriciAd), yapistirici)
  fs.writeFileSync(path.join(hedefKlasor, wasmAd), wasm)
  bilgi.ayri = { js: `/opencv/${yapistiriciAd}`, wasm: `/opencv/${wasmAd}`, wasmBoyut: wasm.length }
  console.log(`OpenCV hızlı sürüm: ${yapistiriciAd} (${(yapistirici.length / 1e3).toFixed(0)} KB) + ${wasmAd} (${(wasm.length / 1e6).toFixed(1)} MB)`)
} catch (e) {
  for (const f of [yapistiriciAd, wasmAd]) fs.rmSync(path.join(hedefKlasor, f), { force: true })
  console.warn(`OpenCV hızlı sürüm üretilemedi, tek parça dosya kullanılacak: ${e.message}`)
}
fs.writeFileSync(path.join(kok, 'src', 'omr', 'opencv-surum.json'), JSON.stringify(bilgi))

/** opencv.js -> { yapistirici: Buffer, wasm: Buffer }. Kalıplar tutmazsa hata fırlatır. */
async function parcala(dosya) {
  const metin = fs.readFileSync(dosya, 'latin1')   // bayt <-> karakter birebir
  const BAS = "function findWasmBinary(){return binaryDecode('"
  const i = metin.indexOf(BAS)
  if (i < 0 || metin.indexOf(BAS, i + 1) >= 0) throw new Error('gömülü wasm kalıbı bulunamadı')
  let j = i + BAS.length
  while (j < metin.length) {
    const c = metin.charCodeAt(j)
    if (c === 92) { j += 2; continue }   // kaçış karakteri
    if (c === 39) break                    // metnin sonu (')
    j++
  }
  if (metin.slice(j, j + 3) !== "')}") throw new Error('gömülü wasm sonu bulunamadı')
  const SON = 'return cv(Module);'
  let yapistirici = metin.slice(0, i) + "function findWasmBinary(){throw new Error('OpenCV wasm ayri dosyada')}" + metin.slice(j + 3)
  if (yapistirici.split(SON).length !== 2) throw new Error('modül fabrikası kalıbı bulunamadı')
  yapistirici = yapistirici.replace(SON, 'return cv(globalThis.__optikCvModul || Module);')

  // Gerçek wasm baytları: OpenCV'nin kendisi çalıştırılır ve WebAssembly'ye verdiği bayt dizisi yakalanır.
  const asil = WebAssembly.instantiate
  let yakalanan = null
  WebAssembly.instantiate = function (b, imp) {
    if (!yakalanan && (b instanceof Uint8Array || b instanceof ArrayBuffer)) {
      yakalanan = Buffer.from(b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength))
    }
    return asil.call(this, b, imp)
  }
  const gecici = path.join(hedefKlasor, `.gecici-${process.pid}.cjs`)
  try {
    fs.copyFileSync(dosya, gecici)
    let cv = createRequire(import.meta.url)(gecici)
    if (cv && typeof cv.then === 'function') cv = await cv
    else if (cv && !cv.Mat) await new Promise(r => { cv.onRuntimeInitialized = r })
    if (!cv || !cv.Mat) throw new Error('OpenCV başlatılamadı')
  } finally {
    WebAssembly.instantiate = asil
    fs.rmSync(gecici, { force: true })
  }
  if (!yakalanan || !WebAssembly.validate(yakalanan)) throw new Error('wasm baytları alınamadı')
  return { yapistirici: Buffer.from(yapistirici, 'latin1'), wasm: yakalanan }
}

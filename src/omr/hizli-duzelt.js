/*
 * Hızlı perspektif düzeltme (WebAssembly SIMD).
 *
 * OpenCV.js'in warpPerspective (INTER_LINEAR, BORDER_CONSTANT, 8 bit gri) fonksiyonunun BİT DÜZEYİNDE AYNI sonucu veren,
 * ~4 kat hızlı sürümü. Kaynak: arac/warp_simd.c (OpenCV 5.0 warpPerspectiveLinearInvoker_8UC1 skaler yolunun birebir kopyası;
 * her SIMD şeridi aynı float32 işlemleri aynı sırayla yapar).
 *
 * Güvenlik: okuyucu açılırken bu fonksiyon OpenCV ile karşılaştırılır (kendini sınama). En küçük fark görülürse,
 * tarayıcı SIMD desteklemiyorsa ya da herhangi bir hata olursa null döner ve okuyucu OpenCV'nin kendi fonksiyonunu kullanır.
 */
const WASM = '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'

function base64Coz(s) {
  const b = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary')
  const u = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i)
  return u
}

/** (kaynak Uint8Array, kaynakG, kaynakY, hedef Uint8Array, hedefG, hedefY, tersMatris[9], kenarDegeri) -> void, ya da null */
export function hizliDuzeltmeOlustur() {
  try {
    if (typeof WebAssembly !== 'object') return null
    const bayt = base64Coz(WASM)
    if (!WebAssembly.validate(bayt)) return null   // SIMD desteklenmiyor
    const bellek = new WebAssembly.Memory({ initial: 2 })
    const warp = new WebAssembly.Instance(new WebAssembly.Module(bayt), { env: { memory: bellek } }).exports.warp
    const MATRIS = 1024, KAYNAK = 2048
    return function duzelt(kaynak, kg, ky, hedef, hg, hy, ters, kenar) {
      const hedefAdres = KAYNAK + ((kg * ky + 15) & ~15)
      const gerek = hedefAdres + hg * hy
      if (bellek.buffer.byteLength < gerek) bellek.grow(Math.ceil((gerek - bellek.buffer.byteLength) / 65536))
      const buf = bellek.buffer
      new Float64Array(buf, MATRIS, 9).set(ters)
      new Uint8Array(buf, KAYNAK, kg * ky).set(kaynak.subarray(0, kg * ky))
      warp(KAYNAK, kg, ky, kg, hedefAdres, hg, hy, MATRIS, kenar)
      hedef.set(new Uint8Array(buf, hedefAdres, hg * hy))
    }
  } catch {
    return null
  }
}

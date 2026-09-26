/*
 * Optik form okuyucu çekirdeği (OpenCV.js)
 * ----------------------------------------
 * Tarayıcıda (Web Worker) ve Node'da (test) aynı kod çalışır.
 *
 * GÜVENLİK İLKESİ: Emin olunmayan hiçbir işaret tahminle okunmaz.
 *   - çift işaret, silik/yarım silinmiş işaret -> "not" ile işaretlenir, öğretmen onaylar
 *   - kâğıdın herhangi bir bölümü iyi hizalanamazsa kâğıt hiç okunmaz
 */

import { hizliDuzeltmeOlustur } from './hizli-duzelt.js'

export const HATA = {
  KOSE: 'kose',
  COZUNURLUK: 'cozunurluk',
  KIVRIK: 'kivrik',
  HIZA: 'hiza',
}

// koyulukHaritasi için tablo: KOYU_TABLO[arka << 8 | piksel] = clamp(1 - piksel / max(arka, 1), 0, 1)  (float32, birebir aynı değer)
const KOYU_TABLO = (() => {
  const t = new Float32Array(65536)
  for (let a = 0; a < 256; a++) {
    for (let g = 0; g < 256; g++) {
      const v = 1 - g / Math.max(a, 1)
      t[a << 8 | g] = v < 0 ? 0 : v > 1 ? 1 : v
    }
  }
  return t
})()

/** Hızlı düzeltme yalnızca sayfanın her yeri kameranın önünde (w > 0) ve koordinatlar makul aralıktaysa kullanılır. */
function hizliUygun(M, W, H) {
  for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
    const w = x * M[6] + y * M[7] + M[8]
    if (!(w > 1e-6)) return false
    const sx = (x * M[0] + y * M[1] + M[2]) / w, sy = (x * M[3] + y * M[4] + M[5]) / w
    if (!(Math.abs(sx) < 1e7 && Math.abs(sy) < 1e7)) return false
  }
  return true
}

export function okuyucuOlustur(cv, geo, secenek = {}) {
  const PX = geo.px
  const W = Math.round(geo.sayfa[0] * PX)
  const H = Math.round(geo.sayfa[1] * PX)
  const MIN_PX_MM = secenek.minPxMm ?? 3.6
  const HIZA_ESIK = secenek.hizaEsik ?? 0.2
  const HALKA = secenek.halka ?? 4             // hizalama şablonundaki halka kalınlığı (px)
  const HIZA_BULANIK = secenek.hizaBulanik ?? 0  // hizalamadan önce yumuşatma (sigma, px)
  const BLOK_ARAMA = 10       // kabarcık bloğu, sabit noktalardan tahmin edilen yerin ±10 px çevresinde aranır
  //                           (en sık ızgara aralığı 35 px: bir satır kayması için tahmin 25 px şaşmalı -> imkânsız)
  const SABIT_ARAMA = 30      // sabit nokta arama penceresi (±3 mm)
  const SABIT_ESIK = secenek.sabitEsik ?? 0.45
  const SABIT_TUTARSIZ = 12   // bir sabit nokta komşularından bu kadar (px) farklı kayıyorsa güvenilmez sayılır
  const MAKS_KIVRIM = 60      // (px) bundan fazla kıvrık kâğıt okunmaz
  const BLOK_TUTARSIZ = 14    // (px) bir blok komşularından bu kadar farklı kaymışsa kâğıt okunmaz
  const ESIK_DOLU = secenek.esikDolu ?? 0.62     // bu koyuluğun üstü: kesin işaret
  const ESIK_SUPHELI = secenek.esikSupheli ?? 0.18 // bununla ESIK_DOLU arası: emin değil -> öğretmene sor
  const ESIK_RAKIP = secenek.esikRakip ?? 0.40     // kesin bir işaretin yanında bundan koyu bir şey varsa sor
  const ESIK_SUTUN_SUPHELI = 0.30  // ad/numara sütununda: bu koyulukta iz varsa sor
  const ESIK_SUTUN_FARK = 0.15     // ad/numara sütununda: en koyu iz diğerlerinden bu kadar ayrışıyorsa sor
  //   (ölçüm: boş sütunda fark %99.9 <= 0.18, gerçek harfte fark >= 0.33; ESIK_SUPHELI (0.18) altı her zaman boş)
  if (!secenek.referans) throw new Error('referans görüntü gerekli')

  // ---- ArUco dedektörü (bir kere kurulur)
  const sozluk = cv.getPredefinedDictionary(cv.DICT_4X4_50)
  const prm = new cv.aruco_DetectorParameters()
  try { prm.cornerRefinementMethod = cv.CORNER_REFINE_SUBPIX.value ?? cv.CORNER_REFINE_SUBPIX } catch (e) { /* yok say */ }
  prm.adaptiveThreshWinSizeMax = 53
  const dedektor = new cv.aruco_ArucoDetector(sozluk, prm, new cv.aruco_RefineParameters(10, 3, true))

  // ---- hızlı perspektif düzeltme: açılışta OpenCV ile karşılaştırılır, en küçük farkta kapatılır
  let hizliDuzelt = secenek.hizliDuzeltme === false ? null : hizliDuzeltmeOlustur()
  if (hizliDuzelt) {
    try { if (!hizliSina()) hizliDuzelt = null } catch (e) { hizliDuzelt = null }
  }
  function hizliSina() {
    // rastgele dokulu küçük görüntü; kaynağın dışına taşan köşeler ve 4'e bölünmeyen genişlik (tüm kod yolları)
    const kg = 157, ky = 211
    const kaynak = new cv.Mat(ky, kg, cv.CV_8UC1)
    const kd = kaynak.data
    let s = 12345
    for (let i = 0; i < kd.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; kd[i] = (s >>> 16) & 255 }
    let tamam = true
    for (const [hg, hy, noktalar] of [
      [130, 97, [-9, 7, 150, -4, 163, 190, 3, 222]],
      [61, 83, [20.5, 30.25, 120, 25, 131, 180, 12, 170]],
    ]) {
      const a = cv.matFromArray(4, 1, cv.CV_32FC2, noktalar)
      const b = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, hg, 0, hg, hy, 0, hy])
      const Hm = cv.getPerspectiveTransform(a, b)
      const beklenen = new cv.Mat(), ters = new cv.Mat()
      cv.warpPerspective(kaynak, beklenen, Hm, new cv.Size(hg, hy), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255))
      cv.invert(Hm, ters, cv.DECOMP_LU)
      const cikti = new Uint8Array(hg * hy)
      hizliDuzelt(kaynak.data, kg, ky, cikti, hg, hy, Array.from(ters.data64F), 255)
      const bd = beklenen.data
      if (bd.length !== cikti.length) tamam = false
      else for (let i = 0; i < bd.length; i++) if (bd[i] !== cikti[i]) { tamam = false; break }
      a.delete(); b.delete(); Hm.delete(); beklenen.delete(); ters.delete()
    }
    kaynak.delete()
    return tamam
  }

  // ---- hedef köşe noktaları (düzeltilmiş görüntüde)
  const hedef = {}
  for (const [id, [x, y]] of Object.entries(geo.markerlar)) {
    const b = geo.markerBoy
    hedef[id] = [x, y, x + b, y, x + b, y + b, x, y + b].map(v => v * PX)
  }

  // ---- ölçüm diskleri ve hizalama şablonları (geometri sabit olduğu için önceden hazırlanır)
  const diskCache = {}
  function disk(rPx) {
    const r = Math.round(rPx * 0.6)
    if (diskCache[r]) return diskCache[r]
    const ofs = []
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) ofs.push([dx, dy])
    return (diskCache[r] = ofs)
  }

  function blokMerkezleri(b) {
    const m = []
    if (b.tur === 'cevap') for (const q of b.sorular) for (const p of geo.cevap.merkez[q]) m.push(p)
    else if (b.tur === 'ad' || b.tur === 'soyad') {
      const [c0, c1] = b.sutunlar || [0, geo[b.tur].merkez.length]
      for (let s = c0; s < c1; s++) for (let h = b.satirlar[0]; h < b.satirlar[1]; h++) m.push(geo[b.tur].merkez[s][h])
    } else if (b.tur === 'no') {
      const [c0, c1] = b.sutunlar || [0, geo.no.merkez.length]
      for (let s = c0; s < c1; s++) for (let d = b.satirlar[0]; d < b.satirlar[1]; d++) m.push(geo.no.merkez[s][d])
    } else if (b.tur === 'kitapcik') for (const p of geo.kitapcik.merkez) m.push(p)
    return m
  }

  const bloklar = geo.bloklar.map(b => {
    const merkez = blokMerkezleri(b)
    const rPx = b.r * PX
    const pad = Math.ceil(rPx + 6)
    const xs = merkez.map(p => p[0] * PX), ys = merkez.map(p => p[1] * PX)
    const x0 = Math.floor(Math.min(...xs) - pad), y0 = Math.floor(Math.min(...ys) - pad)
    const x1 = Math.ceil(Math.max(...xs) + pad), y1 = Math.ceil(Math.max(...ys) + pad)
    const sablon = cv.Mat.zeros(y1 - y0, x1 - x0, cv.CV_32F)
    for (let i = 0; i < merkez.length; i++) {
      cv.circle(sablon, new cv.Point(Math.round(xs[i] - x0), Math.round(ys[i] - y0)), Math.round(rPx), new cv.Scalar(1), HALKA, cv.LINE_AA)
    }
    return { ...b, x0, y0, sablon, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
  })

  // ---- sabit noktalar: referans (boş form) görüntüsünden yarım çözünürlükte kesilir
  const refKoyu = (() => {
    const r = secenek.referans
    const g = new cv.Mat()
    if (r.channels() === 1) r.copyTo(g); else cv.cvtColor(r, g, r.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY)
    const y = new cv.Mat()
    cv.resize(g, y, new cv.Size(Math.round(W / 2), Math.round(H / 2)), 0, 0, cv.INTER_AREA)
    const k = new cv.Mat(y.rows, y.cols, cv.CV_32F)
    // .data / .data32F her erişimde yeni bir görünüm oluşturur: döngü dışında bir kez alınır (aynı sonuç, ~100 kat hızlı)
    const yd = y.data, kd = k.data32F
    for (let i = 0; i < yd.length; i++) kd[i] = 1 - yd[i] / 255
    g.delete(); y.delete()
    return k
  })()
  const SA = SABIT_ARAMA / 2
  const sabitler = geo.sabitler.map(([x0, y0, x1, y1]) => {
    const r = new cv.Rect(Math.round(x0 * PX / 2), Math.round(y0 * PX / 2), Math.round((x1 - x0) * PX / 2), Math.round((y1 - y0) * PX / 2))
    const roi = refKoyu.roi(r)
    const sablon = roi.clone(); roi.delete()
    return { r, sablon, mx: (x0 + x1) / 2 * PX, my: (y0 + y1) / 2 * PX }
  })
  refKoyu.delete()

  // ------------------------------------------------------------------
  function griYap(src) {
    const g = new cv.Mat()
    if (src.channels() === 4) cv.cvtColor(src, g, cv.COLOR_RGBA2GRAY)
    else if (src.channels() === 3) cv.cvtColor(src, g, cv.COLOR_RGB2GRAY)
    else src.copyTo(g)
    return g
  }

  function algila(gray, olcek, bulunan) {
    const koseler = new cv.MatVector(), ids = new cv.Mat(), red = new cv.MatVector()
    try {
      dedektor.detectMarkers(gray, koseler, ids, red)
      for (let i = 0; i < ids.data32S.length; i++) {
        const id = String(ids.data32S[i])
        if (hedef[id] && !bulunan[id]) {
          const c = koseler.get(i)
          bulunan[id] = Array.from(c.data32F).map(v => v / olcek)
          c.delete()
        }
      }
    } finally { koseler.delete(); ids.delete(); red.delete() }
  }

  /** Köşe işaretlerini gri görüntüde bulur. Önce küçültülmüş görüntüde (hızlı), olmazsa tam boyutta ve kontrast artırarak. */
  function isaretleriBulGri(gray, hizli = false) {
    const bulunan = {}
    const uzun = Math.max(gray.rows, gray.cols)
    const HEDEF = 1400
    if (uzun > HEDEF * 1.15) {
      const o = HEDEF / uzun, k = new cv.Mat()
      cv.resize(gray, k, new cv.Size(0, 0), o, o, cv.INTER_AREA)
      algila(k, o, bulunan); k.delete()
      if (hizli || Object.keys(bulunan).length === 4) return bulunan
    }
    algila(gray, 1, bulunan)
    if (hizli || Object.keys(bulunan).length === 4) return bulunan
    const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8)), c = new cv.Mat()
    clahe.apply(gray, c)
    algila(c, 1, bulunan)
    c.delete(); clahe.delete()
    return bulunan
  }

  /** Canlı önizleme için: köşe işaretlerini bulur (renkli ya da gri Mat). */
  function isaretleriBul(src, hizli = true) {
    const gray = griYap(src)
    try { return isaretleriBulGri(gray, hizli) } finally { gray.delete() }
  }

  /**
   * Perspektif düzeltme: hızlı yol (WebAssembly SIMD, OpenCV ile bit düzeyinde aynı) kullanılabiliyorsa o,
   * değilse OpenCV'nin kendi warpPerspective fonksiyonu. Çıktı her iki yolda da birebir aynıdır.
   */
  function perspektif(gray, Hm) {
    if (hizliDuzelt && gray.type() === cv.CV_8UC1 && gray.isContinuous()) {
      const ters = new cv.Mat()
      try {
        cv.invert(Hm, ters, cv.DECOMP_LU)   // warpPerspective de içeride aynı şekilde ters çevirir
        const M = Array.from(ters.data64F)
        if (hizliUygun(M, W, H)) {
          const duz = new cv.Mat(H, W, cv.CV_8UC1)
          try {
            hizliDuzelt(gray.data, gray.cols, gray.rows, duz.data, W, H, M, 255)
            return duz
          } catch (e) { duz.delete() }
        }
      } catch (e) { /* OpenCV yoluna geç */ } finally { ters.delete() }
    }
    const duz = new cv.Mat()
    cv.warpPerspective(gray, duz, Hm, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255))
    return duz
  }

  function duzelt(gray) {
    const m = isaretleriBulGri(gray)
    const ids = Object.keys(hedef)
    const eksik = ids.filter(i => !m[i])
    if (eksik.length) {
      const adlar = { 0: 'sol üst', 1: 'sağ üst', 2: 'sağ alt', 3: 'sol alt' }
      return { hata: HATA.KOSE, mesaj: `Köşe işareti görünmüyor (${eksik.map(i => adlar[i]).join(', ')})`, isaretler: m }
    }
    let kenar = 0
    for (const i of ids) kenar += Math.hypot(m[i][0] - m[i][2], m[i][1] - m[i][3])
    const pxmm = kenar / ids.length / geo.markerBoy
    if (pxmm < MIN_PX_MM) return { hata: HATA.COZUNURLUK, mesaj: 'Kâğıt çok uzakta / çözünürlük düşük. Kamerayı yaklaştırın.', pxmm }
    const kaynak = cv.matFromArray(16, 1, cv.CV_32FC2, ids.flatMap(i => m[i]))
    const hedefM = cv.matFromArray(16, 1, cv.CV_32FC2, ids.flatMap(i => hedef[i]))
    const Hm = cv.findHomography(kaynak, hedefM, 0)
    try {
      if (Hm.empty()) return { hata: HATA.KIVRIK, mesaj: 'Kâğıt düzeltilemedi' }
      const geri = new cv.Mat()
      cv.perspectiveTransform(kaynak, geri, Hm)
      let hata = 0
      for (let i = 0; i < 16; i++) hata += Math.hypot(geri.data32F[2 * i] - hedefM.data32F[2 * i], geri.data32F[2 * i + 1] - hedefM.data32F[2 * i + 1])
      geri.delete()
      hata /= 16
      if (hata > 25) return { hata: HATA.KIVRIK, mesaj: 'Kâğıt çok kıvrık. Düz bir zemine koyun.' }
      const duz = perspektif(gray, Hm)
      return { duz, pxmm, hizaHatasi: hata }
    } finally { kaynak.delete(); hedefM.delete(); Hm.delete() }
  }

  /** 0 = kâğıt beyazı, 1 = siyah. Işık/gölge farkı kâğıdın kendi parlaklığına göre dengelenir. */
  function koyulukHaritasi(gray) {
    const kucuk = new cv.Mat(), arka = new cv.Mat(), arkaB = new cv.Mat()
    cv.resize(gray, kucuk, new cv.Size(0, 0), 0.25, 0.25, cv.INTER_AREA)
    const el = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(19, 19))
    cv.morphologyEx(kucuk, arka, cv.MORPH_CLOSE, el)
    cv.GaussianBlur(arka, arka, new cv.Size(0, 0), 4)
    cv.resize(arka, arkaB, new cv.Size(gray.cols, gray.rows), 0, 0, cv.INTER_LINEAR)
    const koyu = new cv.Mat(gray.rows, gray.cols, cv.CV_32F)
    const g = gray.data, a = arkaB.data, k = koyu.data32F
    // Sonuç yalnızca (piksel, arka plan) ikilisine bağlı: önceden hesaplanmış tablodan okunur (aynı değerler, bölme yok)
    for (let i = 0; i < g.length; i++) k[i] = KOYU_TABLO[a[i] << 8 | g[i]]
    kucuk.delete(); arka.delete(); arkaB.delete(); el.delete()
    return koyu
  }

  function eslestir(harita, sablon, x0, y0, ara) {
    const bx0 = Math.max(x0 - ara, 0), by0 = Math.max(y0 - ara, 0)
    const bx1 = Math.min(x0 + sablon.cols + ara, harita.cols), by1 = Math.min(y0 + sablon.rows + ara, harita.rows)
    if (bx1 - bx0 < sablon.cols || by1 - by0 < sablon.rows) return { dx: 0, dy: 0, guven: 0 }
    const bolge = harita.roi(new cv.Rect(bx0, by0, bx1 - bx0, by1 - by0))
    const sonuc = new cv.Mat()
    cv.matchTemplate(bolge, sablon, sonuc, cv.TM_CCOEFF_NORMED)
    const mm = cv.minMaxLoc(sonuc)
    bolge.delete(); sonuc.delete()
    return { dx: mm.maxLoc.x + bx0 - x0, dy: mm.maxLoc.y + by0 - y0, guven: mm.maxVal }
  }

  function hizala(koyu, b, tahmin) {
    const tx = Math.round(tahmin.dx), ty = Math.round(tahmin.dy)
    const h = eslestir(koyu, b.sablon, b.x0 + tx, b.y0 + ty, BLOK_ARAMA)
    return { dx: h.dx + tx, dy: h.dy + ty, guven: h.guven }
  }

  /** Sabit noktaları eşler, güvenilmezleri ayıklar; her noktadaki kaymayı tahmin eden fonksiyon döndürür. */
  function kivrimOlc(koyu) {
    const yarim = new cv.Mat()
    cv.resize(koyu, yarim, new cv.Size(Math.round(W / 2), Math.round(H / 2)), 0, 0, cv.INTER_AREA)
    const olcum = sabitler.map(sb => {
      const h = eslestir(yarim, sb.sablon, sb.r.x, sb.r.y, SA)
      return { x: sb.mx, y: sb.my, dx: h.dx * 2, dy: h.dy * 2, guven: h.guven, iyi: h.guven >= SABIT_ESIK }
    })
    yarim.delete()
    const idw = (x, y, liste) => {
      const yakin = liste.map(o => ({ o, d2: (o.x - x) ** 2 + (o.y - y) ** 2 })).sort((a, b) => a.d2 - b.d2).slice(0, 4)
      let sw = 0, sx = 0, sy = 0
      for (const { o, d2 } of yakin) { const w = 1 / (d2 + 2500); sw += w; sx += w * o.dx; sy += w * o.dy }
      return { dx: sx / sw, dy: sy / sw, enYakin: Math.sqrt(yakin[0].d2) }
    }
    // tutarsız sabit noktaları ayıkla (komşularının tahmininden çok farklı olan)
    for (let tur = 0; tur < 2; tur++) {
      const iyiler = olcum.filter(o => o.iyi)
      for (const o of iyiler) {
        const digerleri = iyiler.filter(p => p !== o)
        if (digerleri.length < 3) continue
        const t = idw(o.x, o.y, digerleri)
        if (Math.hypot(t.dx - o.dx, t.dy - o.dy) > SABIT_TUTARSIZ) o.iyi = false
      }
    }
    const iyiler = olcum.filter(o => o.iyi)
    return {
      olcum, iyiler, idw, iyiSayi: iyiler.length,
      maks: Math.max(0, ...iyiler.map(o => Math.hypot(o.dx, o.dy))),
    }
  }

  function olc(koyu, x, y, rPx, off) {
    const cx = Math.round(x * PX + off.dx), cy = Math.round(y * PX + off.dy)
    const d = disk(rPx), w = koyu.cols, k = koyu.data32F
    let t = 0
    for (const [dx, dy] of d) t += k[(cy + dy) * w + (cx + dx)]
    return t / d.length
  }

  function medyan(arr) {
    const s = Float64Array.from(arr).sort()
    const n = s.length
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
  }

  /** Bir bölgenin eşiklerini o bölgenin kendi dağılımından çıkarır (kalem koyuluğu, ışık vb. uyarlanır). */
  function esikler(gruplar, varsayilanDolu = null) {
    const tum = gruplar.flat()
    const taban = medyan(tum)
    const maks = gruplar.map(g => Math.max(...g)).filter(v => v > taban + 0.15)
    let dolu
    if (maks.length >= 3) dolu = medyan(maks)
    else if (varsayilanDolu != null) dolu = taban + varsayilanDolu
    else dolu = taban + 0.35
    const kontrast = Math.max(dolu - taban, 0.2)
    // Ölçülmüş dağılımlar (normalize koyuluk): gerçek işaretler >= 0.61, silgi izleri <= 0.52, boş <= 0.37.
    // Arada kalan her şey "emin değilim" sayılır ve öğretmene sorulur.
    return { taban, kontrast, dolu: taban + ESIK_DOLU * kontrast, supheli: taban + Math.max(ESIK_SUPHELI * kontrast, 0.06), seviye: dolu - taban }
  }

  /*
   * Tek bir soru / sütun için karar. Ölçülmüş normalize koyuluk dağılımları:
   *   (500 kâğıt, form v3) tam işaret >= 0.49 (%99'u >= 0.72) · silgi izi <= 0.43 · çok hafif kalem 0.28-0.68
   *   · boş satırın en koyusu: %99.9'u <= 0.22, en fazla 0.27
   * Kural: emin olunamayan hiçbir durum sessizce karara bağlanmaz.
   */
  function sinifla(dizi, e, cokSecenekli = false) {
    const rakipSiniri = e.taban + ESIK_RAKIP * e.kontrast
    const dolu = [], belirsiz = []
    dizi.forEach((v, k) => { if (v >= e.dolu) dolu.push(k); else if (v >= e.supheli) belirsiz.push(k) })
    if (dolu.length === 1) {
      const rakip = belirsiz.filter(k => dizi[k] >= rakipSiniri)
      if (!rakip.length) return { tur: 'cevap', k: dolu[0], not: '' }
      return { tur: 'cevap', k: dolu[0], not: 'yanında ikinci bir işaret / silgi izi var' }
    }
    if (dolu.length >= 2) return { tur: 'cift', k: dolu, not: 'birden fazla işaret' }
    if (!belirsiz.length) return { tur: 'bos', k: null, not: '' }
    if (cokSecenekli) {
      // Ad/soyad (29 harf) ve numara (10 rakam) sütunları: çok sayıda boş yuvarlağın en koyusu doğal olarak
      // biraz yüksek çıkar. Sütunda belirgin bir iz varsa (koyu ya da diğerlerinden ayrışan) sorulur.
      const n = dizi.map(v => (v - e.taban) / e.kontrast).sort((a, b) => b - a)
      if (n[0] >= ESIK_SUTUN_SUPHELI || n[0] - n[1] >= ESIK_SUTUN_FARK) return { tur: 'bos', k: null, not: 'silik / yarım işaret' }
      return { tur: 'bos', k: null, not: '' }
    }
    return { tur: 'bos', k: null, not: 'silik / yarım işaret' }
  }

  function kirp(mat, [x0, y0, x1, y1], olcek = 1) {
    const r = new cv.Rect(Math.round(x0 * PX), Math.round(y0 * PX), Math.round((x1 - x0) * PX), Math.round((y1 - y0) * PX))
    const parca = mat.roi(r)
    const out = new cv.Mat()
    cv.resize(parca, out, new cv.Size(Math.round(r.width * olcek), Math.round(r.height * olcek)), 0, 0, cv.INTER_AREA)
    parca.delete()
    const rgba = new cv.Mat()
    if (out.channels() === 4) out.copyTo(rgba); else if (out.channels() === 3) cv.cvtColor(out, rgba, cv.COLOR_RGB2RGBA); else cv.cvtColor(out, rgba, cv.COLOR_GRAY2RGBA)
    out.delete()
    const res = { genislik: rgba.cols, yukseklik: rgba.rows, veri: new Uint8ClampedArray(rgba.data) }
    rgba.delete()
    return res
  }

  // ------------------------------------------------------------------
  /**
   * Kâğıdı okur.
   * src: RGBA/RGB/GRAY cv.Mat
   * dönüş: { tamam:false, hata, mesaj } | { tamam:true, ... }
   */
  function oku(src, { gorseller = true, profil = null } = {}) {
    const T = (ad) => { if (profil) { const n = performance.now(); profil[ad] = (profil[ad] || 0) + n - (profil._t || n); profil._t = n } }
    if (profil) profil._t = performance.now()
    const gri = griYap(src)
    let d
    try { d = duzelt(gri) } finally { gri.delete() }
    T('duzelt')
    if (d.hata) return { tamam: false, ...d }
    const { duz, pxmm, hizaHatasi } = d
    const koyu = koyulukHaritasi(duz)
    T('koyuluk')
    try {
      // ---- kıvrım ölçümü (sabit noktalar)
      const kv = kivrimOlc(koyu)
      if (kv.iyiSayi < Math.ceil(sabitler.length * 0.6)) {
        return { tamam: false, hata: HATA.HIZA, mesaj: 'Form tanınamadı ya da kâğıdın büyük kısmı net değil. Kâğıdı düz ve net tutun.', sabitIyi: kv.iyiSayi }
      }
      if (kv.maks > MAKS_KIVRIM) {
        return { tamam: false, hata: HATA.KIVRIK, mesaj: 'Kâğıt çok kıvrık. Düz bir zemine koyun.', kivrim: kv.maks }
      }

      T('sabit')
      // ---- kabarcık blokları: sabit noktalardan tahmin edilen yerin çevresinde dar arama
      let hizaHarita = koyu
      if (HIZA_BULANIK > 0) { hizaHarita = new cv.Mat(); cv.GaussianBlur(koyu, hizaHarita, new cv.Size(0, 0), HIZA_BULANIK) }
      const off = {}
      let enDusuk = 1
      // Yayılan hizalama: önce sabit noktalara en yakın blok hizalanır; güvenle hizalanan her blok,
      // komşu blokların tahmini için yeni bir referans noktası olur.
      const referanslar = kv.iyiler.map(o => ({ x: o.x, y: o.y, dx: o.dx, dy: o.dy, blok: -1 }))
      const kalan = new Set(bloklar.map((_, i) => i))
      let red = null
      while (kalan.size && !red) {
        let sec = -1, secD = Infinity
        for (const i of kalan) {
          const b = bloklar[i]
          let d = Infinity
          for (const r of referanslar) d = Math.min(d, (r.x - b.cx) ** 2 + (r.y - b.cy) ** 2)
          if (d < secD) { secD = d; sec = i }
        }
        const b = bloklar[sec]
        const t = kv.idw(b.cx, b.cy, referanslar)
        const h = hizala(hizaHarita, b, t)
        enDusuk = Math.min(enDusuk, h.guven)
        if (h.guven < HIZA_ESIK) { red = { guven: h.guven, blok: b.tur }; break }
        off[sec] = h
        referanslar.push({ x: b.cx, y: b.cy, dx: h.dx, dy: h.dy, blok: sec })
        kalan.delete(sec)
      }
      // Tutarlılık: her blok, kendisi hariç komşularının tahminiyle uyumlu olmalı (satır kaymasına karşı son kilit)
      if (!red) {
        for (let i = 0; i < bloklar.length; i++) {
          const b = bloklar[i]
          const t = kv.idw(b.cx, b.cy, referanslar.filter(r => r.blok !== i))
          if (Math.hypot(t.dx - off[i].dx, t.dy - off[i].dy) > BLOK_TUTARSIZ) { red = { guven: off[i].guven, blok: b.tur, tutarsiz: true }; break }
        }
      }
      if (red) {
        if (hizaHarita !== koyu) hizaHarita.delete()
        return { tamam: false, hata: HATA.HIZA, mesaj: kv.maks > 12 ? 'Kâğıt kıvrık görünüyor. Düz bir zemine koyup tekrar deneyin.' : 'Kâğıdın bir bölümü net değil (bulanık / gölgeli). Sabit tutun.', ...red, kivrim: kv.maks }
      }
      if (hizaHarita !== koyu) hizaHarita.delete()
      T('bloklar')
      const blokOf = (tur, pred) => { const i = bloklar.findIndex((b) => b.tur === tur && pred(b)); return off[i] }

      // ---- cevaplar
      const cevapPuan = geo.cevap.merkez.map((satir, q) => {
        const o = blokOf('cevap', b => b.sorular.includes(q))
        return satir.map(([x, y]) => olc(koyu, x, y, geo.cevap.r * PX, o))
      })
      const eC = esikler(cevapPuan)
      const cevaplar = cevapPuan.map(s => sinifla(s, eC))

      // ---- kitapçık + anahtar
      const oK = blokOf('kitapcik', () => true)
      const kitPuan = geo.kitapcik.merkez.map(([x, y]) => olc(koyu, x, y, geo.kitapcik.r * PX, oK))
      const kitapcikS = sinifla(kitPuan, eC)
      // anahtar yuvarlağı tek başına: kitapçık bloğunun kaymasını kullan (yakın bölge)
      const anahtarP = olc(koyu, geo.anahtar.merkez[0], geo.anahtar.merkez[1], geo.anahtar.r * PX, oK)
      const anahtar = anahtarP >= eC.dolu ? 'evet' : anahtarP >= eC.supheli ? 'supheli' : 'hayir'

      // ---- ad / soyad
      const isimPuan = {}
      for (const alan of ['ad', 'soyad']) {
        isimPuan[alan] = geo[alan].merkez.map((sut, si) => sut.map(([x, y], h) => {
          const o = blokOf(alan, b => h >= b.satirlar[0] && h < b.satirlar[1] && (!b.sutunlar || (si >= b.sutunlar[0] && si < b.sutunlar[1])))
          return olc(koyu, x, y, geo[alan].r * PX, o)
        }))
      }
      const eI = esikler([...isimPuan.ad, ...isimPuan.soyad], eC.seviye)
      const isim = {}
      for (const alan of ['ad', 'soyad']) {
        const sutunlar = isimPuan[alan].map(s => sinifla(s, eI, true))
        let metin = '', supheli = false
        const notlar = []
        sutunlar.forEach((s, i) => {
          if (s.tur === 'cevap') { metin += geo.harfler[s.k]; if (s.not) { supheli = true; notlar.push(`${i + 1}. harf: ${s.not}`) } }
          else if (s.tur === 'cift') { metin += '?'; supheli = true; notlar.push(`${i + 1}. harf: birden fazla harf işaretli (${s.k.map(k => geo.harfler[k]).join('/')})`) }
          else { metin += ' '; if (s.not) { supheli = true; notlar.push(`${i + 1}. harf: silik işaret`) } }
        })
        isim[alan] = { metin: metin.replace(/\s+/g, ' ').trim(), supheli, notlar, sutunlar: sutunlar.map(s => s.tur === 'cevap' ? geo.harfler[s.k] : s.tur === 'cift' ? '?' : '') }
      }

      // ---- numara
      const noPuan = geo.no.merkez.map((sut, si) => sut.map(([x, y], dgt) => {
        const o = blokOf('no', b => dgt >= b.satirlar[0] && dgt < b.satirlar[1] && (!b.sutunlar || (si >= b.sutunlar[0] && si < b.sutunlar[1])))
        return olc(koyu, x, y, geo.no.r * PX, o)
      }))
      const eN = esikler(noPuan, eC.seviye)
      const noS = noPuan.map(s => sinifla(s, eN, true))
      let noMetin = '', noSupheli = false
      const noNotlar = []
      const dolular = noS.map((s, i) => (s.tur !== 'bos' ? i : -1)).filter(i => i >= 0)
      noS.forEach((s, i) => {
        if (s.tur === 'cevap') { noMetin += String(s.k); if (s.not) { noSupheli = true; noNotlar.push(`${i + 1}. hane: ${s.not}`) } }
        else if (s.tur === 'cift') { noMetin += '?'; noSupheli = true; noNotlar.push(`${i + 1}. hane: birden fazla rakam işaretli`) }
        else {
          if (s.not) { noSupheli = true; noNotlar.push(`${i + 1}. hane: silik işaret`) }
          if (dolular.length && i > dolular[0] && i < dolular[dolular.length - 1]) { noSupheli = true; noNotlar.push(`${i + 1}. hane boş bırakılmış`) }
        }
      })

      const sonuc = {
        ...(secenek.debug ? { _esikC: eC, _puan: cevapPuan, _esikI: eI, _isimPuan: isimPuan, _esikN: eN, _noPuan: noPuan } : {}),
        tamam: true,
        pxmm, hizaHatasi, enDusukGuven: enDusuk, kivrim: kv.maks, sabitIyi: kv.iyiSayi,
        cevaplar,
        kitapcik: kitapcikS.tur === 'cevap' ? { harf: geo.kitapcik.harfler[kitapcikS.k], not: kitapcikS.not }
          : kitapcikS.tur === 'cift' ? { harf: null, cift: kitapcikS.k.map(k => geo.kitapcik.harfler[k]), not: 'birden fazla kitapçık işaretli' }
            : { harf: null, not: kitapcikS.not },
        anahtar,
        ad: isim.ad, soyad: isim.soyad,
        no: { metin: noMetin, supheli: noSupheli, notlar: noNotlar },
      }

      T('olcum')
      if (gorseller) {
        sonuc.gorsel = {
          adYazi: kirp(duz, geo.kirp.adYazi, 0.5),
          soyadYazi: kirp(duz, geo.kirp.soyadYazi, 0.5),
          noYazi: kirp(duz, geo.kirp.noYazi, 0.5),
          kucuk: kirp(duz, [0, 0, geo.sayfa[0], geo.sayfa[1]], 0.2),
        }
        sonuc.soruGorsel = {}
        cevaplar.forEach((c, q) => {
          if (c.not) {
            const [x0] = geo.cevap.merkez[q][0], [x4] = geo.cevap.merkez[q][4], y = geo.cevap.merkez[q][0][1]
            sonuc.soruGorsel[q] = kirp(duz, [x0 - 10, y - 3.2, x4 + 3, y + 3.2], 0.6)
          }
        })
      }
      T('gorsel')
      return sonuc
    } finally {
      duz.delete(); koyu.delete()
    }
  }

  function kapat() {
    bloklar.forEach(b => b.sablon.delete())
    sabitler.forEach(sb => sb.sablon.delete())
    dedektor.delete()
  }

  return { oku, isaretleriBul, kapat, W, H, hizli: !!hizliDuzelt }
}

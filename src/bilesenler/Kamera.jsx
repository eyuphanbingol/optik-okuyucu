import { useEffect, useRef, useState } from 'react'
import { isaretBul, kagitOku } from '../omr/istemci.js'
import { okumalariBirlestir } from '../mantik.js'

/*
 * Canlı kamera ile otomatik okuma.
 *  1) Küçük önizleme karelerinde dört köşe işareti aranır.
 *  2) Kâğıt birkaç kare boyunca sabit kalınca tam çözünürlüklü kare okunur.
 *  3) ÇİFT OKUMA ONAYI: iki ayrı kare okunur; ikisinde de emin olunan her şey birebir aynı olmalı.
 *     Emin olunamayan işaretler öğretmene sorulmak üzere işaretlenir. Çelişki varsa tekrar okunur.
 *  4) Aynı kâğıt kamerada durduğu sürece tekrar sayılmaz; kâğıt değişince okuma yeniden başlar.
 */

const ONIZLEME_UZUN = 720
const DONGU_MS = 110

function kimlik(r) {
  return [r.ad.metin, r.soyad.metin, r.no.metin].join('|')
}

function kareAl(video, tuval, maksUzun = 0) {
  const vw = video.videoWidth, vh = video.videoHeight
  let w = vw, h = vh
  if (maksUzun && Math.max(vw, vh) > maksUzun) {
    const o = maksUzun / Math.max(vw, vh)
    w = Math.round(vw * o); h = Math.round(vh * o)
  }
  tuval.width = w; tuval.height = h
  const c = tuval.getContext('2d', { willReadFrequently: true })
  c.drawImage(video, 0, 0, w, h)
  return c.getImageData(0, 0, w, h)
}

export default function Kamera({ aktif, onKabul, ipucu }) {
  const videoRef = useRef(null)
  const cizimRef = useRef(null)
  const tuvalRef = useRef(null)
  const aktifRef = useRef(aktif)
  const onKabulRef = useRef(onKabul)
  const [mesaj, setMesaj] = useState('Kamera açılıyor…')
  const [durum, setDurum] = useState('bekle') // bekle | ara | sabit | oku | tamam | hata
  const [hata, setHata] = useState(null)
  const [fener, setFener] = useState({ var: false, acik: false })
  const [cozunurluk, setCozunurluk] = useState('')
  const trackRef = useRef(null)
  const kutuRef = useRef(null)

  aktifRef.current = aktif
  onKabulRef.current = onKabul

  useEffect(() => {
    let calisiyor = true
    let zamanlayici = null
    let akis = null
    let wakeLock = null
    const st = {
      stabil: 0, kayip: 0, sonMerkez: null, ilk: null, celiski: 0,
      bekleDegisim: false, sonKabulKimlik: null, sonKabulZaman: 0, sonDeneme: 0,
    }
    if (!tuvalRef.current) tuvalRef.current = document.createElement('canvas')

    const planla = (ms = DONGU_MS) => { if (calisiyor) zamanlayici = setTimeout(dongu, ms) }
    const bildir = (m, d) => { setMesaj(m); setDurum(d) }

    function ciz(koseler, renk) {
      const cv = cizimRef.current, v = videoRef.current
      if (!cv || !v) return
      const W = cv.clientWidth, H = cv.clientHeight
      if (cv.width !== W) cv.width = W
      if (cv.height !== H) cv.height = H
      const c = cv.getContext('2d')
      c.clearRect(0, 0, W, H)
      const vw = v.videoWidth, vh = v.videoHeight
      if (!vw) return
      // video "contain" ile gösterilir: ekranda görünen = okunan kare
      const s = Math.min(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2
      const VW = vw * s, VH = vh * s
      // kılavuz çerçeve (A4 oranı)
      const gh = Math.min(VH * 0.92, (VW * 0.94) * 297 / 210), gw = gh * 210 / 297
      c.strokeStyle = 'rgba(255,255,255,0.55)'
      c.setLineDash([10, 8]); c.lineWidth = 2
      c.strokeRect(ox + (VW - gw) / 2, oy + (VH - gh) / 2, gw, gh)
      c.setLineDash([])
      if (!koseler) return
      c.lineWidth = 4
      c.strokeStyle = renk
      c.fillStyle = renk
      for (const k of Object.values(koseler)) {
        c.beginPath()
        for (let i = 0; i < 4; i++) {
          const x = ox + k[2 * i] * s, y = oy + k[2 * i + 1] * s
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y)
        }
        c.closePath(); c.stroke()
        c.globalAlpha = 0.25; c.fill(); c.globalAlpha = 1
      }
    }

    async function dongu() {
      if (!calisiyor) return
      const v = videoRef.current
      if (!v || !v.videoWidth || v.readyState < 2) return planla(200)
      if (!aktifRef.current) { ciz(null); return planla(250) }
      try {
        // ---- 1) önizleme: köşe işaretleri
        const kucuk = kareAl(v, tuvalRef.current, ONIZLEME_UZUN)
        const olcek = v.videoWidth / kucuk.width
        const bulunan = await isaretBul(kucuk)
        if (!calisiyor) return
        const koseler = {}
        for (const [id, k] of Object.entries(bulunan)) koseler[id] = k.map(x => x * olcek)
        const n = Object.keys(koseler).length
        if (n < 4) {
          st.stabil = 0; st.ilk = null
          if (++st.kayip >= 3) st.bekleDegisim = false   // kâğıt kaldırıldı
          ciz(koseler, '#f59e0b')
          bildir(n ? `Dört köşe işareti de görünmeli (${n}/4)` : 'Kâğıdı çerçevenin içine yerleştirin', 'ara')
          return planla()
        }
        st.kayip = 0
        const uzun = Math.max(v.videoWidth, v.videoHeight)
        const merkez = Object.keys(koseler).sort().map(id => {
          const k = koseler[id]; return [(k[0] + k[2] + k[4] + k[6]) / 4, (k[1] + k[3] + k[5] + k[7]) / 4]
        })
        let hareket = 1
        if (st.sonMerkez) hareket = Math.max(...merkez.map((m, i) => Math.hypot(m[0] - st.sonMerkez[i][0], m[1] - st.sonMerkez[i][1]))) / uzun
        st.sonMerkez = merkez
        if (hareket < 0.012) st.stabil++
        else { st.stabil = 0; st.ilk = null; if (hareket > 0.08) st.bekleDegisim = false }

        if (st.bekleDegisim && Date.now() - st.sonDeneme < 2500) {
          ciz(koseler, '#22c55e')
          bildir('✓ Okundu. Sıradaki kâğıdı koyun.', 'tamam')
          return planla()
        }
        if (st.stabil < 2) {
          ciz(koseler, '#38bdf8')
          bildir('Sabit tutun…', 'sabit')
          return planla()
        }

        // ---- 2) tam çözünürlüklü okuma
        ciz(koseler, '#38bdf8')
        bildir(st.ilk ? 'Doğrulanıyor…' : 'Okunuyor…', 'oku')
        st.sonDeneme = Date.now()
        const tam = kareAl(v, tuvalRef.current)
        const r = await kagitOku(tam, true)
        if (!calisiyor) return
        if (!r.tamam) {
          st.ilk = null
          bildir(r.mesaj, 'hata')
          return planla(250)
        }
        if (st.bekleDegisim) {
          if (kimlik(r) === st.sonKabulKimlik) {
            ciz(koseler, '#22c55e')
            bildir('✓ Bu kâğıt okundu. Sıradakini koyun.', 'tamam')
            return planla()
          }
          st.bekleDegisim = false   // farklı bir kâğıt konmuş
        }
        if (!aktifRef.current) return planla()
        // ---- 3) çift okuma onayı
        if (!st.ilk) { st.ilk = r; return planla(60) }
        const b = okumalariBirlestir(st.ilk, r)
        if (!b.tamam) {
          st.ilk = r
          st.celiski++
          bildir('Kâğıt tam net değil, sabit tutun…', 'sabit')
          return planla(120)
        }
        st.ilk = null
        st.celiski = 0
        st.bekleDegisim = true
        st.sonKabulKimlik = kimlik(b.sonuc)
        st.sonDeneme = Date.now()
        ciz(koseler, '#22c55e')
        bildir('✓ Okundu. Sıradaki kâğıdı koyun.', 'tamam')
        onKabulRef.current && onKabulRef.current(b.sonuc)
        return planla()
      } catch (e) {
        bildir('Okuyucu hatası: ' + e.message, 'hata')
        return planla(800)
      }
    }

    async function ac() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Bu tarayıcı kamerayı desteklemiyor (site https ile açılmalı).')
        const denemeler = [
          { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          { facingMode: { ideal: 'environment' } },
        ]
        for (const video of denemeler) {
          try { akis = await navigator.mediaDevices.getUserMedia({ video, audio: false }); break } catch (e) {
            if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e
          }
        }
        if (!akis) throw new Error('Kamera açılamadı.')
        if (!calisiyor) { akis.getTracks().forEach(t => t.stop()); return }
        const track = akis.getVideoTracks()[0]
        trackRef.current = track
        try {
          const cap = track.getCapabilities ? track.getCapabilities() : {}
          if (cap.focusMode && cap.focusMode.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
          setFener({ var: !!cap.torch, acik: false })
        } catch { /* desteklenmiyor */ }
        const v = videoRef.current
        v.srcObject = akis
        await v.play().catch(() => {})
        const oranAyarla = () => { if (v.videoWidth && kutuRef.current) kutuRef.current.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}` }
        v.addEventListener('loadedmetadata', oranAyarla)
        v.addEventListener('resize', oranAyarla)
        oranAyarla()
        const ayar = track.getSettings ? track.getSettings() : {}
        setCozunurluk(ayar.width && ayar.height ? `${ayar.width}×${ayar.height}` : '')
        try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* yok */ }
        bildir('Kâğıdı çerçevenin içine yerleştirin', 'ara')
        planla(300)
      } catch (e) {
        const m = e && e.name === 'NotAllowedError'
          ? 'Kamera izni verilmedi. Tarayıcı ayarlarından bu siteye kamera izni verin.'
          : (e && e.message) || 'Kamera açılamadı.'
        setHata(m)
        bildir(m, 'hata')
      }
    }
    ac()
    return () => {
      calisiyor = false
      clearTimeout(zamanlayici)
      if (akis) akis.getTracks().forEach(t => t.stop())
      try { wakeLock && wakeLock.release() } catch { /* yok */ }
    }
  }, [])

  async function feneriDegistir() {
    const t = trackRef.current
    if (!t) return
    try {
      await t.applyConstraints({ advanced: [{ torch: !fener.acik }] })
      setFener(f => ({ ...f, acik: !f.acik }))
    } catch { /* desteklenmiyor */ }
  }

  return (
    <div ref={kutuRef} className={`kamera durum-${durum}${hata ? ' kamera-yok' : ''}`}>
      <video ref={videoRef} playsInline muted autoPlay />
      <canvas ref={cizimRef} className="kamera-cizim" />
      {!hata && <div className="kamera-mesaj">{aktif ? mesaj : 'Duraklatıldı'}</div>}
      {ipucu && <div className="kamera-ipucu">{ipucu}</div>}
      <div className="kamera-alt">
        {cozunurluk && <span className="kamera-coz">{cozunurluk}</span>}
        {fener.var && (
          <button type="button" className="kucuk-dugme" onClick={feneriDegistir}>{fener.acik ? '🔦 Işığı kapat' : '🔦 Işık'}</button>
        )}
      </div>
      {hata && (
        <div className="kamera-hata">
          <div>
            <div>{hata}</div>
            <div className="kamera-hata-ipucu">Kamera olmadan da okutabilirsiniz: kâğıdın fotoğrafını çekip aşağıdaki <b>🖼️ Fotoğraftan okut</b> düğmesini kullanın.</div>
          </div>
        </div>
      )}
    </div>
  )
}

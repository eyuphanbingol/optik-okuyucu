// Okutma sırasında geri bildirim: yüksek ve net "okundu" sesi (+ titreşim).
// Kâğıt okunup kaydedilince "bi-bip" çalar: öğretmen ekrana bakmadan kâğıdı çekip sıradakini koyar.
// Kontrol gereken durumda (çift işaret, okunamayan numara …) daha kalın, farklı bir uyarı sesi çalar.
//
//  - Ses bir kez üretilir (PCM, tam ses seviyesine yakın; telefon hoparlörünün en yüksek duyulduğu 2–2,6 kHz).
//  - iPhone'un sessiz (zil) düğmesi Web Audio'yu susturur: iOS 17+'da ses oturumu "playback" yapılır;
//    daha eski iOS'ta ses <audio> öğesiyle çalınır (sessiz düğmesinden etkilenmez).
//  - Ses, okutma ekranındaki hoparlör düğmesiyle kapatılabilir (bu cihazda hatırlanır).
const ORNEK = 44100
const AYAR = 'optik-okuyucu.ses'

const SESLER = {
  // parlak, yükselen iki kısa bip (barkod okuyucu gibi): "okundu, sıradaki"
  basari: [
    { f: 1976, sure: 0.085, bosluk: 0.03, harmonik: [[1, 1], [3, 0.3], [5, 0.12]] },
    { f: 2637, sure: 0.16, harmonik: [[1, 1], [3, 0.3], [5, 0.12]] },
  ],
  // kalın, inen iki ton: "bakmanız gereken bir şey var"
  uyari: [
    { f: 784, sure: 0.14, bosluk: 0.05, harmonik: [[1, 1], [2, 0.45], [3, 0.35], [4, 0.18], [5, 0.12]] },
    { f: 523, sure: 0.24, harmonik: [[1, 1], [2, 0.45], [3, 0.35], [4, 0.18], [5, 0.12]] },
  ],
}

let ctx = null
let acik = (() => { try { return localStorage.getItem(AYAR) !== 'kapali' } catch { return true } })()
const pcmOnbellek = {}
const tampon = {}
const oge = {}
let hazirlandi = false

const iosMu = () => {
  try { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) } catch { return false }
}
// Eski iOS (ses oturumu ayarlanamayan): Web Audio sessiz düğmesinde susar, <audio> öğesi susmaz
const ogeYolu = () => iosMu() && !('audioSession' in navigator)

// Tarayıcılar, kullanıcı sayfaya hiç dokunmadan ses/titreşime izin vermez (konsola hata yazar).
// Kullanıcı etkileşimi olmadan sessizce atla.
function izinVar() {
  try {
    const ua = navigator.userActivation
    return !ua || ua.hasBeenActive
  } catch { return true }
}

/** Notalar -> PCM (−1..1). Tek harmonikler sesi ince ve yüksek duyulur yapar; kısa giriş/çıkış tıkırtıyı önler. */
function pcm(ad) {
  if (pcmOnbellek[ad]) return pcmOnbellek[ad]
  const notalar = SESLER[ad]
  const toplam = notalar.reduce((t, n) => t + n.sure + (n.bosluk || 0), 0)
  const x = new Float32Array(Math.ceil(toplam * ORNEK) + 1)
  let bas = 0
  for (const n of notalar) {
    const N = Math.round(n.sure * ORNEK), A = Math.round(0.004 * ORNEK), R = Math.round(0.03 * ORNEK)
    const i0 = Math.round(bas * ORNEK)
    for (let i = 0; i < N && i0 + i < x.length; i++) {
      const t = i / ORNEK
      let v = 0
      for (const [h, a] of n.harmonik) v += a * Math.sin(2 * Math.PI * n.f * h * t)
      x[i0 + i] += v * Math.min(1, i / A, (N - i) / R)
    }
    bas += n.sure + (n.bosluk || 0)
  }
  let tepe = 0
  for (let i = 0; i < x.length; i++) tepe = Math.max(tepe, Math.abs(x[i]))
  const k = 0.97 / (tepe || 1)
  for (let i = 0; i < x.length; i++) x[i] *= k
  return (pcmOnbellek[ad] = x)
}

/** PCM -> 16 bit mono WAV */
function wav(x) {
  const b = new ArrayBuffer(44 + x.length * 2)
  const d = new DataView(b)
  const yaz = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)) }
  yaz(0, 'RIFF'); d.setUint32(4, 36 + x.length * 2, true); yaz(8, 'WAVE')
  yaz(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true)
  d.setUint32(24, ORNEK, true); d.setUint32(28, ORNEK * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true)
  yaz(36, 'data'); d.setUint32(40, x.length * 2, true)
  for (let i = 0; i < x.length; i++) d.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 0x7fff, true)
  return b
}

function baglam() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state !== 'running') ctx.resume().catch(() => {})
  return ctx
}

function webAudioCal(ad) {
  try {
    const c = baglam()
    if (!tampon[ad]) {
      const x = pcm(ad)
      const buf = c.createBuffer(1, x.length, ORNEK)
      buf.getChannelData(0).set(x)
      tampon[ad] = buf
    }
    const s = c.createBufferSource()
    s.buffer = tampon[ad]
    s.connect(c.destination)
    s.start()
  } catch { /* ses yoksa sorun değil */ }
}

function ogeAl(ad) {
  if (!oge[ad]) {
    const a = new Audio(URL.createObjectURL(new Blob([wav(pcm(ad))], { type: 'audio/wav' })))
    a.preload = 'auto'
    a.setAttribute('playsinline', '')
    oge[ad] = a
  }
  return oge[ad]
}

function ogeCal(ad) {
  try {
    const a = ogeAl(ad)
    try { a.currentTime = 0 } catch { /* yok */ }
    const p = a.play()
    if (p && p.catch) p.catch(() => webAudioCal(ad))
  } catch { webAudioCal(ad) }
}

function cal(ad) {
  if (!acik || !izinVar()) return
  if (ogeYolu()) ogeCal(ad)
  else webAudioCal(ad)
}

function titret(desen) {
  try { navigator.vibrate && navigator.vibrate(desen) } catch { /* yok */ }
}

/** Kâğıt okundu ve kaydedildi */
export function basariSesi() {
  cal('basari')
  if (izinVar()) titret(120)
}

/** Öğretmenin bakması gereken durum (kontrol penceresi, aynı kâğıt, eksik anahtar …) */
export function uyariSesi() {
  cal('uyari')
  if (izinVar()) titret([150, 80, 150])
}

/** Tarayıcılar sesi ilk dokunuşta açmaya izin verir (iOS): her dokunuşta çağrılır, işi bir kez yapar */
export function sesiAc() {
  try {
    // iOS 17+: zil düğmesi sessizde olsa da ses duyulsun
    if ('audioSession' in navigator && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'
  } catch { /* yok */ }
  try { baglam() } catch { /* yok */ }
  if (hazirlandi) return
  hazirlandi = true
  if (ogeYolu()) {
    // eski iOS: <audio> öğeleri ancak dokunuş sırasında bir kez çalınınca sonradan kendiliğinden çalabilir
    for (const ad of Object.keys(SESLER)) {
      try {
        const a = ogeAl(ad)
        a.muted = true
        const p = a.play()
        const bitir = () => { try { a.pause(); a.currentTime = 0 } catch { /* yok */ } a.muted = false }
        if (p && p.then) p.then(bitir, bitir); else bitir()
      } catch { /* yok */ }
    }
  }
}

export const sesAcikMi = () => acik

/** Okutma ekranındaki hoparlör düğmesi. Açılınca örnek ses çalar. */
export function sesAyarla(deger) {
  acik = !!deger
  try { localStorage.setItem(AYAR, acik ? 'acik' : 'kapali') } catch { /* yok */ }
  if (acik) { sesiAc(); cal('basari') }
}

/** Sesin WAV hali (test için: arac/ses_test.mjs) */
export const sesWav = ad => wav(pcm(ad))

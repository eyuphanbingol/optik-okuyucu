// Okutma sırasında geri bildirim: kısa ses + titreşim
let ctx = null

// Tarayıcılar, kullanıcı sayfaya hiç dokunmadan ses/titreşime izin vermez (konsola hata yazar).
// Kullanıcı etkileşimi olmadan sessizce atla.
function izinVar() {
  try {
    const ua = navigator.userActivation
    return !ua || ua.hasBeenActive
  } catch { return true }
}

function ton(frekans, sure, gecikme = 0) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = frekans
    o.type = 'sine'
    const t = ctx.currentTime + gecikme
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + sure + 0.02)
  } catch { /* ses yoksa sorun değil */ }
}

function titret(desen) {
  try { navigator.vibrate && navigator.vibrate(desen) } catch { /* yok */ }
}

export function basariSesi() {
  if (!izinVar()) return
  ton(880, 0.12); ton(1320, 0.16, 0.1)
  titret(60)
}

export function uyariSesi() {
  if (!izinVar()) return
  ton(440, 0.18); ton(330, 0.22, 0.16)
  titret([80, 60, 80])
}

/** iOS'ta ses için ilk dokunuşta açılması gerekir */
export function sesiAc() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* yok */ }
}

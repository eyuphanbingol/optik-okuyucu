import { Suspense, lazy, useEffect, useState } from 'react'
import App from './App.jsx'
import AnaSayfa from './AnaSayfa.jsx'

// Sınav hazırlama modülü ayrı yüklenir: optik okuyucuyu açan öğretmen onun kodunu indirmez.
const SinavModulu = lazy(() => import('./sinav/SinavModulu.jsx'))

/** #/            ana sayfa
 *  #/optik       optik okuyucu (değişmeden)
 *  #/sinav       sınavlarım · #/sinav/<id> düzenleyici · #/sinav/<id>/yazdir önizleme ve yazdırma */
export function rotaCoz(hash) {
  const p = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (p[0] === 'optik') return { bolum: 'optik' }
  if (p[0] === 'sinav') return { bolum: 'sinav', id: p[1] || null, alt: p[2] || null }
  return { bolum: 'ana' }
}

export function git(yol) {
  if (window.location.hash !== yol) window.location.hash = yol
}

export default function Kok() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const f = () => setHash(window.location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const rota = rotaCoz(hash)
  useEffect(() => {
    document.title = rota.bolum === 'optik' ? 'Optik Okuyucu' : rota.bolum === 'sinav' ? 'Sınav Hazırla · Optik Okuyucu' : 'Optik Okuyucu'
    document.documentElement.dataset.modul = rota.bolum
  }, [rota.bolum])
  useEffect(() => { window.scrollTo(0, 0) }, [rota.bolum, rota.id, rota.alt])

  if (rota.bolum === 'optik') return <App />
  if (rota.bolum === 'sinav') {
    return (
      <Suspense fallback={<div className="modul-yukleniyor" role="status"><span className="donen" />Sınav hazırlama açılıyor…</div>}>
        <SinavModulu rota={rota} />
      </Suspense>
    )
  }
  return <AnaSayfa />
}

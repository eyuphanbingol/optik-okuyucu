import { useCallback, useEffect, useRef, useState } from 'react'
import SinavListesi from './SinavListesi.jsx'
import Duzenleyici from './Duzenleyici.jsx'
import Onizleme from './Onizleme.jsx'
import Simge from '../bilesenler/Simge.jsx'
import { sinavGetir, sinavKaydet, kullanilmayanGorselleriSil } from './depo.js'
import { gorselKimlikleri } from './model.js'
import './sinav.css'

/**
 * Sınav hazırlama modülü.
 *   #/sinav            -> sınavlarım
 *   #/sinav/<id>       -> düzenleyici
 *   #/sinav/<id>/yazdir -> önizleme, yazdırma, dışa aktarma
 * Düzenleyici ile önizleme aynı bellek durumunu paylaşır; değişiklikler otomatik kaydedilir.
 */
export default function SinavModulu({ rota }) {
  if (!rota.id) return <div className="sh"><SinavListesi /></div>
  return <div className="sh"><SinavCalisma key={rota.id} id={rota.id} alt={rota.alt} /></div>
}

function SinavCalisma({ id, alt }) {
  const [sinav, setSinavIc] = useState(null)
  const [durum, setDurum] = useState('yukleniyor')     // yukleniyor | yok | hazir
  const [kayit, setKayit] = useState('kaydedildi')     // kaydedildi | bekliyor | kaydediliyor | hata
  const sinavRef = useRef(null)
  const gecmis = useRef({ geri: [], ileri: [], anahtar: null, zaman: 0 })
  const zamanlayici = useRef(null)
  const [, setGecmisSurum] = useState(0)

  useEffect(() => {
    let iptal = false
    sinavGetir(id).then(s => {
      if (iptal) return
      if (!s) { setDurum('yok'); return }
      sinavRef.current = s
      setSinavIc(s)
      setDurum('hazir')
      // önceki oturumlardan kalan, artık kullanılmayan görselleri temizle
      kullanilmayanGorselleriSil(s.id, gorselKimlikleri(s)).catch(() => {})
    }).catch(() => { if (!iptal) setDurum('yok') })
    return () => { iptal = true }
  }, [id])

  const kaydetSimdi = useCallback(async () => {
    clearTimeout(zamanlayici.current)
    zamanlayici.current = null
    const s = sinavRef.current
    if (!s) return
    setKayit('kaydediliyor')
    try {
      await sinavKaydet({ ...s, guncelleme: Date.now() })
      if (sinavRef.current === s) setKayit('kaydedildi')
    } catch {
      setKayit('hata')
    }
  }, [])

  const zamanla = useCallback(() => {
    setKayit('bekliyor')
    clearTimeout(zamanlayici.current)
    zamanlayici.current = setTimeout(kaydetSimdi, 450)
  }, [kaydetSimdi])

  // sayfadan ayrılırken bekleyen kaydı yaz
  useEffect(() => {
    const f = () => { if (zamanlayici.current) kaydetSimdi() }
    const g = () => { if (document.visibilityState === 'hidden') f() }
    window.addEventListener('pagehide', f)
    document.addEventListener('visibilitychange', g)
    return () => { window.removeEventListener('pagehide', f); document.removeEventListener('visibilitychange', g); f() }
  }, [kaydetSimdi])

  /** Tek giriş noktası: tüm değişiklikler buradan geçer (geri alma geçmişi + otomatik kayıt). */
  const degistir = useCallback((fn, anahtar = null) => {
    const s = sinavRef.current
    if (!s) return
    const y = typeof fn === 'function' ? fn(s) : fn
    if (!y || y === s) return
    const g = gecmis.current
    const simdi = Date.now()
    if (!(anahtar && g.anahtar === anahtar && simdi - g.zaman < 1500)) {
      g.geri.push(s)
      if (g.geri.length > 200) g.geri.shift()
    }
    g.ileri = []
    g.anahtar = anahtar
    g.zaman = simdi
    sinavRef.current = y
    setSinavIc(y)
    setGecmisSurum(v => v + 1)
    zamanla()
  }, [zamanla])

  const geriAl = useCallback(() => {
    const g = gecmis.current
    if (!g.geri.length) return
    g.ileri.push(sinavRef.current)
    const y = g.geri.pop()
    g.anahtar = null
    sinavRef.current = y
    setSinavIc(y)
    setGecmisSurum(v => v + 1)
    zamanla()
  }, [zamanla])

  const yinele = useCallback(() => {
    const g = gecmis.current
    if (!g.ileri.length) return
    g.geri.push(sinavRef.current)
    const y = g.ileri.pop()
    g.anahtar = null
    sinavRef.current = y
    setSinavIc(y)
    setGecmisSurum(v => v + 1)
    zamanla()
  }, [zamanla])

  if (durum === 'yukleniyor') return <div className="modul-yukleniyor" role="status"><span className="donen" />Sınav açılıyor…</div>
  if (durum === 'yok') {
    return (
      <div className="sh-bos-durum tam">
        <span className="sh-bos-simge"><Simge ad="sayfa" boyut={30} kalinlik={1.5} /></span>
        <h2>Sınav bulunamadı</h2>
        <p>Bu sınav silinmiş ya da başka bir cihazda oluşturulmuş olabilir. Sınavlar yalnızca oluşturuldukları cihazda saklanır.</p>
        <a className="birincil" href="#/sinav"><Simge ad="geri" />Sınavlarım</a>
      </div>
    )
  }

  const ortak = {
    sinav, degistir, geriAl, yinele, kayit, kaydetSimdi,
    geriVar: gecmis.current.geri.length > 0, ileriVar: gecmis.current.ileri.length > 0,
  }
  return alt === 'yazdir' ? <Onizleme {...ortak} /> : <Duzenleyici {...ortak} />
}

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { rotaCoz } from '../Kok.jsx'
import Simge from '../bilesenler/Simge.jsx'
import { supabase, girisAcik, yetkiGetir, cikisYap } from './supabase.js'
import { bulutHazirla, bulutKapat } from './bulut.js'
import GirisEkrani from './GirisEkrani.jsx'
import './giris.css'

const AdminPaneli = lazy(() => import('./AdminPaneli.jsx'))

const adminRotasi = hash => /^#\/?admin(\/|$)/.test(hash || '')

/**
 * Uygulamanın önündeki giriş kapısı: oturum, kurumun açık modülleri ve #/admin yönetim paneli.
 * Supabase ayarlı değilse hiçbir şey yapmaz; uygulama eskisi gibi açılır.
 */
export default function Kapi({ children }) {
  if (!girisAcik) return children
  return <Oturum>{children}</Oturum>
}

function Oturum({ children }) {
  const [durum, setDurum] = useState({ tur: 'yukleniyor' })
  const [hash, setHash] = useState(() => window.location.hash)
  const sonKullanici = useRef(null)

  useEffect(() => {
    const degisti = () => setHash(window.location.hash)
    window.addEventListener('hashchange', degisti)
    return () => window.removeEventListener('hashchange', degisti)
  }, [])

  const yukle = useCallback(async (session, sessiz = false) => {
    if (!session) {
      sonKullanici.current = null
      await bulutKapat(false)
      setDurum({ tur: 'giris' })
      return
    }
    const id = session.user.id
    sonKullanici.current = id
    if (!sessiz) setDurum(d => (d.tur === 'hazir' && d.id === id ? d : { tur: 'yukleniyor' }))
    try {
      const yetki = await yetkiGetir(id)
      if (sonKullanici.current !== id) return
      if (!yetki) { setDurum({ tur: 'bagsiz' }); return }
      await bulutHazirla(id, yetki.alan, mesaj => {
        if (sonKullanici.current === id) setDurum(d => (d.tur === 'hazir' ? d : { tur: 'yukleniyor', mesaj }))
      })
      if (sonKullanici.current !== id) return
      setDurum({ tur: 'hazir', id, yetki })
    } catch {
      if (sonKullanici.current !== id) return
      if (!sessiz) setDurum({ tur: 'hata' })
    }
  }, [])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((olay, session) => {
      if (olay === 'TOKEN_REFRESHED') return
      // Supabase, bu geri çağrının içinde başka bir Supabase isteği beklenirse kilitlenebiliyor.
      setTimeout(() => yukle(session), 0)
    })
    const gorunur = () => {
      if (document.visibilityState !== 'visible') return
      supabase.auth.getSession().then(({ data: d }) => { if (d.session) yukle(d.session, true) })
    }
    document.addEventListener('visibilitychange', gorunur)
    return () => {
      data.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', gorunur)
    }
  }, [yukle])

  const yetki = durum.tur === 'hazir' ? durum.yetki : null

  useEffect(() => {
    const d = document.documentElement.dataset
    if (!yetki) {
      delete d.oturum; delete d.optikKapali; delete d.sinavKapali; delete d.tekModul
      return
    }
    d.oturum = yetki.rol
    if (yetki.optik) delete d.optikKapali; else d.optikKapali = ''
    if (yetki.sinav) delete d.sinavKapali; else d.sinavKapali = ''
    if (yetki.optik !== yetki.sinav) d.tekModul = ''; else delete d.tekModul
  }, [yetki])

  if (durum.tur === 'yukleniyor') {
    return (
      <div className="giris-sahne">
        <div className="giris-yukleniyor" role="status">
          <span className="donen" aria-hidden="true" />
          <span>{durum.mesaj || 'Hesabınız açılıyor…'}</span>
        </div>
      </div>
    )
  }
  if (durum.tur === 'giris') return <GirisEkrani />
  if (durum.tur === 'hata') {
    return (
      <Engel
        simge="uyari"
        baslik="Bağlantı kurulamadı"
        metin="Hesabınız ve verileriniz alınamadı. İnternet bağlantınızı kontrol edip tekrar deneyin."
        eylem={<button type="button" className="birincil" onClick={() => window.location.reload()}><Simge ad="yenile" boyut={17} />Tekrar dene</button>}
      />
    )
  }
  if (durum.tur === 'bagsiz') {
    return <Engel simge="kilit" baslik="Hesap bir kuruma bağlı değil" metin="Bu kullanıcı için tanımlı bir kurum bulunamadı. Yöneticinizle iletişime geçin." />
  }
  if (!yetki.aktif) {
    return <Engel simge="kilit" baslik="Erişim askıya alındı" metin={`${yetki.kurumAdi} için erişim şu an kapalı. Yöneticinizle iletişime geçin.`} />
  }

  if (adminRotasi(hash)) {
    if (yetki.rol !== 'admin') {
      return <Engel simge="kilit" baslik="Bu sayfaya erişiminiz yok" metin="Yönetim paneli yalnızca yönetici hesabıyla açılabilir." eylem={<AnaSayfaDugmesi />} />
    }
    return (
      <Suspense fallback={<div className="giris-sahne"><span className="donen" aria-label="Yükleniyor" /></div>}>
        <AdminPaneli yetki={yetki} />
      </Suspense>
    )
  }

  const rota = rotaCoz(hash)
  if (rota.bolum === 'optik' && !yetki.optik) return <ModulKapali ad="Optik okuma" />
  if (rota.bolum === 'sinav' && !yetki.sinav) return <ModulKapali ad="Sınav hazırlama" />
  if (rota.bolum === 'ana' && !yetki.optik && !yetki.sinav) {
    return <Engel simge="kilit" baslik="Açık modül yok" metin={`${yetki.kurumAdi} için henüz bir modül açılmamış. Yöneticinizle iletişime geçin.`} />
  }

  return (
    <>
      {children}
      {rota.bolum === 'ana' && <OturumCubugu yetki={yetki} />}
    </>
  )
}

function AnaSayfaDugmesi() {
  return <a className="birincil" href="#/"><Simge ad="ev" boyut={17} />Ana sayfa</a>
}

function ModulKapali({ ad }) {
  return (
    <Engel
      simge="kilit"
      baslik={`${ad} modülü kapalı`}
      metin="Bu modül kurumunuz için açılmamış. Açılması için yöneticinizle iletişime geçin."
      eylem={<AnaSayfaDugmesi />}
    />
  )
}

function Engel({ simge, baslik, metin, eylem }) {
  return (
    <div className="giris-sahne">
      <div className="giris-kart engel-kart">
        <span className="engel-simge"><Simge ad={simge} boyut={26} /></span>
        <h1>{baslik}</h1>
        <p className="aciklama">{metin}</p>
        <div className="engel-dugmeler">
          {eylem}
          <button type="button" className="ikincil" onClick={cikisYap}>Çıkış yap</button>
        </div>
      </div>
    </div>
  )
}

function OturumCubugu({ yetki }) {
  return (
    <div className="oturum-cubugu" role="region" aria-label="Oturum">
      <span className="oturum-kim">
        <b>{yetki.kurumAdi}</b>
        <small>{yetki.kullaniciAdi}</small>
      </span>
      {yetki.rol === 'admin' && (
        <a className="oturum-dugme vurgulu" href="#/admin"><Simge ad="ayarlar" boyut={15} />Yönetim</a>
      )}
      <button type="button" className="oturum-dugme" onClick={cikisYap}>Çıkış</button>
    </div>
  )
}

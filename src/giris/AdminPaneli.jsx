import { useCallback, useEffect, useMemo, useState } from 'react'
import Simge, { Logo } from '../bilesenler/Simge.jsx'
import { supabase, cikisYap, sifreUret, kullaniciAdiNormal } from './supabase.js'

const MODULLER = [
  { ad: 'optik', baslik: 'Optik okuma', aciklama: 'Kamerayla optik form okutma', simge: 'optik' },
  { ad: 'sinav', baslik: 'Sınav hazırlama', aciklama: 'Sınav oluşturma ve baskı', simge: 'sinav' },
]

async function istek(islem, veri = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Oturumun süresi dolmuş. Tekrar giriş yapın.')
  let yanit
  try {
    yanit = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ islem, ...veri }),
    })
  } catch {
    throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.')
  }
  const j = await yanit.json().catch(() => ({}))
  if (!yanit.ok || j.tamam === false) throw new Error(j.hata || `Sunucu hatası (${yanit.status}).`)
  return j
}

const adOner = kurum => kullaniciAdiNormal(kurum).replace(/[^a-z0-9._-]/g, '').slice(0, 24)
const bas = ad => (ad || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toLocaleUpperCase('tr-TR')
const tarih = t => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })

export default function AdminPaneli({ yetki }) {
  const [kurumlar, setKurumlar] = useState(null)
  const [hata, setHata] = useState('')
  const [ara, setAra] = useState('')
  const [yeniAcik, setYeniAcik] = useState(false)
  const [kimlik, setKimlik] = useState(null)
  const [bildirim, setBildirim] = useState(null)

  const yenile = useCallback(async () => {
    try {
      const j = await istek('listele')
      setKurumlar(j.kurumlar)
      setHata('')
    } catch (e) {
      setHata(e.message)
      setKurumlar(k => k || [])
    }
  }, [])

  useEffect(() => { yenile() }, [yenile])

  useEffect(() => {
    if (!bildirim) return
    const t = setTimeout(() => setBildirim(null), 3200)
    return () => clearTimeout(t)
  }, [bildirim])

  const bildir = (metin, tur = 'basari') => setBildirim({ metin, tur, an: Date.now() })

  /** İşlemi yapar, listeyi tazeler; hata olursa bildirim gösterip false döner. */
  const calistir = useCallback(async (islem, veri, basari) => {
    try {
      await istek(islem, veri)
      await yenile()
      if (basari) bildir(basari)
      return true
    } catch (e) {
      bildir(e.message, 'hata')
      await yenile()
      return false
    }
  }, [yenile])

  const kurumuDegistir = useCallback((id, degisiklik, basari) => {
    setKurumlar(ks => ks.map(k => (k.id === id ? { ...k, ...degisiklik } : k)))
    return calistir('kurumGuncelle', { id, ...degisiklik }, basari)
  }, [calistir])

  const gorunen = useMemo(() => {
    if (!kurumlar) return []
    const q = ara.trim().toLocaleLowerCase('tr-TR')
    if (!q) return kurumlar
    return kurumlar.filter(k =>
      k.ad.toLocaleLowerCase('tr-TR').includes(q) || k.kullanicilar.some(u => u.kullanici_adi.includes(q)))
  }, [kurumlar, ara])

  const sayilar = useMemo(() => {
    const ks = kurumlar || []
    return {
      kurum: ks.length,
      aktif: ks.filter(k => k.aktif).length,
      kullanici: ks.reduce((t, k) => t + k.kullanicilar.length, 0),
      optik: ks.filter(k => k.optik).length,
      sinav: ks.filter(k => k.sinav).length,
    }
  }, [kurumlar])

  return (
    <div className="admin">
      <header className="admin-ust">
        <a className="marka" href="#/" aria-label="Ana sayfa">
          <Logo boyut={34} />
          <div className="logo">Optik Okuyucu</div>
        </a>
        <div className="admin-ust-dugmeler">
          <a className="ikincil kucuk" href="#/"><Simge ad="ev" boyut={15} />Uygulama</a>
          <button type="button" className="ikincil kucuk" onClick={cikisYap}>Çıkış</button>
        </div>
      </header>

      <div className="admin-baslik">
        <div>
          <span className="admin-ust-yazi">Yönetim paneli · {yetki.kullaniciAdi}</span>
          <h1>Kurumlar</h1>
        </div>
        <button type="button" className="birincil" onClick={() => setYeniAcik(a => !a)}>
          <Simge ad={yeniAcik ? 'kapat' : 'arti'} boyut={17} />{yeniAcik ? 'Vazgeç' : 'Yeni kurum'}
        </button>
      </div>

      <div className="admin-sayilar">
        <div className="admin-sayi"><b>{sayilar.kurum}</b><span>Kurum</span></div>
        <div className="admin-sayi"><b>{sayilar.aktif}</b><span>Aktif kurum</span></div>
        <div className="admin-sayi"><b>{sayilar.kullanici}</b><span>Kullanıcı</span></div>
        <div className="admin-sayi"><b>{sayilar.optik}<i>/</i>{sayilar.sinav}</b><span>Optik / Sınav açık</span></div>
      </div>

      {kimlik && <KimlikKutusu kimlik={kimlik} onKapat={() => setKimlik(null)} />}

      {yeniAcik && (
        <YeniKurum
          onKaydet={async veri => {
            try {
              await istek('kurumEkle', veri)
              setYeniAcik(false)
              if (veri.kullaniciAdi) setKimlik({ kurum: veri.ad, kullaniciAdi: kullaniciAdiNormal(veri.kullaniciAdi), sifre: veri.sifre, yeni: true })
              bildir(`${veri.ad} eklendi.`)
              await yenile()
            } catch (e) {
              bildir(e.message, 'hata')
            }
          }}
        />
      )}

      {hata && (
        <div className="hata-kutu" role="alert">
          <Simge ad="uyari" boyut={17} />
          <span>{hata}</span>
        </div>
      )}

      {kurumlar && kurumlar.length > 0 && (
        <label className="admin-ara">
          <Simge ad="tara" boyut={17} />
          <input value={ara} onChange={e => setAra(e.target.value)} placeholder="Kurum ya da kullanıcı ara…" />
        </label>
      )}

      {!kurumlar ? (
        <div className="admin-bos"><span className="donen" aria-label="Yükleniyor" /></div>
      ) : kurumlar.length === 0 ? (
        !hata && (
          <div className="admin-bos">
            <span className="engel-simge"><Simge ad="kisiler" boyut={26} /></span>
            <b>Henüz kurum yok</b>
            <span>“Yeni kurum” ile ilk kurumu ekleyin; kullanıcı adı ve şifresini verin, modüllerini seçin.</span>
          </div>
        )
      ) : gorunen.length === 0 ? (
        <div className="admin-bos"><span>“{ara}” ile eşleşen kurum yok.</span></div>
      ) : (
        <div className="kurum-listesi">
          {gorunen.map(k => (
            <KurumKarti
              key={k.id}
              kurum={k}
              onDegistir={kurumuDegistir}
              calistir={calistir}
              onKimlik={setKimlik}
            />
          ))}
        </div>
      )}

      {bildirim && (
        <div key={bildirim.an} className={`admin-bildirim ${bildirim.tur}`} role="status">
          <Simge ad={bildirim.tur === 'hata' ? 'uyari' : 'onayDaire'} boyut={17} />
          <span>{bildirim.metin}</span>
        </div>
      )}
    </div>
  )
}

function Anahtar({ acik, onClick, baslik, aciklama, simge, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      className={`modul-anahtar ${acik ? 'acik' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {simge && <span className="modul-anahtar-simge"><Simge ad={simge} boyut={19} /></span>}
      <span className="modul-anahtar-yazi">
        <b>{baslik}</b>
        {aciklama && <small>{aciklama}</small>}
      </span>
      <span className="anahtar-dugme" aria-hidden="true" />
    </button>
  )
}

function YeniKurum({ onKaydet }) {
  const [ad, setAd] = useState('')
  const [moduller, setModuller] = useState({ optik: true, sinav: true })
  const [kullaniciAdi, setKullaniciAdi] = useState('')
  const [adElle, setAdElle] = useState(false)
  const [sifre, setSifre] = useState(() => sifreUret())
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState('')

  const oneri = adElle ? kullaniciAdi : adOner(ad)

  async function gonder(e) {
    e.preventDefault()
    if (!ad.trim()) { setHata('Kurum adını yazın.'); return }
    if (!oneri) { setHata('Kullanıcı adı girin.'); return }
    if (sifre.length < 6) { setHata('Şifre en az 6 karakter olmalı.'); return }
    setHata('')
    setMesgul(true)
    await onKaydet({ ad: ad.trim(), ...moduller, kullaniciAdi: oneri, sifre })
    setMesgul(false)
  }

  return (
    <form className="admin-panel" onSubmit={gonder} noValidate>
      <h2>Yeni kurum</h2>
      <label className="alan">
        <span className="alan-ad">Kurum adı</span>
        <input value={ad} onChange={e => setAd(e.target.value)} placeholder="Örn. Başarı Dershanesi" autoFocus />
      </label>

      <div className="alan">
        <span className="alan-ad">Açık modüller</span>
        <div className="kurum-moduller">
          {MODULLER.map(m => (
            <Anahtar
              key={m.ad}
              acik={moduller[m.ad]}
              onClick={() => setModuller(s => ({ ...s, [m.ad]: !s[m.ad] }))}
              baslik={m.baslik}
              aciklama={m.aciklama}
              simge={m.simge}
            />
          ))}
        </div>
      </div>

      <div className="alan-izgara">
        <label className="alan">
          <span className="alan-ad">Kullanıcı adı</span>
          <input
            value={oneri}
            onChange={e => { setAdElle(true); setKullaniciAdi(e.target.value) }}
            placeholder="basaridershanesi"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <label className="alan">
          <span className="alan-ad">Şifre</span>
          <span className="sifre-alan">
            <input value={sifre} onChange={e => setSifre(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <button type="button" className="sifre-goster" onClick={() => setSifre(sifreUret())} aria-label="Yeni şifre üret" title="Yeni şifre üret">
              <Simge ad="yenile" boyut={18} />
            </button>
          </span>
        </label>
      </div>

      {hata && <div className="hata-kutu" role="alert"><Simge ad="uyari" boyut={17} /><span>{hata}</span></div>}

      <div className="dugmeler">
        <button type="submit" className="birincil" disabled={mesgul}>
          {mesgul ? <span className="donen kucuk" aria-hidden="true" /> : <Simge ad="onay" boyut={17} />}
          Kurumu oluştur
        </button>
        <span className="kucuk-not">Kullanıcı adı ve şifreyi kurumla paylaşmayı unutmayın.</span>
      </div>
    </form>
  )
}

function KurumKarti({ kurum, onDegistir, calistir, onKimlik }) {
  const [adDuzenle, setAdDuzenle] = useState(false)
  const [yeniAd, setYeniAd] = useState(kurum.ad)
  const [ekleAcik, setEkleAcik] = useState(false)
  const [yeniKullanici, setYeniKullanici] = useState('')
  const [yeniSifre, setYeniSifre] = useState(() => sifreUret())
  const [mesgul, setMesgul] = useState(false)

  async function adKaydet(e) {
    e.preventDefault()
    const a = yeniAd.trim()
    if (!a || a === kurum.ad) { setAdDuzenle(false); setYeniAd(kurum.ad); return }
    if (await onDegistir(kurum.id, { ad: a }, 'Kurum adı güncellendi.')) setAdDuzenle(false)
  }

  async function kullaniciEkle(e) {
    e.preventDefault()
    const ad = kullaniciAdiNormal(yeniKullanici)
    setMesgul(true)
    const tamam = await calistir('kullaniciEkle', { kurumId: kurum.id, kullaniciAdi: ad, sifre: yeniSifre }, 'Kullanıcı eklendi.')
    setMesgul(false)
    if (!tamam) return
    onKimlik({ kurum: kurum.ad, kullaniciAdi: ad, sifre: yeniSifre, yeni: true })
    setEkleAcik(false)
    setYeniKullanici('')
    setYeniSifre(sifreUret())
  }

  async function sifreSifirla(u) {
    const sifre = sifreUret()
    if (!window.confirm(`"${u.kullanici_adi}" için yeni şifre oluşturulsun mu?\nEski şifre artık çalışmaz.`)) return
    if (await calistir('sifreDegistir', { id: u.id, sifre }, 'Şifre yenilendi.')) {
      onKimlik({ kurum: kurum.ad, kullaniciAdi: u.kullanici_adi, sifre, yeni: false })
    }
  }

  function kullaniciSil(u) {
    if (!window.confirm(`"${u.kullanici_adi}" kullanıcısı silinsin mi?`)) return
    calistir('kullaniciSil', { id: u.id }, 'Kullanıcı silindi.')
  }

  function kurumSil() {
    const n = kurum.kullanicilar.length
    if (!window.confirm(`"${kurum.ad}" silinsin mi?${n ? `\n${n} kullanıcısı da silinecek.` : ''}\nBu işlem geri alınamaz.`)) return
    calistir('kurumSil', { id: kurum.id }, `${kurum.ad} silindi.`)
  }

  return (
    <article className={`kurum-karti ${kurum.aktif ? '' : 'pasif'}`}>
      <div className="kurum-bas">
        <span className="kurum-avatar">{bas(kurum.ad)}</span>
        {adDuzenle ? (
          <form className="kurum-ad-form" onSubmit={adKaydet}>
            <input className="admin-girdi" value={yeniAd} onChange={e => setYeniAd(e.target.value)} autoFocus aria-label="Kurum adı" />
            <button type="submit" className="ikon-dugme" aria-label="Kaydet"><Simge ad="onay" boyut={17} /></button>
            <button type="button" className="ikon-dugme" aria-label="Vazgeç" onClick={() => { setAdDuzenle(false); setYeniAd(kurum.ad) }}><Simge ad="kapat" boyut={17} /></button>
          </form>
        ) : (
          <div className="kurum-ad">
            <b>{kurum.ad}</b>
            <small>{kurum.kullanicilar.length} kullanıcı · {tarih(kurum.olusturma)}</small>
          </div>
        )}
        {!adDuzenle && (
          <div className="kurum-eylemler">
            <button
              type="button"
              className={`durum-cip ${kurum.aktif ? 'aktif' : ''}`}
              onClick={() => onDegistir(kurum.id, { aktif: !kurum.aktif }, kurum.aktif ? 'Kurum askıya alındı.' : 'Kurum etkinleştirildi.')}
              title={kurum.aktif ? 'Askıya al' : 'Etkinleştir'}
            >
              <i aria-hidden="true" />{kurum.aktif ? 'Aktif' : 'Askıda'}
            </button>
            <button type="button" className="ikon-dugme" aria-label="Adı değiştir" title="Adı değiştir" onClick={() => setAdDuzenle(true)}><Simge ad="kalem" boyut={16} /></button>
            <button type="button" className="ikon-dugme tehlike" aria-label="Kurumu sil" title="Kurumu sil" onClick={kurumSil}><Simge ad="cop" boyut={16} /></button>
          </div>
        )}
      </div>

      <div className="kurum-moduller">
        {MODULLER.map(m => (
          <Anahtar
            key={m.ad}
            acik={kurum[m.ad]}
            onClick={() => onDegistir(kurum.id, { [m.ad]: !kurum[m.ad] }, `${m.baslik} ${kurum[m.ad] ? 'kapatıldı' : 'açıldı'}.`)}
            baslik={m.baslik}
            aciklama={kurum[m.ad] ? 'Açık' : 'Kapalı'}
            simge={m.simge}
          />
        ))}
      </div>

      <div className="kullanici-listesi">
        {kurum.kullanicilar.length === 0 && <span className="kucuk-not">Bu kurumun kullanıcısı yok; giriş yapabilmesi için bir kullanıcı ekleyin.</span>}
        {kurum.kullanicilar.map(u => (
          <div key={u.id} className="kullanici-satir">
            <Simge ad="kisiler" boyut={16} />
            <span className="kullanici-ad">{u.kullanici_adi}</span>
            <button type="button" className="ikincil kucuk" onClick={() => sifreSifirla(u)}><Simge ad="anahtar" boyut={15} />Yeni şifre</button>
            <button type="button" className="ikon-dugme tehlike" aria-label="Kullanıcıyı sil" title="Kullanıcıyı sil" onClick={() => kullaniciSil(u)}><Simge ad="cop" boyut={16} /></button>
          </div>
        ))}

        {ekleAcik ? (
          <form className="satir-form" onSubmit={kullaniciEkle}>
            <input
              className="admin-girdi"
              value={yeniKullanici}
              onChange={e => setYeniKullanici(e.target.value)}
              placeholder="Kullanıcı adı"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              aria-label="Kullanıcı adı"
            />
            <span className="sifre-alan admin-sifre">
              <input className="admin-girdi" value={yeniSifre} onChange={e => setYeniSifre(e.target.value)} aria-label="Şifre" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              <button type="button" className="sifre-goster" onClick={() => setYeniSifre(sifreUret())} aria-label="Yeni şifre üret" title="Yeni şifre üret"><Simge ad="yenile" boyut={17} /></button>
            </span>
            <button type="submit" className="birincil kucuk" disabled={mesgul || !yeniKullanici.trim()}>
              {mesgul ? <span className="donen kucuk" aria-hidden="true" /> : <Simge ad="onay" boyut={15} />}Ekle
            </button>
            <button type="button" className="ikincil kucuk" onClick={() => setEkleAcik(false)}>Vazgeç</button>
          </form>
        ) : (
          <button type="button" className="kullanici-ekle" onClick={() => setEkleAcik(true)}><Simge ad="arti" boyut={15} />Kullanıcı ekle</button>
        )}
      </div>
    </article>
  )
}

function KimlikKutusu({ kimlik, onKapat }) {
  const [kopyalandi, setKopyalandi] = useState(false)
  const adres = window.location.origin
  const metin = `${kimlik.kurum}\nAdres: ${adres}\nKullanıcı adı: ${kimlik.kullaniciAdi}\nŞifre: ${kimlik.sifre}`

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(metin)
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 1800)
    } catch {
      window.prompt('Kopyalayın:', metin)
    }
  }

  return (
    <div className="kimlik-kutu">
      <div className="kimlik-bas">
        <Simge ad="onayDaire" boyut={19} />
        <b>{kimlik.yeni ? 'Giriş bilgileri hazır' : 'Yeni şifre oluşturuldu'}</b>
        <button type="button" className="ikon-dugme" onClick={onKapat} aria-label="Kapat"><Simge ad="kapat" boyut={16} /></button>
      </div>
      <p>Bu bilgileri <b>{kimlik.kurum}</b> ile paylaşın. Şifre bir daha gösterilmez.</p>
      <dl>
        <dt>Adres</dt><dd>{adres}</dd>
        <dt>Kullanıcı adı</dt><dd>{kimlik.kullaniciAdi}</dd>
        <dt>Şifre</dt><dd>{kimlik.sifre}</dd>
      </dl>
      <button type="button" className="birincil kucuk" onClick={kopyala}>
        <Simge ad={kopyalandi ? 'onay' : 'kopya'} boyut={15} />{kopyalandi ? 'Kopyalandı' : 'Bilgileri kopyala'}
      </button>
    </div>
  )
}

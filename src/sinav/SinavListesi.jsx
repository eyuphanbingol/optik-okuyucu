import { useEffect, useMemo, useRef, useState } from 'react'
import Simge from '../bilesenler/Simge.jsx'
import { sinavlariListele, sinavKaydet, sinavSil, profilGetir, profilKaydet, kalici } from './depo.js'
import { yeniSinav, soruMu, toplamPuan, TURLER, GRUP_HARFLERI, puanMetni, grupSayisiSinirla } from './model.js'
import { yedekOlustur, yedektenYukle, sinavKopyala, indirBlob, dosyaAdi } from './yedek.js'
import { Acilir, MenuOge, MenuAyrac, Pencere, Secici, GrupSecici, useBildirim, tarihMetni } from './arayuz.jsx'

const SABLONLAR = [
  { id: 'test', ad: 'Test', aciklama: 'Çoktan seçmeli sorular; optik formla okunabilir', simge: 'liste' },
  { id: 'yazili', ad: 'Yazılı', aciklama: 'Açık uçlu sorular, çizgili cevap alanları', simge: 'kalem' },
  { id: 'karma', ad: 'Karma', aciklama: 'D/Y, boşluk doldurma, eşleştirme, test ve klasik bölümler', simge: 'sinav' },
  { id: 'bos', ad: 'Boş sayfa', aciklama: 'Soruları kendiniz ekleyin', simge: 'sayfa' },
]

export default function SinavListesi() {
  const [sinavlar, setSinavlar] = useState(null)
  const [yeni, setYeni] = useState(false)
  const [ara, setAra] = useState('')
  const [silinecek, setSilinecek] = useState(null)
  const [bildirim, bildir] = useBildirim()
  const dosyaRef = useRef(null)

  const yenile = () => sinavlariListele().then(setSinavlar).catch(() => setSinavlar([]))
  useEffect(() => { yenile() }, [])

  const gorunen = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase('tr-TR')
    if (!sinavlar) return []
    if (!q) return sinavlar
    return sinavlar.filter(s => [s.baslik?.sinavAdi, s.baslik?.ders, s.baslik?.sinif, s.baslik?.okul].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(q))
  }, [sinavlar, ara])

  async function iceAktar(dosya) {
    try {
      const s = await yedektenYukle(dosya)
      bildir(`“${s.baslik.sinavAdi || 'Sınav'}” içe aktarıldı.`)
      yenile()
    } catch (e) { bildir(e.message, 'hata') }
  }

  return (
    <div className="sh-liste-sayfa">
      <header className="sh-liste-ust">
        <a className="sh-geri-baglanti" href="#/"><Simge ad="geri" boyut={17} />Ana sayfa</a>
        <div className="sh-liste-baslik">
          <div>
            <span className="ust-baslik">Sınav hazırla</span>
            <h1>Sınavlarım</h1>
          </div>
          <div className="sh-liste-eylem">
            <button type="button" className="ikincil" onClick={() => dosyaRef.current?.click()}><Simge ad="yukle" />İçe aktar</button>
            <button type="button" className="birincil" onClick={() => setYeni(true)}><Simge ad="arti" />Yeni sınav</button>
          </div>
        </div>
        <input ref={dosyaRef} type="file" accept=".sinav,application/json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) iceAktar(f) }} />
      </header>

      {!kalici && <div className="uyari-kutu"><Simge ad="uyari" />Bu tarayıcı penceresi verileri kalıcı olarak saklayamıyor (gizli pencere olabilir). Sınavlarınız sayfa kapanınca kaybolur; bitince yedek dosyası indirin.</div>}

      {sinavlar === null ? (
        <div className="sh-kartlar">{[0, 1, 2].map(i => <div key={i} className="sh-sinav-karti iskelet" />)}</div>
      ) : sinavlar.length === 0 ? (
        <div className="sh-hosgeldin">
          <div className="sh-hosgeldin-metin">
            <span className="sh-bos-simge"><Simge ad="sinav" boyut={30} kalinlik={1.5} /></span>
            <h2>İlk sınavınızı hazırlayın</h2>
            <p>Bir şablon seçin; soru sayısını, grupları ve sınav bilgilerini belirleyin. Sonra soruları Word'de yazar gibi doğrudan kâğıdın üzerinde yazın.</p>
          </div>
          <div className="sh-sablonlar">
            {SABLONLAR.map(s => (
              <button key={s.id} type="button" className="sh-sablon" onClick={() => setYeni(s.id)}>
                <span className="sh-sablon-simge"><Simge ad={s.simge} boyut={22} /></span>
                <b>{s.ad}</b>
                <small>{s.aciklama}</small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {sinavlar.length > 5 && (
            <div className="sh-ara">
              <Simge ad="goz" boyut={17} />
              <input type="search" placeholder="Sınav ara (ad, ders, sınıf)" value={ara} onChange={e => setAra(e.target.value)} />
            </div>
          )}
          <div className="sh-kartlar">
            <button type="button" className="sh-sinav-karti yeni" onClick={() => setYeni(true)}>
              <span className="sh-yeni-arti"><Simge ad="arti" boyut={26} /></span>
              <b>Yeni sınav</b>
              <small>Test, yazılı, karma ya da boş</small>
            </button>
            {gorunen.map(s => (
              <SinavKarti key={s.id} s={s}
                onKopya={async () => { await sinavKopyala(s); bildir('Kopyası oluşturuldu.'); yenile() }}
                onYedek={async () => { indirBlob(await yedekOlustur(s), dosyaAdi(s, 'sinav')); bildir('Yedek dosyası indirildi.') }}
                onSil={() => setSilinecek(s)} />
            ))}
          </div>
          {!gorunen.length && <p className="sh-sonuc-yok">“{ara}” ile eşleşen sınav yok.</p>}
        </>
      )}

      {yeni && <YeniSinavPenceresi baslangicSablon={typeof yeni === 'string' ? yeni : 'test'} onKapat={() => setYeni(false)} />}
      {silinecek && (
        <Pencere baslik="Sınav silinsin mi?" simge="cop" onKapat={() => setSilinecek(null)}
          alt={<div className="dugmeler"><button type="button" className="ikincil" onClick={() => setSilinecek(null)}>Vazgeç</button><button type="button" className="birincil tehlike-dolu" onClick={async () => { await sinavSil(silinecek.id); setSilinecek(null); bildir('Sınav silindi.'); yenile() }}><Simge ad="cop" />Sil</button></div>}>
          <p className="aciklama">“{silinecek.baslik?.sinavAdi || 'Adsız sınav'}” ve içindeki görseller bu cihazdan kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
        </Pencere>
      )}
      {bildirim}
    </div>
  )
}

function SinavKarti({ s, onKopya, onYedek, onSil }) {
  const sorular = s.ogeler.filter(soruMu)
  const turler = [...new Set(sorular.map(o => o.tur))]
  const g = Math.max(1, s.ayar?.grupSayisi || 1)
  const ad = s.baslik?.sinavAdi || 'Adsız sınav'
  return (
    <div className="sh-sinav-karti">
      <a className="sh-kart-baglanti" href={`#/sinav/${s.id}`} aria-label={`${ad} sınavını aç`} />
      <div className="sh-kucuk-kagit" aria-hidden="true">
        <span className="kk-baslik" /><span className="kk-alt" />
        <span className="kk-satir" /><span className="kk-satir kisa" /><span className="kk-satir" /><span className="kk-satir kisa" />
        {g > 1 && <span className="kk-gruplar">{GRUP_HARFLERI.slice(0, g).split('').map(h => <i key={h}>{h}</i>)}</span>}
      </div>
      <div className="sh-kart-metin">
        <b className="sh-kart-ad">{ad}</b>
        <span className="sh-kart-alt">{[s.baslik?.sinif, s.baslik?.ders].filter(Boolean).join(' · ') || 'Sınıf ve ders belirtilmemiş'}</span>
        <div className="sh-kart-cipler">
          <span className="cip">{sorular.length} soru</span>
          <span className="cip">{g === 1 ? 'Tek grup' : `${g} grup`}</span>
          <span className="cip">{puanMetni(toplamPuan(s.ogeler))} puan</span>
        </div>
        <div className="sh-kart-turler" title={turler.map(t => TURLER[t]?.ad).join(', ')}>
          {turler.map(t => <span key={t}><Simge ad={TURLER[t]?.simge || 'sayfa'} boyut={14} /></span>)}
          <span className="sh-kart-tarih">{tarihMetni(s.guncelleme)}</span>
        </div>
      </div>
      <div className="sh-kart-eylem">
        <a className="ikincil kucuk" href={`#/sinav/${s.id}/yazdir`}><Simge ad="yazdir" boyut={16} />Yazdır</a>
        <Acilir hiza="sag" genislik={230} tetik={<button type="button" className="sh-ikon-dugme" aria-label="Diğer işlemler"><Simge ad="menu" /></button>}>
          <MenuOge simge="kalem" onClick={() => { window.location.hash = `#/sinav/${s.id}` }}>Düzenle</MenuOge>
          <MenuOge simge="kopya" onClick={onKopya}>Kopyasını oluştur</MenuOge>
          <MenuOge simge="indir" onClick={onYedek} aciklama="Başka cihaza taşımak için">Yedek dosyası indir</MenuOge>
          <MenuAyrac />
          <MenuOge simge="cop" tehlike onClick={onSil}>Sil</MenuOge>
        </Acilir>
      </div>
    </div>
  )
}

export function YeniSinavPenceresi({ baslangicSablon = 'test', onKapat }) {
  const profil = useMemo(() => profilGetir(), [])
  const [sablon, setSablon] = useState(baslangicSablon)
  const [soru, setSoru] = useState(baslangicSablon === 'yazili' ? 5 : baslangicSablon === 'karma' ? 10 : 20)
  const [sik, setSik] = useState(profil.sikSayisi || 5)
  const [grup, setGrup] = useState(grupSayisiSinirla(profil.grupSayisi || 2))
  const [b, setB] = useState(() => ({ okul: profil.okul || '', ders: profil.ders || '', sinif: '', sinavAdi: '', ogretmen: profil.ogretmen || '' }))
  const [mesgul, setMesgul] = useState(false)
  const ilkRef = useRef(null)
  useEffect(() => { setTimeout(() => ilkRef.current?.focus(), 60) }, [])
  const ayarla = (k, v) => setB(x => ({ ...x, [k]: v }))
  const soruGerek = sablon === 'test' || sablon === 'yazili' || sablon === 'karma'

  async function olustur() {
    setMesgul(true)
    try {
      const s = yeniSinav({ sablon, soruSayisi: soru, sikSayisi: sik, grupSayisi: grup, profil, baslik: { ...b } })
      await sinavKaydet(s)
      profilKaydet({ okul: b.okul, ders: b.ders, ogretmen: b.ogretmen, sikSayisi: sik, grupSayisi: grup })
      window.location.hash = `#/sinav/${s.id}`
    } finally { setMesgul(false) }
  }

  return (
    <Pencere baslik="Yeni sınav" altBaslik="Şablonu ve temel bilgileri seçin; her şeyi sonradan değiştirebilirsiniz." simge="sinav" genis onKapat={onKapat}
      alt={<div className="dugmeler"><button type="button" className="ikincil" onClick={onKapat}>Vazgeç</button><button type="button" className="birincil" disabled={mesgul} onClick={olustur}>{mesgul ? <span className="donen kucuk" /> : <Simge ad="onay" />}Sınavı oluştur</button></div>}>
      <div className="sh-form-bolum">
        <div className="sh-form-baslik">Şablon</div>
        <div className="sh-sablonlar kucuk" role="radiogroup" aria-label="Şablon">
          {SABLONLAR.map(s => (
            <button key={s.id} type="button" role="radio" aria-checked={sablon === s.id} className={'sh-sablon' + (sablon === s.id ? ' secili' : '')}
              onClick={() => { setSablon(s.id); if (s.id === 'yazili' && soru > 20) setSoru(5); if (s.id === 'test' && soru < 5) setSoru(20); if (s.id === 'karma') setSoru(10) }}>
              <span className="sh-sablon-simge"><Simge ad={s.simge} boyut={20} /></span>
              <b>{s.ad}</b>
              <small>{s.aciklama}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="sh-form-bolum sh-form-satir">
        {soruGerek && (
          <label className="alan"><span className="alan-ad">{sablon === 'karma' ? 'Test bölümündeki soru sayısı' : 'Soru sayısı'}</span>
            <input type="number" min="1" max="100" inputMode="numeric" value={soru} onChange={e => setSoru(e.target.value === '' ? '' : Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))} />
          </label>
        )}
        {(sablon === 'test' || sablon === 'karma') && (
          <div className="alan"><span className="alan-ad">Şık sayısı</span>
            <Secici etiket="Şık sayısı" deger={sik} onDegis={setSik} secenekler={[[3, 'A–C'], [4, 'A–D'], [5, 'A–E']]} />
          </div>
        )}
        <div className="alan sh-alan-genis"><span className="alan-ad">Gruplar</span>
          <GrupSecici deger={grup} onDegis={setGrup} />
        </div>
      </div>
      <div className="sh-form-bolum">
        <div className="sh-form-baslik">Sınav bilgileri <small>kâğıdın başlığında görünür</small></div>
        <div className="sh-form-izgara">
          <label className="alan"><span className="alan-ad">Okul</span><input ref={ilkRef} value={b.okul} onChange={e => ayarla('okul', e.target.value)} placeholder="Örn. Atatürk Anadolu Lisesi" /></label>
          <label className="alan"><span className="alan-ad">Ders</span><input value={b.ders} onChange={e => ayarla('ders', e.target.value)} placeholder="Örn. Matematik" /></label>
          <label className="alan"><span className="alan-ad">Sınıf / şube</span><input value={b.sinif} onChange={e => ayarla('sinif', e.target.value)} placeholder="Örn. 9. Sınıf" /></label>
          <label className="alan"><span className="alan-ad">Sınav adı</span><input value={b.sinavAdi} onChange={e => ayarla('sinavAdi', e.target.value)} placeholder="Örn. 1. Dönem 1. Yazılı" /></label>
          <label className="alan"><span className="alan-ad">Öğretmen adı <small>isteğe bağlı · kâğıtta yalnızca ad soyad yazar</small></span><input value={b.ogretmen} onChange={e => ayarla('ogretmen', e.target.value)} placeholder="Örn. Ayşe Yılmaz" autoComplete="name" /></label>
        </div>
      </div>
    </Pencere>
  )
}

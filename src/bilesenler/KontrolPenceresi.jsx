import { useMemo, useState } from 'react'
import { gorselUrl } from '../omr/istemci.js'
import { SIKLAR, kitapcikSec, baslikBicim, varsayilanKarar } from '../mantik.js'
import Simge from './Simge.jsx'

/**
 * Okuyucunun emin olamadığı her şeyi öğretmene gösterir. Öğretmen onaylamadan kayıt yapılmaz.
 */
export default function KontrolPenceresi({ sonuc, sorunlar, ayar, anahtarlar, onOnay, onAtla }) {
  const kitaplar = Object.keys(anahtarlar)
  const isimSorunu = sorunlar.some(s => s.tur === 'isim' || s.tur === 'no')
  const kitapSorunu = sorunlar.some(s => s.tur === 'kitapcik')
  const anahtarSorunu = sorunlar.find(s => s.tur === 'anahtarIsaretli')
  const soruSorunlari = sorunlar.filter(s => s.tur === 'soru')

  const [ad, setAd] = useState(sonuc.ad.metin)
  const [soyad, setSoyad] = useState(sonuc.soyad.metin)
  const [no, setNo] = useState(sonuc.no.metin)
  const [kitapcik, setKitapcik] = useState(() => kitapcikSec(sonuc, anahtarlar))
  const [kararlar, setKararlar] = useState(() => {
    const k = {}
    for (const s of soruSorunlari) k[s.q] = varsayilanKarar(s.okunan)
    return k
  })

  const gorsel = useMemo(() => {
    const g = sonuc.gorsel || {}
    return {
      ad: gorselUrl(g.adYazi), soyad: gorselUrl(g.soyadYazi), no: gorselUrl(g.noYazi),
      sorular: Object.fromEntries(Object.entries(sonuc.soruGorsel || {}).map(([q, v]) => [q, gorselUrl(v)])),
    }
  }, [sonuc])

  const temizle = s => s.toLocaleUpperCase('tr-TR').replace(/[^A-ZÇĞİÖŞÜ ]/g, '').replace(/\s+/g, ' ')
  const hatalar = []
  if (/\?/.test(ad) || /\?/.test(soyad)) hatalar.push('Ad/soyaddaki "?" işaretlerini düzeltin.')
  if (/\?/.test(no)) hatalar.push('Numaradaki "?" işaretini düzeltin.')
  if (!kitapcik) hatalar.push('Kitapçık türünü seçin.')
  if (!ad.trim() && !soyad.trim() && !no.trim()) hatalar.push('En azından ad soyad ya da numara girin.')

  function kararVer(q, karar) { setKararlar(k => ({ ...k, [q]: karar })) }

  function onayla() {
    if (hatalar.length) return
    onOnay({
      ad: temizle(ad).trim(), soyad: temizle(soyad).trim(), no: no.replace(/\D/g, ''),
      kitapcik, kararlar,
    })
  }

  return (
    <div className="pencere-arka">
      <div className="pencere genis" role="dialog" aria-modal="true">
        <div className="pencere-bas">
          <span className="pencere-simge uyari"><Simge ad="uyari" /></span>
          <div className="pencere-bas-metin">
            <h2>Kontrol gerekiyor</h2>
            <p className="aciklama">Okuyucu bu kâğıtta aşağıdaki noktalardan emin olamadı. Kâğıda bakıp doğrusunu seçin.</p>
          </div>
        </div>
        <div className="pencere-govde">
          <ul className="sorun-listesi">
            {sorunlar.filter(s => s.tur !== 'soru').map((s, i) => <li key={i}>{s.mesaj}{s.notlar && s.notlar.length ? ` (${s.notlar.join('; ')})` : ''}</li>)}
            {soruSorunlari.length > 0 && <li>{soruSorunlari.length} soruda net olmayan işaret var.</li>}
          </ul>

          {anahtarSorunu && (
            <div className="uyari-kutu">
              <Simge ad="uyari" />
              <span>
                {anahtarSorunu.mesaj} Bu bir öğrenci kâğıdıysa "Onayla" deyin. Cevap anahtarı okutmak istiyorsanız bu kâğıdı atlayın
                ve "Cevap anahtarı" ekranına dönün.
              </span>
            </div>
          )}

          {(isimSorunu || true) && (
            <div className="kimlik-bolum">
              <div className="yazi-gorsel">
                {gorsel.ad && <figure><img src={gorsel.ad} alt="Öğrencinin yazdığı ad" /><figcaption>Kâğıttaki ad</figcaption></figure>}
                {gorsel.soyad && <figure><img src={gorsel.soyad} alt="Öğrencinin yazdığı soyad" /><figcaption>Kâğıttaki soyad</figcaption></figure>}
                {gorsel.no && <figure><img src={gorsel.no} alt="Öğrencinin yazdığı numara" /><figcaption>Kâğıttaki numara</figcaption></figure>}
              </div>
              <div className="form-izgara">
                <label>Ad<input value={ad} onChange={e => setAd(e.target.value.toLocaleUpperCase('tr-TR'))} className={/\?/.test(ad) ? 'hatali' : ''} /></label>
                <label>Soyad<input value={soyad} onChange={e => setSoyad(e.target.value.toLocaleUpperCase('tr-TR'))} className={/\?/.test(soyad) ? 'hatali' : ''} /></label>
                <label>Numara<input value={no} inputMode="numeric" onChange={e => setNo(e.target.value)} className={/\?/.test(no) ? 'hatali' : ''} /></label>
              </div>
              {!isimSorunu && <p className="kucuk-not">Okunan: {baslikBicim(`${sonuc.ad.metin} ${sonuc.soyad.metin}`)} {sonuc.no.metin && `· No ${sonuc.no.metin}`}</p>}
            </div>
          )}

          {(kitapSorunu || kitaplar.length > 1) && (
            <div className="satir">
              <label>Kitapçık</label>
              <div className="secenekler">
                {kitaplar.map(k => (
                  <button key={k} type="button" className={'sec' + (kitapcik === k ? ' secili' : '')} onClick={() => setKitapcik(k)}>{k}</button>
                ))}
              </div>
            </div>
          )}

          {soruSorunlari.map(s => {
            const karar = kararlar[s.q]
            return (
              <div key={s.q} className="soru-kontrol">
                <div className="soru-baslik">{s.mesaj}</div>
                {gorsel.sorular[s.q] && <img src={gorsel.sorular[s.q]} alt={`${s.q + 1}. soru`} />}
                <div className="secenekler">
                  {SIKLAR.split('').map((h, k) => (
                    <button key={k} type="button" className={'sec' + (karar.t === 'c' && karar.k === k ? ' secili' : '')} onClick={() => kararVer(s.q, { t: 'c', k })}>{h}</button>
                  ))}
                  <button type="button" className={'sec genis-sec' + (karar.t === 'b' ? ' secili' : '')} onClick={() => kararVer(s.q, { t: 'b' })}>Boş</button>
                  {s.okunan.tur === 'cift' && (
                    <button type="button" className={'sec genis-sec' + (karar.t === 'x' ? ' secili' : '')} onClick={() => kararVer(s.q, { t: 'x', ks: s.okunan.k })}>
                      Çift ({ayar.ciftIsaret === 'bos' ? 'boş' : 'yanlış'} say)
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="pencere-alt">
          {hatalar.length > 0 && <div className="hata-kutu"><Simge ad="uyari" />{hatalar.join(' ')}</div>}
          <div className="dugmeler">
            <button type="button" className="ikincil" onClick={onAtla}>Bu kâğıdı atla</button>
            <button type="button" className="birincil" disabled={hatalar.length > 0} onClick={onayla}><Simge ad="onay" />Onayla ve kaydet</button>
          </div>
        </div>
      </div>
    </div>
  )
}

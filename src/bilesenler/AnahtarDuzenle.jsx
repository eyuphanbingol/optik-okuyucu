import { useState } from 'react'
import { SIKLAR, KITAPCIKLAR } from '../mantik.js'

/**
 * Cevap anahtarını gösterir / düzenletir. Okunamayan sorular kırmızı işaretlenir;
 * öğretmen tüm soruları doldurmadan kaydedemez.
 */
export default function AnahtarDuzenle({ baslangic, soruSayisi, kitapcikVarsayilan, mevcutKitapciklar, uyarilar = [], onKaydet, onIptal }) {
  const [cevaplar, setCevaplar] = useState(() => {
    const a = Array.from({ length: 80 }, (_, i) => (baslangic && baslangic[i] != null ? baslangic[i] : null))
    return a
  })
  const [kitapcik, setKitapcik] = useState(kitapcikVarsayilan || 'A')
  const [metin, setMetin] = useState('')
  const eksik = cevaplar.slice(0, soruSayisi).map((c, i) => (c == null ? i + 1 : null)).filter(Boolean)

  function sec(q, k) {
    setCevaplar(a => { const b = [...a]; b[q] = b[q] === k ? null : k; return b })
  }

  function metindenDoldur() {
    const harfler = metin.toLocaleUpperCase('tr-TR').replace(/[^ABCDE]/g, '')
    setCevaplar(a => {
      const b = [...a]
      for (let i = 0; i < Math.min(harfler.length, soruSayisi); i++) b[i] = SIKLAR.indexOf(harfler[i])
      return b
    })
  }

  const ustuneYaz = mevcutKitapciklar.includes(kitapcik)

  return (
    <div className="pencere-arka">
      <div className="pencere genis">
        <h2>Cevap anahtarı</h2>
        {uyarilar.map((u, i) => <div key={i} className="uyari-kutu">{u}</div>)}
        <div className="satir">
          <label>Kitapçık türü</label>
          <div className="secenekler">
            {KITAPCIKLAR.split('').map(k => (
              <button key={k} type="button" className={'sec' + (kitapcik === k ? ' secili' : '')} onClick={() => setKitapcik(k)}>{k}</button>
            ))}
          </div>
        </div>
        {ustuneYaz && <div className="bilgi-kutu">{kitapcik} kitapçığının mevcut anahtarı bununla değiştirilecek.</div>}
        <details className="elle">
          <summary>Harfleri yazarak doldur</summary>
          <textarea value={metin} onChange={e => setMetin(e.target.value)} placeholder="Örnek: ABDCE BBACD ..." rows={2} />
          <button type="button" className="ikincil" onClick={metindenDoldur}>Doldur</button>
        </details>
        <div className="anahtar-izgara">
          {Array.from({ length: soruSayisi }, (_, q) => (
            <div key={q} className={'anahtar-satir' + (cevaplar[q] == null ? ' eksik' : '')}>
              <span className="soru-no">{q + 1}</span>
              {SIKLAR.split('').map((h, k) => (
                <button key={k} type="button" className={'sik' + (cevaplar[q] === k ? ' secili' : '')} onClick={() => sec(q, k)}>{h}</button>
              ))}
            </div>
          ))}
        </div>
        {eksik.length > 0 && <div className="hata-kutu">Boş sorular: {eksik.join(', ')}. Tüm soruların cevabı işaretlenmeli.</div>}
        <div className="dugmeler">
          <button type="button" className="ikincil" onClick={onIptal}>Vazgeç</button>
          <button type="button" className="birincil" disabled={eksik.length > 0} onClick={() => onKaydet(kitapcik, cevaplar)}>
            Anahtarı kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

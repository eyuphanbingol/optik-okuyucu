/*
 * Grupların özeti: her grubun soru sırası (A'daki numaralarla) ve doğru cevapları.
 * "Soru sırasını karıştır" / "Şıkları karıştır" / "Yeniden karıştır" etkisi düzenleyicide hemen görünür.
 */
import { useMemo } from 'react'
import { tumGruplar } from './karistir.js'
import { soruMu } from './model.js'

export default function GrupOzeti({ sinav }) {
  const gruplar = useMemo(() => tumGruplar(sinav), [sinav.ogeler, sinav.ayar]) // eslint-disable-line react-hooks/exhaustive-deps
  if (gruplar.length < 2) return null
  const aSorular = gruplar[0].ogeler.filter(soruMu)
  if (!aSorular.length) return null
  const aNo = new Map(aSorular.map(o => [o.id, o.no]))
  const aCevap = aSorular.map(o => (o.tur === 'coktan' ? o.dogruHarf : null))
  const coktan = aSorular.some(o => o.tur === 'coktan')
  // eski sınav (karıştırma sürüm 1): bazı sorular / cevaplar A ile aynı yerde kalabiliyor
  const ayniVar = (sinav.ayar.karistirma || 1) < 2 && gruplar.slice(1).some(g => g.ogeler.filter(soruMu).some((o, i) =>
    aNo.get(o.id) === i + 1 || (o.tur === 'coktan' && o.dogruHarf && aCevap[aNo.get(o.id) - 1] === o.dogruHarf)))
  return (
    <div className="sh-grup-ozeti">
      {gruplar.map(g => {
        const sorular = g.ogeler.filter(soruMu)
        return (
          <div key={g.harf} className="sh-grup-ozeti-satir">
            <b className="sh-go-harf">{g.harf}</b>
            <div className="sh-go-icerik">
              <div className="sh-go-satir" title="Soru sırası (A grubundaki numaralarla)">
                <small>Sıra</small>
                <span>{sorular.map((o, i) => <i key={o.id} className={g.g > 0 && aNo.get(o.id) === i + 1 ? 'ayni' : ''}>{aNo.get(o.id)}</i>)}</span>
              </div>
              {coktan && (
                <div className="sh-go-satir" title="Çoktan seçmeli soruların doğru cevapları (kâğıttaki sırayla)">
                  <small>Cevap</small>
                  <span>{sorular.map((o, i) => <i key={o.id} className={g.g > 0 && o.tur === 'coktan' && o.dogruHarf && aCevap[aNo.get(o.id) - 1] === o.dogruHarf ? 'ayni' : ''}>{o.tur === 'coktan' ? (o.dogruHarf || '?') : '·'}</i>)}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
      <p className="sh-oz-not">Soluk yazılanlar A grubuyla aynı yerde / aynı harfte kalanlar.</p>
      {ayniVar && (
        <p className="sh-oz-not sh-go-ipucu">Bu sınav eski karıştırmayla hazırlanmış. <b>Yeniden karıştır</b>'a basarsanız her soru başka yere,
          her doğru cevap başka harfe düşer. (Bu sınavı bastırıp dağıttıysanız basmayın: gruplar değişir.)</p>
      )}
    </div>
  )
}

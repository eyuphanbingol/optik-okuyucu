/*
 * Sınav kâğıdının baskı görünümü: A4 sayfalara bölünmüş, gerçek ölçülerle (mm).
 * Ekrandaki önizleme ile yazıcıya / PDF'e giden çıktı aynı bileşenlerdir.
 *
 * Sayfalama: her blok (başlık, soru) gizli bir alanda gerçek genişliğinde ölçülür, sonra sayfalara/sütunlara yerleştirilir.
 * Sorular bölünmez; bölüm başlığı sayfa ya da sütun sonunda yalnız kalmaz.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { HARFLER, soruMu, sikDuzeni } from './model.js'
import { kucukHarf, bosluklar } from './karistir.js'
import { temizle, kacis } from './metin.js'
import { useGorsel } from './gorsel.js'

// ------------------------------------------------------------------ ölçüler (mm)
export const SAYFA = { g: 210, y: 297, ust: 12, alt: 10, sol: 14, sag: 14, altbilgi: 8, sutunArasi: 8 }
const ICERIK_G = SAYFA.g - SAYFA.sol - SAYFA.sag
const ICERIK_Y = SAYFA.y - SAYFA.ust - SAYFA.alt - SAYFA.altbilgi

const Html = ({ html, className, as: E = 'div' }) => <E className={className} dangerouslySetInnerHTML={{ __html: temizle(html) }} />

/** Öğrenci kâğıdında boşluklar: cevap yazılmaz, cevabın uzunluğuna göre çizgi */
function bosluklariCiz(html) {
  return temizle(html).replace(/<span class="bosluk">([\s\S]*?)<\/span>/g, (_, ic) => {
    const n = ic.replace(/<[^>]+>/g, '').length
    const mm = Math.max(18, Math.min(58, n * 2.4 + 8))
    return `<span class="bs-bosluk" style="width:${mm}mm"></span>`
  })
}

// ------------------------------------------------------------------ bloklar
export function BaskiBaslik({ sinav, grup, grupSayisi }) {
  const b = sinav.baslik, a = sinav.ayar
  const sorular = grup.ogeler.filter(soruMu)
  const ikinciSatir = [b.ogretimYili && `${b.ogretimYili} EĞİTİM-ÖĞRETİM YILI`, b.sinif, b.ders && `${b.ders} DERSİ`].filter(Boolean).join(' ')
  const tablo = []
  for (let i = 0; i < sorular.length; i += 20) tablo.push(sorular.slice(i, i + 20))
  return (
    <div className="bs-blok bs-baslik">
      <table className="bs-baslik-tablo">
        <tbody>
          <tr>
            <td className="bs-bt-orta">
              {b.okul && <div className="bs-okul">{b.okul}</div>}
              {ikinciSatir && <div className="bs-yil">{ikinciSatir}</div>}
              <div className="bs-sinav-adi">{b.sinavAdi || 'SINAV'}</div>
            </td>
            {grupSayisi > 1 && <td className="bs-grup-kutu"><b>{grup.harf}</b><small>GRUBU</small></td>}
          </tr>
        </tbody>
      </table>
      {a.ogrenciBilgisi && (
        <table className="bs-ogrenci">
          <tbody>
            <tr>
              <th>Adı Soyadı</th><td className="uzun" />
              <th>Numarası</th><td />
              <th>Sınıfı</th><td className="kisa" />
              <td rowSpan={2} className="bs-puan-kutu"><span>PUAN</span></td>
            </tr>
            <tr>
              <th>Tarih</th><td>{b.tarih}</td>
              <th>Süre</th><td>{b.sure}</td>
              <th>İmza</th><td className="kisa" />
            </tr>
          </tbody>
        </table>
      )}
      {a.puanTablosu && sorular.length > 0 && tablo.map((satir, k) => (
        <table key={k} className="bs-puan-tablosu">
          <tbody>
            <tr><th>Soru</th>{satir.map(o => <td key={o.id}>{o.no}</td>)}{k === tablo.length - 1 && <td className="t">Toplam</td>}</tr>
            <tr><th>Puan</th>{satir.map(o => <td key={o.id}>{o.puan || 0}</td>)}{k === tablo.length - 1 && <td className="t">{sorular.reduce((x, o) => x + (Number(o.puan) || 0), 0)}</td>}</tr>
            <tr className="alinan"><th>Alınan</th>{satir.map(o => <td key={o.id} />)}{k === tablo.length - 1 && <td className="t" />}</tr>
          </tbody>
        </table>
      ))}
      {b.yonerge && <Html className="bs-yonerge" html={b.yonerge} />}
    </div>
  )
}

function BaskiGorsel({ gorsel, kucuk }) {
  const v = useGorsel(gorsel?.id)
  if (!gorsel) return null
  return (
    <figure className={`bs-gorsel hiza-${gorsel.hiza || 'orta'} konum-${gorsel.konum || 'alt'}${kucuk ? ' kucuk' : ''}`} style={{ width: `${gorsel.genislik || 50}%` }}>
      {v ? <img src={v.url} alt="" /> : <div className="bs-gorsel-yer" />}
    </figure>
  )
}

function SoruUst({ oge, ayar, children }) {
  return (
    <div className="bs-soru-ust">
      <span className="bs-no">{oge.no}.</span>
      <div className="bs-metin">
        {ayar.puanGoster && <span className="bs-puan">({oge.puan || 0} puan)</span>}
        {oge.gorsel && oge.gorsel.konum === 'yan' && <BaskiGorsel gorsel={oge.gorsel} />}
        <Html html={oge.metin} className="bs-metin-ic" />
        {oge.gorsel && oge.gorsel.konum !== 'yan' && <BaskiGorsel gorsel={oge.gorsel} />}
        {children}
      </div>
    </div>
  )
}

export function BaskiOge({ oge, ayar, sutun }) {
  if (oge.tur === 'bolum') {
    return (
      <div className="bs-blok bs-bolum">
        <Html className="bs-bolum-baslik" html={oge.metin || ''} />
        {oge.aciklama && <Html className="bs-bolum-aciklama" html={oge.aciklama} />}
      </div>
    )
  }
  if (oge.tur === 'coktan') {
    const d = sikDuzeni(oge, ayar.sikDuzeni, sutun)
    const siklar = oge.siklarSirali || oge.siklar
    return (
      <div className="bs-blok bs-soru">
        <SoruUst oge={oge} ayar={ayar}>
          <div className={`bs-siklar duzen-${d}`} style={{ '--n': siklar.length }}>
            {siklar.map((s, i) => (
              <div key={s.id} className="bs-sik">
                <span className="bs-sik-harf">{HARFLER[i]})</span>
                <div className="bs-sik-icerik">
                  <Html html={s.metin} className="bs-sik-metin" />
                  {s.gorsel && <BaskiGorsel gorsel={{ ...s.gorsel, hiza: 'sol' }} kucuk />}
                </div>
              </div>
            ))}
          </div>
        </SoruUst>
      </div>
    )
  }
  if (oge.tur === 'dy') {
    return (
      <div className="bs-blok bs-soru">
        <SoruUst oge={oge} ayar={ayar}>
          <div className="bs-liste">
            {oge.maddeler.map((m, i) => (
              <div key={m.id} className="bs-dy">
                <span className="bs-dy-kutu">(<span />)</span>
                <span className="bs-harf">{kucukHarf(i)})</span>
                <Html html={m.metin} className="bs-dy-metin" />
              </div>
            ))}
          </div>
        </SoruUst>
      </div>
    )
  }
  if (oge.tur === 'bosluk') {
    return (
      <div className="bs-blok bs-soru">
        <SoruUst oge={oge} ayar={ayar}>
          {oge.havuz && oge.havuzSirali?.length > 0 && (
            <div className="bs-havuz">{oge.havuzSirali.map((k, i) => <span key={i}>{k}</span>)}</div>
          )}
          <div className="bs-liste">
            {oge.cumleler.map((c, i) => (
              <div key={c.id} className="bs-cumle">
                <span className="bs-harf">{kucukHarf(i)})</span>
                <div className="bs-cumle-metin" dangerouslySetInnerHTML={{ __html: bosluklariCiz(c.metin) }} />
              </div>
            ))}
          </div>
        </SoruUst>
      </div>
    )
  }
  if (oge.tur === 'eslestirme') {
    const sol = oge.ciftler, sag = oge.sagSirali || oge.ciftler.map(c => ({ id: c.id, metin: c.sag }))
    const n = Math.max(sol.length, sag.length)
    return (
      <div className="bs-blok bs-soru">
        <SoruUst oge={oge} ayar={ayar}>
          <table className="bs-eslestirme">
            <tbody>
              {Array.from({ length: n }, (_, i) => (
                <tr key={i}>
                  <td className="bs-es-bos">{sol[i] ? <span>(<i />)</span> : null}</td>
                  <td className="bs-es-no">{sol[i] ? `${i + 1}.` : ''}</td>
                  <td className="bs-es-sol">{sol[i] ? <Html html={sol[i].sol} /> : null}</td>
                  <td className="bs-es-harf">{sag[i] ? `${kucukHarf(i)})` : ''}</td>
                  <td className="bs-es-sag">{sag[i] ? <Html html={sag[i].metin} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SoruUst>
      </div>
    )
  }
  // açık uçlu
  const satir = Number(oge.satir) || 0
  return (
    <div className="bs-blok bs-soru">
      <SoruUst oge={oge} ayar={ayar}>
        {satir > 0 && <div className={'bs-cevap ' + (oge.alan === 'bos' ? 'bos' : 'cizgili')} style={{ height: `${satir * 8}mm` }} />}
      </SoruUst>
    </div>
  )
}

function AltBilgi({ sinav, grup, sayfa, toplam, grupSayisi }) {
  const a = sinav.ayar, b = sinav.baslik
  return (
    <div className="bs-altbilgi">
      <span className="bs-ab-sol">{a.altBilgi}{b.ogretmen ? `${a.altBilgi ? ' — ' : ''}${b.ogretmen}` : ''}</span>
      <span className="bs-ab-sag">
        {grupSayisi > 1 && <b>{grup.harf} grubu</b>}
        {a.sayfaNo && <span>Sayfa {sayfa} / {toplam}</span>}
      </span>
    </div>
  )
}

// ------------------------------------------------------------------ sayfalama
function yerlestir(yukseklikler, ogeler, baslikY, sayfaY, sutunSayisi) {
  const sayfalar = []
  let sayfa = { sutunlar: Array.from({ length: sutunSayisi }, () => []), baslik: true }
  let sutun = 0, dolu = 0
  let kap = sayfaY - baslikY
  const tasan = []
  const yeniSutun = () => {
    if (sutun < sutunSayisi - 1) { sutun++; dolu = 0; return }
    sayfalar.push(sayfa)
    sayfa = { sutunlar: Array.from({ length: sutunSayisi }, () => []), baslik: false }
    sutun = 0; dolu = 0; kap = sayfaY
  }
  for (let i = 0; i < ogeler.length; i++) {
    const h = yukseklikler[i]
    let gerek = h
    if (ogeler[i].tur === 'bolum' && i + 1 < ogeler.length) gerek = h + Math.min(yukseklikler[i + 1], kap * 0.5)
    if (dolu > 0 && dolu + gerek > kap + 0.5) yeniSutun()
    if (h > kap + 0.5) tasan.push(ogeler[i].no || ogeler[i].id)
    sayfa.sutunlar[sutun].push(i)
    dolu += h
  }
  sayfalar.push(sayfa)
  return { sayfalar, tasan }
}

/** Bir grubun sayfaları. hazir(sayfaSayisi, tasanlar) yerleşim bitince çağrılır. */
export function GrupSayfalari({ sinav, grup, grupSayisi, hazir, olcek }) {
  const a = sinav.ayar
  const sutunSayisi = a.sutun === 2 ? 2 : 1
  const olcum = useRef(null)
  const [plan, setPlan] = useState(null)
  const anahtar = useMemo(() => JSON.stringify([grup.ogeler, sinav.baslik, a]), [grup, sinav.baslik, a])

  useLayoutEffect(() => {
    let iptal = false
    setPlan(null)
    const kok = olcum.current
    if (!kok) return
    const olc = async () => {
      // yazı tipleri ve görseller yüklenmeden ölçülmez (yoksa sayfa taşar)
      try { await document.fonts?.ready } catch { /* yok */ }
      const imgs = Array.from(kok.querySelectorAll('img'))
      await Promise.all(imgs.map(i => (i.complete ? null : i.decode ? i.decode().catch(() => {}) : new Promise(r => { i.onload = i.onerror = r }))))
      await new Promise(r => setTimeout(r, 0))
      if (iptal) return
      // görsel adresleri ilk çizimde henüz yoksa yer tutucular ölçülür; adresler gelince tekrar ölçülür
      const bekleyen = kok.querySelectorAll('.bs-gorsel-yer').length
      const mm = kok.querySelector('.bs-olcu-mm').getBoundingClientRect().height / 100
      const baslikY = kok.querySelector('.bs-olc-baslik').getBoundingClientRect().height
      const hs = Array.from(kok.querySelectorAll('.bs-olc-oge')).map(e => e.getBoundingClientRect().height)
      const { sayfalar, tasan } = yerlestir(hs, grup.ogeler, baslikY, ICERIK_Y * mm, sutunSayisi)
      setPlan({ sayfalar, tasan, bekleyen })
      hazir && hazir(sayfalar.length, tasan)
    }
    olc()
    // görseller sonradan gelirse yeniden ölç
    const gozcu = new MutationObserver(() => { if (!kok.querySelector('.bs-gorsel-yer')) { gozcu.disconnect(); olc() } })
    if (kok.querySelector('.bs-gorsel-yer')) gozcu.observe(kok, { subtree: true, childList: true })
    return () => { iptal = true; gozcu.disconnect() }
  }, [anahtar, sutunSayisi])

  const sayfaStil = { '--yazi': `${a.yaziBoyutu}pt` }
  const sinif = `bs-kagit yazi-${a.yaziTipi} sutun-${sutunSayisi}`
  return (
    <>
      <div ref={olcum} className={`bs-olcum ${sinif}`} style={sayfaStil} aria-hidden="true">
        <div className="bs-olcu-mm" style={{ height: '100mm' }} />
        <div className="bs-olc-baslik" style={{ width: `${ICERIK_G}mm` }}><BaskiBaslik sinav={sinav} grup={grup} grupSayisi={grupSayisi} /></div>
        <div style={{ width: sutunSayisi === 2 ? `${(ICERIK_G - SAYFA.sutunArasi) / 2}mm` : `${ICERIK_G}mm` }}>
          {grup.ogeler.map(o => <div key={o.id} className="bs-olc-oge"><BaskiOge oge={o} ayar={a} sutun={sutunSayisi} /></div>)}
        </div>
      </div>
      {plan && plan.sayfalar.map((s, k) => (
        <div key={k} className="bs-sayfa-sarmal" style={olcek ? { '--olcek': olcek } : undefined}>
          <div className={`bs-sayfa ${sinif}`} style={sayfaStil} data-grup={grup.harf}>
            {s.baslik ? <BaskiBaslik sinav={sinav} grup={grup} grupSayisi={grupSayisi} /> : (
              <div className="bs-devam-ust">
                <span>{[sinav.baslik.ders, sinav.baslik.sinavAdi].filter(Boolean).join(' · ')}</span>
                {grupSayisi > 1 && <b className="bs-grup-rozet" title={`${grup.harf} grubu`}>{grup.harf}</b>}
              </div>
            )}
            <div className="bs-sutunlar">
              {s.sutunlar.map((sutun, j) => (
                <div key={j} className="bs-sutun">
                  {sutun.map(i => <BaskiOge key={grup.ogeler[i].id} oge={grup.ogeler[i]} ayar={a} sutun={sutunSayisi} />)}
                </div>
              ))}
            </div>
            <AltBilgi sinav={sinav} grup={grup} sayfa={k + 1} toplam={plan.sayfalar.length} grupSayisi={grupSayisi} />
          </div>
        </div>
      ))}
      {!plan && <div className="bs-sayfa-sarmal" style={olcek ? { '--olcek': olcek } : undefined}><div className={`bs-sayfa bs-yukleniyor ${sinif}`}><span className="donen" /></div></div>}
    </>
  )
}

// ------------------------------------------------------------------ cevap anahtarı
export function CevapAnahtari({ sinav, gruplar, olcek }) {
  const b = sinav.baslik
  const baslik = [b.sinif, b.ders, b.sinavAdi].filter(Boolean).join(' · ') || 'Sınav'
  return (
    <div className="bs-sayfa-sarmal akan" style={olcek ? { '--olcek': olcek } : undefined}>
      <div className={`bs-sayfa bs-anahtar-sayfa yazi-${sinav.ayar.yaziTipi}`}>
        <div className="bs-anahtar-ust">
          <div>
            <div className="bs-anahtar-baslik">CEVAP ANAHTARI</div>
            <div className="bs-anahtar-alt">{b.okul ? `${b.okul} · ` : ''}{baslik}</div>
          </div>
          <div className="bs-anahtar-gizli">Öğretmen nüshası</div>
        </div>
        {gruplar.map(g => {
          const coktan = g.anahtar.filter(x => x.tur === 'coktan')
          const diger = g.anahtar.filter(x => x.tur !== 'coktan')
          const toplam = g.anahtar.reduce((t, x) => t + (Number(x.puan) || 0), 0)
          return (
            <section key={g.harf} className="bs-anahtar-grup">
              <div className="bs-anahtar-grup-baslik">
                {gruplar.length > 1 ? <b>{g.harf} GRUBU</b> : <b>CEVAPLAR</b>}
                <span>{g.anahtar.length} soru · {toplam} puan</span>
              </div>
              {coktan.length > 0 && (
                <>
                  <div className="bs-anahtar-izgara">
                    {coktan.map(x => <span key={x.no}><i>{x.no}</i><b>{x.kisa}</b></span>)}
                  </div>
                  {coktan.length === g.anahtar.length && <div className="bs-optik-satir">Optik anahtar: <code>{coktan.map(x => x.kisa).join('')}</code></div>}
                </>
              )}
              {diger.length > 0 && (
                <table className="bs-anahtar-tablo">
                  <thead><tr><th>No</th><th>Cevap</th><th>Puan</th></tr></thead>
                  <tbody>
                    {diger.map(x => (
                      <tr key={x.no}>
                        <td className="no">{x.no}</td>
                        <td>{x.acik ? (x.uzun ? <span className="bs-ornek" dangerouslySetInnerHTML={{ __html: kacis(x.uzun).replace(/\n/g, '<br>') }} /> : <span className="bs-bos-cevap">Açık uçlu — örnek cevap girilmemiş</span>) : x.uzun}{x.konu && <small className="bs-konu">{x.konu}</small>}</td>
                        <td className="puan">{x.puan || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

export { bosluklar }

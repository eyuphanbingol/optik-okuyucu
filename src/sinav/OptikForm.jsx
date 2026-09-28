/*
 * Optik form sayfası (yazdırma için): okuyucunun tanıdığı formun kendisi (public/optik_formu.svg — optik_formu.pdf'in
 * birebir vektör kopyası) + üzerine, okuyucunun ölçtüğü yuvarlak merkezlerine (src/omr/geometri.json) basılan işaretler.
 *
 *  - Öğrenci formu: istenirse kitapçık türü yuvarlağı hazır doldurulur (öğrencinin grubu); sınıf listesinden basılıyorsa
 *    adı, soyadı ve numarası da kutulara yazılır ve yuvarlakları doldurulur.
 *  - Cevap anahtarı formu: CEVAP ANAHTARI yuvarlağı + kitapçık türü + her sorunun doğru şıkkı doldurulur;
 *    optik okuyucuda "Anahtarı kamerayla okut" ile okutulabilir.
 *
 * İşaretler kurşun kalemle tamamen doldurulmuş yuvarlak gibidir (tam siyah, yuvarlağın içini kaplar).
 * Optik okuyucunun kodu ve formu değişmez; yalnızca okuyucunun kullandığı ölçüler okunur.
 */
import geo from '../omr/geometri.json'
import { ogrenciKodu } from './sinifListesi.js'

export const OPTIK_FORM_ADRESI = `${import.meta.env.BASE_URL || '/'}optik_formu.svg`
const DOLGU = 0.97            // yuvarlak yarıçapına oranla dolgu (formdaki "DOĞRU" örneği gibi)

export const optikGeometri = geo

function Isaret({ x, y, r }) {
  return <circle cx={x} cy={y} r={r * DOLGU} fill="#000" />
}

/** Adın harflerini üstteki yazı kutularına yazar (öğretmen onay ekranında da okunur) */
function KutuYazisi({ merkezler, metin }) {
  return [...metin].map((ch, s) => (ch === ' ' || !merkezler[s] ? null
    : <text key={s} x={merkezler[s][0][0]} y="36.25" fontSize="3.5" fontWeight="600" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif">{ch}</text>))
}

/**
 * kitapcik: 'A'..'D' ya da null · anahtar: true ise CEVAP ANAHTARI yuvarlağı işaretli
 * cevaplar: [şık indeksi | null] (soru sırasıyla) · etiket: formun SINIFI/ŞUBESİ kutusuna yazılan kısa bilgi
 * ogrenci: { ad, soyad, no } — sınıf listesinden basılırken
 */
export function OptikFormSayfasi({ kitapcik, anahtar = false, cevaplar = null, etiket, altEtiket, olcek, veri, ogrenci }) {
  const ki = kitapcik ? geo.kitapcik.harfler.indexOf(kitapcik) : -1
  const k = ogrenci ? ogrenciKodu(ogrenci) : null
  return (
    <div className="bs-sayfa-sarmal" style={olcek ? { '--olcek': olcek } : undefined}>
      <div className="bs-sayfa bs-optik-sayfa" data-optik={anahtar ? 'anahtar' : 'ogrenci'} data-kitapcik={kitapcik || ''} {...veri}>
        <img className="bs-optik-form" src={OPTIK_FORM_ADRESI} alt="Optik cevap formu" draggable={false} />
        <svg className="bs-optik-isaret" viewBox={`0 0 ${geo.sayfa[0]} ${geo.sayfa[1]}`} aria-hidden="true">
          {ki >= 0 && <Isaret x={geo.kitapcik.merkez[ki][0]} y={geo.kitapcik.merkez[ki][1]} r={geo.kitapcik.r} />}
          {anahtar && <Isaret x={geo.anahtar.merkez[0]} y={geo.anahtar.merkez[1]} r={geo.anahtar.r} />}
          {cevaplar && cevaplar.map((k, q) => (k == null || !geo.cevap.merkez[q] ? null
            : <Isaret key={q} x={geo.cevap.merkez[q][k][0]} y={geo.cevap.merkez[q][k][1]} r={geo.cevap.r} />))}
          {k && k.adKod.map((h, s) => (h == null ? null : <Isaret key={'a' + s} x={geo.ad.merkez[s][h][0]} y={geo.ad.merkez[s][h][1]} r={geo.ad.r} />))}
          {k && k.soyadKod.map((h, s) => (h == null ? null : <Isaret key={'s' + s} x={geo.soyad.merkez[s][h][0]} y={geo.soyad.merkez[s][h][1]} r={geo.soyad.r} />))}
          {k && k.noHane && k.noHane.map((d, s) => <Isaret key={'n' + s} x={geo.no.merkez[s][d][0]} y={geo.no.merkez[s][d][1]} r={geo.no.r} />)}
          {k && <KutuYazisi merkezler={geo.ad.merkez} metin={k.ad} />}
          {k && <KutuYazisi merkezler={geo.soyad.merkez} metin={k.soyad} />}
          {k && <KutuYazisi merkezler={geo.no.merkez} metin={k.no} />}
          {/* SINIFI / ŞUBESİ kutusunun içi (okuyucunun baktığı yerlerin dışında) */}
          {etiket && <text x="147.3" y="67.2" fontSize="3.1" fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">{etiket}</text>}
          {altEtiket && <text x="147.3" y="70.6" fontSize="2.3" fontFamily="Arial, Helvetica, sans-serif">{altEtiket.length > 38 ? altEtiket.slice(0, 37) + '…' : altEtiket}</text>}
        </svg>
      </div>
    </div>
  )
}

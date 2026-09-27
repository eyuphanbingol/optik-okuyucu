/*
 * Optik form sayfası (yazdırma için): okuyucunun tanıdığı formun kendisi (public/optik_formu.svg — optik_formu.pdf'in
 * birebir vektör kopyası) + üzerine, okuyucunun ölçtüğü yuvarlak merkezlerine (src/omr/geometri.json) basılan işaretler.
 *
 *  - Öğrenci formu: istenirse kitapçık türü yuvarlağı hazır doldurulur (öğrencinin grubu).
 *  - Cevap anahtarı formu: CEVAP ANAHTARI yuvarlağı + kitapçık türü + her sorunun doğru şıkkı doldurulur;
 *    optik okuyucuda "Anahtarı kamerayla okut" ile okutulabilir.
 *
 * İşaretler kurşun kalemle tamamen doldurulmuş yuvarlak gibidir (tam siyah, yuvarlağın içini kaplar).
 * Optik okuyucunun kodu ve formu değişmez; yalnızca okuyucunun kullandığı ölçüler okunur.
 */
import geo from '../omr/geometri.json'

export const OPTIK_FORM_ADRESI = `${import.meta.env.BASE_URL || '/'}optik_formu.svg`
const DOLGU = 0.97            // yuvarlak yarıçapına oranla dolgu (formdaki "DOĞRU" örneği gibi)

export const optikGeometri = geo

function Isaret({ x, y, r }) {
  return <circle cx={x} cy={y} r={r * DOLGU} fill="#000" />
}

/**
 * kitapcik: 'A'..'D' ya da null · anahtar: true ise CEVAP ANAHTARI yuvarlağı işaretli
 * cevaplar: [şık indeksi | null] (soru sırasıyla) · etiket: formun SINIFI/ŞUBESİ kutusuna yazılan kısa bilgi
 */
export function OptikFormSayfasi({ kitapcik, anahtar = false, cevaplar = null, etiket, altEtiket, olcek, veri }) {
  const ki = kitapcik ? geo.kitapcik.harfler.indexOf(kitapcik) : -1
  return (
    <div className="bs-sayfa-sarmal" style={olcek ? { '--olcek': olcek } : undefined}>
      <div className="bs-sayfa bs-optik-sayfa" data-optik={anahtar ? 'anahtar' : 'ogrenci'} data-kitapcik={kitapcik || ''} {...veri}>
        <img className="bs-optik-form" src={OPTIK_FORM_ADRESI} alt="Optik cevap formu" draggable={false} />
        <svg className="bs-optik-isaret" viewBox={`0 0 ${geo.sayfa[0]} ${geo.sayfa[1]}`} aria-hidden="true">
          {ki >= 0 && <Isaret x={geo.kitapcik.merkez[ki][0]} y={geo.kitapcik.merkez[ki][1]} r={geo.kitapcik.r} />}
          {anahtar && <Isaret x={geo.anahtar.merkez[0]} y={geo.anahtar.merkez[1]} r={geo.anahtar.r} />}
          {cevaplar && cevaplar.map((k, q) => (k == null || !geo.cevap.merkez[q] ? null
            : <Isaret key={q} x={geo.cevap.merkez[q][k][0]} y={geo.cevap.merkez[q][k][1]} r={geo.cevap.r} />))}
          {/* SINIFI / ŞUBESİ kutusunun içi (okuyucunun baktığı yerlerin dışında) */}
          {etiket && <text x="147.3" y="67.2" fontSize="3.1" fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">{etiket}</text>}
          {altEtiket && <text x="147.3" y="70.6" fontSize="2.3" fontFamily="Arial, Helvetica, sans-serif">{altEtiket.length > 38 ? altEtiket.slice(0, 37) + '…' : altEtiket}</text>}
        </svg>
      </div>
    </div>
  )
}

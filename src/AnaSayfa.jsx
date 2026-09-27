import { useEffect, useState } from 'react'
import Simge, { Logo } from './bilesenler/Simge.jsx'
import * as optikDepo from './depo.js'
import './anasayfa.css'

function goreliZaman(t) {
  if (!t) return ''
  const fark = Date.now() - t
  const dk = Math.round(fark / 60000)
  if (dk < 1) return 'az önce'
  if (dk < 60) return `${dk} dk önce`
  const sa = Math.round(dk / 60)
  if (sa < 24) return `${sa} saat önce`
  const gun = Math.round(sa / 24)
  if (gun < 7) return `${gun} gün önce`
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

function OptikCizim() {
  return (
    <svg className="modul-cizim" viewBox="0 0 220 150" aria-hidden="true">
      <rect x="62" y="10" width="96" height="130" rx="8" className="c-kagit" />
      {[0, 1, 2, 3, 4, 5, 6].map(s => [0, 1, 2, 3, 4].map(k => (
        <circle key={`${s}-${k}`} cx={84 + k * 13} cy={34 + s * 14} r="4.2" className={(s * 3 + k * 2) % 5 === 1 ? 'c-dolu' : 'c-bos'} />
      )))}
      <rect x="66" y="14" width="8" height="8" rx="1.5" className="c-isaret" />
      <rect x="146" y="14" width="8" height="8" rx="1.5" className="c-isaret" />
      <rect x="66" y="128" width="8" height="8" rx="1.5" className="c-isaret" />
      <rect x="146" y="128" width="8" height="8" rx="1.5" className="c-isaret" />
      <g className="c-vizor">
        <path d="M44 22v-10a6 6 0 0 1 6-6h10M160 6h10a6 6 0 0 1 6 6v10M176 128v10a6 6 0 0 1-6 6h-10M60 144H50a6 6 0 0 1-6-6v-10" />
      </g>
      <rect x="50" y="60" width="120" height="3" rx="1.5" className="c-tarama" />
    </svg>
  )
}

function SinavCizim() {
  return (
    <svg className="modul-cizim" viewBox="0 0 220 150" aria-hidden="true">
      <rect x="84" y="18" width="92" height="122" rx="8" className="c-kagit-arka" />
      <rect x="54" y="8" width="96" height="130" rx="8" className="c-kagit" />
      <rect x="66" y="20" width="44" height="6" rx="3" className="c-cizgi-koyu" />
      <rect x="66" y="31" width="72" height="4" rx="2" className="c-cizgi" />
      <text x="67" y="54" className="c-no">1.</text>
      <rect x="78" y="48" width="58" height="4" rx="2" className="c-cizgi" />
      {['A', 'B', 'C', 'D'].map((h, i) => (
        <g key={h}>
          <circle cx={82 + i * 15} cy="64" r="4.6" className={i === 2 ? 'c-dolu' : 'c-bos'} />
        </g>
      ))}
      <text x="67" y="86" className="c-no">2.</text>
      <rect x="78" y="80" width="50" height="4" rx="2" className="c-cizgi" />
      <rect x="66" y="92" width="72" height="1.6" className="c-cizgi" />
      <rect x="66" y="100" width="72" height="1.6" className="c-cizgi" />
      <rect x="66" y="108" width="72" height="1.6" className="c-cizgi" />
      <g className="c-grup">
        <rect x="128" y="16" width="16" height="16" rx="4" />
        <text x="136" y="28" textAnchor="middle">A</text>
      </g>
      <g className="c-grup ikinci">
        <rect x="156" y="26" width="14" height="14" rx="4" />
        <text x="163" y="37" textAnchor="middle">B</text>
      </g>
    </svg>
  )
}

export default function AnaSayfa() {
  const [optik] = useState(() => optikDepo.yukle())
  const [sinavlar, setSinavlar] = useState(null)

  useEffect(() => {
    let iptal = false
    import('./sinav/depo.js')
      .then(d => d.sinavlariListele())
      .then(l => { if (!iptal) setSinavlar(l) })
      .catch(() => { if (!iptal) setSinavlar([]) })
    // modül kodunu boşta önceden getir: "Sınav hazırla"ya basınca anında açılsın
    const on = () => import('./sinav/SinavModulu.jsx').catch(() => {})
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(on, { timeout: 2500 }) : setTimeout(on, 1200)
    return () => { iptal = true; if ('cancelIdleCallback' in window) window.cancelIdleCallback(id); else clearTimeout(id) }
  }, [])

  const optikDevam = optik && optik.ogrenciler && optik.ogrenciler.length > 0
  // sınav hazırlaydan aktarılmış, henüz kâğıt okunmamış anahtar
  const optikHazir = !optikDevam && optik && optik.ekran === 'okut' && Object.keys(optik.anahtarlar || {}).length > 0
  const son = sinavlar && sinavlar[0]

  return (
    <div className="ana">
      <header className="ana-ust">
        <div className="marka">
          <Logo boyut={34} />
          <div className="logo">Optik Okuyucu</div>
        </div>
        <span className="ana-gizlilik"><Simge ad="kilit" boyut={14} />Veriler yalnızca bu cihazda</span>
      </header>

      <section className="ana-giris">
        <span className="ust-baslik">Öğretmen araçları</span>
        <h1>Ne yapmak istiyorsunuz?</h1>
        <p>Sınavınızı hazırlayın, yazdırın; öğrenciler optik formu doldurunca kamerayla okuyup puanlayın.</p>
      </section>

      <div className="ana-moduller">
        <a className="modul-karti m-sinav" href="#/sinav">
          <div className="modul-ust">
            <span className="modul-simge"><Simge ad="sinav" boyut={24} /></span>
            <span className="modul-etiket">Yeni</span>
          </div>
          <SinavCizim />
          <div className="modul-metin">
            <h2>Sınav hazırla</h2>
            <p>Word gibi çalışan düzenleyiciyle sınav kâğıdı hazırlayın; A–D gruplarını ve cevap anahtarını otomatik oluşturun.</p>
            <ul className="modul-ozellik">
              <li>Çoktan seçmeli</li><li>Açık uçlu</li><li>Boşluk doldurma</li><li>Eşleştirme</li><li>Doğru / Yanlış</li><li>Resimli soru</li>
            </ul>
          </div>
          <div className="modul-alt">
            <span className="modul-durum">
              {sinavlar == null ? ' ' : sinavlar.length ? <>{sinavlar.length} sınav · son: <b>{son.baslik?.sinavAdi || son.baslik?.ders || 'Adsız sınav'}</b></> : 'Henüz sınav yok'}
            </span>
            <span className="modul-git">Sınav hazırla<Simge ad="ileri" boyut={18} /></span>
          </div>
        </a>

        <a className="modul-karti m-optik" href="#/optik">
          <div className="modul-ust">
            <span className="modul-simge"><Simge ad="tara" boyut={24} /></span>
          </div>
          <OptikCizim />
          <div className="modul-metin">
            <h2>Optik okuma</h2>
            <p>Cevap kâğıtlarını telefon kamerasıyla okuyun; her kâğıt anında puanlanır, sonuçlar Excel'e aktarılır.</p>
            <ul className="modul-ozellik">
              <li>Çift okuma onayı</li><li>A–D kitapçık</li><li>80 soru</li><li>Excel</li>
            </ul>
          </div>
          <div className="modul-alt">
            <span className="modul-durum">
              {optikDevam ? <><span className="nokta" />Yarım kalan: <b>{optik.ayar?.sinavAdi || 'Sınav'}</b> · {optik.ogrenciler.length} öğrenci</>
                : optikHazir ? <><span className="nokta hazir" />Okumaya hazır: <b>{optik.ayar?.sinavAdi || 'Sınav'}</b> · {optik.ayar?.soruSayisi} soru</>
                  : 'Kamera ile hızlı okuma'}
            </span>
            <span className="modul-git">{optikDevam || optikHazir ? 'Devam et' : 'Optiği aç'}<Simge ad="ileri" boyut={18} /></span>
          </div>
        </a>
      </div>

      {sinavlar && sinavlar.length > 0 && (
        <section className="ana-son">
          <div className="ana-son-baslik">
            <span>Son sınavlarınız</span>
            <a href="#/sinav">Tümü<Simge ad="sag" boyut={15} /></a>
          </div>
          <div className="ana-son-liste">
            {sinavlar.slice(0, 4).map(s => (
              <a key={s.id} className="ana-son-oge" href={`#/sinav/${s.id}`}>
                <span className="ana-son-simge"><Simge ad="sayfa" boyut={18} /></span>
                <span className="ana-son-metin">
                  <b>{s.baslik?.sinavAdi || s.baslik?.ders || 'Adsız sınav'}</b>
                  <small>{[s.baslik?.sinif, s.baslik?.ders].filter(Boolean).join(' · ') || 'Sınav'} · {s.ogeler.filter(o => o.tur !== 'bolum').length} soru · {goreliZaman(s.guncelleme)}</small>
                </span>
                <Simge ad="sag" boyut={16} className="ana-son-ok" />
              </a>
            ))}
          </div>
        </section>
      )}

      <footer className="ana-alt">Kâğıt görüntüleri ve sınavlarınız hiçbir sunucuya gönderilmez.</footer>
    </div>
  )
}

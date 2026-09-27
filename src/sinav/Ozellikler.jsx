import { useMemo, useRef } from 'react'
import Simge from '../bilesenler/Simge.jsx'
import { Anahtar, Secici, Sayac, Acilir, GrupSecici } from './arayuz.jsx'
import { TurMenusu } from './Ogeler.jsx'
import { TURLER, soruSayisi, toplamPuan, eksikler, puanlariDagit, puanMetni, testMi } from './model.js'
import { duzMetin } from './metin.js'

/** Sağ panel: seçili soru yoksa sınav ayarları, varsa sorunun özellikleri */
export default function Ozellikler({ sinav, degistir, secili, no, islem, onKapat }) {
  const oge = secili ? sinav.ogeler.find(o => o.id === secili) : null
  return (
    <div className="sh-ozellik-ic">
      {oge ? <OgeOzellikleri oge={oge} no={no.get(oge.id)} islem={islem} sinav={sinav} onKapat={onKapat} /> : <SinavAyarlari sinav={sinav} degistir={degistir} islem={islem} />}
    </div>
  )
}

function Bolum({ baslik, children, simge }) {
  return (
    <section className="sh-oz-bolum">
      <h3>{simge && <Simge ad={simge} boyut={15} />}{baslik}</h3>
      {children}
    </section>
  )
}

function SinavAyarlari({ sinav, degistir, islem }) {
  const a = sinav.ayar
  const ayarla = (k, v) => degistir(s => ({ ...s, ayar: { ...s.ayar, [k]: v } }))
  const n = soruSayisi(sinav.ogeler)
  const toplam = toplamPuan(sinav.ogeler)
  const eksik = useMemo(() => eksikler(sinav, duzMetin), [sinav])
  return (
    <>
      <div className="sh-oz-ust">
        <span className="ust-baslik">Sınav ayarları</span>
        <div className="sh-oz-ozet">
          <div><b>{n}</b><span>soru</span></div>
          <div className={toplam === 100 ? 'iyi' : 'uyari'}><b>{puanMetni(toplam)}</b><span>puan</span></div>
          <div><b>{a.grupSayisi}</b><span>grup</span></div>
        </div>
        {toplam !== 100 && n > 0 && (
          <button type="button" className="ikincil kucuk tam" onClick={() => degistir(s => ({ ...s, ogeler: puanlariDagit(s.ogeler, 100) }))}>
            <Simge ad="yenile" boyut={15} />Puanları eşit dağıt (100)
          </button>
        )}
      </div>

      <Bolum baslik="Gruplar" simge="kopya">
        <GrupSecici deger={a.grupSayisi} onDegis={v => ayarla('grupSayisi', v)} optikUyari={testMi(sinav.ogeler)} />
        {a.grupSayisi > 1 && (
          <>
            <Anahtar deger={a.soruKaristir} onDegis={v => ayarla('soruKaristir', v)} aciklama="Bölüm başlıkları yerinde kalır">Soru sırasını karıştır</Anahtar>
            <Anahtar deger={a.sikKaristir} onDegis={v => ayarla('sikKaristir', v)} aciklama="Sabitlenen sorular hariç">Şıkları karıştır</Anahtar>
            <button type="button" className="ikincil kucuk tam" onClick={() => ayarla('tohum', Math.floor(Math.random() * 1e9))}><Simge ad="karistir" boyut={15} />Grupları yeniden karıştır</button>
            <p className="sh-oz-not">A grubu yazdığınız sırada basılır; diğer gruplar farklı sırayla. Cevap anahtarı her grup için ayrı oluşturulur.</p>
          </>
        )}
      </Bolum>

      <Bolum baslik="Sayfa düzeni" simge="sayfa">
        <div className="sh-oz-satir"><span>Sütun</span>
          <Secici kucuk etiket="Sütun" deger={a.sutun} onDegis={v => ayarla('sutun', v)} secenekler={[[1, 'Tek'], [2, 'İki']]} />
        </div>
        <div className="sh-oz-satir"><span>Yazı tipi</span>
          <select value={a.yaziTipi} onChange={e => ayarla('yaziTipi', e.target.value)} aria-label="Yazı tipi">
            <option value="modern">Modern (Geist)</option>
            <option value="klasik">Klasik (Times)</option>
            <option value="arial">Arial</option>
          </select>
        </div>
        <div className="sh-oz-satir"><span>Yazı boyutu</span>
          <Secici kucuk etiket="Yazı boyutu" deger={a.yaziBoyutu} onDegis={v => ayarla('yaziBoyutu', v)} secenekler={[[10, '10'], [11, '11'], [12, '12'], [13, '13']]} />
        </div>
        <div className="sh-oz-satir"><span>Şık yerleşimi</span>
          <select value={a.sikDuzeni} onChange={e => ayarla('sikDuzeni', e.target.value)} aria-label="Şık yerleşimi">
            <option value="oto">Otomatik</option>
            <option value="alt">Alt alta</option>
            <option value="iki">İki sütun</option>
            <option value="yan">Yan yana</option>
          </select>
        </div>
      </Bolum>

      <Bolum baslik="Kâğıtta göster" simge="goz">
        <Anahtar deger={a.ogrenciBilgisi} onDegis={v => ayarla('ogrenciBilgisi', v)}>Öğrenci bilgi alanı</Anahtar>
        <Anahtar deger={a.puanGoster} onDegis={v => ayarla('puanGoster', v)}>Soru puanları</Anahtar>
        <Anahtar deger={a.puanTablosu} onDegis={v => ayarla('puanTablosu', v)} aciklama="Her soru için puan kutusu">Puan tablosu</Anahtar>
        <Anahtar deger={a.sayfaNo} onDegis={v => ayarla('sayfaNo', v)}>Sayfa numarası</Anahtar>
        <label className="sh-oz-alan"><span>Alt bilgi</span>
          <input value={a.altBilgi} onChange={e => ayarla('altBilgi', e.target.value)} placeholder="Örn. Başarılar dilerim." />
        </label>
      </Bolum>

      {eksik.length > 0 && (
        <Bolum baslik={`Eksikler (${eksik.length})`} simge="uyari">
          <ul className="sh-eksik-liste">
            {eksik.slice(0, 12).map((e, i) => (
              <li key={i}><button type="button" className={e.agir ? 'agir' : ''} onClick={() => islem.git(e.id)}>{e.mesaj}</button></li>
            ))}
            {eksik.length > 12 && <li className="sh-oz-not">ve {eksik.length - 12} eksik daha</li>}
          </ul>
        </Bolum>
      )}
    </>
  )
}

function OgeOzellikleri({ oge, no, islem, sinav, onKapat }) {
  const guncelle = (patch, a) => islem.guncelle(oge.id, patch, a)
  const dosya = useRef(null)
  const bolum = oge.tur === 'bolum'
  const g = oge.gorsel
  const sira = sinav.ogeler.findIndex(o => o.id === oge.id)
  return (
    <>
      <div className="sh-oz-ust">
        <button type="button" className="sh-geri-kucuk" onClick={() => { islem.sec(null); onKapat && onKapat() }}><Simge ad="geri" boyut={15} />Sınav ayarları</button>
        <div className="sh-oz-soru-baslik">
          <span className="sh-oz-no">{bolum ? <Simge ad="baslik" boyut={18} /> : no}</span>
          <div>
            <b>{bolum ? 'Bölüm başlığı' : `${no}. soru`}</b>
            <Acilir genislik={280} tetik={<button type="button" className="sh-tur-degis">{TURLER[oge.tur].ad}<Simge ad="asagi" boyut={13} /></button>}>
              <div className="sh-menu-baslik">Türü değiştir</div>
              <TurMenusu onSec={(t, sec) => islem.turDegistir(oge.id, t, sec)} />
            </Acilir>
          </div>
        </div>
      </div>

      {!bolum && (
        <Bolum baslik="Puan" simge="yildiz">
          <Sayac etiket="Puan" deger={oge.puan} min={0} maks={100} adim={1} birim="puan" onDegis={v => guncelle({ puan: v }, `${oge.id}:puan`)} />
          <label className="sh-oz-alan"><span>Konu / kazanım <small>(cevap anahtarında görünür)</small></span>
            <input value={oge.konu || ''} onChange={e => guncelle({ konu: e.target.value }, `${oge.id}:konu`)} placeholder="Örn. Üslü ifadeler" />
          </label>
        </Bolum>
      )}

      {oge.tur === 'coktan' && (
        <Bolum baslik="Şıklar" simge="liste">
          <div className="sh-oz-satir"><span>Şık sayısı</span>
            <Secici kucuk etiket="Şık sayısı" deger={oge.siklar.length} onDegis={v => islem.sikSayisi(oge.id, v)} secenekler={[[2, '2'], [3, '3'], [4, '4'], [5, '5']]} />
          </div>
          <div className="sh-oz-satir"><span>Yerleşim</span>
            <select value={oge.duzen || 'oto'} onChange={e => guncelle({ duzen: e.target.value })} aria-label="Şık yerleşimi">
              <option value="oto">Otomatik</option>
              <option value="alt">Alt alta</option>
              <option value="iki">İki sütun</option>
              <option value="yan">Yan yana</option>
            </select>
          </div>
          <Anahtar deger={oge.sikKilit} onDegis={v => guncelle({ sikKilit: v })} aciklama="“Hepsi / Hiçbiri” gibi şıklar için">Şıkları sabitle (karıştırma)</Anahtar>
        </Bolum>
      )}

      {oge.tur === 'klasik' && (
        <Bolum baslik="Cevap alanı" simge="kalem">
          <div className="sh-oz-satir"><span>Satır sayısı</span>
            <Sayac etiket="Satır sayısı" deger={oge.satir} min={0} maks={40} onDegis={v => guncelle({ satir: v }, `${oge.id}:satir`)} />
          </div>
          <div className="sh-oz-satir"><span>Görünüm</span>
            <Secici kucuk etiket="Cevap alanı" deger={oge.alan || 'cizgili'} onDegis={v => guncelle({ alan: v })} secenekler={[['cizgili', 'Çizgili'], ['bos', 'Boş']]} />
          </div>
          <label className="sh-oz-alan"><span>Örnek cevap <small>(yalnızca cevap anahtarında)</small></span>
            <textarea rows={4} value={oge.cevap || ''} onChange={e => guncelle({ cevap: e.target.value }, `${oge.id}:cevap`)} placeholder="Beklenen cevap / puanlama ölçütü" />
          </label>
        </Bolum>
      )}

      {oge.tur === 'bosluk' && (
        <Bolum baslik="Kelime havuzu" simge="bosluk">
          <Anahtar deger={oge.havuz} onDegis={v => guncelle({ havuz: v })} aciklama="Cevaplar karışık sırada kutuda verilir">Kelime havuzunu göster</Anahtar>
          {oge.havuz && (
            <label className="sh-oz-alan"><span>Fazladan (çeldirici) kelimeler</span>
              <input value={oge.ekKelimeler || ''} onChange={e => guncelle({ ekKelimeler: e.target.value }, `${oge.id}:ek`)} placeholder="Virgülle ayırın: İzmir, Bursa" />
            </label>
          )}
        </Bolum>
      )}

      {oge.tur === 'eslestirme' && (
        <Bolum baslik="Sağ sütun" simge="eslestirme">
          <label className="sh-oz-alan"><span>Fazladan (çeldirici) seçenekler</span>
            <input value={oge.ekSag || ''} onChange={e => guncelle({ ekSag: e.target.value }, `${oge.id}:ek`)} placeholder="Virgülle ayırın" />
          </label>
          <p className="sh-oz-not">Sağ sütun her grupta ayrı karıştırılır; cevap anahtarı otomatik oluşur.</p>
        </Bolum>
      )}

      {!bolum && (
        <Bolum baslik="Görsel" simge="gorsel">
          {g ? (
            <>
              <div className="sh-oz-satir"><span>Genişlik</span>
                <input type="range" min="12" max="100" value={g.genislik || 50} onChange={e => guncelle({ gorsel: { ...g, genislik: +e.target.value } }, `${oge.id}:gorsel`)} aria-label="Görsel genişliği" />
                <span className="sh-oz-deger">%{g.genislik || 50}</span>
              </div>
              <div className="sh-oz-satir"><span>Yerleşim</span>
                <Secici kucuk etiket="Görsel yerleşimi" deger={g.konum === 'yan' ? 'yan' : g.hiza || 'orta'} onDegis={v => guncelle({ gorsel: v === 'yan' ? { ...g, konum: 'yan', genislik: Math.min(g.genislik || 50, 45) } : { ...g, konum: 'alt', hiza: v } })}
                  secenekler={[['sol', 'Sol'], ['orta', 'Orta'], ['sag', 'Sağ'], ['yan', 'Yanda']]} />
              </div>
              <div className="dugmeler sol">
                <button type="button" className="ikincil kucuk" onClick={() => dosya.current?.click()}><Simge ad="yenile" boyut={15} />Değiştir</button>
                <button type="button" className="ikincil kucuk tehlike" onClick={() => guncelle({ gorsel: null })}><Simge ad="cop" boyut={15} />Kaldır</button>
              </div>
            </>
          ) : (
            <button type="button" className="sh-gorsel-ekle" onClick={() => dosya.current?.click()}>
              <Simge ad="gorsel" boyut={22} />
              <b>Görsel ekle</b>
              <small>Seçin, yapıştırın (Ctrl+V) ya da soruya sürükleyin</small>
            </button>
          )}
          <input ref={dosya} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) islem.gorselEkle(oge.id, f) }} />
        </Bolum>
      )}

      <Bolum baslik="Düzen" simge="ayarlar">
        <div className="sh-oz-dugmeler">
          <button type="button" className="ikincil kucuk" disabled={sira <= 0} onClick={() => islem.tasi(oge.id, -1)}><Simge ad="yukari" boyut={15} />Yukarı</button>
          <button type="button" className="ikincil kucuk" disabled={sira >= sinav.ogeler.length - 1} onClick={() => islem.tasi(oge.id, 1)}><Simge ad="asagi" boyut={15} />Aşağı</button>
          <button type="button" className="ikincil kucuk" onClick={() => islem.cogalt(oge.id)}><Simge ad="kopya" boyut={15} />Çoğalt</button>
          <button type="button" className="ikincil kucuk tehlike" onClick={() => islem.sil(oge.id)}><Simge ad="cop" boyut={15} />Sil</button>
        </div>
      </Bolum>
    </>
  )
}

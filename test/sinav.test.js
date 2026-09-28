// Sınav hazırlama: model ve grup (karıştırma) birim testleri:  node test/sinav.test.js
import assert from 'node:assert/strict'
import { yeniSinav, yeniOge, numaralar, toplamPuan, puanlariDagit, ogeKopyala, turDegistir, eksikler, gorselKimlikleri, puanMetni, GRUP_HARFLERI, MAKS_GRUP, grupAraligi } from '../src/sinav/model.js'
import { grupOlustur, tumGruplar, bosluklar } from '../src/sinav/karistir.js'
import { duzMetin, bosMu, ozet } from '../src/sinav/metin.js'
import { optigeAktarilabilir, optikYapiUygun, optikDurumu, puanDurumu, optikAnahtarlari } from '../src/sinav/optikAktar.js'
import { baskiListesi, baskiSecimiDuzelt, bloklar, dagilim } from '../src/sinav/baski.js'
import { puanla } from '../src/mantik.js'
import { adKodla, noKodla, ogrenciKodu, metniTabloyaCevir, tablodanOgrenciler, AD_SUTUN, SOYAD_SUTUN, NO_HANE, FORM_HARFLERI } from '../src/sinav/sinifListesi.js'
import { readFileSync } from 'node:fs'

let gecen = 0
const t = (ad, f) => { f(); gecen++; console.log('  ✔', ad) }

function testSinavi(n = 12, grup = 4) {
  const s = yeniSinav({ sablon: 'test', soruSayisi: n, sikSayisi: 5, grupSayisi: grup })
  s.ogeler.forEach((o, i) => { o.metin = `Soru ${i + 1}`; o.siklar.forEach((k, j) => { k.metin = `S${i + 1}-${'ABCDE'[j]}` }); o.dogru = o.siklar[i % 5].id })
  return s
}

t('şablonlar: test / yazılı / karma / boş', () => {
  assert.equal(yeniSinav({ sablon: 'test', soruSayisi: 20 }).ogeler.length, 20)
  assert.ok(yeniSinav({ sablon: 'yazili', soruSayisi: 5 }).ogeler.every(o => o.tur === 'klasik'))
  const k = yeniSinav({ sablon: 'karma', soruSayisi: 10 })
  assert.deepEqual([...new Set(k.ogeler.map(o => o.tur))].sort(), ['bolum', 'bosluk', 'coktan', 'dy', 'eslestirme', 'klasik'])
  assert.equal(yeniSinav({ sablon: 'bos' }).ogeler.length, 0)
})
t('yeni sınavda puanlar toplam 100: test eşit puanlı, yazılı tam sayı', () => {
  for (const n of [1, 3, 7, 12, 30, 40, 80]) {
    const s = yeniSinav({ sablon: 'test', soruSayisi: n })
    assert.equal(toplamPuan(s.ogeler), 100)
    assert.equal(new Set(s.ogeler.map(o => o.puan)).size, 1, 'test sorularının hepsi eşit puanlı')
    assert.equal(puanDurumu(s).otomatik, true)
    const y = yeniSinav({ sablon: 'yazili', soruSayisi: n })
    assert.equal(toplamPuan(y.ogeler), 100)
    assert.ok(y.ogeler.every(o => Number.isInteger(o.puan)))
  }
  assert.equal(puanMetni(100 / 12), '8,33')
  assert.equal(puanMetni(5), '5')
})
t('bölümler numarasız, sorular sıralı numaralı', () => {
  const s = yeniSinav({ sablon: 'karma', soruSayisi: 3 })
  const no = numaralar(s.ogeler)
  assert.equal(no.get(s.ogeler[0].id), undefined)
  assert.equal(no.get(s.ogeler[1].id), 1)
  assert.equal([...no.values()].length, s.ogeler.filter(o => o.tur !== 'bolum').length)
})
t('puanları eşit dağıt: bölümler etkilenmez', () => {
  const ogeler = puanlariDagit([yeniOge('bolum'), yeniOge('klasik'), yeniOge('klasik'), yeniOge('klasik')], 100)
  assert.equal(ogeler[0].puan, undefined)
  assert.deepEqual(ogeler.slice(1).map(o => o.puan), [33, 33, 34])
})
t('A grubu yazıldığı sırada; B/C/D farklı ve cevap anahtarı doğru', () => {
  const s = testSinavi(12, 4)
  const g = tumGruplar(s)
  assert.deepEqual(g.map(x => x.harf), ['A', 'B', 'C', 'D'])
  assert.deepEqual(g[0].ogeler.map(o => o.metin), s.ogeler.map(o => o.metin))
  assert.deepEqual(g[0].anahtar.map(a => a.kisa).join(''), 'ABCDEABCDEAB')
  const siralar = g.map(x => x.ogeler.map(o => o.metin).join('|'))
  assert.equal(new Set(siralar).size, 4, 'her grubun soru sırası farklı olmalı')
  for (const grup of g) {
    for (const o of grup.ogeler) {
      // doğru harf, karıştırılmış şıklarda doğru şıkkı göstermeli
      const asil = s.ogeler.find(x => x.id === o.id)
      const dogruMetin = asil.siklar.find(k => k.id === asil.dogru).metin
      assert.equal(o.siklarSirali[o.dogruIndex].metin, dogruMetin)
      assert.equal(o.dogruHarf, 'ABCDE'[o.dogruIndex])
    }
  }
})
t('karıştırma kararlı: aynı tohum aynı grup, farklı tohum farklı grup', () => {
  const s = testSinavi(10, 2)
  const a = JSON.stringify(grupOlustur(s, 1).anahtar)
  assert.equal(JSON.stringify(grupOlustur(s, 1).anahtar), a)
  s.ayar.tohum += 1
  assert.notEqual(JSON.stringify(grupOlustur(s, 1).ogeler.map(o => o.id)), JSON.stringify(grupOlustur({ ...s, ayar: { ...s.ayar, tohum: s.ayar.tohum - 1 } }, 1).ogeler.map(o => o.id)))
})
t('karıştırma kapalıysa B grubu A ile aynı sırada', () => {
  const s = testSinavi(8, 2)
  s.ayar.soruKaristir = false; s.ayar.sikKaristir = false
  assert.deepEqual(grupOlustur(s, 1).anahtar.map(a => a.kisa), grupOlustur(s, 0).anahtar.map(a => a.kisa))
})
t('şıkları sabitlenen soru karışmaz', () => {
  const s = testSinavi(4, 4)
  s.ogeler[2].sikKilit = true
  for (let g = 1; g < 4; g++) {
    const o = grupOlustur(s, g).ogeler.find(x => x.id === s.ogeler[2].id)
    assert.deepEqual(o.siklarSirali.map(k => k.id), s.ogeler[2].siklar.map(k => k.id))
  }
})
t('bölüm başlıkları yerinde kalır, sorular bölüm dışına çıkmaz', () => {
  const s = yeniSinav({ sablon: 'karma', soruSayisi: 6, grupSayisi: 4 })
  for (let g = 0; g < 4; g++) {
    const o = grupOlustur(s, g).ogeler
    const turSirasi = o.map(x => x.tur).join(',')
    assert.equal(turSirasi, s.ogeler.map(x => x.tur).join(','))
  }
})
t('eşleştirme: sağ sütun karışık, anahtar doğru', () => {
  const s = yeniSinav({ sablon: 'bos' })
  const e = yeniOge('eslestirme', { adet: 5 })
  e.ciftler.forEach((c, i) => { c.sol = `Sol${i}`; c.sag = `Sag${i}` })
  e.ekSag = 'Çeldirici1, Çeldirici2'
  s.ogeler = [e]
  for (let g = 0; g < 2; g++) {
    const o = grupOlustur(s, g).ogeler[0]
    assert.equal(o.sagSirali.length, 7)
    assert.ok(o.sagSirali.slice(0, 5).some((x, i) => x.metin !== `Sag${i}`))
    o.eslesme.forEach((j, i) => assert.equal(o.sagSirali[j].metin, `Sag${i}`))
  }
})
t('boşluk doldurma: cevaplar ve kelime havuzu', () => {
  const s = yeniSinav({ sablon: 'bos' })
  const b = yeniOge('bosluk', { adet: 2 })
  b.cumleler[0].metin = 'Türkiye\'nin başkenti <span class="bosluk">Ankara</span>\'dır.'
  b.cumleler[1].metin = '<span class="bosluk">Su</span> <b>100</b> °C\'de <span class="bosluk">kaynar</span>.'
  b.ekKelimeler = 'İstanbul'
  s.ogeler = [b]
  const o = grupOlustur(s, 0).ogeler[0]
  assert.deepEqual(bosluklar(b.cumleler[1].metin), ['Su', 'kaynar'])
  assert.deepEqual([...o.havuzSirali].sort(), ['Ankara', 'İstanbul', 'Su', 'kaynar'].sort())
  assert.equal(grupOlustur(s, 0).anahtar[0].uzun, 'a) Ankara   b) Su / kaynar')
})
t('D/Y cevap anahtarı', () => {
  const s = yeniSinav({ sablon: 'bos' })
  const d = yeniOge('dy', { adet: 3 }); d.maddeler[1].dogru = false
  s.ogeler = [d]
  assert.equal(grupOlustur(s, 0).anahtar[0].kisa, 'DYD')
})
t('çoğaltma yeni kimlik verir, doğru cevap korunur', () => {
  const s = testSinavi(1, 1)
  const k = ogeKopyala(s.ogeler[0])
  assert.notEqual(k.id, s.ogeler[0].id)
  assert.notEqual(k.siklar[0].id, s.ogeler[0].siklar[0].id)
  assert.equal(k.siklar.findIndex(x => x.id === k.dogru), 0)
})
t('tür değiştirme metni ve puanı korur', () => {
  const o = yeniOge('coktan'); o.metin = 'Soru'; o.puan = 7
  const y = turDegistir(o, 'klasik')
  assert.equal(y.metin, 'Soru'); assert.equal(y.puan, 7); assert.equal(y.id, o.id)
})
t('eksik kontrolü: doğru cevap işaretlenmemiş soru', () => {
  const s = yeniSinav({ sablon: 'test', soruSayisi: 2 })
  const e = eksikler(s, duzMetin)
  assert.ok(e.some(x => x.agir && x.no === 1))
})
t('görsel kimlikleri', () => {
  const s = testSinavi(2, 1)
  s.ogeler[0].gorsel = { id: 'g1' }; s.ogeler[1].siklar[0].gorsel = { id: 'g2' }
  assert.deepEqual([...gorselKimlikleri(s)].sort(), ['g1', 'g2'])
})
t('metin yardımcıları', () => {
  assert.equal(duzMetin('a<b>b</b><br>c &amp; d'), 'ab\nc & d')
  assert.ok(bosMu('<div><br></div>'))
  assert.ok(!bosMu('<b>x</b>'))
  assert.equal(ozet('x'.repeat(100), 10).length, 10)
})
t('optiğe aktarım: yalnız çoktan seçmeli, eksiksiz sınav', () => {
  const s = testSinavi(12, 4)
  assert.equal(optigeAktarilabilir(s).tamam, true)
  const d = optikDurumu(s)
  assert.equal(d.ayar.soruSayisi, 12)
  assert.deepEqual(Object.keys(d.anahtarlar), ['A', 'B', 'C', 'D'])
  assert.equal(d.anahtarlar.A.length, 80)
  assert.deepEqual(d.anahtarlar.A.slice(0, 5), [0, 1, 2, 3, 4])
  const g1 = grupOlustur(s, 1)
  assert.deepEqual(d.anahtarlar.B.slice(0, 12), g1.ogeler.map(o => o.dogruIndex))
  const k = yeniSinav({ sablon: 'karma' })
  assert.equal(optigeAktarilabilir(k).tamam, false)
})

t('gruplar A, B, C, D (tek grup … 4 grup): harfler, farklı sıralar, her grubun anahtarı doğru', () => {
  assert.equal(MAKS_GRUP, 4)
  assert.equal(GRUP_HARFLERI, 'ABCD')
  for (const G of [1, 2, 3, 4]) {
    const s = testSinavi(20, G)
    const g = tumGruplar(s)
    assert.equal(g.length, G)
    assert.deepEqual(g.map(x => x.harf).join(''), GRUP_HARFLERI.slice(0, G))
    for (const grup of g) {
      assert.equal(grup.ogeler.length, 20)
      for (const o of grup.ogeler) {
        const asil = s.ogeler.find(x => x.id === o.id)
        assert.equal(o.siklarSirali[o.dogruIndex].metin, asil.siklar.find(k => k.id === asil.dogru).metin)
      }
    }
    assert.equal(new Set(g.map(x => x.ogeler.map(o => o.id).join())).size, G, `${G} grubun soru sıraları farklı`)
  }
  // eski kayıtta 4'ten fazla grup varsa A–D'ye indirilir; optik aktarımı yine hatasız
  const s = testSinavi(10, 7)
  assert.equal(tumGruplar(s).length, 4)
  assert.equal(yeniSinav({ sablon: 'test', grupSayisi: 9 }).ayar.grupSayisi, 4)
  assert.equal(optigeAktarilabilir(s).tamam, true)
  assert.deepEqual(Object.keys(optikDurumu(s).anahtarlar), ['A', 'B', 'C', 'D'])
  assert.equal(grupAraligi(3), 'A–C')
})
t('optik: farklı puanlı sınav sessizce aktarılmaz; eşitlenince aktarılır', () => {
  const s = testSinavi(10, 2)
  s.ogeler[0].puan = 20; s.ogeler[1].puan = 0
  assert.equal(puanDurumu(s).esit, false)
  assert.throws(() => optikDurumu(s), /eşit değil/)
  s.ogeler = puanlariDagit(s.ogeler, 100, true)
  assert.equal(optikDurumu(s).ayar.soruPuani, 0)
  const y = testSinavi(20, 1); y.ogeler.forEach(o => { o.puan = 3 })   // 20 x 3 = 60
  assert.equal(optikDurumu(y).ayar.soruPuani, 3)
})
t('optik: silinmiş şıkka bağlı doğru cevap yakalanır', () => {
  const s = testSinavi(3, 1)
  s.ogeler[1].dogru = 'yok-boyle-sik'
  assert.equal(optigeAktarilabilir(s).tamam, false)
})
t('optik puanı = kâğıttaki puan (1–80 soru, 1–4 grup, rastgele öğrenci cevapları)', () => {
  let r = 12345
  const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648 }
  for (const N of [1, 2, 7, 12, 13, 25, 33, 40, 57, 80]) {
    for (const G of [1, 2, 3, 4]) {
      const s = yeniSinav({ sablon: 'test', soruSayisi: N, sikSayisi: 5, grupSayisi: G })
      s.ogeler.forEach(o => { o.dogru = o.siklar[Math.floor(rnd() * 5)].id })
      const d = optikDurumu(s)
      const gruplar = tumGruplar(s)
      for (let k = 0; k < 6; k++) {
        const g = Math.floor(rnd() * G)
        const cevaplar = Array.from({ length: 80 }, (_, q) => (q >= N || rnd() < 0.1 ? { t: 'b' } : { t: 'c', k: Math.floor(rnd() * 5) }))
        const optikP = puanla({ cevaplar }, d.anahtarlar[gruplar[g].harf], d.ayar).puan
        const kagitP = gruplar[g].ogeler.reduce((t, o, q) => t + (cevaplar[q].t === 'c' && cevaplar[q].k === o.dogruIndex ? o.puan : 0), 0)
        assert.ok(Math.abs(optikP - kagitP) < 0.006, `N=${N} G=${G}: optik ${optikP} ≠ kâğıt ${kagitP}`)
        if (cevaplar.slice(0, N).every((c, q) => c.t === 'c' && c.k === gruplar[g].ogeler[q].dogruIndex)) assert.equal(optikP, 100)
      }
      // tamamı doğru -> 100
      const tam = gruplar[G - 1].ogeler.map(o => ({ t: 'c', k: o.dogruIndex }))
      assert.equal(puanla({ cevaplar: [...tam, ...Array(80 - N).fill({ t: 'b' })] }, d.anahtarlar[gruplar[G - 1].harf], d.ayar).puan, 100)
    }
  }
})
t('yazdırma sırası: öğrenci sayısı kadar kâğıt + optik, gruplar sırayla, çift taraflı boş sayfa', () => {
  const sayfa = g => [1, 2, 3][g]
  const sec = baskiSecimiDuzelt({ kopya: 'ogrenci', ogrenci: 7, optik: true, optikAnahtar: true, anahtar: true }, 3)
  assert.deepEqual(dagilim(sec), [0, 1, 2, 0, 1, 2, 0])
  const l = baskiListesi(sec, sayfa)
  assert.equal(l.filter(x => x.tur === 'optik').length, 7)
  assert.equal(l.filter(x => x.tur === 'optikAnahtar').length, 3)
  assert.equal(l.filter(x => x.tur === 'kagit').length, 1 + 2 + 3 + 1 + 2 + 3 + 1)
  assert.equal(l[l.length - 1].tur, 'anahtar')
  // her öğrencinin optik formu kendi kâğıdının hemen arkasında ve aynı grupta
  l.forEach((x, i) => { if (x.tur === 'optik') { assert.equal(l[i - 1].tur, 'kagit'); assert.equal(l[i - 1].g, x.g); assert.equal(l[i - 1].kisi, x.kisi) } })
  const c = baskiListesi({ ...sec, ciftTaraf: true }, sayfa)
  // çift taraflı: her kâğıt ve her optik form tek (sol) sayfadan başlar
  let n = 0
  for (const x of c) { if ((x.tur === 'optik' || x.tur === 'optikAnahtar' || (x.tur === 'kagit' && x.sayfa === 0))) assert.equal(n % 2, 0, 'yeni yaprakta başlamalı'); if (x.tur !== 'anahtar') n++ }
  const b = bloklar(l)
  assert.equal(b.filter(x => x.tur === 'kagit').length, 7)
  assert.equal(b.find(x => x.tur === 'kagit' && x.g === 2).sayfa, 3)
  // yalnız optik (kâğıt yok)
  const o = baskiListesi({ ...sec, kagit: false, optikAnahtar: false, anahtar: false }, sayfa)
  assert.deepEqual(o.map(x => x.tur), Array(7).fill('optik'))
  // optik uygun değilse optik form basılmaz
  assert.equal(baskiListesi(sec, sayfa, { optikUygun: false, anahtarUygun: false }).some(x => x.tur.startsWith('optik')), false)
  // her gruptan bir
  assert.deepEqual(dagilim(baskiSecimiDuzelt({ kopya: 'grup' }, 4)), [0, 1, 2, 3])
  // eski kayıt, grup sayısı azalınca düzelir
  assert.deepEqual(baskiSecimiDuzelt({ gruplar: [0, 3, 5] }, 2).gruplar, [0])
})
t('optik anahtarları grupların kâğıttaki doğru şıklarıdır', () => {
  const s = testSinavi(15, 4)
  const a = optikAnahtarlari(s)
  tumGruplar(s).forEach(g => assert.deepEqual(a[g.harf], g.ogeler.map(o => o.dogruIndex)))
})

t('soru iptali için soru eşleşmesi: her kitapçıkta aynı soru kimlikleri, kâğıttaki sırayla', () => {
  const s = testSinavi(20, 4)
  const d = optikDurumu(s)
  const g = tumGruplar(s)
  assert.deepEqual(Object.keys(d.soruKimlikleri), ['A', 'B', 'C', 'D'])
  g.forEach(gr => assert.deepEqual(d.soruKimlikleri[gr.harf], gr.ogeler.map(o => o.id)))
  // A'nın 5. sorusu B'de kaçıncıysa, B'nin anahtarındaki o soru A'nın 5. sorusunun doğru şıkkıyla aynı metindir
  for (let q = 0; q < 20; q++) {
    const id = d.soruKimlikleri.A[q]
    for (const k of ['B', 'C', 'D']) {
      const qk = d.soruKimlikleri[k].indexOf(id)
      assert.ok(qk >= 0)
      const oA = g[0].ogeler[q], oK = g['ABCD'.indexOf(k)].ogeler[qk]
      assert.equal(oA.siklarSirali[d.anahtarlar.A[q]].metin, oK.siklarSirali[d.anahtarlar[k][qk]].metin)
      assert.equal(oA.siklarSirali[d.anahtarlar.A[q]].id, oA.dogru)
    }
  }
})
t('sınıf listesi: form ölçüleri optik okuyucunun geometri dosyasıyla aynı', () => {
  const geo = JSON.parse(readFileSync(new URL('../src/omr/geometri.json', import.meta.url), 'utf8'))
  assert.equal(FORM_HARFLERI, geo.harfler)
  assert.equal(AD_SUTUN, geo.ad.merkez.length)
  assert.equal(SOYAD_SUTUN, geo.soyad.merkez.length)
  assert.equal(NO_HANE, geo.no.merkez.length)
  geo.ad.merkez.forEach(sutun => assert.equal(sutun.length, FORM_HARFLERI.length))
  geo.soyad.merkez.forEach(sutun => assert.equal(sutun.length, FORM_HARFLERI.length))
  geo.no.merkez.forEach(sutun => assert.equal(sutun.length, 10))
})
t('sınıf listesi: ad kodlama (Türkçe harfler, iki ad, uzun ad, formda olmayan harf)', () => {
  const h = ch => FORM_HARFLERI.indexOf(ch)
  let a = adKodla('ayşe nur')
  assert.equal(a.yazilan, 'AYŞE NUR')
  assert.deepEqual(a.kod, [h('A'), h('Y'), h('Ş'), h('E'), null, h('N'), h('U'), h('R')])
  assert.deepEqual(a.uyarilar, [])
  assert.equal(adKodla('ismail').yazilan, 'İSMAİL')          // Türkçe büyük harf: i -> İ
  assert.equal(adKodla('IŞIK').yazilan, 'IŞIK')
  assert.equal(adKodla('çağrı ğöüş').yazilan, 'ÇAĞRI ĞÖÜŞ')
  a = adKodla('Edward')
  assert.equal(a.yazilan, 'EDVARD'); assert.equal(a.uyarilar.length, 1)
  assert.equal(adKodla('Alexander').yazilan, 'ALEKSANDER')
  assert.equal(adKodla('Âlim').yazilan, 'ALİM')
  a = adKodla('Muhammed Mustafa Enes')
  assert.equal(a.kod.length, 13); assert.equal(a.yazilan, 'MUHAMMED MUST'); assert.ok(a.uyarilar.some(u => u.includes('uzun')))
  a = adKodla('Mehmet Ali  ')                      // 13. sütunda boşluk kalmaz
  assert.equal(a.yazilan, 'MEHMET ALİ')
  a = adKodla('Abdurrahmanxx')                     // X -> KS ile 13'ü aşarsa kesilir
  assert.equal(a.kod.length, 13)
  assert.equal(adKodla("Can-Ali O'Neil").yazilan, 'CAN ALİ ONEİL')
  assert.deepEqual(adKodla('').kod, [])
  assert.ok(adKodla('Ahmet 2').uyarilar.length === 1)   // rakam yazılmaz
  // kod her zaman form harfi ya da boş
  for (const ad of ['Zeynep Gül', 'Ömer Faruk', 'Ğ Ü Ş İ Ö Ç', 'Wİlliam Quincy']) adKodla(ad).kod.forEach(k => assert.ok(k === null || (k >= 0 && k < 29)))
})
t('sınıf listesi: numara kodlama (en çok 9 hane, uydurma numara yok)', () => {
  assert.deepEqual(noKodla('1234').haneler, [1, 2, 3, 4])
  assert.deepEqual(noKodla(' 00 7 ').haneler, [0, 0, 7])
  assert.deepEqual(noKodla(123456789).haneler, [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(noKodla('1234567890').haneler, null); assert.ok(noKodla('1234567890').uyari)
  assert.equal(noKodla('12A').haneler, null); assert.ok(noKodla('12A').uyari)
  assert.equal(noKodla('').haneler, null); assert.equal(noKodla('').uyari, null)
  const k = ogrenciKodu({ ad: 'Ayşe Nur', soyad: 'Yılmaz', no: '1234567890' })
  assert.equal(k.noHane, null); assert.equal(k.no, ''); assert.equal(k.uyarilar.length, 1)
})
t('sınıf listesi: e-Okul / üniversite listesi, yapıştırılan metin, başlıksız liste', () => {
  // e-Okul benzeri: üstte okul bilgisi, sonra başlık satırı
  let r = tablodanOgrenciler([
    ['T.C. MİLLÎ EĞİTİM BAKANLIĞI'], ['9/A Sınıf Listesi'], [],
    ['S.No', 'Öğrenci No', 'Adı', 'Soyadı', 'Cinsiyeti'],
    ['1', '123', 'ayşe nur', 'yılmaz', 'Kız'],
    ['2', '45', 'İSMAİL', 'ÇELİK', 'Erkek'],
    ['', '', '', '', ''],
  ])
  assert.equal(r.baslikSatiri, 3)
  assert.deepEqual(r.ogrenciler, [{ no: '123', ad: 'AYŞE NUR', soyad: 'YILMAZ', sinif: '' }, { no: '45', ad: 'İSMAİL', soyad: 'ÇELİK', sinif: '' }])
  // "Adı Soyadı" tek sütun: son kelime soyad
  r = tablodanOgrenciler([['Numara', 'Adı Soyadı', 'Sınıfı'], ['7', 'Mehmet Ali Kaya', '10-B'], ['8', 'Ece Su Ak', '10-B']])
  assert.deepEqual(r.ogrenciler[0], { no: '7', ad: 'MEHMET ALİ', soyad: 'KAYA', sinif: '10-B' })
  assert.equal(r.ogrenciler[1].ad, 'ECE SU')
  // üniversite: Student ID / Name / Surname, Excel'in 2021001.0 gibi yazdığı numara
  r = tablodanOgrenciler([['Student ID', 'Name', 'Surname'], ['2021001.0', 'Deniz', 'Öztürk']])
  assert.deepEqual(r.ogrenciler[0], { no: '2021001', ad: 'DENİZ', soyad: 'ÖZTÜRK', sinif: '' })
  // yapıştırılan (sekmeyle ayrılmış) metin
  r = tablodanOgrenciler(metniTabloyaCevir('No\tAdı\tSoyadı\r\n12\tZeynep\tKara\n13\tCan\tDemir\n'))
  assert.equal(r.ogrenciler.length, 2); assert.equal(r.ogrenciler[1].soyad, 'DEMİR')
  // noktalı virgüllü Türkçe CSV, tırnaklı hücre
  assert.deepEqual(metniTabloyaCevir('No;Adı;Soyadı\n1;"Ali; Veli";Can'), [['No', 'Adı', 'Soyadı'], ['1', 'Ali; Veli', 'Can']])
  // başlıksız: sıra no sütunu atlanır, rakamlı sütun numara, ilk iki yazı sütunu ad / soyad
  r = tablodanOgrenciler([['1', '501', 'Ali', 'Can'], ['2', '502', 'Ece', 'Su'], ['3', '503', 'Efe', 'Ay']])
  assert.deepEqual(r.ogrenciler[2], { no: '503', ad: 'EFE', soyad: 'AY', sinif: '' })
  assert.ok(r.uyarilar.some(u => u.includes('Başlık')))
  // aynı numara uyarısı
  r = tablodanOgrenciler([['No', 'Ad', 'Soyad'], ['5', 'A', 'B'], ['5', 'C', 'D']])
  assert.ok(r.uyarilar.some(u => u.includes('Aynı numara')))
  // "Soyadı" başlığı ad soyad sanılmaz
  r = tablodanOgrenciler([['Soyadı', 'Adı', 'No'], ['Kaya', 'Ali', '9']])
  assert.deepEqual(r.ogrenciler[0], { no: '9', ad: 'ALİ', soyad: 'KAYA', sinif: '' })
  assert.equal(tablodanOgrenciler([['1', '2'], ['3', '4']]).ogrenciler.length, 0)
})
t('sınıf listesinden yazdırma: listedeki her öğrenciye sırayla grup, kâğıt ve optik form', () => {
  const sec = baskiSecimiDuzelt({ kopya: 'liste', gruplar: [0, 1, 2], optik: true, ogrenci: 3 }, 4)
  assert.equal(sec.kopya, 'liste')
  assert.deepEqual(dagilim(sec, 7), [0, 1, 2, 0, 1, 2, 0])
  const l = baskiListesi(sec, () => 2, { listeSayisi: 5 })
  assert.equal(l.filter(x => x.tur === 'optik').length, 5)
  assert.deepEqual(l.filter(x => x.tur === 'optik').map(x => x.kisi), [0, 1, 2, 3, 4])
  assert.equal(l.filter(x => x.tur === 'kagit').length, 10)
  assert.equal(baskiListesi(sec, () => 2, { listeSayisi: 0 }).length, 0)
})

t('karıştırma: grupları hiç değişmez (sürüm 1 eski sınavlar, sürüm 2 yeniler; basılmış kâğıtlar / optik anahtarları korunur)', () => {
  const ogeler = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, tur: 'coktan', puan: 10, metin: `S${i}`, gorsel: null,
    siklar: Array.from({ length: 5 }, (_, j) => ({ id: `q${i}s${j}`, metin: `${i}${j}`, gorsel: null })), dogru: `q${i}s${i % 5}`, sikKilit: false }))
  const s = { id: 'x', baslik: {}, ayar: { grupSayisi: 4, soruKaristir: true, sikKaristir: true, tohum: 12345 }, ogeler }
  const ozet = tumGruplar(s).map(g => [g.ogeler.map(o => o.id.slice(1)).join(','), g.ogeler.map(o => o.dogruHarf).join('')])
  assert.deepEqual(ozet, [['0,1,2,3,4,5,6,7,8,9', 'ABCDEABCDE'], ['3,4,7,8,2,6,0,9,5,1', 'ACEEDBDEEA'], ['2,4,9,8,6,1,7,5,3,0', 'EDEADADAAE'], ['6,9,3,8,5,2,7,0,1,4', 'DABBEAEADC']])
  // sürüm 2 de sabit kalmalı (bu sürümle basılan sınavlar için)
  s.ayar.karistirma = 2
  const ozet2 = tumGruplar(s).map(g => [g.ogeler.map(o => o.id.slice(1)).join(','), g.ogeler.map(o => o.dogruHarf).join('')])
  assert.deepEqual(ozet2, [['0,1,2,3,4,5,6,7,8,9', 'ABCDEABCDE'], ['9,2,6,5,0,7,4,8,3,1', 'AEDBBDBEEE'], ['2,7,1,9,8,3,5,0,6,4', 'DEABBCEEAD'], ['7,4,8,0,3,9,2,5,1,6', 'BACCADBDDE']])
})
t('karıştırma (yeni sınav): her soru başka yerde, her doğru cevap her grupta başka harfte', () => {
  for (const [n, k] of [[10, 5], [12, 4], [25, 5], [40, 4], [80, 5], [7, 5], [5, 4], [20, 3]]) {
    for (let tekrar = 0; tekrar < 5; tekrar++) {
      const s = testSinavi(n, 4)
      assert.equal(s.ayar.karistirma, 2)
      s.ogeler.forEach(o => { o.siklar = o.siklar.slice(0, k); if (!o.siklar.some(x => x.id === o.dogru)) o.dogru = o.siklar[0].id })
      s.ayar.tohum = 1000 + tekrar * 7 + n
      const g = tumGruplar(s)
      const yer = g.map(gr => new Map(gr.ogeler.map((o, i) => [o.id, i])))
      const harf = g.map(gr => new Map(gr.ogeler.map(o => [o.id, o.dogruIndex])))
      for (const o of s.ogeler) {
        // soru: dört grupta dört ayrı yerde
        assert.equal(new Set(yer.map(m => m.get(o.id))).size, 4, `${n} soru: ${o.id} bir grupta aynı yerde`)
        // doğru cevap: şık sayısı yettiğince her grupta ayrı harf (3 şıkta en çok 3 farklı harf olabilir)
        assert.equal(new Set(harf.map(m => m.get(o.id))).size, Math.min(4, k), `${n} soru ${k} şık: ${o.id} doğru cevabı aynı harfte`)
      }
      // şıklar: B grubunda hiçbir şık A'daki harfinde değil
      for (const o of g[1].ogeler) assert.ok(o.siklarSirali.every((x, i) => s.ogeler.find(a => a.id === o.id).siklar[i].id !== x.id))
      // anahtar = kâğıttaki doğru şık; aynı tohumla her açılışta aynı gruplar
      assert.deepEqual(JSON.stringify(tumGruplar(s)), JSON.stringify(g))
      g.forEach(gr => gr.ogeler.forEach(o => assert.equal(o.siklarSirali[o.dogruIndex].id, o.dogru)))
    }
  }
})
t('karıştırma (yeni sınav): kapalıyken sıra / şıklar A ile aynı; sabitlenen şıklar ve bölümler yerinde', () => {
  const s = testSinavi(12, 3)
  s.ayar.soruKaristir = false; s.ayar.sikKaristir = false
  tumGruplar(s).forEach(g => { assert.deepEqual(g.ogeler.map(o => o.id), s.ogeler.map(o => o.id)); g.ogeler.forEach(o => assert.deepEqual(o.siklarSirali.map(x => x.id), s.ogeler.find(a => a.id === o.id).siklar.map(x => x.id))) })
  s.ayar.soruKaristir = true; s.ayar.sikKaristir = true
  s.ogeler[2].sikKilit = true
  const b = yeniOge('bolum'); s.ogeler.splice(6, 0, b)
  tumGruplar(s).forEach(g => {
    assert.equal(g.ogeler[6].id, b.id)                                     // bölüm başlığı yerinde
    assert.deepEqual(new Set(g.ogeler.slice(0, 6).map(o => o.id)), new Set(s.ogeler.slice(0, 6).map(o => o.id)))   // bölüm içinde
    assert.deepEqual(g.ogeler.find(o => o.id === s.ogeler[2].id).siklarSirali.map(x => x.id), s.ogeler[2].siklar.map(x => x.id))
  })
})

console.log(`\n${gecen} test geçti`)

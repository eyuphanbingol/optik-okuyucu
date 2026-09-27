// Sınav hazırlama: model ve grup (karıştırma) birim testleri:  node test/sinav.test.js
import assert from 'node:assert/strict'
import { yeniSinav, yeniOge, numaralar, toplamPuan, puanlariDagit, ogeKopyala, turDegistir, eksikler, gorselKimlikleri, puanMetni, GRUP_HARFLERI, MAKS_GRUP, grupAraligi } from '../src/sinav/model.js'
import { grupOlustur, tumGruplar, bosluklar } from '../src/sinav/karistir.js'
import { duzMetin, bosMu, ozet } from '../src/sinav/metin.js'
import { optigeAktarilabilir, optikYapiUygun, optikDurumu, puanDurumu, optikAnahtarlari } from '../src/sinav/optikAktar.js'
import { baskiListesi, baskiSecimiDuzelt, bloklar, dagilim } from '../src/sinav/baski.js'
import { puanla } from '../src/mantik.js'

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

t('istenen sayıda grup (1–26): harfler, farklı sıralar, her grubun anahtarı doğru', () => {
  assert.equal(MAKS_GRUP, 26)
  assert.equal(grupAraligi(6), 'A–F')
  for (const G of [1, 2, 3, 5, 6, 8, 12, 26]) {
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
    if (G <= 8) assert.equal(new Set(g.map(x => x.ogeler.map(o => o.id).join())).size, G, `${G} grubun soru sıraları farklı`)
  }
  const s = testSinavi(5, 40)
  assert.equal(tumGruplar(s).length, 26, '26 grubun üstü sınırlanır')
})
t('optik: 4\'ten fazla grup aktarılmaz (formda A–D), neden açıkça söylenir', () => {
  const s = testSinavi(10, 5)
  const u = optigeAktarilabilir(s)
  assert.equal(u.tamam, false); assert.equal(u.grup, true); assert.match(u.neden, /4 kitapçık/)
  assert.throws(() => optikDurumu(s))
  assert.equal(optikYapiUygun(testSinavi(10, 4)).tamam, true)
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

console.log(`\n${gecen} test geçti`)

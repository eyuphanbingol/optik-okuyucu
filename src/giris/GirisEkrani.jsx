import { useState } from 'react'
import Simge, { Logo } from '../bilesenler/Simge.jsx'
import { supabase, epostaYap, kullaniciAdiNormal } from './supabase.js'

export default function GirisEkrani() {
  const [ad, setAd] = useState('')
  const [sifre, setSifre] = useState('')
  const [goster, setGoster] = useState(false)
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState('')

  async function gir(e) {
    e.preventDefault()
    if (!kullaniciAdiNormal(ad) || !sifre) { setHata('Kullanıcı adı ve şifre girin.'); return }
    setMesgul(true)
    setHata('')
    const { error } = await supabase.auth.signInWithPassword({ email: epostaYap(ad), password: sifre })
    setMesgul(false)
    if (!error) return
    if (/invalid|credentials/i.test(error.message)) setHata('Kullanıcı adı ya da şifre hatalı.')
    else if (/fetch|network/i.test(error.message)) setHata('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.')
    else setHata('Giriş yapılamadı: ' + error.message)
  }

  return (
    <div className="giris-sahne">
      <form className="giris-kart" onSubmit={gir} noValidate>
        <div className="marka giris-marka">
          <Logo boyut={34} />
          <div className="logo">Optik Okuyucu</div>
        </div>
        <h1>Giriş yap</h1>
        <p className="aciklama">Kurumunuza verilen kullanıcı adı ve şifreyle devam edin.</p>

        <label className="alan">
          <span className="alan-ad">Kullanıcı adı</span>
          <input
            value={ad}
            onChange={e => setAd(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            placeholder="ornek.kurum"
          />
        </label>

        <label className="alan">
          <span className="alan-ad">Şifre</span>
          <span className="sifre-alan">
            <input
              type={goster ? 'text' : 'password'}
              value={sifre}
              onChange={e => setSifre(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <button
              type="button"
              className={`sifre-goster ${goster ? 'acik' : ''}`}
              onClick={() => setGoster(g => !g)}
              aria-label={goster ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              <Simge ad="goz" boyut={19} />
            </button>
          </span>
        </label>

        {hata && <div className="hata-kutu" role="alert"><Simge ad="uyari" boyut={17} /><span>{hata}</span></div>}

        <button type="submit" className="birincil giris-dugme" disabled={mesgul}>
          {mesgul ? <span className="donen kucuk" aria-hidden="true" /> : <Simge ad="kilit" boyut={17} />}
          {mesgul ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>

        <p className="giris-alt">Hesabınız yoksa kurum yöneticinizle iletişime geçin.</p>
      </form>
    </div>
  )
}

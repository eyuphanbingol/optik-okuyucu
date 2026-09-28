// Uygulama simgeleri (tek renk, çizgi; renk yazı renginden gelir). Emoji yerine: her cihazda aynı, keskin görünüm.
const YOLLAR = {
  kamera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3a1.5 1.5 0 0 0 1.25-.67l.9-1.36A1.5 1.5 0 0 1 11.2 3.3h1.6a1.5 1.5 0 0 1 1.25.67l.9 1.36a1.5 1.5 0 0 0 1.25.67h1.3A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.3" r="3.4" /></>,
  klavye: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M7 10h.01M10.3 10h.01M13.7 10h.01M17 10h.01M7 13.6h.01M17 13.6h.01M10 13.6h4" /></>,
  indir: <><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 19.5h14" /></>,
  posta: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7.5 7.1 5.1a1.6 1.6 0 0 0 1.8 0L20 7.5" /></>,
  paylas: <><path d="M12 14.5V3.8" /><path d="m8 7.3 4-4 4 4" /><path d="M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5" /></>,
  dosya: <><path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5z" /><path d="M14 3.5v5h5" /><path d="M9 13h6M9 16.5h4" /></>,
  fener: <><path d="M9 3.5h6l-1 5.5v0a2 2 0 0 1 1 1.73V19a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 19v-8.27A2 2 0 0 1 10 9z" /><path d="M12 13v2" /></>,
  ileri: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  geri: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
  onay: <path d="m5 12.5 4.2 4.2L19 7" />,
  ses: <><path d="M4 9.6v4.8a1 1 0 0 0 1 1h2.9l4.3 3.5a.8.8 0 0 0 1.3-.62V5.72a.8.8 0 0 0-1.3-.62L7.9 8.6H5a1 1 0 0 0-1 1z" /><path d="M16.3 9.2a4 4 0 0 1 0 5.6" /><path d="M18.9 6.6a7.6 7.6 0 0 1 0 10.8" /></>,
  sesKapali: <><path d="M4 9.6v4.8a1 1 0 0 0 1 1h2.9l4.3 3.5a.8.8 0 0 0 1.3-.62V5.72a.8.8 0 0 0-1.3-.62L7.9 8.6H5a1 1 0 0 0-1 1z" /><path d="m16.5 9.5 5 5M21.5 9.5l-5 5" /></>,
  onayDaire: <><circle cx="12" cy="12" r="9" /><path d="m8.2 12.3 2.6 2.6 5-5.2" /></>,
  uyari: <><path d="M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0" /><path d="M12 9.5v4M12 16.8h.01" /></>,
  kapat: <path d="M6 6l12 12M18 6 6 18" />,
  kalem: <><path d="M4 20h4L18.6 9.4a2.1 2.1 0 0 0 0-3L17.6 5.4a2.1 2.1 0 0 0-3 0L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  cop: <><path d="M4.5 7h15" /><path d="M9.5 7V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" /><path d="M6.5 7l.8 11.6A2 2 0 0 0 9.3 20.5h5.4a2 2 0 0 0 2-1.9L17.5 7" /></>,
  bilgi: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8h.01" /></>,
  soru: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.8M12 17.2h.01" /></>,
  ayarlar: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  anahtar: <><circle cx="8" cy="15" r="4" /><path d="m10.9 12.1 8.1-8.1M16 7l2.5 2.5M13.5 9.5 15.5 11.5" /></>,
  tara: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M7.5 12h9" /></>,
  grafik: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6" /></>,
  kisiler: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.2A5.5 5.5 0 0 1 20.5 19" /></>,
  sirala: <><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5" /><path d="M17 20V4M13.5 7.5 17 4l3.5 3.5" /></>,
  yenile: <><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20v-4h-4" /></>,
  arti: <path d="M12 5v14M5 12h14" />,
  kagit: <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="9" cy="8" r="1.1" /><circle cx="12" cy="8" r="1.1" /><circle cx="15" cy="8" r="1.1" /><circle cx="9" cy="12" r="1.1" /><circle cx="12" cy="12" r="1.1" /><circle cx="15" cy="12" r="1.1" /><path d="M8.5 16.5h7" /></>,
  isik: <><path d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4" /><circle cx="12" cy="12" r="3.6" /></>,
  sabit: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="5" /></>,
  // ---- sınav hazırlama
  ev: <><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z" /></>,
  geriAl: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  yinele: <><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>,
  gorsel: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m20.5 16-4.8-4.8a1.5 1.5 0 0 0-2.1 0L5 19.5" /></>,
  yazdir: <><path d="M7 8.5V4h10v4.5" /><rect x="3.5" y="8.5" width="17" height="8" rx="2" /><path d="M7 14h10v6H7z" /><path d="M16.5 11.5h.01" /></>,
  word: <><path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5z" /><path d="M14 3.5v5h5" /><path d="m8.5 11.5 1.2 5 1.8-4 1.8 4 1.2-5" /></>,
  kopya: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2" /><path d="M15.5 8.5V6A2 2 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></>,
  yukari: <path d="m6 15 6-6 6 6" />,
  asagi: <path d="m6 9 6 6 6-6" />,
  sag: <path d="m9 6 6 6-6 6" />,
  tutamak: <><circle cx="9" cy="6.5" r="1.1" /><circle cx="15" cy="6.5" r="1.1" /><circle cx="9" cy="12" r="1.1" /><circle cx="15" cy="12" r="1.1" /><circle cx="9" cy="17.5" r="1.1" /><circle cx="15" cy="17.5" r="1.1" /></>,
  menu: <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>,
  sembol: <path d="M6 19.5h4v-1.7a6.5 6.5 0 1 1 4 0v1.7h4" />,
  liste: <><circle cx="5.5" cy="7" r="1.6" /><circle cx="5.5" cy="12" r="1.6" /><circle cx="5.5" cy="17" r="1.6" /><path d="M10 7h9.5M10 12h9.5M10 17h9.5" /></>,
  dy: <><rect x="3.5" y="4" width="8" height="8" rx="2" /><path d="m5.5 8 1.6 1.6 2.6-3" /><rect x="3.5" y="13" width="8" height="8" rx="2" /><path d="m6 15.5 3 3m0-3-3 3" /><path d="M14.5 8h6M14.5 17h6" /></>,
  bosluk: <><path d="M3.5 12h4M16.5 12h4" /><path d="M9.5 15h5" strokeDasharray="1.5 1.8" /><path d="M3.5 7.5h17M3.5 16.5h4M16.5 16.5h4" /></>,
  eslestirme: <><circle cx="5.5" cy="6.5" r="1.8" /><circle cx="5.5" cy="17.5" r="1.8" /><circle cx="18.5" cy="6.5" r="1.8" /><circle cx="18.5" cy="17.5" r="1.8" /><path d="M7.3 7.3 16.7 16.7M7.3 16.7 16.7 7.3" /></>,
  baslik: <><path d="M5 5v14M13 5v14M5 12h8" /><path d="M17 10.5 19.5 9v10" /></>,
  karistir: <><path d="M3.5 7h3.2a4 4 0 0 1 3.3 1.8l4 6.4A4 4 0 0 0 17.3 17h3.2" /><path d="M3.5 17h3.2a4 4 0 0 0 3.3-1.8l.6-1M14 8.8a4 4 0 0 1 3.3-1.8h3.2" /><path d="m18 4.5 2.5 2.5L18 9.5M18 14.5l2.5 2.5-2.5 2.5" /></>,
  sutun: <><rect x="3.5" y="4" width="17" height="16" rx="2.2" /><path d="M12 4v16" /></>,
  klasor: <><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></>,
  yukle: <><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 19.5h14" /></>,
  sayfa: <><path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5z" /><path d="M14 3.5v5h5" /></>,
  goz: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" /><circle cx="12" cy="12" r="3" /></>,
  kilit: <><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  hizaSol: <path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h10" />,
  hizaOrta: <path d="M4 6h16M7 10.5h10M4 15h16M7 19.5h10" />,
  hizaSag: <path d="M4 6h16M10 10.5h10M4 15h16M10 19.5h10" />,
  metinYani: <><rect x="13" y="5" width="7.5" height="7" rx="1.5" /><path d="M3.5 6h6.5M3.5 9.5h6.5M3.5 13h17M3.5 16.5h17M3.5 20h11" /></>,
  optik: <><rect x="4.5" y="3" width="15" height="18" rx="2" /><circle cx="9" cy="8" r="1.4" /><circle cx="15" cy="8" r="1.4" fill="currentColor" /><circle cx="9" cy="12.5" r="1.4" fill="currentColor" /><circle cx="15" cy="12.5" r="1.4" /><path d="M8.5 17h7" /></>,
  sinav: <><path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5z" /><path d="M14 3.5v5h5" /><path d="M8.5 12.5h7M8.5 16h4.5" /><path d="m15.5 15 1 1 2-2.2" /></>,
  yildiz: <path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7z" />,
}

export default function Simge({ ad, boyut = 18, kalinlik = 1.8, className = '', ...ozellik }) {
  return (
    <svg className={'simge ' + className} width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={kalinlik} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...ozellik}>
      {YOLLAR[ad]}
    </svg>
  )
}

/** Uygulama işareti: optik form kabarcıkları (biri işaretli) */
export function Logo({ boyut = 30 }) {
  return (
    <svg className="logo-isaret" width={boyut} height={boyut} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-zemin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--logo-1)" />
          <stop offset="1" stopColor="var(--logo-2)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-zemin)" />
      <rect x=".5" y=".5" width="31" height="31" rx="8.5" fill="none" stroke="#fff" strokeOpacity=".16" />
      {[0, 1, 2].map(s => [0, 1, 2].map(k => {
        const dolu = (s === 0 && k === 1) || (s === 1 && k === 2) || (s === 2 && k === 0)
        return <circle key={`${s}${k}`} cx={9.5 + k * 6.5} cy={9.5 + s * 6.5} r="2.35" fill={dolu ? '#fff' : 'none'} stroke="#fff" strokeOpacity={dolu ? 1 : 0.55} strokeWidth="1.3" />
      }))}
    </svg>
  )
}

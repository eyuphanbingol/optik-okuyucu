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

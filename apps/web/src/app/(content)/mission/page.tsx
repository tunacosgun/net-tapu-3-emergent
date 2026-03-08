import type { Metadata } from 'next';
import { CmsPageClient } from '@/components/cms-page-client';
import Link from 'next/link';

const SLUG = 'mission';
const FALLBACK_TITLE = 'Misyon';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const res = await fetch(`${apiUrl}/api/v1/content/pages/${SLUG}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const page = await res.json();
      return {
        title: page.metaTitle || `${FALLBACK_TITLE} — NetTapu`,
        description: page.metaDescription || undefined,
        openGraph: { title: page.metaTitle || FALLBACK_TITLE, description: page.metaDescription || undefined },
      };
    }
  } catch { /* fallback */ }
  return { title: `${FALLBACK_TITLE} — NetTapu` };
}

function MissionFallback() {
  const missions = [
    {
      title: 'Şeffaflık',
      desc: 'Her işlemi kayıt altına alarak, alıcı ve satıcı arasında tam şeffaflık sağlamak. Fiyat geçmişi, ihale süreçleri ve tapu bilgileri açık erişimde.',
      icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Güvenlik',
      desc: '3D Secure ödeme altyapısı, kimlik doğrulama ve yasal çerçevede işlem garantisi. Tüm veriler şifreli kanallarla korunur.',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Erişilebilirlik',
      desc: 'Her bütçeye uygun gayrimenkul fırsatları sunarak, yatırımı demokratikleştirmek. Web, mobil ve tablet — her platformdan kolay erişim.',
      icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'İnovasyon',
      desc: 'Canlı ihale motoru, harita tabanlı arayüz, akıllı fiyat analizi ve bildirim sistemi ile sektörün en yenilikçi platformunu sunmak.',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  const commitments = [
    'Tüm işlemlerde yasal uyumluluk',
    'Kişisel verilerin KVKK kapsamında korunması',
    '7/24 müşteri desteği ve danışmanlık',
    'Adil ve rekabetçi ihale ortamı',
  ];

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-500 p-6 sm:p-10 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Misyonumuz</h1>
          <p className="mt-3 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">
            Gayrimenkul alım-satımını herkes için güvenli, şeffaf ve erişilebilir kılmak.
          </p>
        </div>
      </div>

      {/* Mission Cards */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {missions.map((m) => (
          <div key={m.title} className="group rounded-xl border border-[var(--border)] p-5 transition-all hover:shadow-lg hover:border-emerald-200">
            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${m.bg} ${m.color}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={m.icon} />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{m.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Commitments */}
      <div className="mt-12 rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
        <h2 className="text-xl font-bold text-emerald-900">Taahhütlerimiz</h2>
        <ul className="mt-4 space-y-3">
          {commitments.map((c, i) => (
            <li key={i} className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-emerald-800">{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 p-6 sm:p-8 text-center text-white">
        <h2 className="text-xl sm:text-2xl font-bold">Birlikte Güçlüyüz</h2>
        <p className="mt-2 text-sm sm:text-base text-white/70">Güvenilir gayrimenkul yatırımı için bize katılın.</p>
        <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/parcels" className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-gray-50 transition-colors">Arsaları Keşfet</Link>
          <Link href="/about" className="rounded-lg border border-white/20 px-6 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors">Hakkımızda</Link>
        </div>
      </div>
    </div>
  );
}

export default function MissionPage() {
  return (
    <CmsPageClient
      slug={SLUG}
      showHero
      subtitle="Gayrimenkul alım-satımını herkes için güvenli, şeffaf ve erişilebilir kılmak."
      heroIcon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      fallback={<MissionFallback />}
    />
  );
}

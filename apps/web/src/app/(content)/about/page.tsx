import type { Metadata } from 'next';
import { CmsPageClient } from '@/components/cms-page-client';
import Link from 'next/link';

const SLUG = 'about';
const FALLBACK_TITLE = 'Hakkımızda';

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

function AboutFallback() {
  const stats = [
    { value: '10.000+', label: 'Kayıtlı Kullanıcı' },
    { value: '5.000+', label: 'Arsa İlanı' },
    { value: '1.200+', label: 'Başarılı Satış' },
    { value: '81', label: 'İl Kapsamı' },
  ];

  const values = [
    { title: 'Güvenilirlik', desc: 'Tüm işlemler yasal çerçevede, tam şeffaflıkla yürütülür.', bg: 'bg-blue-50', text: 'text-blue-600', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { title: 'Teknoloji', desc: 'Canlı ihale motoru, harita tabanlı arayüz ve akıllı filtreleme.', bg: 'bg-brand-50', text: 'text-brand-600', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { title: 'Erişilebilirlik', desc: 'Web, mobil ve tablet - her cihazdan kolay erişim.', bg: 'bg-purple-50', text: 'text-purple-600', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { title: 'Destek', desc: '7/24 uzman danışman desteği ve rehberlik hizmeti.', bg: 'bg-amber-50', text: 'text-amber-600', icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z' },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-emerald-500 p-6 sm:p-10 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Hakkımızda</h1>
          <p className="mt-3 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">
            NetTapu, Türkiye&apos;nin en güvenilir gayrimenkul açık artırma platformudur. Teknolojiyi ve şeffaflığı bir araya getirerek gayrimenkul alım-satımında yeni bir dönem başlatıyoruz.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-center transition-all hover:shadow-md hover:border-brand-200">
            <p className="text-2xl sm:text-3xl font-bold text-brand-600">{s.value}</p>
            <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Values */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Değerlerimiz</h2>
        <p className="mt-2 text-[var(--muted-foreground)]">Bizi farklı kılan temel ilkelerimiz</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="group rounded-xl border border-[var(--border)] p-5 transition-all duration-300 hover:shadow-lg hover:border-brand-200">
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${v.bg} ${v.text}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={v.icon} />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{v.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 p-6 sm:p-8 text-center text-white">
        <h2 className="text-xl sm:text-2xl font-bold">Bize Ulaşın</h2>
        <p className="mt-2 text-sm sm:text-base text-white/70">Sorularınız için uzman ekibimizle iletişime geçin.</p>
        <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/parcels" className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold hover:bg-brand-600 transition-colors">Arsaları Keşfet</Link>
          <a href="mailto:info@nettapu.com" className="rounded-lg border border-white/20 px-6 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors">info@nettapu.com</a>
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <CmsPageClient
      slug={SLUG}
      showHero
      subtitle="NetTapu, Türkiye'nin güvenilir gayrimenkul açık artırma platformudur."
      heroIcon="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      fallback={<AboutFallback />}
    />
  );
}

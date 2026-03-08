import type { Metadata } from 'next';
import { CmsPageClient } from '@/components/cms-page-client';

const SLUG = 'press';
const FALLBACK_TITLE = 'Basın';

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

function PressFallback() {
  const pressItems = [
    {
      date: 'Mart 2026',
      title: 'NetTapu Canlı İhale Sistemi Devrede',
      desc: 'Türkiye\'nin ilk gerçek zamanlı gayrimenkul açık artırma platformu hizmete girdi.',
      tag: 'Duyuru',
      tagColor: 'bg-blue-100 text-blue-700',
    },
    {
      date: 'Şubat 2026',
      title: 'Platform Beta Lansmanı',
      desc: 'NetTapu platformu, seçili kullanıcılarla beta testine başladı. İlk geri bildirimler olumlu.',
      tag: 'Lansman',
      tagColor: 'bg-brand-100 text-brand-700',
    },
    {
      date: 'Ocak 2026',
      title: '81 İlde Arsa İlanı Kapsamı',
      desc: 'NetTapu, Türkiye genelinde 81 ilin tamamında arsa ilanı listeleme kapasitesine ulaştı.',
      tag: 'Büyüme',
      tagColor: 'bg-emerald-100 text-emerald-700',
    },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-zinc-800 p-6 sm:p-10 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Basın Odası</h1>
          <p className="mt-3 max-w-xl text-base sm:text-lg text-white/70 leading-relaxed">
            NetTapu basın bültenleri, medya haberleri ve kurumsal duyurular.
          </p>
        </div>
      </div>

      {/* Press Kit */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] p-5 text-center transition-all hover:shadow-md hover:border-slate-300">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">Logo &amp; Marka</h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Basın kiti ve marka varlıkları</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-5 text-center transition-all hover:shadow-md hover:border-slate-300">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">Basın İletişim</h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">basin@nettapu.com</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-5 text-center transition-all hover:shadow-md hover:border-slate-300">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">Medya Arşivi</h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Fotoğraf ve video galerisi</p>
        </div>
      </div>

      {/* Press Releases */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Basın Bültenleri</h2>
        <p className="mt-2 text-[var(--muted-foreground)]">Son gelişmeler ve duyurular</p>
        <div className="mt-6 space-y-4">
          {pressItems.map((item, i) => (
            <div key={i} className="group rounded-xl border border-[var(--border)] p-5 transition-all hover:shadow-lg hover:border-slate-300">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs text-[var(--muted-foreground)]">{item.date}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.tagColor}`}>{item.tag}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-brand-600 transition-colors">{item.title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{item.desc}</p>
                </div>
                <svg className="hidden sm:block h-5 w-5 shrink-0 text-[var(--muted-foreground)] group-hover:text-brand-500 transition-colors mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PressPage() {
  return (
    <CmsPageClient
      slug={SLUG}
      showHero
      subtitle="NetTapu basın bültenleri, medya haberleri ve duyurular."
      heroIcon="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
      fallback={<PressFallback />}
    />
  );
}

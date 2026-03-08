import type { Metadata } from 'next';
import { CmsPageClient } from '@/components/cms-page-client';
import Link from 'next/link';

const SLUG = 'real-estate-guide';
const FALLBACK_TITLE = 'Gayrimenkul Rehberi';

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

function GuideFallback() {
  const chapters = [
    {
      number: '01',
      title: 'Arsa Satın Almadan Önce Bilinmesi Gerekenler',
      items: ['İmar durumu kontrolü', 'Tapu kayıt sorgulaması', 'Arsa üzerindeki şerhler ve ipotek', 'Belediye imar planı incelemesi'],
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      number: '02',
      title: 'Tapu İşlemleri ve Devir Süreci',
      items: ['Gerekli belgeler listesi', 'Tapu harcı hesaplama', 'Noter onay süreci', 'Devir işlemi aşamaları'],
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      number: '03',
      title: 'İhale ile Gayrimenkul Alma',
      items: ['İhaleye katılım şartları', 'Teminat bedeli yatırma', 'Canlı ihale süreci', 'Kazanma sonrası adımlar'],
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      number: '04',
      title: 'Yatırım Değerlendirmesi',
      items: ['Bölgesel değer analizi', 'Gelecek projeksiyonları', 'Altyapı ve ulaşım durumu', 'Çevresel risk faktörleri'],
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      gradient: 'from-purple-500 to-purple-600',
    },
  ];

  const tips = [
    { title: 'Kadastro Sorgulama', desc: 'TKGM Parsel Sorgu ile arsanızın resmi bilgilerini doğrulayın.', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { title: 'Çap Belgesi', desc: 'Arsanın sınırlarını ve ölçülerini gösteren resmi belgeyi mutlaka alın.', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    { title: 'İmar Durumu', desc: 'Belediyeden arsanın yapılaşma koşullarını öğrenin.', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500 p-6 sm:p-10 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Gayrimenkul Rehberi</h1>
          <p className="mt-3 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">
            Arsa alım-satım süreçlerinde bilmeniz gereken her şey, adım adım.
          </p>
        </div>
      </div>

      {/* Chapters */}
      <div className="mt-10 space-y-5">
        {chapters.map((ch) => (
          <div key={ch.number} className="group rounded-xl border border-[var(--border)] p-5 transition-all hover:shadow-lg hover:border-amber-200">
            <div className="flex gap-5">
              <div className="shrink-0">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${ch.gradient} text-white shadow-lg`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={ch.icon} />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex h-6 items-center rounded-full bg-amber-50 px-2.5 text-xs font-bold text-amber-600">
                    Bölüm {ch.number}
                  </span>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">{ch.title}</h2>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {ch.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Tips */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Hızlı İpuçları</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {tips.map((tip) => (
            <div key={tip.title} className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 transition-all hover:shadow-md">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tip.icon} />
                </svg>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-amber-900">{tip.title}</h3>
              <p className="mt-1 text-xs text-amber-700 leading-relaxed">{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 p-6 sm:p-8 text-center text-white">
        <h2 className="text-xl sm:text-2xl font-bold">Yatırıma Başlayın</h2>
        <p className="mt-2 text-sm sm:text-base text-white/70">Uzman danışmanlarımızla görüşerek doğru arsayı bulun.</p>
        <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/parcels" className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-amber-700 hover:bg-gray-50 transition-colors">Arsaları İncele</Link>
          <Link href="/how-it-works" className="rounded-lg border border-white/20 px-6 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors">Nasıl Çalışır?</Link>
        </div>
      </div>
    </div>
  );
}

export default function RealEstateGuidePage() {
  return (
    <CmsPageClient
      slug={SLUG}
      showHero
      subtitle="Gayrimenkul alım-satım süreçlerinde bilmeniz gereken her şey."
      heroIcon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      fallback={<GuideFallback />}
    />
  );
}

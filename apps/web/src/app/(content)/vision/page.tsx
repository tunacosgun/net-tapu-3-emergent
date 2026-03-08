import type { Metadata } from 'next';
import { CmsPageClient } from '@/components/cms-page-client';

const SLUG = 'vision';
const FALLBACK_TITLE = 'Vizyon';

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

function VisionFallback() {
  const pillars = [
    {
      number: '01',
      title: 'Dijital Dönüşüm',
      desc: 'Gayrimenkul sektörünü geleneksel yöntemlerden kurtararak, tamamen dijital ve şeffaf bir ekosistem oluşturmak. Yapay zeka destekli değerleme, blokzincir tabanlı kayıt sistemi ve gerçek zamanlı piyasa analizi ile sektörü geleceğe taşımak.',
      icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      gradient: 'from-indigo-500 to-indigo-600',
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
    },
    {
      number: '02',
      title: 'Küresel Erişim',
      desc: 'Türkiye gayrimenkul piyasasını uluslararası yatırımcılara açarak, sınır ötesi yatırım imkanları sunmak. Çok dilli platform desteği ve uluslararası ödeme altyapısı ile küresel bir pazar yeri olmak.',
      icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      gradient: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
    },
    {
      number: '03',
      title: 'Toplumsal Fayda',
      desc: 'Gayrimenkul yatırımını demokratikleştirerek, her bütçeye uygun fırsatlar sunmak. Kırsal kalkınmayı destekleyen arazi projeleri ve sürdürülebilir şehircilik vizyonu ile topluma değer katmak.',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
  ];

  const milestones = [
    { year: '2025', label: 'Platform Lansmanı', done: true },
    { year: '2025', label: 'Canlı İhale Sistemi', done: true },
    { year: '2026', label: 'Mobil Uygulama', done: false },
    { year: '2026', label: 'Uluslararası Açılım', done: false },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-600 p-6 sm:p-10 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Vizyonumuz</h1>
          <p className="mt-3 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">
            Gayrimenkul sektöründe dijital dönüşümün öncüsü olmak ve Türkiye&apos;nin en güvenilir emlak ekosistemini inşa etmek.
          </p>
        </div>
      </div>

      {/* Quote */}
      <div className="mt-8 rounded-xl border-l-4 border-indigo-500 bg-indigo-50/50 p-5 sm:p-6">
        <blockquote className="text-base sm:text-lg italic text-indigo-900 leading-relaxed">
          &ldquo;Teknoloji ve güven bir araya geldiğinde, gayrimenkul yatırımı herkes için erişilebilir hale gelir.&rdquo;
        </blockquote>
        <p className="mt-3 text-sm font-medium text-indigo-600">— NetTapu Kurucu Ekibi</p>
      </div>

      {/* Strategic Pillars */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Stratejik Hedefler</h2>
        <p className="mt-2 text-[var(--muted-foreground)]">Vizyonumuzu şekillendiren üç temel sütun</p>
        <div className="mt-6 space-y-5">
          {pillars.map((p) => (
            <div key={p.number} className="group flex gap-5 rounded-xl border border-[var(--border)] p-5 transition-all hover:shadow-lg hover:border-indigo-200">
              <div className="shrink-0">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${p.gradient} text-white shadow-lg`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={p.icon} />
                  </svg>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-6 items-center rounded-full ${p.bg} px-2.5 text-xs font-bold ${p.text}`}>
                    {p.number}
                  </span>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{p.title}</h3>
                </div>
                <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Yol Haritası</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {milestones.map((m, i) => (
            <div key={i} className={`rounded-xl border p-4 text-center transition-all ${m.done ? 'border-indigo-200 bg-indigo-50' : 'border-[var(--border)]'}`}>
              <span className={`text-xs font-bold ${m.done ? 'text-indigo-600' : 'text-[var(--muted-foreground)]'}`}>{m.year}</span>
              <p className={`mt-1 text-sm font-medium ${m.done ? 'text-indigo-900' : 'text-[var(--foreground)]'}`}>{m.label}</p>
              {m.done && (
                <svg className="mx-auto mt-2 h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VisionPage() {
  return (
    <CmsPageClient
      slug={SLUG}
      showHero
      subtitle="Gayrimenkul sektöründe dijital dönüşümün öncüsü olmak."
      heroIcon="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      fallback={<VisionFallback />}
    />
  );
}

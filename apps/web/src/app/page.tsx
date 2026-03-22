'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { TurkeyMap } from '@/components/turkey-map';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { ParcelCard } from '@/components/parcel-card';
import { VideoPopup } from '@/components/video-popup';
import {
  Search, ArrowRight, MapPin, Shield, Lock, Headphones, Scale,
  Play, Star, Users, Gavel, Building2, ChevronRight, TrendingUp,
  Zap, Timer,
} from 'lucide-react';
import type { Parcel, Auction, PaginatedResponse, Reference } from '@/types';

const ParcelMapLazy = dynamic(() => import('@/components/parcel-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center bg-gray-50 rounded-2xl">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
        <span className="text-sm text-gray-400">Harita yükleniyor...</span>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const router = useRouter();
  const siteSettings = useSiteSettings();
  const [featuredParcels, setFeaturedParcels] = useState<Parcel[]>([]);
  const [latestParcels, setLatestParcels] = useState<Parcel[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [stats, setStats] = useState({ parcels: 0, auctions: 0, cities: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [testimonials, setTestimonials] = useState<Reference[]>([]);

  useEffect(() => {
    apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { isFeatured: true, limit: 6, status: 'active' } })
      .then(({ data }) => setFeaturedParcels(data.data)).catch(() => {});

    apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { limit: 6, sortBy: 'createdAt', sortOrder: 'DESC', status: 'active' } })
      .then(({ data }) => {
        setLatestParcels(data.data);
        setStats((s) => ({ ...s, parcels: data.meta.total }));
      }).catch(() => {});

    // Fetch total city count from all active parcels
    apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { limit: 100, status: 'active' } })
      .then(({ data }) => {
        const cities = new Set(data.data.map((p) => p.city).filter(Boolean));
        setStats((s) => ({ ...s, cities: cities.size }));
      }).catch(() => {});

    apiClient.get<Reference[]>('/content/references')
      .then(({ data }) => setTestimonials(data.filter((r) => r.referenceType === 'testimonial').slice(0, 6)))
      .catch(() => {});

    Promise.all([
      apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 3, status: 'live' } }).catch(() => ({ data: { data: [], meta: { total: 0 } } })),
      apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 3, status: 'scheduled' } }).catch(() => ({ data: { data: [], meta: { total: 0 } } })),
      apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 1, status: 'deposit_open' } }).catch(() => ({ data: { data: [], meta: { total: 0 } } })),
    ]).then(([liveRes, schedRes, depositRes]) => {
      const combined = [...liveRes.data.data, ...schedRes.data.data].slice(0, 3);
      setActiveAuctions(combined);
      setStats((s) => ({ ...s, auctions: liveRes.data.meta.total + schedRes.data.meta.total + depositRes.data.meta.total }));
    });
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/parcels?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <main className="bg-[var(--background)]">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-brand-950">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-400/8 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-xs font-medium text-brand-300 tracking-wide">Türkiye'nin Güvenilir Arsa Platformu</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight">
              Güvenilir Arsa Satış ve{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-brand-500">
                Açık Artırma
              </span>{' '}
              Platformu
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Türkiye genelinde binlerce doğrulanmış arsa ilanı arasından size uygun olanı bulun, canlı açık artırmalara katılın.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="mx-auto mt-10 max-w-2xl">
              <div className="relative flex items-center rounded-2xl bg-white/[0.07] border border-white/10 backdrop-blur-md p-1.5 shadow-2xl shadow-black/20 focus-within:border-brand-500/50 transition-colors duration-200">
                <Search className="ml-4 h-5 w-5 text-gray-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Şehir, ilçe veya arsa adı ile arayın..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-3.5 text-sm text-white placeholder-gray-500 outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-brand-500 hover:bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 cursor-pointer active:scale-[0.98]"
                >
                  Arsa Ara
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {['İstanbul', 'Antalya', 'Muğla', 'Mersin', 'Bursa'].map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => router.push(`/parcels?city=${city}`)}
                    className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-150 cursor-pointer"
                  >
                    <MapPin className="inline h-3 w-3 mr-1 -mt-0.5" />
                    {city}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="relative -mt-8 z-10 mx-auto max-w-4xl px-4">
        <div className="grid grid-cols-3 gap-px rounded-2xl bg-white border border-gray-200/80 shadow-xl shadow-gray-200/50 overflow-hidden">
          {[
            { value: `${stats.parcels}`, label: 'Aktif İlan', icon: Building2, color: 'text-brand-500' },
            { value: `${stats.auctions}`, label: 'Açık Artırma', icon: Gavel, color: 'text-amber-500' },
            { value: `${stats.cities}`, label: 'Farklı İl', icon: MapPin, color: 'text-blue-500' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`flex items-center justify-center gap-4 px-6 py-6 bg-white ${i > 0 ? 'border-l border-gray-100' : ''}`}>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 tracking-tight">{stat.value}</p>
                  <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Featured Parcels ─── */}
      {featuredParcels.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-20 pb-12">
          <SectionHeader
            title="Öne Çıkan Arsalar"
            subtitle="Editör seçimi premium arsa ilanları"
            href="/parcels?isFeatured=true"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredParcels.map((parcel) => (
              <ParcelCard key={parcel.id} parcel={parcel} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Active Auctions ─── */}
      {activeAuctions.length > 0 && (
        <section className="bg-gray-50/80">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Açık Artırmalar</h2>
                  <span className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    Canlı
                  </span>
                </div>
                <p className="text-sm text-gray-500">Gerçek zamanlı teklif verin, en iyi fiyatı yakalayın</p>
              </div>
              <Link href="/auctions" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-150 cursor-pointer">
                Tümünü Gör <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {activeAuctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Latest Parcels ─── */}
      {(() => {
        const featuredIds = new Set(featuredParcels.map((p) => p.id));
        const uniqueLatest = latestParcels.filter((p) => !featuredIds.has(p.id));
        if (uniqueLatest.length === 0) return null;
        return (
          <section className="mx-auto max-w-6xl px-4 py-16">
            <SectionHeader
              title="Son Eklenen Arsalar"
              subtitle="En yeni eklenen arsa ilanları"
              href="/parcels?sortBy=createdAt&sortOrder=DESC"
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {uniqueLatest.map((parcel) => (
                <ParcelCard key={parcel.id} parcel={parcel} />
              ))}
            </div>
          </section>
        );
      })()}

      {/* ─── Turkey Map ─── */}
      <section className="bg-gray-50/80">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Türkiye Geneli Arsalar</h2>
            <p className="mt-2 text-sm text-gray-500">Bir ile tıklayarak o ildeki arsaları görüntüleyin</p>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 sm:p-10 shadow-sm">
            <TurkeyMap onProvinceClick={(province) => router.push(`/parcels?city=${encodeURIComponent(province)}`)} />
          </div>
        </div>
      </section>

      {/* ─── Interactive Map ─── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeader
          title="Haritada Keşfet"
          subtitle="Tüm arsaları harita üzerinde görüntüleyin"
          href="/parcels?view=map"
          linkText="Tam Ekran Harita"
        />
        <div className="rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
          <ParcelMapLazy
            parcels={[...featuredParcels, ...latestParcels].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)}
            height="400px"
          />
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="bg-gray-50/80">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Nasıl Çalışır?</h2>
            <p className="mt-2 text-sm text-gray-500">3 basit adımda hayalinizdeki arsaya sahip olun</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { step: '01', icon: Search, title: 'Arsa Bulun', desc: 'Harita veya liste üzerinden size uygun arsayı keşfedin.', color: 'bg-brand-50 text-brand-600' },
              { step: '02', icon: Gavel, title: 'Teklif Verin', desc: 'Doğrudan satın alın veya canlı açık artırmaya katılın.', color: 'bg-amber-50 text-amber-600' },
              { step: '03', icon: Shield, title: 'Tapunuzu Alın', desc: 'Güvenli ödeme sonrası tapu işlemlerinizi tamamlayın.', color: 'bg-blue-50 text-blue-600' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="group relative rounded-2xl border border-gray-200/80 bg-white p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default">
                  <div className="absolute top-5 right-5 text-4xl font-black text-gray-100 select-none">{item.step}</div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Trust Badges ─── */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Lock, label: 'SSL Güvenlik', desc: '256-bit şifreleme', color: 'text-brand-500 bg-brand-50' },
            { icon: Scale, label: 'Yasal Uyumluluk', desc: 'KVKK ve mevzuat', color: 'text-indigo-500 bg-indigo-50' },
            { icon: Shield, label: 'Güvenli Ödeme', desc: '3D Secure ile', color: 'text-amber-500 bg-amber-50' },
            { icon: Headphones, label: '7/24 Destek', desc: 'Canlı müşteri hizmeti', color: 'text-blue-500 bg-blue-50' },
          ].map((badge) => {
            const Icon = badge.icon;
            return (
              <div key={badge.label} className="flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-4 hover:shadow-sm transition-shadow duration-200">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${badge.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{badge.label}</p>
                  <p className="text-xs text-gray-500">{badge.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Video ─── */}
      {siteSettings.intro_video_url && (
        <section className="bg-gray-50/80">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">NetTapu Nasıl Çalışır?</h2>
            <p className="mt-2 text-sm text-gray-500">Platformumuzu tanıtan kısa videomuzu izleyin</p>
            <button
              onClick={() => setShowVideo(true)}
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-gray-900 hover:bg-gray-800 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-gray-900/20 transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500">
                <Play className="h-4 w-4 text-white ml-0.5" fill="currentColor" />
              </div>
              Tanıtım Videosunu İzle
            </button>
          </div>
        </section>
      )}

      {showVideo && siteSettings.intro_video_url && (
        <VideoPopup videoUrl={siteSettings.intro_video_url} onClose={() => setShowVideo(false)} />
      )}

      {/* ─── Testimonials ─── */}
      {testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Müşterilerimiz Ne Diyor?</h2>
            <p className="mt-2 text-sm text-gray-500">Memnun müşterilerimizden yorumlar</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.id} className="rounded-2xl border border-gray-200/80 bg-white p-6 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-0.5 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 text-amber-400" fill="currentColor" />
                  ))}
                </div>
                {t.description && (
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">&ldquo;{t.description}&rdquo;</p>
                )}
                <div className="mt-5 flex items-center gap-3 pt-4 border-t border-gray-100">
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt={t.title} className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-100" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 font-bold text-sm ring-2 ring-brand-100">
                      {t.title.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                    {t.websiteUrl && <p className="text-xs text-gray-400">{t.websiteUrl}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/references" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-150 cursor-pointer">
              Tüm Referanslarımızı Görün <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ─── CTA ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-brand-950">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />

        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Hayalinizdeki Arsayı{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-brand-500">Şimdi Bulun</span>
          </h2>
          <p className="mt-3 text-gray-400">Binlerce doğrulanmış arsa arasından size en uygun olanı keşfedin.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/parcels"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              Arsaları İncele <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 cursor-pointer"
            >
              Ücretsiz Üye Ol
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ─── Section Header Component ─── */
function SectionHeader({
  title,
  subtitle,
  href,
  linkText = 'Tümünü Gör',
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-150 cursor-pointer"
        >
          {linkText} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/* ─── Auction Card ─── */
function AuctionCard({ auction }: { auction: Auction }) {
  const statusMap: Record<string, { color: string; bg: string; label: string; icon: typeof Zap }> = {
    live: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', label: 'Canlı', icon: Zap },
    ending: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', label: 'Bitiyor', icon: Timer },
    scheduled: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', label: 'Yaklaşan', icon: Timer },
  };
  const st = statusMap[auction.status] || { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-100', label: auction.status, icon: Gavel };
  const Icon = st.icon;

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group block rounded-2xl border border-gray-200/80 bg-white p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${st.bg} ${st.color}`}>
          <Icon className="h-3 w-3" />
          {st.label}
        </span>
      </div>
      <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-brand-600 transition-colors duration-150">
        {auction.title || 'Açık Artırma'}
      </h3>
      <div className="mt-5 space-y-2.5">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-gray-500">Güncel Fiyat</span>
          <span className="text-xl font-bold text-brand-600 tracking-tight">{formatPrice(auction.currentPrice)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Başlangıç</span>
          <span className="text-gray-600 font-medium">{formatPrice(auction.startingPrice)}</span>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4 text-xs text-gray-400 pt-4 border-t border-gray-100">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{auction.participantCount} katılımcı</span>
        <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />{auction.bidCount} teklif</span>
      </div>
    </Link>
  );
}

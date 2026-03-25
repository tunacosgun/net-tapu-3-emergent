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
  Zap, Timer, Sparkles, Activity
} from 'lucide-react';
import type { Parcel, Auction, PaginatedResponse, Reference } from '@/types';

const ParcelMapLazy = dynamic(() => import('@/components/parcel-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex xl:h-[500px] h-[400px] items-center justify-center bg-[#0a0f1a] rounded-3xl border border-white/5 shadow-2xl">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500/20 border-t-brand-500" />
        <span className="text-sm font-medium tracking-wide text-brand-500/70 uppercase">Dünya Haritası Yükleniyor</span>
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

    apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { limit: 100, status: 'active' } })
      .then(({ data }) => {
        const cities = new Set(data.data.map((p) => p.city).filter(Boolean));
        setStats((s) => ({ ...s, cities: cities.size }));
      }).catch(() => {});

    apiClient.get<Reference[]>('/content/references')
      .then(({ data }) => setTestimonials(data.filter((r) => r.referenceType === 'testimonial').slice(0, 4)))
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
    <main className="bg-[#030712] text-white selection:bg-brand-500/30 font-sans mt-[-80px] pt-[80px]">
      {/* ─── ULTRA-PREMIUM HERO ─── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-600/10 rounded-full blur-[120px] mix-blend-screen opacity-60 translate-x-1/3 -translate-y-1/4 animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen opacity-50 -translate-x-1/3 translate-y-1/3 animate-pulse" style={{ animationDuration: '12s' }} />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030712]/50 to-[#030712]" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 flex flex-col items-center justify-center text-center mt-20">
          {/* Badge */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 hover:bg-white/10 transition-colors cursor-pointer group">
              <Sparkles className="w-4 h-4 text-brand-400 group-hover:text-brand-300 transition-colors" />
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors tracking-wide">
                Türkiye'nin Ekosistem Lideri Gayrimenkul Platformu
              </span>
            </div>
          </div>

          {/* Epic Headline */}
          <h1 className="animate-fade-in-up animation-delay-100 max-w-5xl mx-auto text-6xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-white leading-[1.05] mb-8">
            Geleceğinize{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-brand-300 origin-bottom via-brand-500 to-emerald-700">
               Değer Katın
            </span>
          </h1>
          
          <p className="animate-fade-in-up animation-delay-200 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 font-light leading-relaxed mb-12 tracking-wide">
            Şeffaf, güvenilir ve tamamen dijital arsa yatırımı. 
            Canlı müzayedelerde yerinizi alın, saniyeler içinde kazanın.
          </p>

          {/* Glass Search Bar */}
          <form onSubmit={handleSearch} className="animate-fade-in-up animation-delay-300 w-full max-w-2xl mx-auto relative z-20">
            <div className="relative p-[1px] rounded-[32px] bg-gradient-to-b from-white/20 to-white/5 hover:from-brand-500/40 hover:to-brand-500/5 transition-all duration-700 shadow-[0_0_40px_rgba(36,168,106,0.15)] group">
              <div className="relative flex items-center bg-[#0a0f1a]/80 backdrop-blur-3xl rounded-[31px] p-2 pl-6 overflow-hidden">
                <Search className="h-6 w-6 text-gray-400 group-focus-within:text-brand-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Şehir, ilçe veya ilan statüsü arayın..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent px-5 py-4 text-white text-lg placeholder-gray-500 outline-none w-full font-light tracking-wide"
                />
                <button
                  type="submit"
                  className="relative shrink-0 overflow-hidden rounded-[22px] bg-white text-black px-8 py-4 text-base font-bold transition-all duration-300 hover:scale-[0.98] active:scale-95"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Ara <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>

            {/* Micro Tags */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="text-xs tracking-widest text-gray-500 font-semibold uppercase mr-2">Trend:</span>
              {['İstanbul', 'İzmir', 'Arsa', 'Tarla'].map((tag, idx) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => router.push(`/parcels?search=${tag}`)}
                  className="px-4 py-1.5 rounded-full border border-white/5 bg-white/5 backdrop-blur-md text-xs font-medium text-gray-400 transition-all hover:bg-white/10 hover:text-white"
                >
                  {tag}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* ─── VERCEL STYLE BENTO STATS ─── */}
      <section className="relative z-20 mx-auto max-w-7xl px-6 sm:px-8 mt-[-60px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { value: `${stats.parcels}+`, label: 'Aktif Premium İlan', icon: Building2, desc: 'Doğrulanmış ve değerlemesi yapılmış eşsiz parseller.' },
            { value: `${stats.auctions}`, label: 'Canlı Müzayede', icon: Activity, desc: 'Gerçek zamanlı açık artırmalar ile heyecana ortak olun.' },
            { value: `${stats.cities}`, label: 'Farklı Lokasyon', icon: MapPin, desc: 'Türkiye nin dört bir yanından stratejik yatırım noktaları.' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 p-8 backdrop-blur-xl hover:bg-white/[0.08] transition-all duration-500 flex flex-col justify-between h-[220px]">
                <div className="absolute top-0 right-0 -m-8 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition-all duration-700" />
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-brand-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-gray-400 tracking-wide">{stat.label}</span>
                  </div>
                  <h3 className="text-5xl font-black text-white tracking-tighter mb-2">{stat.value}</h3>
                </div>
                <p className="text-sm text-gray-500 font-light leading-relaxed">{stat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── LIVE AUCTIONS (Neon Mode) ─── */}
      {activeAuctions.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 sm:px-8 py-32 border-b border-white/5">
          <SectionHeader
            title="Sıcak Müzayedeler"
            subtitle="Şu anda aktif olan ve yakında kapanacak fırsatlar."
            href="/auctions"
            liveBadge
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeAuctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        </section>
      )}

      {/* ─── SHOWCASE (Bento Grids Variant) ─── */}
      {featuredParcels.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 sm:px-8 py-32">
          <SectionHeader
            title="Premium Koleksiyon"
            subtitle="NetTapu yatırım uzmanları tarafından özenle seçilmiş elit arsalar."
            href="/parcels?isFeatured=true"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
            {featuredParcels.map((parcel) => (
              <div key={parcel.id} className="relative group rounded-3xl overflow-hidden bg-[#0a0f1a] border border-white/10 hover:border-brand-500/50 transition-all duration-500">
                <ParcelCard parcel={parcel} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── INTERACTIVE MAP ─── */}
      <section className="relative mx-auto max-w-7xl px-6 sm:px-8 py-32">
        <div className="absolute inset-0 bg-brand-500/5 blur-[120px] rounded-full pointer-events-none" />
        <SectionHeader
          title="Keşif Haritası"
          subtitle="Gelişmiş uydu verileri ile parselleri noktasal olarak inceleyin."
          href="/parcels?view=map"
          linkText="Tam Ekranda Keşfet"
        />
        <div className="relative rounded-[2.5rem] p-[2px] bg-gradient-to-b from-white/15 to-white/5 overflow-hidden shadow-2xl">
          <div className="bg-[#030712] rounded-[2.4rem] overflow-hidden">
            <ParcelMapLazy
              parcels={[...featuredParcels, ...latestParcels]}
              height="600px"
            />
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS (Timeline Core) ─── */}
      <section className="bg-[#0a0f1a] border-y border-white/5 py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-6">Sistemin <span className="text-brand-400">DNA'sı</span></h2>
          <p className="text-gray-400 text-lg sm:text-xl font-light max-w-2xl mx-auto">
            Karmaşık bürokrasiyi tek bir platformda erittik. NetTapu ile yatırım yapmak bir e-ticaret sitesinden alışveriş yapmak kadar kolay.
          </p>
        </div>
        
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-[40px] left-12 right-12 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            {[
              { step: '01', icon: Search, title: 'Keşfet & Analiz Et', desc: 'AI destekli değerleme algoritmalarımızla en kazançlı bölgeyi saniyeler içinde belirle.' },
              { step: '02', icon: Gavel, title: 'Akıllı Teklif', desc: 'Canlı müzayedelerde rekabet et veya sistemin önerdiği en iyi fiyatla hemen satın al.' },
              { step: '03', icon: Shield, title: 'Güvenli Transfer', desc: 'E-Devlet altyapısı ve banka entegrasyonu ile paranız ve tapunuz %100 güvende.' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left group">
                  <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#030712] border border-white/10 group-hover:border-brand-500/50 group-hover:bg-brand-500/10 transition-all duration-500 shadow-2xl">
                    <Icon className="h-8 w-8 text-white group-hover:text-brand-400 transition-colors" />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-4xl font-black text-white/5">{item.step}</span>
                    <h3 className="text-2xl font-bold text-white tracking-tight">{item.title}</h3>
                  </div>
                  <p className="text-gray-400 font-light leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── TRUST & SECURITY ─── */}
      <section className="mx-auto max-w-7xl px-6 sm:px-8 py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Lock, label: 'Banka Güvencesi' },
            { icon: Scale, label: 'Hukuki Şeffaflık' },
            { icon: Shield, label: 'Uçtan Uca Şifreleme' },
            { icon: Headphones, label: 'VIP Destek' },
          ].map((b) => (
            <div key={b.label} className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <b.icon className="h-8 w-8 text-gray-500" />
              <span className="text-sm font-medium text-gray-400">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── EPIC FOOTER CTA ─── */}
      <section className="relative overflow-hidden py-32 mt-12 bg-[#06080F]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-12 bg-brand-500/20 blur-[50px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-5xl sm:text-7xl font-black text-white tracking-tighter mb-8 leading-tight">
            Yatırımın Yeni <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-500 to-emerald-600">
               Altın Standardı.
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-xl text-gray-400 font-light mb-12">
            NetTapu ile dijital emlak devrimine katılın. Ücretsiz hesabınızı oluşturun, premium fırsatların kapısını aralayın.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              href="/register"
              className="w-full sm:w-auto rounded-full bg-white text-black px-12 py-5 text-lg font-bold transition-all duration-300 hover:scale-[0.98] active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2"
            >
              Hemen Başla <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/parcels"
              className="w-full sm:w-auto rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-12 py-5 text-lg font-medium text-white transition-all duration-300 hover:bg-white/10"
            >
              Vitrine Göz At
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ─── INTERNAL COMPONENTS ─── */
function SectionHeader({ title, subtitle, href, linkText = 'Tüm Koleksiyonu İncele', liveBadge }: any) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
      <div>
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-4xl font-black text-white tracking-tighter">{title}</h2>
          {liveBadge && (
            <span className="flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-500 tracking-wider uppercase">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              Canlı Akış
            </span>
          )}
        </div>
        {subtitle && <p className="text-lg text-gray-400 font-light max-w-xl">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-2 text-sm font-semibold text-brand-400 hover:text-white transition-colors"
        >
          {linkText} 
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/10 group-hover:bg-brand-500 group-hover:text-white transition-all">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}
    </div>
  );
}

function AuctionCard({ auction }: { auction: Auction }) {
  const isLive = auction.status === 'live';
  
  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group relative block rounded-3xl bg-white/5 border border-white/10 p-6 hover:bg-white/[0.08] hover:border-brand-500/50 transition-all duration-500"
    >
      <div className="flex items-center gap-3 mb-6">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${isLive ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>
          <Zap className="h-3 w-3" />
          {isLive ? 'Sıcak İhale' : 'Yaklaşan İhale'}
        </span>
      </div>
      <h3 className="text-xl font-bold text-white line-clamp-2 mb-8 group-hover:text-brand-300 transition-colors">
        {auction.title || 'Premium Arsa Arazisi'}
      </h3>
      
      <div className="bg-[#030712] rounded-2xl p-5 border border-white/5 mb-6">
        <div className="flex justify-between items-end">
          <span className="text-sm text-gray-500 font-medium tracking-wide">Güncel Teklif</span>
          <span className="text-3xl font-black text-white tracking-tighter">
            {formatPrice(auction.currentPrice)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400 font-medium">
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          {auction.participantCount} Yatırımcı
        </span>
        <span className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-500" />
          {auction.bidCount} Tur
        </span>
      </div>
    </Link>
  );
}

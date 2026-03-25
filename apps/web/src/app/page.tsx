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
      {/* ─── Premium Hero Section ─── */}
      <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden bg-[#030712]">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-brand-600/20 blur-[140px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/15 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
          <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-indigo-500/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_40%,#000_20%,transparent_100%)]" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center mt-12">
          {/* Glowing Badge */}
          <div className="animate-fadeInDown mb-8">
            <div className="relative inline-flex group cursor-pointer">
              <div className="absolute transition-all duration-1000 opacity-50 -inset-px bg-gradient-to-r from-brand-500 via-blue-500 to-indigo-500 rounded-full blur-sm group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-tilt"></div>
              <div className="relative inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white transition-all duration-200 bg-[#030712] rounded-full ring-1 ring-white/10 group-hover:ring-white/20">
                <span className="flex h-2 w-2 rounded-full bg-brand-400 animate-pulse shadow-[0_0_8px_rgba(36,168,106,1)]" />
                Türkiye'nin Yeni Nesil Arsa Platformu
              </div>
            </div>
          </div>

          {/* Hyper-Modern Headline */}
          <h1 className="animate-fadeInUp max-w-5xl mx-auto text-5xl sm:text-7xl lg:text-[5.5rem] font-black tracking-tight text-white leading-[1.05] drop-shadow-2xl mb-8">
            Geleceğinize <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-500 to-emerald-400 filter drop-shadow-[0_0_20px_rgba(36,168,106,0.5)]">
               Değer Katın
            </span>
          </h1>
          
          <p className="animate-fadeInUp animation-delay-200 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400/90 font-light leading-relaxed mb-12">
            Güvenilir, şeffaf ve dijital onaylı arsa satın alma deneyimi. 
            Canlı müzayedelerde yerinizi alın, en iyi yatırımı saniyeler içinde gerçekleştirin.
          </p>

          {/* Glassmorphism Premium Search */}
          <form onSubmit={handleSearch} className="animate-fadeInUp animation-delay-400 w-full max-w-3xl mx-auto relative z-20">
            <div className="group relative p-[2px] rounded-3xl bg-gradient-to-b from-white/10 to-white/5 hover:from-brand-500/40 hover:to-blue-500/30 transition-all duration-500 shadow-2xl">
              <div className="relative flex items-center bg-[#0a0f1a]/80 backdrop-blur-2xl rounded-[22px] p-2 overflow-hidden border border-white/5">
                <Search className="ml-5 h-6 w-6 text-gray-400 group-hover:text-brand-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Şehir, ilçe, proje veya ilan no arayın..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent px-5 py-4 text-white text-lg placeholder-gray-500 outline-none w-full"
                />
                <button
                  type="submit"
                  className="relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-8 py-4 text-base font-semibold text-white shadow-[0_0_20px_rgba(36,168,106,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(36,168,106,0.6)] active:scale-95"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Ara <ArrowRight className="h-4 w-4" />
                  </span>
                  <div className="absolute inset-0 h-full w-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out" />
                </button>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-gray-500 font-medium mr-2">Popüler Aramalar:</span>
              {['İstanbul', 'İzmir', 'Antalya', 'Muğla', 'Ankara'].map((city, idx) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => router.push(`/parcels?city=${city}`)}
                  className="relative px-4 py-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-sm font-medium text-gray-300 transition-all duration-300 hover:bg-white/10 hover:text-white hover:border-brand-500/50 hover:shadow-[0_0_15px_rgba(36,168,106,0.2)]"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <MapPin className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5 opacity-70" />
                  {city}
                </button>
              ))}
            </div>
          </form>
        </div>
        
        {/* Bottom Fade */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none" />
      </section>

      {/* ─── Premium Stats Bar ─── */}
      <section className="relative -mt-16 z-20 mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 rounded-3xl bg-white/70 dark:bg-[#0a0f1a]/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] overflow-hidden">
          {[
            { value: `${stats.parcels}+`, label: 'Aktif İlan', icon: Building2, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-500/10' },
            { value: `${stats.auctions}`, label: 'Canlı Müzayede', icon: Gavel, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
            { value: `${stats.cities}`, label: 'Farklı İl', icon: MapPin, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`group relative flex items-center justify-center gap-5 px-8 py-8 transition-colors hover:bg-white/90 dark:hover:bg-white/5 ${i > 0 ? 'sm:border-l border-gray-100 dark:border-white/10 border-t sm:border-t-0' : ''}`}>
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${stat.bg} ${stat.color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mt-1">{stat.label}</p>
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

      {/* ─── Premium How It Works ─── */}
      <section className="relative py-24 overflow-hidden bg-white dark:bg-[#030712]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="text-center mb-16">
            <span className="text-brand-500 font-semibold tracking-wider uppercase text-sm mb-3 block">Kolay ve Güvenli</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">Nasıl Çalışır?</h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">Sadece 3 basit adımda hayalinizdeki yatırıma giden güvenli yolculuk.</p>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-3 relative before:absolute before:inset-0 sm:before:top-1/2 sm:before:h-0.5 sm:before:-translate-y-1/2 before:bg-gradient-to-r before:from-transparent before:via-gray-200 dark:before:via-gray-800 before:to-transparent">
            {[
              { step: '01', icon: Search, title: 'Arsa Bulun', desc: 'Gelişmiş harita ve filtreler üzerinden size en uygun lokasyonu ve arsayı anında keşfedin.', color: 'from-blue-500 to-cyan-400', shadow: 'shadow-blue-500/20' },
              { step: '02', icon: Gavel, title: 'Teklif Verin', desc: 'Doğrulanmış ilanlara hemen teklif verin veya eşzamanlı canlı açık artırma heyecanına ortak olun.', color: 'from-amber-500 to-orange-400', shadow: 'shadow-amber-500/20' },
              { step: '03', icon: Shield, title: 'Tapunuzu Alın', desc: 'Banka onaylı güvenli cüzdan ve resmi entegrasyonlar sayesinde tapu devir işlemlerinizi hızla tamamlayın.', color: 'from-brand-600 to-brand-400', shadow: 'shadow-brand-500/20' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="group relative z-10 rounded-[2rem] bg-white dark:bg-[#0a0f1a] p-8 md:p-10 border border-gray-100 dark:border-white/5 hover:border-brand-500/30 shadow-xl shadow-gray-200/40 dark:shadow-[0_8px_30px_rgb(0,0,0,0.6)] hover:-translate-y-2 transition-all duration-500 cursor-default">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-gray-50 to-white dark:from-white/5 dark:to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="absolute top-6 right-8 text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-gray-100 to-transparent dark:from-white/5 select-none">{item.step}</div>
                  
                  <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} shadow-lg ${item.shadow} mb-8 group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  
                  <h3 className="relative text-xl font-bold text-gray-900 dark:text-white mb-3">{item.title}</h3>
                  <p className="relative text-gray-500 dark:text-gray-400 leading-relaxed font-light">{item.desc}</p>
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

      {/* ─── Premium CTA ─── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-[#030712]" />
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#24a86a33_100%)] rounded-full blur-[80px] animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay" />
          <div className="absolute inset-0 bg-[#030712]/60 backdrop-blur-[2px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight mb-6">
            Geleceğin Yatırımına{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-brand-500">Bugün Başlayın</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg sm:text-xl text-gray-400 font-light leading-relaxed mb-10">
            Binlerce doğrulanmış arsa ve güvenilir müzayedeler sizi bekliyor. Hemen ücretsiz üye olun, fırsatları kaçırmayın.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/parcels"
              className="group relative flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-10 py-5 text-base font-bold text-white shadow-[0_0_30px_rgba(36,168,106,0.5)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_50px_rgba(36,168,106,0.7)] active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 h-full w-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out" />
              <span className="relative z-10 flex items-center gap-2">Arsaları Keşfet <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" /></span>
            </Link>
            <Link
              href="/register"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-10 py-5 text-base font-bold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:border-white/30 cursor-pointer"
            >
              Hemen Üye Ol
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

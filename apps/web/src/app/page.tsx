'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { TurkeyMap } from '@/components/turkey-map';
import { VideoPopup } from '@/components/video-popup';
import { ParcelCard } from '@/components/parcel-card';
import type { Parcel, Auction, PaginatedResponse, Reference } from '@/types';

const ParcelMapLazy = dynamic(() => import('@/components/parcel-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[450px] items-center justify-center rounded-xl bg-[var(--muted)]">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <span className="text-sm text-[var(--muted-foreground)]">Harita yükleniyor...</span>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const router = useRouter();
  const [featuredParcels, setFeaturedParcels] = useState<Parcel[]>([]);
  const [latestParcels, setLatestParcels] = useState<Parcel[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [stats, setStats] = useState({ parcels: 0, auctions: 0, cities: 0 });
  const [testimonials, setTestimonials] = useState<Reference[]>([]);
  const [showVideo, setShowVideo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    apiClient
      .get<PaginatedResponse<Parcel>>('/parcels', {
        params: { isFeatured: true, limit: 6, status: 'active' },
      })
      .then(({ data }) => setFeaturedParcels(data.data))
      .catch(() => {});

    apiClient
      .get<PaginatedResponse<Parcel>>('/parcels', {
        params: { limit: 6, sortBy: 'createdAt', sortOrder: 'DESC', status: 'active' },
      })
      .then(({ data }) => {
        setLatestParcels(data.data);
        setStats((s) => ({ ...s, parcels: data.meta.total }));
        const cities = new Set(data.data.map((p) => p.city));
        setStats((s) => ({ ...s, cities: Math.max(cities.size, s.cities) }));
      })
      .catch(() => {});

    Promise.all([
      apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 3, status: 'live' } }).catch(() => ({ data: { data: [], meta: { total: 0 } } })),
      apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 3, status: 'scheduled' } }).catch(() => ({ data: { data: [], meta: { total: 0 } } })),
    ]).then(([liveRes, schedRes]) => {
      const combined = [...liveRes.data.data, ...schedRes.data.data].slice(0, 3);
      setActiveAuctions(combined);
      setStats((s) => ({ ...s, auctions: liveRes.data.meta.total + schedRes.data.meta.total }));
    });

    apiClient
      .get<Reference[]>('/content/references')
      .then(({ data }) => {
        setTestimonials(data.filter((r) => r.referenceType === 'testimonial').slice(0, 6));
      })
      .catch(() => {});
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/parcels?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <main>
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center">
        {/* Background */}
        <div className="absolute inset-0 bg-[#070f1e]" />
        {/* Animated gradient mesh */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-500/15 rounded-full blur-[150px] animate-float" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[130px] animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] bg-blue-500/8 rounded-full blur-[100px] animate-float" style={{ animationDelay: '3s' }} />
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' fill=\'white\'/%3E%3C/svg%3E")' }} />
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white via-white/80 to-transparent" />
        {/* Decorative lines */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        <div className="relative w-full mx-auto max-w-7xl px-4 py-24 sm:py-32 lg:py-0">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="animate-fadeInDown inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl px-5 py-2.5 mb-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[13px] font-medium text-white/70 tracking-wide">Canlı Açık Artırmalar Devam Ediyor</span>
              <Link href="/auctions" className="text-[13px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors ml-1">
                İncele →
              </Link>
            </div>

            {/* Main heading */}
            <h1 className="animate-fadeInUp text-[42px] sm:text-[56px] lg:text-[72px] font-extrabold tracking-[-0.03em] text-white leading-[1.05]">
              Hayalinizdeki Arsayı
              <br />
              <span className="relative">
                <span className="bg-gradient-to-r from-brand-400 via-emerald-400 to-brand-300 bg-clip-text text-transparent">NetTapu</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 8C50 2 100 2 150 6C200 10 250 4 298 8" stroke="url(#hero-underline)" strokeWidth="3" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="hero-underline" x1="0" y1="0" x2="300" y2="0">
                      <stop stopColor="#4ade80" stopOpacity="0" />
                      <stop offset="0.3" stopColor="#4ade80" stopOpacity="0.6" />
                      <stop offset="0.7" stopColor="#34d399" stopOpacity="0.6" />
                      <stop offset="1" stopColor="#34d399" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              &apos;da Bulun
            </h1>

            <p className="animate-fadeInUp mt-7 text-[17px] sm:text-lg text-white/45 max-w-lg mx-auto leading-relaxed font-light" style={{ animationDelay: '100ms' }}>
              Türkiye&apos;nin en güvenilir gayrimenkul ve arsa açık artırma
              platformu. Şeffaf süreç, güvenli ödeme.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="animate-fadeInUp mx-auto mt-12 max-w-2xl" style={{ animationDelay: '200ms' }}>
              <div className="group relative flex overflow-hidden rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/30 focus-within:bg-white focus-within:border-white/80 focus-within:shadow-brand-500/10 transition-all duration-500">
                <div className="flex items-center pl-6 text-white/30 group-focus-within:text-gray-400 transition-colors duration-500">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Şehir, ilçe veya arsa adı ile arayın..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-5 text-[15px] text-white outline-none placeholder:text-white/30 focus:text-gray-900 focus:placeholder:text-gray-400 transition-colors duration-500"
                />
                <button
                  type="submit"
                  className="btn-shine m-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-3 text-sm font-bold text-white hover:from-brand-600 hover:to-brand-700 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-lg shadow-brand-500/30"
                >
                  Ara
                </button>
              </div>
              {/* Popular searches */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-white/25">Popüler:</span>
                {['Antalya', 'Muğla', 'Mersin', 'Bursa'].map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => router.push(`/parcels?city=${city}`)}
                    className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-300"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </form>

            {/* CTA Buttons */}
            <div className="animate-fadeInUp mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center" style={{ animationDelay: '300ms' }}>
              <Link
                href="/parcels"
                className="btn-shine group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-[15px] font-bold text-gray-900 shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                Arsaları Keşfet
                <svg className="h-4 w-4 text-brand-500 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link
                href="/auctions"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] backdrop-blur-sm px-8 py-4 text-[15px] font-semibold text-white/80 hover:bg-white/[0.06] hover:border-white/[0.2] hover:text-white transition-all duration-300"
              >
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                </svg>
                Açık Artırmalar
              </Link>
              <button
                onClick={() => setShowVideo(true)}
                className="group inline-flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-[15px] font-semibold text-white/50 hover:text-white/80 transition-all duration-300"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/10 group-hover:bg-white/15 group-hover:scale-110 transition-all duration-300">
                  <svg className="h-3.5 w-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                Tanıtım Videosu
              </button>
            </div>

            {/* Trust line */}
            <div className="animate-fadeInUp mt-16 flex items-center justify-center gap-8 opacity-0" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
              <div className="flex items-center gap-2 text-white/20">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span className="text-xs font-medium">SSL Korumalı</span>
              </div>
              <div className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-white/20">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <span className="text-xs font-medium">3D Secure Ödeme</span>
              </div>
              <div className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-white/20">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="text-xs font-medium">KVKK Uyumlu</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Counter ─── */}
      <section className="mx-auto max-w-6xl px-4 -mt-14 relative z-10">
        <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-2xl bg-white shadow-2xl shadow-gray-200/60 border border-gray-100/80">
          {[
            { value: `${stats.parcels}+`, label: 'Aktif İlan', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z', color: 'text-brand-500 bg-brand-50' },
            { value: `${stats.auctions}`, label: 'Canlı Açık Artırma', icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z', color: 'text-emerald-500 bg-emerald-50' },
            { value: `${stats.cities}+`, label: 'Farklı İl', icon: 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z', color: 'text-blue-500 bg-blue-50' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-4 px-6 sm:px-10 py-7 sm:py-8">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.color}`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                </svg>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{stat.value}</p>
                <p className="text-xs sm:text-sm font-medium text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Featured Parcels ─── */}
      {featuredParcels.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Seçilmiş Fırsatlar</span>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Öne Çıkan Arsalar</h2>
            </div>
            <Link
              href="/parcels?isFeatured=true"
              className="hidden sm:flex items-center gap-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted-foreground)] hover:text-brand-500 hover:border-brand-300 transition-all"
            >
              Tümünü Gör
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
          <div className="stagger-children grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredParcels.map((parcel) => (
              <ParcelCard key={parcel.id} parcel={parcel} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Active Auctions ─── */}
      {activeAuctions.length > 0 && (
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M20 20.5V18H0v-2h20v-2l2 3-2 3z\' fill=\'%23fff\' fill-opacity=\'1\'/%3E%3C/svg%3E")' }} />
          <div className="relative mx-auto max-w-7xl px-4">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Canlı
                </span>
                <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Açık Artırmalar</h2>
              </div>
              <Link
                href="/auctions"
                className="hidden sm:flex items-center gap-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 hover:text-white hover:border-white/40 transition-all"
              >
                Tümünü Gör
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeAuctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Latest Parcels ─── */}
      {latestParcels.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Yeni Eklenenler</span>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Son Eklenen Arsalar</h2>
            </div>
            <Link
              href="/parcels?sortBy=createdAt&sortOrder=DESC"
              className="hidden sm:flex items-center gap-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted-foreground)] hover:text-brand-500 hover:border-brand-300 transition-all"
            >
              Tümünü Gör
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestParcels.map((parcel) => (
              <ParcelCard key={parcel.id} parcel={parcel} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Map Section ─── */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/50 via-brand-50/30 to-[var(--background)]" />
        <div className="relative mx-auto max-w-5xl px-4">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Harita</span>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">
              Türkiye Geneli Arsalar
            </h2>
            <p className="mt-3 text-[var(--muted-foreground)] max-w-md mx-auto">
              Bir ile tıklayarak o ildeki arsaları görüntüleyin.
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white p-6 sm:p-10 shadow-xl shadow-gray-200/30">
            <TurkeyMap
              onProvinceClick={(province) => {
                router.push(`/parcels?city=${encodeURIComponent(province)}`);
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── Interactive Map Section ─── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Keşfet</span>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Haritada Arsaları Keşfedin</h2>
          <p className="mt-3 text-[var(--muted-foreground)] max-w-md mx-auto">
            Tüm arsaları harita üzerinde görüntüleyin, yakınlaştırın ve detaylara ulaşın.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white shadow-xl overflow-hidden">
          {/* Map */}
          <ParcelMapLazy
            parcels={[...featuredParcels, ...latestParcels].filter(
              (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
            )}
            height="500px"
            onParcelClick={(parcel) => router.push(`/parcels/${parcel.id}`)}
          />
          {/* Quick Filters */}
          <div className="border-t border-[var(--border)] bg-[var(--muted)] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-[var(--muted-foreground)]">Satışta</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-[var(--muted-foreground)]">Kaparo Alındı</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-[var(--muted-foreground)]">Satıldı</span>
                </div>
              </div>
              <Link
                href="/parcels?view=map"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
                Tüm Haritayı Gör
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Süreç</span>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Nasıl Çalışır?</h2>
          <p className="mt-3 text-[var(--muted-foreground)]">
            Sadece 3 adımda arsa sahibi olun
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              step: '1',
              icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
              title: 'Arsa Bulun',
              desc: 'Harita veya liste üzerinden size uygun arsayı keşfedin.',
              color: 'from-blue-500 to-blue-600',
            },
            {
              step: '2',
              icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
              title: 'Teklif Verin',
              desc: 'Doğrudan satın alın veya canlı açık artırmaya katılın.',
              color: 'from-brand-500 to-brand-600',
            },
            {
              step: '3',
              icon: 'M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819',
              title: 'Tapunuzu Alın',
              desc: 'Güvenli ödeme sonrası tapu işlemlerinizi tamamlayın.',
              color: 'from-emerald-500 to-emerald-600',
            },
          ].map((item) => (
            <div key={item.step} className="text-center group">
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-xl shadow-gray-200/50 group-hover:-translate-y-1 transition-all duration-300">
                <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className={`absolute -top-2.5 -right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${item.color} text-xs font-extrabold text-white shadow-md`}>
                  {item.step}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="bg-[var(--muted)]/50 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-500">Referanslar</span>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Kullanıcılarımız Ne Diyor?</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {(testimonials.length > 0
              ? testimonials.map((t) => ({ name: t.title, location: '', text: t.description || '' }))
              : [
                  { name: 'Ahmet Y.', location: 'Antalya', text: 'NetTapu sayesinde Antalya\'da aradığım arsayı kolayca buldum. Açık artırma süreci çok şeffaf ve güvenliydi.' },
                  { name: 'Fatma K.', location: 'Muğla', text: 'Online açık artırma sistemi gerçekten çok pratik. Evimden çıkmadan Muğla\'da arsa sahibi oldum.' },
                  { name: 'Mehmet S.', location: 'Bursa', text: 'Danışman desteği harika. Her aşamada bize yardımcı oldular. Tapu işlemleri de çok hızlı tamamlandı.' },
                ]
            ).map((testimonial) => (
              <div
                key={testimonial.name}
                className="rounded-2xl border border-[var(--border)] bg-white p-7 shadow-lg shadow-gray-100/50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex gap-0.5 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-gray-600">
                  &ldquo;{testimonial.text}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3 pt-4 border-t border-[var(--border)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-sm font-bold text-brand-700">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{testimonial.name}</p>
                    {testimonial.location && <p className="text-xs text-[var(--muted-foreground)]">{testimonial.location}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/references" className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
              Tüm referansları görüntüle →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Trust Badges ─── */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z', label: 'SSL Güvenlik', desc: '256-bit şifreleme' },
              { icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', label: 'Yasal Uyumluluk', desc: 'KVKK ve mevzuat' },
              { icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z', label: 'Güvenli Ödeme', desc: '3D Secure ile' },
              { icon: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155', label: '7/24 Destek', desc: 'Canlı müşteri hizmeti' },
            ].map((badge) => (
              <div key={badge.label} className="text-center group">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 border border-brand-100 group-hover:bg-brand-100 transition-colors">
                  <svg className="h-7 w-7 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={badge.icon} />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-bold">{badge.label}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-500 to-emerald-500" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative mx-auto max-w-3xl text-center px-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Hayalinizdeki Arsayı Şimdi Bulun
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Binlerce arsa arasından size en uygun olanı keşfedin.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/parcels"
              className="rounded-2xl bg-white px-8 py-4 text-sm font-bold text-brand-600 shadow-xl shadow-black/10 hover:bg-white/90 transition-all"
            >
              Arsaları İncele
            </Link>
            <Link
              href="/register"
              className="rounded-2xl border-2 border-white/30 px-8 py-4 text-sm font-bold text-white hover:bg-white/10 transition-all"
            >
              Ücretsiz Üye Ol
            </Link>
          </div>
        </div>
      </section>

      {/* Video Popup */}
      {showVideo && <VideoPopup onClose={() => setShowVideo(false)} />}
    </main>
  );
}

/* ─── Auction Card ─── */
function AuctionCard({ auction }: { auction: Auction }) {
  const statusMap: Record<string, { color: string; label: string; glow: string }> = {
    live: { color: 'bg-emerald-500', label: 'CANLI', glow: 'shadow-emerald-500/50' },
    ending: { color: 'bg-amber-500', label: 'BİTİYOR', glow: 'shadow-amber-500/50' },
    scheduled: { color: 'bg-blue-500', label: 'YAKLAŞAN', glow: 'shadow-blue-500/50' },
  };
  const st = statusMap[auction.status] || {
    color: 'bg-gray-400',
    label: auction.status,
    glow: '',
  };

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
    >
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${st.color} animate-pulse shadow-lg ${st.glow}`} />
        <span className="text-xs font-extrabold uppercase tracking-widest text-white/80">
          {st.label}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-bold text-white group-hover:text-brand-200 transition-colors">
        {auction.title || 'Açık Artırma'}
      </h3>
      <div className="mt-5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/50">Güncel Fiyat</span>
          <span className="text-xl font-extrabold text-emerald-400">
            {formatPrice(auction.currentPrice)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/50">Başlangıç</span>
          <span className="text-white/70 font-medium">{formatPrice(auction.startingPrice)}</span>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3 text-xs text-white/40 pt-4 border-t border-white/10">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          {auction.participantCount} katılımcı
        </span>
        <span>{auction.bidCount} teklif</span>
      </div>
    </Link>
  );
}

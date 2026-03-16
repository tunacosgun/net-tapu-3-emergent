'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { TurkeyMap } from '@/components/turkey-map';
import { ParcelCard } from '@/components/parcel-card';
import { VideoPopup } from '@/components/video-popup';
import type { Parcel, Auction, PaginatedResponse, Reference } from '@/types';

const ParcelMapLazy = dynamic(() => import('@/components/parcel-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center bg-gray-50">
      <span className="text-sm text-gray-400">Harita yükleniyor...</span>
    </div>
  ),
});

export default function HomePage() {
  const router = useRouter();
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
        const cities = new Set(data.data.map((p) => p.city));
        setStats((s) => ({ ...s, cities: Math.max(cities.size, s.cities) }));
      }).catch(() => {});

    apiClient.get<Reference[]>('/content/references')
      .then(({ data }) => setTestimonials(data.filter((r) => r.referenceType === 'testimonial').slice(0, 6)))
      .catch(() => {});

    Promise.all([
      apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 3, status: 'live' } }).catch(() => ({ data: { data: [], meta: { total: 0 } } })),
      apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 3, status: 'scheduled' } }).catch(() => ({ data: { data: [], meta: { total: 0 } } })),
    ]).then(([liveRes, schedRes]) => {
      const combined = [...liveRes.data.data, ...schedRes.data.data].slice(0, 3);
      setActiveAuctions(combined);
      setStats((s) => ({ ...s, auctions: liveRes.data.meta.total + schedRes.data.meta.total }));
    });
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/parcels?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <main className="bg-white">
      {/* ─── Hero ─── */}
      <section className="bg-gradient-to-b from-brand-600 to-brand-700">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Güvenilir Arsa Satış ve
            <br />
            Açık Artırma Platformu
          </h1>
          <p className="mt-4 text-base sm:text-lg text-brand-100 max-w-xl mx-auto">
            Türkiye genelinde binlerce arsa arasından size uygun olanı bulun.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-2xl">
            <div className="flex rounded-lg overflow-hidden shadow-lg">
              <input
                type="text"
                placeholder="Şehir, ilçe veya arsa adı ile arayın..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-5 py-4 text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
              <button type="submit" className="bg-gray-900 hover:bg-gray-800 px-8 py-4 text-sm font-semibold text-white transition-colors whitespace-nowrap">
                Arsa Ara
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {['İstanbul', 'Antalya', 'Muğla', 'Mersin', 'Bursa'].map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => router.push(`/parcels?city=${city}`)}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 hover:bg-white/25 transition-colors"
                >
                  {city}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-3 divide-x divide-gray-200">
            {[
              { value: `${stats.parcels}+`, label: 'Aktif İlan' },
              { value: `${stats.auctions}`, label: 'Açık Artırma' },
              { value: `${stats.cities}+`, label: 'Farklı İl' },
            ].map((stat) => (
              <div key={stat.label} className="py-4 sm:py-5 text-center">
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Featured Parcels ─── */}
      {featuredParcels.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Öne Çıkan Arsalar</h2>
            <Link href="/parcels?isFeatured=true" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Tümünü Gör &rarr;
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredParcels.map((parcel) => (
              <ParcelCard key={parcel.id} parcel={parcel} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Active Auctions ─── */}
      {activeAuctions.length > 0 && (
        <section className="bg-gray-50 border-y border-gray-200">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Açık Artırmalar</h2>
                <span className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  Canlı
                </span>
              </div>
              <Link href="/auctions" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Tümünü Gör &rarr;
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeAuctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Latest Parcels ─── */}
      {latestParcels.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Son Eklenen Arsalar</h2>
            <Link href="/parcels?sortBy=createdAt&sortOrder=DESC" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Tümünü Gör &rarr;
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestParcels.map((parcel) => (
              <ParcelCard key={parcel.id} parcel={parcel} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Turkey Map ─── */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="text-center mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Türkiye Geneli Arsalar</h2>
            <p className="mt-1 text-sm text-gray-500">Bir ile tıklayarak o ildeki arsaları görüntüleyin.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-8">
            <TurkeyMap onProvinceClick={(province) => router.push(`/parcels?city=${encodeURIComponent(province)}`)} />
          </div>
        </div>
      </section>

      {/* ─── Interactive Map ─── */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Haritada Keşfet</h2>
          <Link href="/parcels?view=map" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Tam Ekran Harita &rarr;
          </Link>
        </div>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <ParcelMapLazy
            parcels={[...featuredParcels, ...latestParcels].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)}
            height="400px"
          />
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 text-center mb-8">Nasıl Çalışır?</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { step: '1', title: 'Arsa Bulun', desc: 'Harita veya liste üzerinden size uygun arsayı keşfedin.' },
              { step: '2', title: 'Teklif Verin', desc: 'Doğrudan satın alın veya canlı açık artırmaya katılın.' },
              { step: '3', title: 'Tapunuzu Alın', desc: 'Güvenli ödeme sonrası tapu işlemlerinizi tamamlayın.' },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust Badges ─── */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'SSL Güvenlik', desc: '256-bit şifreleme' },
            { label: 'Yasal Uyumluluk', desc: 'KVKK ve mevzuat' },
            { label: 'Güvenli Ödeme', desc: '3D Secure ile' },
            { label: '7/24 Destek', desc: 'Canlı müşteri hizmeti' },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
              <svg className="h-5 w-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-900">{badge.label}</p>
                <p className="text-xs text-gray-500">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Video Tanıtım ─── */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">NetTapu Nasıl Çalışır?</h2>
          <p className="mt-2 text-sm text-gray-500">Platformumuzu tanıtan kısa videomuzu izleyin.</p>
          <button
            onClick={() => setShowVideo(true)}
            className="mt-6 inline-flex items-center gap-3 rounded-xl bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Tanıtım Videosunu İzle
          </button>
        </div>
      </section>

      {showVideo && <VideoPopup onClose={() => setShowVideo(false)} />}

      {/* ─── Testimonials (Müşteri Yorumları) ─── */}
      {testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="text-center mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Müşterilerimiz Ne Diyor?</h2>
            <p className="mt-1 text-sm text-gray-500">Memnun müşterilerimizden yorumlar</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                {t.description && (
                  <p className="text-sm text-gray-600 italic leading-relaxed line-clamp-4">&ldquo;{t.description}&rdquo;</p>
                )}
                <div className="mt-4 flex items-center gap-3">
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt={t.title} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold text-sm">
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
          <div className="mt-6 text-center">
            <Link href="/references" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Tüm Referanslarımızı Görün &rarr;
            </Link>
          </div>
        </section>
      )}

      {/* ─── CTA ─── */}
      <section className="bg-brand-600">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Hayalinizdeki Arsayı Şimdi Bulun</h2>
          <p className="mt-2 text-brand-100">Binlerce arsa arasından size en uygun olanı keşfedin.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/parcels" className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-600 hover:bg-gray-50 transition-colors">
              Arsaları İncele
            </Link>
            <Link href="/register" className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Ücretsiz Üye Ol
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ─── Auction Card ─── */
function AuctionCard({ auction }: { auction: Auction }) {
  const statusMap: Record<string, { color: string; label: string }> = {
    live: { color: 'bg-green-500', label: 'Canlı' },
    ending: { color: 'bg-amber-500', label: 'Bitiyor' },
    scheduled: { color: 'bg-blue-500', label: 'Yaklaşan' },
  };
  const st = statusMap[auction.status] || { color: 'bg-gray-400', label: auction.status };

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${st.color}`} />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{st.label}</span>
      </div>
      <h3 className="font-semibold text-gray-900 line-clamp-2">{auction.title || 'Açık Artırma'}</h3>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Güncel Fiyat</span>
          <span className="text-lg font-bold text-brand-600">{formatPrice(auction.currentPrice)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Başlangıç</span>
          <span className="text-gray-700">{formatPrice(auction.startingPrice)}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-gray-100">
        <span>{auction.participantCount} katılımcı</span>
        <span>{auction.bidCount} teklif</span>
      </div>
    </Link>
  );
}

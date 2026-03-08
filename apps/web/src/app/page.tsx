'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { TurkeyMap } from '@/components/turkey-map';
import { VideoPopup } from '@/components/video-popup';
import { ParcelCard } from '@/components/parcel-card';
import type { Parcel, Auction, PaginatedResponse } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [featuredParcels, setFeaturedParcels] = useState<Parcel[]>([]);
  const [latestParcels, setLatestParcels] = useState<Parcel[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [stats, setStats] = useState({ parcels: 0, auctions: 0, cities: 0 });
  const [showVideo, setShowVideo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Fetch featured parcels
    apiClient
      .get<PaginatedResponse<Parcel>>('/parcels', {
        params: { isFeatured: true, limit: 6, status: 'active' },
      })
      .then(({ data }) => setFeaturedParcels(data.data))
      .catch(() => {});

    // Fetch latest parcels
    apiClient
      .get<PaginatedResponse<Parcel>>('/parcels', {
        params: { limit: 6, sortBy: 'createdAt', sortOrder: 'DESC', status: 'active' },
      })
      .then(({ data }) => {
        setLatestParcels(data.data);
        setStats((s) => ({ ...s, parcels: data.meta.total }));
        // Count unique cities
        const cities = new Set(data.data.map((p) => p.city));
        setStats((s) => ({ ...s, cities: Math.max(cities.size, s.cities) }));
      })
      .catch(() => {});

    // Fetch active auctions
    apiClient
      .get<PaginatedResponse<Auction>>('/auctions', {
        params: { limit: 3, status: 'live,scheduled' },
      })
      .then(({ data }) => {
        setActiveAuctions(data.data);
        setStats((s) => ({ ...s, auctions: data.meta.total }));
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
      <section className="relative flex flex-col items-center justify-center px-4 py-20 sm:py-28 bg-gradient-to-b from-brand-50 to-[var(--background)]">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Hayalinizdeki Arsayı{' '}
            <span className="text-brand-500">NetTapu</span>
            &apos;da Bulun
          </h1>
          <p className="mt-4 text-lg text-[var(--muted-foreground)] max-w-xl mx-auto">
            Gayrimenkul ve arsa satışı için Türkiye&apos;nin canlı açık artırma
            platformu. Güvenilir, şeffaf ve hızlı.
          </p>

          {/* Hero Search */}
          <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-lg">
            <div className="flex overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-lg focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
              <div className="flex items-center pl-4 text-[var(--muted-foreground)]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Şehir, ilçe veya arsa adı ile arayın..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent px-3 py-3.5 text-sm outline-none placeholder:text-[var(--muted-foreground)]/60"
              />
              <button
                type="submit"
                className="m-1.5 rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                Ara
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/parcels"
              className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition-colors"
            >
              Arsaları Keşfet
            </Link>
            <Link
              href="/auctions"
              className="rounded-lg border border-brand-500 px-6 py-3 text-sm font-semibold text-brand-500 shadow-sm hover:bg-brand-50 transition-colors"
            >
              Açık Artırmalar
            </Link>
            <button
              onClick={() => setShowVideo(true)}
              className="rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--muted-foreground)] shadow-sm hover:bg-[var(--muted)] transition-colors"
            >
              ▶ Tanıtım Videosu
            </button>
          </div>
        </div>
      </section>

      {/* ─── Stats Counter ─── */}
      <section className="mx-auto max-w-4xl px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-white shadow-md border border-[var(--border)] p-6 text-center">
            <p className="text-3xl font-bold text-brand-500">{stats.parcels}+</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Aktif İlan</p>
          </div>
          <div className="rounded-xl bg-white shadow-md border border-[var(--border)] p-6 text-center">
            <p className="text-3xl font-bold text-brand-500">{stats.auctions}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Açık Artırma</p>
          </div>
          <div className="rounded-xl bg-white shadow-md border border-[var(--border)] p-6 text-center">
            <p className="text-3xl font-bold text-brand-500">{stats.cities}+</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">İl</p>
          </div>
        </div>
      </section>

      {/* ─── Featured Parcels ─── */}
      {featuredParcels.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Öne Çıkan Arsalar</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Seçilmiş fırsat arsalar
              </p>
            </div>
            <Link
              href="/parcels?isFeatured=true"
              className="text-sm font-medium text-brand-500 hover:underline"
            >
              Tümünü Gör →
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredParcels.map((parcel) => (
              <ParcelCard key={parcel.id} parcel={parcel} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Active Auctions ─── */}
      {activeAuctions.length > 0 && (
        <section className="bg-[var(--muted)] py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Canlı Açık Artırmalar</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Şu anda devam eden ve yaklaşan ihaleler
                </p>
              </div>
              <Link
                href="/auctions"
                className="text-sm font-medium text-brand-500 hover:underline"
              >
                Tümünü Gör →
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeAuctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Latest Parcels ─── */}
      {latestParcels.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Son Eklenen Arsalar</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                En yeni ilanlar
              </p>
            </div>
            <Link
              href="/parcels?sortBy=createdAt&sortOrder=DESC"
              className="text-sm font-medium text-brand-500 hover:underline"
            >
              Tümünü Gör →
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestParcels.map((parcel) => (
              <ParcelCard key={parcel.id} parcel={parcel} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Map Section ─── */}
      <section className="bg-[var(--muted)] py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-bold text-center">
            Türkiye Geneli Arsalar
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
            Bir ile tıklayarak o ildeki arsaları görüntüleyin.
          </p>
          <div className="mt-6">
            <TurkeyMap
              onProvinceClick={(province) => {
                router.push(`/parcels?city=${encodeURIComponent(province)}`);
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-2xl font-bold text-center">Nasıl Çalışır?</h2>
        <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
          Sadece 3 adımda arsa sahibi olun
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: '1',
              icon: (
                <svg className="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              ),
              title: 'Arsa Bulun',
              desc: 'Harita veya liste üzerinden size uygun arsayı keşfedin.',
            },
            {
              step: '2',
              icon: (
                <svg className="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              ),
              title: 'Teklif Verin',
              desc: 'Doğrudan satın alın veya canlı açık artırmaya katılın.',
            },
            {
              step: '3',
              icon: (
                <svg className="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
                </svg>
              ),
              title: 'Tapunuzu Alın',
              desc: 'Güvenli ödeme sonrası tapu işlemlerinizi tamamlayın.',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 border border-brand-100">
                {item.icon}
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  {item.step}
                </span>
              </div>
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="bg-[var(--muted)] py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-bold text-center">Kullanıcılarımız Ne Diyor?</h2>
          <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
            Platformumuzdan memnun kalan kullanıcıların deneyimleri
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                name: 'Ahmet Y.',
                location: 'Antalya',
                text: 'NetTapu sayesinde Antalya\'da aradığım arsayı kolayca buldum. Açık artırma süreci çok şeffaf ve güvenliydi.',
              },
              {
                name: 'Fatma K.',
                location: 'Muğla',
                text: 'Online açık artırma sistemi gerçekten çok pratik. Evimden çıkmadan Muğla\'da arsa sahibi oldum.',
              },
              {
                name: 'Mehmet S.',
                location: 'Bursa',
                text: 'Danışman desteği harika. Her aşamada bize yardımcı oldular. Tapu işlemleri de çok hızlı tamamlandı.',
              },
            ].map((testimonial) => (
              <div
                key={testimonial.name}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6"
              >
                <div className="flex gap-1 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  &ldquo;{testimonial.text}&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{testimonial.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust Badges ─── */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { icon: '🛡️', label: 'SSL Güvenlik', desc: '256-bit şifreleme' },
              { icon: '📜', label: 'Yasal Uyumluluk', desc: 'KVKK ve mevzuat' },
              { icon: '💳', label: 'Güvenli Ödeme', desc: '3D Secure ile' },
              { icon: '📞', label: '7/24 Destek', desc: 'Canlı müşteri hizmeti' },
            ].map((badge) => (
              <div key={badge.label} className="text-center">
                <span className="text-2xl">{badge.icon}</span>
                <p className="mt-2 text-sm font-semibold">{badge.label}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="bg-brand-500 py-16">
        <div className="mx-auto max-w-3xl text-center px-4">
          <h2 className="text-3xl font-bold text-white">
            Hayalinizdeki Arsayı Şimdi Bulun
          </h2>
          <p className="mt-3 text-brand-100">
            Binlerce arsa arasından size en uygun olanı keşfedin.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/parcels"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-600 shadow-sm hover:bg-brand-50 transition-colors"
            >
              Arsaları İncele
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-white px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition-colors"
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
  const statusMap: Record<string, { color: string; label: string }> = {
    live: { color: 'bg-green-500', label: 'CANLI' },
    ending: { color: 'bg-amber-500', label: 'BİTİYOR' },
    scheduled: { color: 'bg-blue-500', label: 'YAKLAŞAN' },
  };
  const st = statusMap[auction.status] || {
    color: 'bg-gray-400',
    label: auction.status,
  };

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 hover:border-brand-300 hover:shadow-lg transition-all"
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${st.color} animate-pulse`} />
        <span className="text-xs font-bold uppercase tracking-wider">
          {st.label}
        </span>
      </div>
      <h3 className="mt-3 font-semibold group-hover:text-brand-500 transition-colors">
        {auction.title || 'Açık Artırma'}
      </h3>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">Güncel Fiyat</span>
          <span className="font-bold text-brand-500">
            {formatPrice(auction.currentPrice)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">Başlangıç</span>
          <span>{formatPrice(auction.startingPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted-foreground)]">Teklif</span>
          <span>{auction.bidCount} teklif</span>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        {auction.status === 'scheduled'
          ? `Başlangıç: ${formatDate(auction.scheduledStart, 'datetime')}`
          : `${auction.participantCount} katılımcı`}
      </div>
    </Link>
  );
}

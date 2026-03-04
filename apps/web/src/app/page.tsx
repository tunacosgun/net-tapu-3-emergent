'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { TurkeyMap } from '@/components/turkey-map';
import { Badge, Card, Button } from '@/components/ui';
import { parcelStatusConfig } from '@/components/ui/badge';
import { VideoPopup } from '@/components/video-popup';
import type { Parcel, Auction, PaginatedResponse } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [featuredParcels, setFeaturedParcels] = useState<Parcel[]>([]);
  const [latestParcels, setLatestParcels] = useState<Parcel[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [stats, setStats] = useState({ parcels: 0, auctions: 0, cities: 0 });
  const [showVideo, setShowVideo] = useState(false);

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

  return (
    <main className="min-h-screen">
      {/* ─── Hero Section ─── */}
      <section className="relative flex flex-col items-center justify-center px-4 py-24 bg-gradient-to-b from-brand-50 to-[var(--background)]">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="text-brand-500">NetTapu</span>
          </h1>
          <p className="mt-4 text-lg text-[var(--muted-foreground)] max-w-xl mx-auto">
            Gayrimenkul ve arsa satışı için Türkiye&apos;nin canlı açık artırma
            platformu. Güvenilir, şeffaf ve hızlı.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
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
      <section className="mx-auto max-w-4xl px-4 -mt-8">
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
              href="/parcels"
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
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
              🔍
            </div>
            <h3 className="mt-4 font-semibold">1. Arsa Bulun</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Harita veya liste üzerinden size uygun arsayı keşfedin.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
              💰
            </div>
            <h3 className="mt-4 font-semibold">2. Teklif Verin</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Doğrudan satın alın veya canlı açık artırmaya katılın.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
              🏡
            </div>
            <h3 className="mt-4 font-semibold">3. Tapunuzu Alın</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Güvenli ödeme sonrası tapu işlemlerinizi tamamlayın.
            </p>
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

      {/* Footer placeholder */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-[var(--muted-foreground)]">
          <p>© {new Date().getFullYear()} NetTapu. Tüm hakları saklıdır.</p>
          <div className="mt-4 flex justify-center gap-6">
            <Link href="/about" className="hover:text-brand-500">
              Hakkımızda
            </Link>
            <Link href="/faq" className="hover:text-brand-500">
              SSS
            </Link>
            <Link href="/legal" className="hover:text-brand-500">
              Yasal Bilgiler
            </Link>
            <Link href="/references" className="hover:text-brand-500">
              Referanslar
            </Link>
            <Link href="/press" className="hover:text-brand-500">
              Basın
            </Link>
          </div>
        </div>
      </footer>

      {/* Video Popup */}
      {showVideo && <VideoPopup onClose={() => setShowVideo(false)} />}
    </main>
  );
}

/* ─── Parcel Card (Homepage variant) ─── */
function ParcelCard({ parcel }: { parcel: Parcel }) {
  const status = parcelStatusConfig(parcel.status);
  return (
    <Link
      href={`/parcels/${parcel.id}`}
      className="group relative rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 hover:border-brand-500 hover:shadow-md transition-all"
    >
      <Badge variant={status.variant} className="absolute top-3 right-3">
        {status.label}
      </Badge>
      <h3 className="pr-16 font-semibold group-hover:text-brand-500 transition-colors">
        {parcel.title}
      </h3>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        📍 {parcel.city}, {parcel.district}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-lg font-bold text-brand-500">
          {formatPrice(parcel.price)}
        </span>
        {parcel.areaM2 && (
          <span className="text-sm text-[var(--muted-foreground)]">
            {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
          </span>
        )}
      </div>
      {parcel.isAuctionEligible && (
        <span className="mt-2 inline-block rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          Açık Artırma
        </span>
      )}
    </Link>
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
      className="group rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 hover:border-brand-500 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${st.color} animate-pulse`} />
        <span className="text-xs font-bold uppercase tracking-wider">
          {st.label}
        </span>
      </div>
      <h3 className="mt-2 font-semibold group-hover:text-brand-500 transition-colors">
        {auction.title || 'Açık Artırma'}
      </h3>
      <div className="mt-3 space-y-1 text-sm">
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
      <div className="mt-3 text-xs text-[var(--muted-foreground)]">
        {auction.status === 'scheduled'
          ? `Başlangıç: ${formatDate(auction.scheduledStart, 'datetime')}`
          : `Katılımcı: ${auction.participantCount}`}
      </div>
    </Link>
  );
}

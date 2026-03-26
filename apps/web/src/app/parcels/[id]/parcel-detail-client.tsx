'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '@/lib/api-client';
import { formatPrice, resolveImageUrl } from '@/lib/format';
import { ShareButtons } from '@/components/share-buttons';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteSettings } from '@/hooks/use-site-settings';
import type { Parcel, ParcelImage } from '@/types';
import {
  Heart, ChevronLeft, ChevronRight, X, MapPin, Maximize2, Calendar,
  Share2, Phone, Eye, Building2, Ruler, TreePine, FileText, Download,
  Printer, ExternalLink, ChevronDown, ChevronUp, Check, Sparkles,
  Clock, Users, Gavel, TrendingUp, Shield, Info,
} from 'lucide-react';

export default function ParcelDetailClient() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const siteSettings = useSiteSettings();

  const parcelId = params?.id as string;

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [images, setImages] = useState<ParcelImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loved, setLoved] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showCallForm, setShowCallForm] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('details');

  useEffect(() => {
    if (!parcelId) return;

    Promise.all([
      apiClient.get<Parcel>(`/parcels/${parcelId}`),
      apiClient.get<ParcelImage[]>(`/parcels/${parcelId}/images`),
    ])
      .then(([parcelRes, imagesRes]) => {
        setParcel(parcelRes.data);
        setImages(imagesRes.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Arsa detayları yüklenemedi.');
        setLoading(false);
      });
  }, [parcelId]);

  const nextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600 mb-4" />
          <p className="text-slate-600 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !parcel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 mb-2">
            Arsa Bulunamadı
          </h1>
          <p className="text-slate-600 mb-6">
            {error || 'Bu arsa mevcut değil veya kaldırılmış olabilir.'}
          </p>
          <Link
            href="/parcels"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Tüm Arsalar
          </Link>
        </div>
      </div>
    );
  }

  const mainImage = images[currentImageIndex];
  let mainImageUrl = '/placeholder-parcel.jpg';
  if (mainImage) {
    if (typeof mainImage === 'string') {
      mainImageUrl = resolveImageUrl(mainImage);
    } else if (typeof mainImage === 'object' && (mainImage.watermarkedUrl || mainImage.originalUrl || mainImage.url)) {
      mainImageUrl = resolveImageUrl((mainImage as any).watermarkedUrl || (mainImage as any).originalUrl || (mainImage as any).url || '');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* ═══════════════════════════════════════════════════════════════
          BREADCRUMB & BACK BUTTON
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-slate-500 hover:text-emerald-600 transition-colors">
              Ana Sayfa
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <Link href="/parcels" className="text-slate-500 hover:text-emerald-600 transition-colors">
              Arsalar
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <span className="text-slate-900 font-medium truncate max-w-xs">
              {parcel.title}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ─── LEFT COLUMN: Images & Details ─── */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* GALLERY */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Main image */}
              <div className="relative aspect-[16/10] bg-slate-100">
                <img
                  src={mainImageUrl}
                  alt={parcel.title}
                  className="w-full h-full object-cover"
                />
                
                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {parcel.isFeatured && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-sm font-bold rounded-lg shadow-lg">
                      <Sparkles className="h-4 w-4" />
                      Öne Çıkan
                    </span>
                  )}
                  {parcel.status === 'sold' && (
                    <span className="px-3 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg shadow-lg">
                      SATILDI
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={() => setLoved(!loved)}
                    className={`p-3 rounded-full backdrop-blur-sm transition-all shadow-lg ${
                      loved ? 'bg-red-500 text-white' : 'bg-white/95 text-slate-700 hover:bg-white'
                    }`}
                    title="Favorilere ekle"
                  >
                    <Heart className={`h-5 w-5 ${loved ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowLightbox(true)}
                    className="p-3 rounded-full bg-white/95 backdrop-blur-sm text-slate-700 hover:bg-white transition-all shadow-lg"
                    title="Tam ekran"
                  >
                    <Maximize2 className="h-5 w-5" />
                  </button>
                </div>

                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/95 backdrop-blur-sm text-slate-700 hover:bg-white transition-all shadow-lg"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/95 backdrop-blur-sm text-slate-700 hover:bg-white transition-all shadow-lg"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}

                {/* Image counter */}
                {images.length > 0 && (
                  <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-slate-900/80 backdrop-blur-sm text-white text-sm font-semibold rounded-lg">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, index) => {
                      const thumbUrl = typeof img === 'string' 
                        ? resolveImageUrl(img)
                        : resolveImageUrl((img as any)?.thumbnailUrl || (img as any)?.url || '');
                      return (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                            index === currentImageIndex
                              ? 'border-emerald-500 shadow-md'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <img
                            src={thumbUrl}
                            alt={`Görsel ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* TITLE & LOCATION */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h1 className="text-3xl font-heading font-extrabold text-slate-900 tracking-tight mb-4">
                {parcel.title}
              </h1>
              <div className="flex items-center gap-2 text-slate-600 mb-6">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <span className="text-lg font-medium">
                  {parcel.city}, {parcel.district}
                </span>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
                {parcel.areaM2 && (
                  <StatCard
                    icon={Maximize2}
                    label="Toplam Alan"
                    value={`${Number(parcel.areaM2).toLocaleString()} m²`}
                  />
                )}
                {parcel.ada && parcel.parsel && (
                  <StatCard
                    icon={FileText}
                    label="Ada/Parsel"
                    value={`${parcel.ada}/${parcel.parsel}`}
                  />
                )}
                <StatCard
                  icon={Eye}
                  label="Görüntülenme"
                  value="--"
                />
                <StatCard
                  icon={Calendar}
                  label="İlan Tarihi"
                  value={new Date(parcel.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                />
              </div>
            </div>

            {/* ACCORDION SECTIONS */}
            <div className="space-y-4">
              
              {/* Description */}
              {parcel.description && (
                <AccordionSection
                  title="Açıklama"
                  icon={FileText}
                  isOpen={expandedSection === 'description'}
                  onToggle={() => setExpandedSection(expandedSection === 'description' ? null : 'description')}
                >
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {parcel.description}
                  </p>
                </AccordionSection>
              )}

              {/* Details */}
              <AccordionSection
                title="Detaylı Bilgiler"
                icon={Info}
                isOpen={expandedSection === 'details'}
                onToggle={() => setExpandedSection(expandedSection === 'details' ? null : 'details')}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailRow label="İlan No" value={parcel.listingId || parcelId} />
                  <DetailRow label="Durum" value={parcel.status === 'active' ? 'Satışta' : parcel.status === 'sold' ? 'Satıldı' : 'Kapalı'} />
                  {parcel.city && <DetailRow label="Şehir" value={parcel.city} />}
                  {parcel.district && <DetailRow label="İlçe" value={parcel.district} />}
                  {parcel.neighborhood && <DetailRow label="Mahalle" value={parcel.neighborhood} />}
                  {parcel.ada && parcel.parsel && <DetailRow label="Ada/Parsel" value={`${parcel.ada}/${parcel.parsel}`} />}
                  {parcel.areaM2 && <DetailRow label="Toplam Alan" value={`${Number(parcel.areaM2).toLocaleString()} m²`} />}
                  {parcel.zoningStatus && <DetailRow label="İmar Durumu" value={parcel.zoningStatus} />}
                </div>
              </AccordionSection>

              {/* Map - placeholder for now */}
              <AccordionSection
                title="Konum"
                icon={MapPin}
                isOpen={expandedSection === 'map'}
                onToggle={() => setExpandedSection(expandedSection === 'map' ? null : 'map')}
              >
                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                  <MapPin className="h-12 w-12" />
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  {parcel.city}, {parcel.district} {parcel.neighborhood && `- ${parcel.neighborhood}`}
                </p>
              </AccordionSection>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: Price & Contact Card (Sticky) ─── */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              
              {/* PRICE CARD */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="text-center mb-6">
                  <p className="text-sm text-slate-500 font-medium mb-2">Fiyat</p>
                  <p className="text-4xl font-heading font-extrabold text-emerald-600 tracking-tight">
                    {formatPrice(parcel.price)}
                  </p>
                  {parcel.areaM2 && parcel.price && (
                    <p className="mt-2 text-sm text-slate-500">
                      {formatPrice(String(Math.round(Number(parcel.price) / Number(parcel.areaM2))))} / m²
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={() => setShowCallForm(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
                  >
                    <Phone className="h-5 w-5" />
                    Beni Ara
                  </button>
                  
                  <Link
                    href={`https://wa.me/${siteSettings.whatsapp_number || ''}?text=Merhaba, ${parcel.title} hakkında bilgi almak istiyorum.`}
                    target="_blank"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    WhatsApp
                  </Link>

                  <button className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors">
                    <Share2 className="h-5 w-5" />
                    Paylaş
                  </button>
                </div>
              </div>

              {/* AUCTION INFO (if applicable) */}
              {/* Temporarily disabled - needs proper type definition
              {parcel.auction && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Gavel className="h-5 w-5 text-amber-600" />
                    <h3 className="text-lg font-heading font-bold text-slate-900">
                      İhale Bilgisi
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Durum</span>
                      <span className="font-semibold text-slate-900">Canlı İhale</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Güncel Teklif</span>
                      <span className="font-semibold text-emerald-600">
                        {formatPrice(parcel.auction.currentPrice || parcel.price)}
                      </span>
                    </div>
                    <Link
                      href={`/auctions/${parcel.auction.id}`}
                      className="block w-full mt-4 px-4 py-2 bg-amber-600 text-white text-center rounded-lg font-semibold hover:bg-amber-700 transition-colors"
                    >
                      İhaleye Git
                    </Link>
                  </div>
                </div>
              )}
              */}

              {/* TRUST BADGES */}
              <div className="bg-slate-100 rounded-xl p-4 space-y-3">
                <TrustBadge icon={Shield} text="Güvenli İşlem Garantisi" />
                <TrustBadge icon={Check} text="Tapu Doğrulaması Yapıldı" />
                <TrustBadge icon={Users} text="Profesyonel Danışmanlık" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LIGHTBOX MODAL
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setShowLightbox(false)}
          >
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 p-3 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="relative max-w-6xl w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
              <img
                src={mainImageUrl}
                alt={parcel.title}
                className="max-w-full max-h-full object-contain rounded-lg"
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </>
              )}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold rounded-lg">
                {currentImageIndex + 1} / {images.length}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call form modal - placeholder */}
      {showCallForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCallForm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Sizi Arayalım</h3>
            <p className="text-slate-600 mb-4">Form buraya gelecek</p>
            <button
              onClick={() => setShowCallForm(false)}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════ */
function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
      <Icon className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AccordionSection({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: any;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-heading font-bold text-slate-900">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-100"
          >
            <div className="p-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 font-medium">{label}</span>
      <span className="text-sm text-slate-900 font-semibold">{value}</span>
    </div>
  );
}

function TrustBadge({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="shrink-0 p-1.5 rounded-full bg-emerald-100 text-emerald-600">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-slate-700 font-medium">{text}</span>
    </div>
  );
}

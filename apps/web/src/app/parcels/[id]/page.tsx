import type { Metadata } from 'next';
import { fetchParcelServer, fetchParcelImagesServer, fetchSiteSettingsServer } from '@/lib/server-api';
import ParcelDetailClient from './parcel-detail-client';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://nettapu.com';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [parcel, images, settings] = await Promise.all([
    fetchParcelServer(id),
    fetchParcelImagesServer(id),
    fetchSiteSettingsServer(),
  ]);

  const siteName = settings.site_title || 'NetTapu';

  if (!parcel) {
    return { title: `Arsa Bulunamadı | ${siteName}` };
  }

  const title = `${parcel.title} - ${parcel.city}, ${parcel.district}`;
  const areaText = parcel.areaM2 ? `${Number(parcel.areaM2).toLocaleString('tr-TR')} m²` : '';
  const priceText = parcel.price ? `${Number(parcel.price).toLocaleString('tr-TR')} ${parcel.currency === 'USD' ? '$' : parcel.currency === 'EUR' ? '€' : '₺'}` : '';
  const description =
    [areaText, priceText, parcel.city && parcel.district ? `${parcel.city}, ${parcel.district}` : '']
      .filter(Boolean).join(' | ') || `${parcel.city} ${parcel.district} satılık arsa`;

  // Resolve OG image — pick cover image or first image
  const coverImage = images.find((i) => i.isCover) || images[0];
  let ogImage: string | undefined;
  if (coverImage) {
    const imgUrl = coverImage.watermarkedUrl || coverImage.originalUrl || coverImage.url || '';
    ogImage = imgUrl.startsWith('http') ? imgUrl : `${SITE_URL}${imgUrl}`;
  }

  const pageUrl = `${SITE_URL}/parcels/${id}`;

  return {
    title: `${title} | ${siteName}`,
    description,
    openGraph: {
      type: 'website',
      locale: 'tr_TR',
      url: pageUrl,
      siteName,
      title: `${title} | ${siteName}`,
      description,
      ...(ogImage && {
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: parcel.title,
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${siteName}`,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}

export default function ParcelDetailPage() {
  return <ParcelDetailClient />;
}

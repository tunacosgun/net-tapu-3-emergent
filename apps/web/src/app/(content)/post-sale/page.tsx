import type { Metadata } from 'next';
import Link from 'next/link';
import { CmsPageClient } from '@/components/cms-page-client';

export const metadata: Metadata = {
  title: 'Satış Sonrası Hizmetler — NetTapu',
  description: 'Tapu devri, teknik destek ve danışmanlık hizmetleri ile satış sonrasında da yanınızdayız.',
  openGraph: {
    title: 'Satış Sonrası Hizmetler',
    description: 'Tapu devri, teknik destek ve danışmanlık hizmetleri ile satış sonrasında da yanınızdayız.',
  },
};

function PostSaleFallback() {
  const services = [
    {
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      title: 'Tapu Devir Desteği',
      desc: 'Satış sonrası tapu devir işlemleriniz uzman ekibimiz tarafından takip edilir. Gerekli belgelerin hazırlanması ve noter süreçlerinde size rehberlik ediyoruz.',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      title: 'Teknik Altyapı Desteği',
      desc: 'Su, elektrik, doğalgaz bağlantıları ve yol erişimi konularında ilgili kurumlarla iletişiminizi kolaylaştırıyoruz.',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      title: 'Yatırım Danışmanlığı',
      desc: 'İmar durumu değişiklikleri, yapı ruhsatı süreçleri ve gayrimenkul yatırım danışmanlığı konularında uzman kadromuzla hizmetinizdeyiz.',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
      title: 'Garanti ve Güvence',
      desc: 'Tüm satış işlemlerimiz yasal güvence altındadır. Tapu devri tamamlanana kadar ödemeleriniz koruma altında tutulur.',
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 px-8 py-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold lg:text-4xl">Satış Sonrası Hizmetler</h1>
          <p className="mt-2 text-base text-white/80 lg:text-lg">
            Satış sonrasında da yanınızdayız. Tapu devrinden teknik desteğe kadar her aşamada sizinle.
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {services.map((svc) => (
          <div key={svc.title} className="rounded-xl border border-[var(--border)] p-6 hover:shadow-lg hover:border-emerald-200 transition-all">
            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${svc.color}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={svc.icon} />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{svc.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{svc.desc}</p>
          </div>
        ))}
      </div>

      {/* Process Steps */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Satış Sonrası Süreç</h2>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Satış Onayı', desc: 'Ödeme onaylandıktan sonra işlem süreciniz başlar.' },
            { step: '2', title: 'Belge Hazırlığı', desc: 'Tapu devri için gerekli belgeler ekibimiz tarafından hazırlanır.' },
            { step: '3', title: 'Tapu Randevusu', desc: 'Tapu müdürlüğünde randevu alınır ve devir işlemi gerçekleştirilir.' },
            { step: '4', title: 'Teslimat', desc: 'Tapu tescili tamamlanır ve arsa size devredilir.' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4 rounded-lg border border-[var(--border)] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                {item.step}
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">{item.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact CTA */}
      <div className="mt-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-6 sm:p-8 text-center text-white">
        <h2 className="text-xl sm:text-2xl font-bold">Desteğe mi İhtiyacınız Var?</h2>
        <p className="mt-2 text-sm text-white/70">Satış sonrası her türlü sorunuz için ekibimize ulaşabilirsiniz.</p>
        <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/contact" className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-gray-50 transition-colors">İletişime Geç</Link>
          <Link href="/faq" className="rounded-lg border border-white/20 px-6 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors">Sık Sorulan Sorular</Link>
        </div>
      </div>
    </div>
  );
}

export default function PostSalePage() {
  return (
    <CmsPageClient
      slug="satis-sonrasi"
      showHero
      subtitle="Satış sonrasında da yanınızdayız"
      heroIcon="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
      fallback={<PostSaleFallback />}
    />
  );
}

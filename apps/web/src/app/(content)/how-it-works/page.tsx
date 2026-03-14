import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Nasıl Çalışırız — NetTapu',
  description: 'NetTapu platformunda arsa satın alma ve ihale süreçlerinin nasıl işlediğini öğrenin.',
  openGraph: {
    title: 'Nasıl Çalışırız',
    description: 'NetTapu platformunda arsa satın alma ve ihale süreçlerinin nasıl işlediğini öğrenin.',
  },
};

const steps = [
  {
    number: '01',
    title: 'Keşfedin',
    description:
      'Harita üzerinden veya detaylı filtreleme seçenekleri ile Türkiye genelindeki arsa ilanlarını inceleyin. Şehir, ilçe, fiyat aralığı, metrekare ve imar durumuna göre arama yapabilirsiniz.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    color: 'from-blue-500 to-blue-600',
  },
  {
    number: '02',
    title: 'İnceleyin',
    description:
      'Beğendiğiniz arsanın detay sayfasından tüm bilgilere ulaşın: ada/parsel bilgileri, imar durumu, fotoğraflar, konum haritası ve fiyat geçmişi. TKGM parsel sorgu bağlantısı ile resmi kayıtları doğrulayın.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'from-indigo-500 to-indigo-600',
  },
  {
    number: '03',
    title: 'Teklif Verin veya İhaleye Katılın',
    description:
      'Doğrudan teklif verin veya açık artırma ilanlarına katılın. İhaleye katılmak için teminat bedelini güvenli ödeme sistemi üzerinden yatırın ve canlı ihale sırasında teklifinizi verin.',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'from-brand-500 to-brand-600',
  },
  {
    number: '04',
    title: 'Güvende Olun',
    description:
      'Tüm işlemler 3D Secure güvenlik protokolü ile korunur. Ödeme bilgileriniz şifreli kanallar üzerinden iletilir. İhale sürecinin her adımı kayıt altına alınır.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    number: '05',
    title: 'Tapu İşlemleri',
    description:
      'İhaleyi kazandığınızda veya teklifiniz kabul edildiğinde, uzman danışman ekibimiz tapu devir işlemlerinde size rehberlik eder. Tüm yasal süreçler profesyonel olarak yönetilir.',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    color: 'from-amber-500 to-amber-600',
  },
];

const advantages = [
  {
    title: 'Şeffaf Süreç',
    description: 'Tüm fiyatlar, teklifler ve ihale sonuçları açık ve şeffaftır. Her adım kayıt altına alınır.',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    gradient: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
  },
  {
    title: 'Güvenli Ödeme',
    description: '3D Secure ile korunan sanal POS üzerinden güvenli ödeme. Tüm finansal veriler şifrelenir.',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    gradient: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
  },
  {
    title: 'Uzman Destek',
    description: 'Deneyimli gayrimenkul danışmanlarından profesyonel rehberlik. 7/24 müşteri desteği.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    gradient: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
  },
  {
    title: 'Yasal Uyum',
    description: 'Tüm işlemler mevcut mevzuata uygun olarak yürütülür. Hukuki güvence altındasınız.',
    icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
    gradient: 'from-purple-50 to-violet-50',
    borderColor: 'border-purple-200',
    iconColor: 'text-purple-600',
  },
];

export default function HowItWorksPage() {
  return (
    <div>
      {/* Hero */}
      <div className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 px-8 py-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold lg:text-4xl">Nasıl Çalışırız?</h1>
          <p className="mt-2 text-base text-white/80 lg:text-lg">
            NetTapu ile arsa satın alma süreciniz 5 basit adımda tamamlanır.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {steps.map((step, idx) => (
          <div
            key={step.number}
            className="group relative flex gap-6 rounded-xl border border-[var(--border)] p-6 transition-all duration-300 hover:shadow-lg hover:border-brand-200"
          >
            <div className="shrink-0">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} text-white shadow-lg`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                </svg>
              </div>
              {idx < steps.length - 1 && (
                <div className="mx-auto mt-3 h-6 w-0.5 bg-gradient-to-b from-[var(--border)] to-transparent" />
              )}
            </div>
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-6 items-center rounded-full bg-brand-50 px-2.5 text-xs font-bold text-brand-600">
                  Adım {step.number}
                </span>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">{step.title}</h2>
              </div>
              <p className="mt-3 text-[var(--muted-foreground)] leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Advantages */}
      <div className="mt-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Neden NetTapu?</h2>
          <p className="mt-2 text-[var(--muted-foreground)]">Güvenli ve şeffaf gayrimenkul alışverişi için tercih edilme sebeplerimiz</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {advantages.map((adv) => (
            <div
              key={adv.title}
              className={`rounded-xl border ${adv.borderColor} bg-gradient-to-br ${adv.gradient} p-6 transition-all duration-300 hover:shadow-md`}
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ${adv.iconColor}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={adv.icon} />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{adv.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                {adv.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-16 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 p-8 text-center text-white shadow-xl">
        <h2 className="text-2xl font-bold">Hazır mısınız?</h2>
        <p className="mt-2 text-white/80">
          Hemen arsaları keşfetmeye başlayın veya uzman danışmanlarımızla iletişime geçin.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link
            href="/parcels"
            className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-600 shadow-md hover:bg-gray-50 transition-colors"
          >
            Arsaları Keşfet
          </Link>
          <Link
            href="/about"
            className="rounded-lg border-2 border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Bize Ulaşın
          </Link>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nasıl Çalışırız',
  description: 'NetTapu platformunda arsa satın alma ve ihale süreçlerinin nasıl işlediğini öğrenin.',
};

const steps = [
  {
    number: '01',
    title: 'Keşfedin',
    description:
      'Harita üzerinden veya detaylı filtreleme seçenekleri ile Türkiye genelindeki arsa ilanlarını inceleyin. Şehir, ilçe, fiyat aralığı, metrekare ve imar durumuna göre arama yapabilirsiniz.',
    icon: '🔍',
  },
  {
    number: '02',
    title: 'İnceleyin',
    description:
      'Beğendiğiniz arsanın detay sayfasından tüm bilgilere ulaşın: ada/parsel bilgileri, imar durumu, fotoğraflar, konum haritası ve fiyat geçmişi. TKGM parsel sorgu bağlantısı ile resmi kayıtları doğrulayın.',
    icon: '📋',
  },
  {
    number: '03',
    title: 'Teklif Verin veya İhaleye Katılın',
    description:
      'Doğrudan teklif verin veya açık artırma ilanlarına katılın. İhaleye katılmak için teminat bedelini güvenli ödeme sistemi üzerinden yatırın ve canlı ihale sırasında teklifinizi verin.',
    icon: '💰',
  },
  {
    number: '04',
    title: 'Güvende Olun',
    description:
      'Tüm işlemler 3D Secure güvenlik protokolü ile korunur. Ödeme bilgileriniz şifreli kanallar üzerinden iletilir. İhale sürecinin her adımı kayıt altına alınır.',
    icon: '🔒',
  },
  {
    number: '05',
    title: 'Tapu İşlemleri',
    description:
      'İhaleyi kazandığınızda veya teklifiniz kabul edildiğinde, uzman danışman ekibimiz tapu devir işlemlerinde size rehberlik eder. Tüm yasal süreçler profesyonel olarak yönetilir.',
    icon: '🏡',
  },
];

const advantages = [
  {
    title: 'Şeffaf Süreç',
    description: 'Tüm fiyatlar, teklifler ve ihale sonuçları açık ve şeffaftır.',
    icon: '✨',
  },
  {
    title: 'Güvenli Ödeme',
    description: '3D Secure ile korunan sanal POS üzerinden güvenli ödeme.',
    icon: '🛡️',
  },
  {
    title: 'Uzman Destek',
    description: 'Deneyimli gayrimenkul danışmanlarından profesyonel rehberlik.',
    icon: '👥',
  },
  {
    title: 'Yasal Uyum',
    description: 'Tüm işlemler mevcut mevzuata uygun olarak yürütülür.',
    icon: '⚖️',
  },
];

export default function HowItWorksPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Nasıl Çalışırız?</h1>
      <p className="mt-2 text-lg text-[var(--muted-foreground)]">
        NetTapu ile arsa satın alma süreciniz 5 basit adımda tamamlanır.
      </p>

      {/* Steps */}
      <div className="mt-10 space-y-8">
        {steps.map((step, idx) => (
          <div key={step.number} className="flex gap-6">
            <div className="shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white text-xl font-bold">
                {step.icon}
              </div>
              {idx < steps.length - 1 && (
                <div className="mx-auto mt-2 h-8 w-0.5 bg-brand-200" />
              )}
            </div>
            <div className="pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-500">{step.number}</span>
                <h2 className="text-xl font-semibold">{step.title}</h2>
              </div>
              <p className="mt-2 text-[var(--muted-foreground)] leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Advantages */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold">Neden NetTapu?</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {advantages.map((adv) => (
            <div
              key={adv.title}
              className="rounded-lg border border-[var(--border)] p-6"
            >
              <span className="text-3xl">{adv.icon}</span>
              <h3 className="mt-3 text-lg font-semibold">{adv.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {adv.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-16 rounded-xl bg-brand-50 p-8 text-center">
        <h2 className="text-2xl font-bold">Hazır mısınız?</h2>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Hemen arsaları keşfetmeye başlayın veya uzman danışmanlarımızla iletişime geçin.
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <a
            href="/parcels"
            className="rounded-md bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            Arsaları Keşfet
          </a>
          <a
            href="/about"
            className="rounded-md border border-brand-500 px-6 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
          >
            Bize Ulaşın
          </a>
        </div>
      </div>
    </div>
  );
}

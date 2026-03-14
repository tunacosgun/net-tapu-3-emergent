import type { Metadata } from 'next';
import Link from 'next/link';
import { CmsPageClient } from '@/components/cms-page-client';

export const metadata: Metadata = {
  title: 'Cayma Hakkı — NetTapu',
  description: 'NetTapu platformunda cayma hakkı ve iade koşulları hakkında bilgi.',
  openGraph: {
    title: 'Cayma Hakkı',
    description: 'NetTapu platformunda cayma hakkı ve iade koşulları hakkında bilgi.',
  },
};

/* Fallback: Shown when the CMS page is not yet published */
function WithdrawalFallback() {
  return (
    <div>
      {/* Hero */}
      <div className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 px-8 py-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold lg:text-4xl">Cayma Hakkı</h1>
          <p className="mt-2 text-base text-white/70 lg:text-lg">
            Tüketici haklarınız ve cayma koşulları hakkında bilgilendirme
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {/* Section 1 */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">1. Genel Bilgi</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili yönetmelikler kapsamında,
                mesafeli satış sözleşmelerinde tüketicinin cayma hakkı bulunmaktadır. NetTapu
                platformu üzerinden gerçekleştirilen işlemlerde cayma hakkı aşağıdaki koşullara
                tabidir.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">2. Gayrimenkul Satışlarında Cayma Hakkı</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                Gayrimenkul (taşınmaz) satışları, 6502 sayılı Kanun kapsamında mesafeli satış
                sözleşmesi hükümlerine tabi değildir. Taşınmaz satışları Türk Borçlar Kanunu ve
                Tapu Kanunu hükümlerine göre gerçekleştirilir. Bu nedenle, tapu devir işlemi
                tamamlanmış gayrimenkul satışlarında standart cayma hakkı uygulanmamaktadır.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3 */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">3. İhale Teminatları</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                Açık artırma (ihale) sürecine katılım için yatırılan teminat bedelleri aşağıdaki
                koşullarla iade edilir:
              </p>
              <ul className="mt-3 space-y-2">
                <li className="flex items-start gap-2.5 text-sm text-[var(--muted-foreground)]">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>İhaleyi kazanamayan katılımcıların teminatları, ihale sonuçlandıktan sonra 5 iş günü içinde iade edilir.</span>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[var(--muted-foreground)]">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>İhale başlamadan önce katılımdan çekilme halinde teminat iadesi yapılabilir.</span>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[var(--muted-foreground)]">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>İhaleyi kazanan ancak satış işlemini tamamlamayan katılımcının teminatı iade edilmez.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 4 */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">4. Teklif İptali</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                Platform üzerinden verilen teklifler, karşı tarafça kabul edilmeden önce geri
                çekilebilir. Kabul edilmiş tekliflerin iptali için lütfen müşteri hizmetleri ile
                iletişime geçin.
              </p>
            </div>
          </div>
        </div>

        {/* Section 5 */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">5. &ldquo;Bana Ayır&rdquo; Rezervasyonları</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                48 saatlik &ldquo;Bana Ayır&rdquo; rezervasyonları, süre dolmadan önce iptal edilebilir.
                Rezervasyon süresinin dolması halinde arsa yeniden satışa açılır ve herhangi bir
                ücret talep edilmez.
              </p>
            </div>
          </div>
        </div>

        {/* Section 6 - Refund Table */}
        <div className="rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">6. İade Süreci</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                İade koşullarını karşılayan ödemeler, aşağıdaki süreçle iade edilir:
              </p>
              <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--muted)]">
                      <th className="px-4 py-3 text-left font-semibold text-[var(--foreground)]">Ödeme Yöntemi</th>
                      <th className="px-4 py-3 text-left font-semibold text-[var(--foreground)]">İade Süresi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          Kredi Kartı
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">5-10 iş günü</td>
                    </tr>
                    <tr className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                          </svg>
                          Banka Havalesi
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">3-5 iş günü</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-brand-100/50 p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-brand-800">7. İletişim</h2>
              <p className="mt-2 text-sm text-brand-700">
                Cayma hakkı ve iade talepleri için aşağıdaki kanallardan bize ulaşabilirsiniz:
              </p>
              <div className="mt-3 space-y-1.5 text-sm text-brand-700">
                <p><strong>E-posta:</strong> destek@nettapu.com</p>
                <p><strong>Telefon:</strong> 0850 XXX XX XX</p>
                <p><strong>Çalışma Saatleri:</strong> Pazartesi - Cuma, 09:00 - 18:00</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WithdrawalRightsPage() {
  return (
    <CmsPageClient
      slug="withdrawal-rights"
      showHero
      subtitle="Tüketici haklarınız ve cayma koşulları hakkında bilgilendirme"
      heroIcon="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
      fallback={<WithdrawalFallback />}
    />
  );
}

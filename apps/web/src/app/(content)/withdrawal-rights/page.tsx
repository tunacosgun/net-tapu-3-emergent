import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cayma Hakkı',
  description: 'NetTapu platformunda cayma hakkı ve iade koşulları hakkında bilgi.',
};

export default function WithdrawalRightsPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold">Cayma Hakkı</h1>
      <p className="mt-2 text-lg text-[var(--muted-foreground)]">
        Tüketici haklarınız ve cayma koşulları hakkında bilgilendirme.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-xl font-semibold">1. Genel Bilgi</h2>
          <p className="mt-2 text-[var(--muted-foreground)] leading-relaxed">
            6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili yönetmelikler kapsamında,
            mesafeli satış sözleşmelerinde tüketicinin cayma hakkı bulunmaktadır. NetTapu
            platformu üzerinden gerçekleştirilen işlemlerde cayma hakkı aşağıdaki koşullara
            tabidir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Gayrimenkul Satışlarında Cayma Hakkı</h2>
          <p className="mt-2 text-[var(--muted-foreground)] leading-relaxed">
            Gayrimenkul (taşınmaz) satışları, 6502 sayılı Kanun kapsamında mesafeli satış
            sözleşmesi hükümlerine tabi değildir. Taşınmaz satışları Türk Borçlar Kanunu ve
            Tapu Kanunu hükümlerine göre gerçekleştirilir. Bu nedenle, tapu devir işlemi
            tamamlanmış gayrimenkul satışlarında standart cayma hakkı uygulanmamaktadır.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. İhale Teminatları</h2>
          <p className="mt-2 text-[var(--muted-foreground)] leading-relaxed">
            Açık artırma (ihale) sürecine katılım için yatırılan teminat bedelleri aşağıdaki
            koşullarla iade edilir:
          </p>
          <ul className="mt-3 space-y-2 text-[var(--muted-foreground)]">
            <li className="flex gap-2">
              <span className="text-brand-500 font-bold">•</span>
              <span>İhaleyi kazanamayan katılımcıların teminatları, ihale sonuçlandıktan sonra
              5 iş günü içinde iade edilir.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-500 font-bold">•</span>
              <span>İhale başlamadan önce katılımdan çekilme halinde teminat iadesi
              yapılabilir.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-500 font-bold">•</span>
              <span>İhaleyi kazanan ancak satış işlemini tamamlamayan katılımcının teminatı
              iade edilmez.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Teklif İptali</h2>
          <p className="mt-2 text-[var(--muted-foreground)] leading-relaxed">
            Platform üzerinden verilen teklifler, karşı tarafça kabul edilmeden önce geri
            çekilebilir. Kabul edilmiş tekliflerin iptali için lütfen müşteri hizmetleri ile
            iletişime geçin.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. "Bana Ayır" Rezervasyonları</h2>
          <p className="mt-2 text-[var(--muted-foreground)] leading-relaxed">
            48 saatlik "Bana Ayır" rezervasyonları, süre dolmadan önce iptal edilebilir.
            Rezervasyon süresinin dolması halinde arsa yeniden satışa açılır ve herhangi bir
            ücret talep edilmez.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. İade Süreci</h2>
          <p className="mt-2 text-[var(--muted-foreground)] leading-relaxed">
            İade koşullarını karşılayan ödemeler, aşağıdaki süreçle iade edilir:
          </p>
          <div className="mt-4 rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--muted)]">
                  <th className="px-4 py-2 text-left font-medium">Ödeme Yöntemi</th>
                  <th className="px-4 py-2 text-left font-medium">İade Süresi</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">Kredi Kartı</td>
                  <td className="px-4 py-2">5-10 iş günü</td>
                </tr>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">Banka Havalesi</td>
                  <td className="px-4 py-2">3-5 iş günü</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. İletişim</h2>
          <p className="mt-2 text-[var(--muted-foreground)] leading-relaxed">
            Cayma hakkı ve iade talepleri için aşağıdaki kanallardan bize ulaşabilirsiniz:
          </p>
          <div className="mt-3 rounded-lg bg-brand-50 p-4 text-sm">
            <p><strong>E-posta:</strong> destek@nettapu.com</p>
            <p className="mt-1"><strong>Telefon:</strong> 0850 XXX XX XX</p>
            <p className="mt-1"><strong>Çalışma Saatleri:</strong> Pazartesi - Cuma, 09:00 - 18:00</p>
          </div>
        </section>
      </div>
    </div>
  );
}

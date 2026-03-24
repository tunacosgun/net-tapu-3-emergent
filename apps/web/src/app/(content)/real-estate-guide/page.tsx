import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd, JsonLd } from '@/components/json-ld';

export const metadata: Metadata = {
  title: 'Gayrimenkul Rehberi — NetTapu',
  description:
    'Arsa nedir, imar durumu, KAKS-TAKS, tapu işlemleri ve daha fazlası. Gayrimenkul yatırımına başlamadan önce bilmeniz gereken her şey.',
  openGraph: {
    title: 'Gayrimenkul Rehberi',
    description: 'Arsa alım-satım süreçlerinde bilmeniz gereken temel kavramlar ve işlemler.',
  },
};

const sections = [
  {
    id: 'arsa-nedir',
    title: 'Arsa Nedir?',
    content: `Arsa, üzerinde yapı yapılabilecek şekilde imar planı ile belirlenmiş, altyapısı tamamlanmış veya tamamlanması planlanan arazi parçasıdır. Arazi ise imar planı dışında kalan, tarımsal veya doğal durumda bulunan toprak parçasıdır. Bir arazinin arsa olabilmesi için belediye imar planında "yapı yapılabilir" olarak gösterilmesi gerekir.`,
  },
  {
    id: 'imar-durumu',
    title: 'İmar Durumu Nedir?',
    content: `İmar durumu, bir arsanın üzerine ne tür yapı yapılabileceğini, yapının boyutlarını ve kullanımını belirleyen resmi belgedir. Belediyeden alınan bu belge; arsanın konut, ticaret veya sanayi alanında olup olmadığını, kaç kat çıkılabildiğini, yapının oturma alanını ve cephe koşullarını içerir. Arsa almadan önce mutlaka imar durumu sorgulaması yapılmalıdır.`,
  },
  {
    id: 'kaks-taks',
    title: 'KAKS ve TAKS Nedir?',
    content: `Bu iki kavram, bir arsanin yapilasma kapasitesini belirleyen en onemli teknik terimlerdir.`,
    subsections: [
      {
        title: 'TAKS (Taban Alani Kat Sayisi)',
        content:
          'Bir yapinin taban oturma alaninin arsa alanina oranini ifade eder. Ornegin 500 m\u00B2 arsa ve TAKS 0.30 ise, yapinin taban alani en fazla 150 m\u00B2 olabilir. Formul: Taban Alani = Arsa Alani x TAKS',
      },
      {
        title: 'KAKS (Kat Alani Kat Sayisi / Emsal)',
        content:
          'Toplam insaat alaninin arsa alanina oranini gosterir. 500 m\u00B2 arsa ve KAKS 1.50 ise toplam insaat alani en fazla 750 m\u00B2 olabilir. Formul: Toplam Insaat Alani = Arsa Alani x KAKS',
      },
    ],
    example: {
      title: 'Ornek Hesaplama',
      items: [
        'Arsa alani: 1.000 m\u00B2',
        'TAKS: 0.40 \u2192 Taban alani: 400 m\u00B2',
        'KAKS: 1.60 \u2192 Toplam insaat: 1.600 m\u00B2',
        'Maksimum kat: 1.600 / 400 = 4 kat',
      ],
    },
  },
  {
    id: 'ada-parsel',
    title: 'Ada ve Parsel Nedir?',
    content: `Türkiye'de her arazi parçası kadastro sisteminde "ada" ve "parsel" numaralarıyla tanımlanır. Ada, etrafındaki yollar ve sınırlarla çevrili arazi grubunu ifade eder. Parsel ise bir ada içindeki bağımsız mülkiyet birimidir. Tapu ve kadastro işlemlerinde arsalar "il/ilçe/mahalle/ada/parsel" şeklinde tanımlanır. TKGM Parsel Sorgu sistemiyle herhangi bir parselin bilgilerine erişebilirsiniz.`,
  },
  {
    id: 'tapu-cesitleri',
    title: 'Tapu Çeşitleri',
    content: 'Türkiye\'de arsa ve arazi alım-satımında karşılaşılan başlıca tapu türleri:',
    list: [
      { term: 'Kat Mülkiyeti Tapusu', desc: 'Bina tamamlanmış ve iskan alınmış bağımsız bölümlere verilir.' },
      { term: 'Kat İrtifakı Tapusu', desc: 'İnşaat halindeki veya projesi onaylı binaların bağımsız bölümleri için düzenlenir.' },
      { term: 'Hisseli Tapu', desc: 'Birden fazla kişinin ortaklaşa olarak sahip olduğu arazi için verilir. Belirli bir alan değil, yüzdelik pay gösterir.' },
      { term: 'Müstakil Tapu', desc: 'Tek kişiye ait, sınır ve ölçüleri belli arsa için düzenlenir. En güvenli tapu türüdür.' },
    ],
  },
  {
    id: 'tapu-islemleri',
    title: 'Tapu Devir İşlemleri',
    content: 'Arsa satın alındığında tapu devir işlemleri şu aşamalardan oluşur:',
    steps: [
      'Taraflar arasında anlaşma ve satış bedelinin belirlenmesi',
      'Tapu müdürlüğünde randevu alınması',
      'Gerekli belgelerin hazırlanması (kimlik, vergi no, tapu fotokopisi, belediye rayiç değeri)',
      'Tapu harcı ödemesi (alıcıdan %2, satıcıdan %2 — toplam %4)',
      'Tapu müdürlüğünde devir işleminin tamamlanması',
      'Yeni tapu senedinin teslim alınması',
    ],
  },
  {
    id: 'serh-ipotek',
    title: 'Şerh ve İpotek Kontrolü',
    content: `Arsa almadan önce tapu üzerinde "şerh" veya "ipotek" olup olmadığını mutlaka kontrol edin. Şerh, arsanın satış veya kullanımını kısıtlayan resmi kayıttır (örneğin haciz, ihtiyati tedbir, su havzası koruma alanı). İpotek ise arsanın bir borca karşılık teminat gösterildiğini belirtir. Bu bilgiler e-Devlet üzerinden veya tapu müdürlüğünden sorgulanabilir.`,
  },
  {
    id: 'ihale-sureci',
    title: 'İhale ile Arsa Alımı',
    content: `NetTapu üzerinden canlı ihaleye katılarak arsa satın alabilirsiniz. İhale süreci şu şekilde işler:`,
    steps: [
      'İhaleye katılmak istediğiniz arsayı seçin',
      'Teminat bedelini (kaparoyu) ödeyin',
      'İhale başlangıç saatinde canlı ihale odasına girin',
      'Teklifinizi verin ve diğer katılımcılarla rekabet edin',
      'İhaleyi kazanırsınız — kalan ödemeyi belirtilen sürede tamamlayın',
      'Tapu devir işlemi başlatılır',
    ],
  },
  {
    id: 'yatirim-ipuclari',
    title: 'Arsa Yatırımında Dikkat Edilmesi Gerekenler',
    content: '',
    list: [
      { term: 'Konum', desc: 'Ulaşım ağlarına yakınlık, çevredeki gelişim projeleri ve altyapı durumunu araştırın.' },
      { term: 'İmar Planı', desc: 'Arsanın imarı olup olmadığını, ne amaçla kullanılabileceğini mutlaka kontrol edin.' },
      { term: 'Altyapı', desc: 'Yol, su, elektrik, doğalgaz ve kanalizasyon bağlantısı olup olmadığını öğrenin.' },
      { term: 'Rayiç Değer', desc: 'Belediye rayiç değeri ve piyasa değerini karşılaştırarak uygun fiyat analizi yapın.' },
      { term: 'Gelecek Potansiyeli', desc: 'Yakın çevrede planlanan otoyol, metro, havalimanı gibi projeler değeri artırabilir.' },
      { term: 'Hukuki Durum', desc: 'Şerh, ipotek, orman alanı, sit alanı gibi kısıtlamaları kontrol edin.' },
    ],
  },
];

const glossary = [
  { term: 'Ada', desc: 'Kadastro planında sınırlandırılmış arazi bloğu' },
  { term: 'Parsel', desc: 'Ada içindeki bağımsız arazi birimi' },
  { term: 'KAKS (Emsal)', desc: 'Toplam inşaat alanının arsa alanına oranı' },
  { term: 'TAKS', desc: 'Taban oturma alanının arsa alanına oranı' },
  { term: 'İmar Durumu', desc: 'Arsanın yapılaşma koşullarını gösteren belge' },
  { term: 'Hmax', desc: 'Yapının ulaşabileceği maksimum yükseklik' },
  { term: 'Gabari', desc: 'Yapının cephesinde izin verilen maksimum yükseklik' },
  { term: 'Cephe', desc: 'Arsanın yola bakan kısmı / genişliği' },
  { term: 'Derinlik', desc: 'Arsanın yoldan içeri doğru uzunluğu' },
  { term: 'İskan (Yapı Kullanma İzni)', desc: 'Binanın yaşanılabilir olduğunu gösteren resmi belge' },
  { term: 'Kat İrtifakı', desc: 'İnşaat halindeki yapılarda bağımsız bölüm hakkı' },
  { term: 'Kat Mülkiyeti', desc: 'Tamamlanmış binalarda bağımsız bölüm mülkiyeti' },
  { term: 'Hisseli Tapu', desc: 'Birden fazla kişinin ortaklaşa sahip olduğu tapu türü' },
  { term: 'İpotek', desc: 'Arsanın borca karşılık teminat olarak gösterilmesi' },
  { term: 'Şerh', desc: 'Tapu üzerine konulan kısıtlama veya uyarı kaydı' },
  { term: 'Kadastro', desc: 'Taşınmazların sınır ve sahiplik bilgilerinin belirlenmesi' },
  { term: 'Rayiç Değer', desc: 'Belediyenin arsa/arazi için belirlediği değer' },
  { term: 'Emlak Vergisi', desc: 'Taşınmaz sahiplerinin yıllık ödediği vergi' },
  { term: 'Tapu Harcı', desc: 'Alım-satım işlemlerinde ödenen devlet harcı (toplam %4)' },
  { term: 'Çap Belgesi', desc: 'Arsanın sınırları ve ölçülerini gösteren belge' },
];

export default function RealEstateGuidePage() {
  return (
    <div>
      <BreadcrumbJsonLd
        items={[
          { name: 'Ana Sayfa', url: 'https://nettapu.com' },
          { name: 'Gayrimenkul Rehberi', url: 'https://nettapu.com/real-estate-guide' },
        ]}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'Gayrimenkul Rehberi - Arsa, KAKS, TAKS, İmar ve Tapu Bilgileri',
          description: 'Arsa nedir, imar durumu, KAKS-TAKS hesaplama, tapu çeşitleri ve devir işlemleri rehberi.',
          author: { '@type': 'Organization', name: 'NetTapu' },
          publisher: { '@type': 'Organization', name: 'NetTapu' },
          mainEntityOfPage: 'https://nettapu.com/real-estate-guide',
        }}
      />
      <h1 className="text-2xl font-bold text-gray-900">Gayrimenkul Rehberi</h1>
      <p className="mt-2 text-sm text-gray-500">
        Arsa alım-satım süreçlerinde bilmeniz gereken temel kavramlar, hesaplamalar ve işlemler.
      </p>

      {/* Table of contents */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">İçindekiler</h2>
        <nav className="grid gap-1 sm:grid-cols-2">
          {sections.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-white hover:text-brand-600 transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-50 text-[10px] font-bold text-brand-600">
                {i + 1}
              </span>
              {s.title}
            </a>
          ))}
          <a
            href="#sozluk"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-white hover:text-brand-600 transition-colors"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-50 text-[10px] font-bold text-brand-600">
              S
            </span>
            Gayrimenkul Sözlüğü
          </a>
        </nav>
      </div>

      {/* Sections */}
      <div className="mt-8 space-y-10">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2">
              {section.title}
            </h2>
            {section.content && (
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{section.content}</p>
            )}

            {/* Subsections (KAKS/TAKS) */}
            {section.subsections && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {section.subsections.map((sub) => (
                  <div key={sub.title} className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-gray-900">{sub.title}</h3>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{sub.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Example box */}
            {section.example && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-900">{section.example.title}</h4>
                <ul className="mt-2 space-y-1">
                  {section.example.items.map((item, i) => (
                    <li key={i} className="text-sm text-blue-800 flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-blue-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ordered steps */}
            {section.steps && (
              <ol className="mt-4 space-y-2">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {/* Definition list */}
            {section.list && (
              <div className="mt-4 space-y-2">
                {section.list.map((item) => (
                  <div key={item.term} className="rounded-lg border border-gray-200 bg-white p-3">
                    <dt className="text-sm font-semibold text-gray-900">{item.term}</dt>
                    <dd className="mt-0.5 text-sm text-gray-600">{item.desc}</dd>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Glossary */}
      <section id="sozluk" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2">
          Gayrimenkul Sözlüğü
        </h2>
        <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {glossary.map((item) => (
            <div key={item.term} className="flex gap-2 py-2 border-b border-gray-100 last:border-0">
              <dt className="text-sm font-semibold text-gray-900 whitespace-nowrap">{item.term}:</dt>
              <dd className="text-sm text-gray-600">{item.desc}</dd>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <h2 className="text-lg font-bold text-gray-900">Yatırıma Başlayın</h2>
        <p className="mt-1 text-sm text-gray-500">Arsaları inceleyin, ihaleye katılın veya uzman danışmanlarımızla görüşün.</p>
        <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
          <Link
            href="/parcels"
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            Arsaları İncele
          </Link>
          <Link
            href="/contact"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-white transition-colors"
          >
            İletişim
          </Link>
        </div>
      </div>
    </div>
  );
}

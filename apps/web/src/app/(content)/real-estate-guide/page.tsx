import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd, JsonLd } from '@/components/json-ld';

export const metadata: Metadata = {
  title: 'Gayrimenkul Rehberi — NetTapu',
  description:
    'Arsa nedir, imar durumu, KAKS-TAKS, tapu islemleri ve daha fazlasi. Gayrimenkul yatirimina baslamadan once bilmeniz gereken her sey.',
  openGraph: {
    title: 'Gayrimenkul Rehberi',
    description: 'Arsa alim-satim sureclerinde bilmeniz gereken temel kavramlar ve islemler.',
  },
};

const sections = [
  {
    id: 'arsa-nedir',
    title: 'Arsa Nedir?',
    content: `Arsa, uzerinde yapi yapilabilecek sekilde imar plani ile belirlenmis, altyapisi tamamlanmis veya tamamlanmasi planlanan arazi parcasidir. Arazi ise imar plani disinda kalan, tarimsal veya dogal durumda bulunan toprak parcasidir. Bir arazinin arsa olabilmesi icin belediye imar planinda "yapi yapilabilir" olarak gosterilmesi gerekir.`,
  },
  {
    id: 'imar-durumu',
    title: 'Imar Durumu Nedir?',
    content: `Imar durumu, bir arsanin uzerine ne tur yapi yapilabilecegini, yapinin boyutlarini ve kullanimini belirleyen resmi belgedir. Belediyeden alinan bu belge; arsanin konut, ticaret veya sanayi alaninda olup olmadigini, kac kat cikilabildigi, yapinin oturma alanini ve cephe kosullarini icerir. Arsa almadan once mutlaka imar durumu sorgulamasi yapilmalidir.`,
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
    content: `Turkiye\'de her arazi parcasi kadastro sisteminde "ada" ve "parsel" numaralariyla tanimlanir. Ada, etrafindaki yollar ve sinirlarla cevrili arazi grubunu ifade eder. Parsel ise bir ada icindeki bagimsiz mulkiyet birimidir. Tapu ve kadastro islemlerinde arsalar "il/ilce/mahalle/ada/parsel" seklinde tanimlanir. TKGM Parsel Sorgu sistemiyle herhangi bir parselin bilgilerine erisebilirsiniz.`,
  },
  {
    id: 'tapu-cesitleri',
    title: 'Tapu Cesitleri',
    content: 'Turkiye\'de arsa ve arazi alim-satiminda karsilasilan baslica tapu turleri:',
    list: [
      { term: 'Kat Mulkiyeti Tapusu', desc: 'Bina tamamlanmis ve iskan alinmis bagimsiz bolumlere verilir.' },
      { term: 'Kat Irtifaki Tapusu', desc: 'Insaat halindeki veya projesi onayli binalarin bagimsiz bolumleri icin duzenlenir.' },
      { term: 'Hisseli Tapu', desc: 'Birden fazla kisinin ortaklasma olarak sahip oldugu arazi icin verilir. Belirli bir alan degil, yuzdelik pay gosterir.' },
      { term: 'Mustakil Tapu', desc: 'Tek kisiye ait, sinir ve olculeri belli arsa icin duzenlenir. En guvenli tapu turudur.' },
    ],
  },
  {
    id: 'tapu-islemleri',
    title: 'Tapu Devir Islemleri',
    content: 'Arsa satin alindiginda tapu devir islemleri su asamalardan olusur:',
    steps: [
      'Taraflar arasinda anlasma ve satis bedelinin belirlenmesi',
      'Tapu mudurlugune randevu alinmasi',
      'Gerekli belgelerin hazirlanmasi (kimlik, vergi no, tapu fotokopisi, belediye rayic degeri)',
      'Tapu harci odemesi (alicindan %2, saticidan %2 — toplam %4)',
      'Tapu mudurlugunde devir isleminin tamamlanmasi',
      'Yeni tapu senedinin teslim alinmasi',
    ],
  },
  {
    id: 'serh-ipotek',
    title: 'Serh ve Ipotek Kontrolu',
    content: `Arsa almadan once tapu uzerinde "serh" veya "ipotek" olup olmadigini mutlaka kontrol edin. Serh, arsanin satis veya kullanimini kisitlayan resmi kayittir (ornegin haciz, ihtiyati tedbir, su havzasi koruma alani). Ipotek ise arsanin bir borca karsilik teminat gosterildigini belirtir. Bu bilgiler e-Devlet uzerinden veya tapu mudurlugunden sorgulanabilir.`,
  },
  {
    id: 'ihale-sureci',
    title: 'Ihale ile Arsa Alimi',
    content: `NetTapu uzerinden canli ihaleye katilarak arsa satin alabilirsiniz. Ihale sureci su sekilde isler:`,
    steps: [
      'Ihaleye katilmak istediginiz arsayi secin',
      'Teminat bedelini (kaparoyu) odeyin',
      'Ihale baslangic saatinde canli ihale odasina girin',
      'Teklifinizi verin ve diger katilimcilarla rekabet edin',
      'Ihaleyi kazanirsiniz — kalan odemeyi belirtilen surede tamamlayin',
      'Tapu devir islemi baslatilir',
    ],
  },
  {
    id: 'yatirim-ipuclari',
    title: 'Arsa Yatiriminda Dikkat Edilmesi Gerekenler',
    content: '',
    list: [
      { term: 'Konum', desc: 'Ulasim aglarina yakinlik, cevredeki gelisim projeleri ve altyapi durumunu arastirin.' },
      { term: 'Imar Plani', desc: 'Arsanin imari olup olmadigini, ne amacla kullanilabilecegini mutlaka kontrol edin.' },
      { term: 'Altyapi', desc: 'Yol, su, elektrik, dogalgaz ve kanalizasyon baglantisi olup olmadigini ogrenim.' },
      { term: 'Rayic Deger', desc: 'Belediye rayic degeri ve piyasa degerini karsilastirarak uygun fiyat analizi yapin.' },
      { term: 'Gelecek Potansiyeli', desc: 'Yakin cevrde planlanan otoyol, metro, havalimani gibi projeler degeri artirabilir.' },
      { term: 'Hukuki Durum', desc: 'Serh, ipotek, orman alani, sit alani gibi kisitlamalari kontrol edin.' },
    ],
  },
];

const glossary = [
  { term: 'Ada', desc: 'Kadastro planinda sinirlandirilmis arazi blogu' },
  { term: 'Parsel', desc: 'Ada icindeki bagimsiz arazi birimi' },
  { term: 'KAKS (Emsal)', desc: 'Toplam insaat alaninin arsa alanina orani' },
  { term: 'TAKS', desc: 'Taban oturma alaninin arsa alanina orani' },
  { term: 'Imar Durumu', desc: 'Arsanin yapilasma kosullarini gosteren belge' },
  { term: 'Hmax', desc: 'Yapinin ulasabilecegi maksimum yukseklik' },
  { term: 'Gabari', desc: 'Yapinin cephesinde izin verilen maksimum yukseklik' },
  { term: 'Cephe', desc: 'Arsanin yola bakan kismi / genisligi' },
  { term: 'Derinlik', desc: 'Arsanin yoldan iceri dogru uzunlugu' },
  { term: 'Iskan (Yapi Kullanma Izni)', desc: 'Binanin yasanilabilir oldugunu gosteren resmi belge' },
  { term: 'Kat Irtifaki', desc: 'Insaat halindeki yapilarda bagimsiz bolum hakki' },
  { term: 'Kat Mulkiyeti', desc: 'Tamamlanmis binalarda bagimsiz bolum mulkiyeti' },
  { term: 'Hisseli Tapu', desc: 'Birden fazla kisinin ortaklasa sahip oldugu tapu turu' },
  { term: 'Ipotek', desc: 'Arsanin borca karsilik teminat olarak gosterilmesi' },
  { term: 'Serh', desc: 'Tapu uzerine konulan kisitlama veya uyari kaydi' },
  { term: 'Kadastro', desc: 'Tasinmazlarin sinir ve sahiplik bilgilerinin belirlenmesi' },
  { term: 'Rayic Deger', desc: 'Belediyenin arsa/arazi icin belirledigi deger' },
  { term: 'Emlak Vergisi', desc: 'Tasinmaz sahiplerinin yillik odedigi vergi' },
  { term: 'Tapu Harci', desc: 'Alim-satim islemlerinde odenen devlet harci (toplam %4)' },
  { term: 'Cap Belgesi', desc: 'Arsanin sinirlari ve olculerini gosteren belge' },
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
          headline: 'Gayrimenkul Rehberi - Arsa, KAKS, TAKS, Imar ve Tapu Bilgileri',
          description: 'Arsa nedir, imar durumu, KAKS-TAKS hesaplama, tapu cesitleri ve devir islemleri rehberi.',
          author: { '@type': 'Organization', name: 'NetTapu' },
          publisher: { '@type': 'Organization', name: 'NetTapu' },
          mainEntityOfPage: 'https://nettapu.com/real-estate-guide',
        }}
      />
      <h1 className="text-2xl font-bold text-gray-900">Gayrimenkul Rehberi</h1>
      <p className="mt-2 text-sm text-gray-500">
        Arsa alim-satim sureclerinde bilmeniz gereken temel kavramlar, hesaplamalar ve islemler.
      </p>

      {/* Table of contents */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Icindekiler</h2>
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
            Gayrimenkul Sozlugu
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
          Gayrimenkul Sozlugu
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
        <h2 className="text-lg font-bold text-gray-900">Yatirima Baslayin</h2>
        <p className="mt-1 text-sm text-gray-500">Arsalari inceleyin, ihaleye katilim veya uzman danismanlarimizla gorusun.</p>
        <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
          <Link
            href="/parcels"
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            Arsalari Incele
          </Link>
          <Link
            href="/contact"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-white transition-colors"
          >
            Iletisim
          </Link>
        </div>
      </div>
    </div>
  );
}

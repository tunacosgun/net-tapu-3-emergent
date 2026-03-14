/**
 * JSON-LD structured data components for SEO.
 * Renders <script type="application/ld+json"> in the page head.
 */

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organization schema — use in root layout */
export function OrganizationJsonLd({
  name = 'NetTapu',
  url = 'https://nettapu.com',
  logo = 'https://nettapu.com/logo.png',
  description = 'Arsa ve gayrimenkul satisi icin Turkiye\'nin guvenilir canli acik artirma platformu.',
}: {
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name,
        url,
        logo,
        description,
        sameAs: [],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          availableLanguage: 'Turkish',
        },
      }}
    />
  );
}

/** WebSite schema with search action */
export function WebSiteJsonLd({
  name = 'NetTapu',
  url = 'https://nettapu.com',
}: {
  name?: string;
  url?: string;
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name,
        url,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${url}/parcels?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  );
}

/** BreadcrumbList schema */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}

/** FAQPage schema — for FAQ page */
export function FaqJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions.map((q) => ({
          '@type': 'Question',
          name: q.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.answer,
          },
        })),
      }}
    />
  );
}

/** RealEstateAgent schema — for the platform */
export function RealEstateAgentJsonLd({
  name = 'NetTapu',
  url = 'https://nettapu.com',
  description = 'Online gayrimenkul acik artirma platformu.',
}: {
  name?: string;
  url?: string;
  description?: string;
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'RealEstateAgent',
        name,
        url,
        description,
        areaServed: {
          '@type': 'Country',
          name: 'Turkey',
        },
      }}
    />
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import type { ContentBlock, StatsBlock } from './block-editor';

interface BlockRendererProps {
  blocks: ContentBlock[];
}

export function CmsBlockRenderer({ blocks }: BlockRendererProps) {
  return (
    <div className="space-y-8">
      {blocks.map((block, idx) => (
        <RenderBlock key={idx} block={block} />
      ))}
    </div>
  );
}

function RenderBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'hero':
      return (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${block.gradient} p-6 sm:p-10 text-white`}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-xl" />
          <div className="relative">
            <h1 className="text-3xl sm:text-4xl font-bold">{block.title}</h1>
            {block.subtitle && (
              <p className="mt-3 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">{block.subtitle}</p>
            )}
          </div>
        </div>
      );

    case 'text':
      return (
        <div
          className="prose prose-lg max-w-none
            prose-headings:text-[var(--foreground)] prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[var(--border)]
            prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-3
            prose-p:text-[var(--muted-foreground)] prose-p:leading-relaxed
            prose-a:text-brand-500 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[var(--foreground)]
            prose-ul:text-[var(--muted-foreground)] prose-ol:text-[var(--muted-foreground)]
            prose-li:marker:text-brand-400
            prose-blockquote:border-l-brand-400 prose-blockquote:bg-brand-50/50 prose-blockquote:rounded-r-lg"
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      );

    case 'cards':
      return (
        <div>
          {block.heading && <h2 className="text-2xl font-bold text-[var(--foreground)]">{block.heading}</h2>}
          {block.subtitle && <p className="mt-2 text-[var(--muted-foreground)]">{block.subtitle}</p>}
          <div className={`mt-6 grid gap-5 ${
            block.columns === 2 ? 'sm:grid-cols-2' : block.columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'
          }`}>
            {block.items.map((item, i) => (
              <div key={i} className="group rounded-xl border border-[var(--border)] p-5 transition-all hover:shadow-lg hover:border-brand-200">
                <span className="text-2xl">{item.icon}</span>
                <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{item.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'stats':
      return block.useLiveData ? <LiveStatsRenderer /> : <ManualStatsRenderer block={block} />;

    case 'steps':
      return (
        <div>
          {block.heading && <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">{block.heading}</h2>}
          <div className="space-y-4">
            {block.items.map((item, i) => (
              <div key={i} className="flex gap-4 rounded-xl border border-[var(--border)] p-5 transition-all hover:shadow-md hover:border-brand-200">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)] leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'cta':
      return (
        <div className={`rounded-2xl bg-gradient-to-r ${block.gradient} p-6 sm:p-8 text-center text-white`}>
          <h2 className="text-xl sm:text-2xl font-bold">{block.title}</h2>
          {block.subtitle && <p className="mt-2 text-sm sm:text-base text-white/70">{block.subtitle}</p>}
          <Link
            href={block.buttonLink}
            className="mt-5 inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-gray-800 shadow-md hover:bg-gray-50 transition-colors"
          >
            {block.buttonText}
          </Link>
        </div>
      );

    case 'quote':
      return (
        <div className="rounded-xl border-l-4 border-brand-500 bg-brand-50/50 p-5 sm:p-6">
          <blockquote className="text-base sm:text-lg italic text-[var(--foreground)] leading-relaxed">
            &ldquo;{block.text}&rdquo;
          </blockquote>
          {block.author && (
            <p className="mt-3 text-sm font-medium text-brand-600">— {block.author}</p>
          )}
        </div>
      );

    case 'checklist':
      return (
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-6">
          {block.heading && <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">{block.heading}</h2>}
          <ul className="space-y-3">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-[var(--foreground)]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case 'table':
      return (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--muted)]">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-semibold text-[var(--foreground)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-[var(--border)]">
                  {row.cells.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-[var(--muted-foreground)]">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'spacer':
      return <div className={block.size === 'sm' ? 'h-4' : block.size === 'lg' ? 'h-16' : 'h-8'} />;
  }
}

/* ── Manual Stats ── */
function ManualStatsRenderer({ block }: { block: StatsBlock }) {
  return (
    <div className={`grid gap-4 grid-cols-2 ${block.items.length >= 4 ? 'sm:grid-cols-4' : `sm:grid-cols-${block.items.length}`}`}>
      {block.items.map((item, i) => (
        <div key={i} className="rounded-xl border border-brand-200 bg-brand-50/50 p-5 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-brand-600">{item.value}</p>
          <p className="mt-1 text-xs sm:text-sm text-brand-700">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Live Stats (fetches from /content/stats) ── */
interface LiveStats {
  totalParcels: number;
  totalUsers: number;
  completedAuctions: number;
  activeCities: number;
}

function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 1000).toFixed(0)}K+`;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace('.0', '')}K+`;
  return num.toLocaleString('tr-TR');
}

function LiveStatsRenderer() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<LiveStats>('/content/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = stats ? [
    { value: formatNumber(stats.totalParcels), label: 'Arsa İlanı', icon: '🏠' },
    { value: formatNumber(stats.totalUsers), label: 'Kayıtlı Üye', icon: '👥' },
    { value: formatNumber(stats.completedAuctions), label: 'Tamamlanan İhale', icon: '🔨' },
    { value: formatNumber(stats.activeCities), label: 'Aktif İl', icon: '📍' },
  ] : [];

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-brand-200 bg-brand-50/50 p-5 text-center animate-pulse">
            <div className="mx-auto h-8 w-16 rounded bg-brand-200" />
            <div className="mx-auto mt-2 h-4 w-20 rounded bg-brand-100" />
          </div>
        ))
      ) : (
        items.map((item, i) => (
          <div key={i} className="group rounded-xl border border-brand-200 bg-brand-50/50 p-5 text-center transition-all hover:shadow-md hover:border-brand-300">
            <span className="text-lg">{item.icon}</span>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-brand-600">{item.value}</p>
            <p className="mt-1 text-xs sm:text-sm text-brand-700">{item.label}</p>
          </div>
        ))
      )}
    </div>
  );
}

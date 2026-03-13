'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert } from '@/components/ui';
import { CmsBlockRenderer } from './cms-block-renderer';
import { htmlToBlocks } from './block-editor';
import type { CmsPage } from '@/types';

interface CmsPageRendererProps {
  slug: string;
  showHero?: boolean;
  subtitle?: string;
  heroIcon?: string;
  fallback?: React.ReactNode;
}

export function CmsPageRenderer({
  slug,
  showHero = true,
  subtitle,
  heroIcon,
  fallback,
}: CmsPageRendererProps) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<CmsPage>(`/content/pages/${slug}`);
      setPage(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        if (fallback) {
          setError(null);
        } else {
          setError('Bu sayfa henüz yayınlanmamış. Lütfen daha sonra tekrar deneyin.');
        }
      } else {
        setError('Sayfa yüklenirken bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  }, [slug, fallback]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  if (loading) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="mt-3 text-sm text-amber-800">{error}</p>
      </div>
    );
  }

  if (!page && fallback) return <>{fallback}</>;
  if (!page) return null;

  // Check if content uses block format (nt- classes) or JSON block array
  const isBlockContent = page.content && page.content.includes('nt-');

  // Check if content is a JSON array of blocks like [{"type":"heading","data":{...}},...]
  let jsonBlocks: Array<{ type: string; data: Record<string, unknown> }> | null = null;
  if (page.content && page.content.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(page.content);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
        jsonBlocks = parsed;
      }
    } catch {
      // Not JSON, continue with legacy rendering
    }
  }

  if (jsonBlocks) {
    return (
      <article>
        {showHero && (
          <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 px-8 py-10 text-white">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
            <div className="relative">
              {heroIcon && (
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={heroIcon} />
                  </svg>
                </div>
              )}
              <h1 className="text-3xl font-bold lg:text-4xl">{page.title}</h1>
              {subtitle && <p className="mt-2 text-base text-white/80 lg:text-lg">{subtitle}</p>}
            </div>
          </div>
        )}

        <div className="cms-content prose prose-lg max-w-none prose-headings:text-[var(--foreground)] prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[var(--border)] prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-[var(--muted-foreground)] prose-p:leading-relaxed">
          {jsonBlocks.map((block, idx) => {
            if (block.type === 'heading') {
              const level = (block.data.level as number) || 2;
              const text = (block.data.text as string) || '';
              if (level === 1) return <h1 key={idx}>{text}</h1>;
              if (level === 2) return <h2 key={idx}>{text}</h2>;
              if (level === 3) return <h3 key={idx}>{text}</h3>;
              return <h4 key={idx}>{text}</h4>;
            }
            if (block.type === 'paragraph') {
              return <p key={idx}>{(block.data.text as string) || ''}</p>;
            }
            if (block.type === 'list') {
              const items = (block.data.items as string[]) || [];
              const style = block.data.style;
              if (style === 'ordered') {
                return <ol key={idx}>{items.map((item, i) => <li key={i}>{item}</li>)}</ol>;
              }
              return <ul key={idx}>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
            }
            if (block.type === 'quote') {
              return (
                <blockquote key={idx} className="border-l-4 border-brand-400 bg-brand-50/50 rounded-r-lg py-3 px-4">
                  <p>{(block.data.text as string) || ''}</p>
                  {block.data.caption && <cite className="text-sm text-[var(--muted-foreground)]">{String(block.data.caption)}</cite>}
                </blockquote>
              );
            }
            if (block.type === 'image') {
              return (
                <figure key={idx}>
                  <img src={block.data.url as string} alt={(block.data.caption as string) || ''} className="rounded-xl shadow-md" />
                  {block.data.caption && <figcaption className="text-center text-sm text-[var(--muted-foreground)] mt-2">{String(block.data.caption)}</figcaption>}
                </figure>
              );
            }
            if (block.type === 'delimiter') {
              return <hr key={idx} className="my-8" />;
            }
            return null;
          })}
        </div>

        {page.updatedAt && (
          <div className="mt-10 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Son güncelleme: {new Date(page.updatedAt).toLocaleDateString('tr-TR', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
        )}
      </article>
    );
  }

  if (isBlockContent) {
    const blocks = htmlToBlocks(page.content!);
    return (
      <article>
        <CmsBlockRenderer blocks={blocks} />
        {page.updatedAt && (
          <div className="mt-10 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Son güncelleme: {new Date(page.updatedAt).toLocaleDateString('tr-TR', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
        )}
      </article>
    );
  }

  // Legacy: render as HTML content
  return (
    <article>
      {showHero && (
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 px-8 py-10 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
          <div className="relative">
            {heroIcon && (
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={heroIcon} />
                </svg>
              </div>
            )}
            <h1 className="text-3xl font-bold lg:text-4xl">{page.title}</h1>
            {subtitle && <p className="mt-2 text-base text-white/80 lg:text-lg">{subtitle}</p>}
          </div>
        </div>
      )}

      {!showHero && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">{page.title}</h1>
          {subtitle && <p className="mt-2 text-lg text-[var(--muted-foreground)]">{subtitle}</p>}
        </div>
      )}

      {page.content && (
        <div
          className="cms-content prose prose-lg max-w-none
            prose-headings:text-[var(--foreground)] prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[var(--border)]
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-[var(--muted-foreground)] prose-p:leading-relaxed
            prose-a:text-brand-500 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[var(--foreground)]
            prose-ul:text-[var(--muted-foreground)] prose-ol:text-[var(--muted-foreground)]
            prose-li:marker:text-brand-400
            prose-blockquote:border-l-brand-400 prose-blockquote:bg-brand-50/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4
            prose-img:rounded-xl prose-img:shadow-md
            prose-table:overflow-hidden prose-table:rounded-lg prose-table:border prose-table:border-[var(--border)]
            prose-th:bg-[var(--muted)] prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
            prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-[var(--border)]"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      )}

      {page.updatedAt && (
        <div className="mt-10 border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Son güncelleme: {new Date(page.updatedAt).toLocaleDateString('tr-TR', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
      )}
    </article>
  );
}

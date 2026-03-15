'use client';

import { useState } from 'react';

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
  extraInfo?: string;
}

export function ShareButtons({ url, title, description, extraInfo }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description || '');

  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const whatsappText = extraInfo ? `${title}\n${extraInfo}\n${url}` : `${title} ${url}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const buttonClass =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-[var(--muted-foreground)] mr-1">Paylaş:</span>

      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonClass} bg-[#1877F2] text-white hover:bg-[#166FE5]`}
      >
        Facebook
      </a>

      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonClass} bg-[#1DA1F2] text-white hover:bg-[#1A91DA]`}
      >
        Twitter
      </a>

      <a
        href={whatsappShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonClass} bg-[#25D366] text-white hover:bg-[#22C55E]`}
      >
        WhatsApp
      </a>

      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonClass} bg-[#0A66C2] text-white hover:bg-[#004182]`}
      >
        LinkedIn
      </a>

      <button
        onClick={handleCopyLink}
        className={`${buttonClass} border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]`}
      >
        {copied ? '✓ Kopyalandı' : '🔗 Link Kopyala'}
      </button>
    </div>
  );
}

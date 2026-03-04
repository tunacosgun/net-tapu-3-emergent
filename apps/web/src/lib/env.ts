function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  // Server-only
  API_URL: optional('API_URL', 'http://localhost:3000'),
  AUCTION_API_URL: optional('AUCTION_API_URL', 'http://localhost:3001'),

  // Public (browser-safe)
  NEXT_PUBLIC_API_URL: optional('NEXT_PUBLIC_API_URL', 'http://localhost:3002/api/v1'),
  NEXT_PUBLIC_WS_URL: optional('NEXT_PUBLIC_WS_URL', 'http://localhost:3001'),
  NEXT_PUBLIC_SITE_URL: optional('NEXT_PUBLIC_SITE_URL', 'http://localhost:3002'),
} as const;

// Validate critical env at build/startup (production only)
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  required('API_URL');
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import apiClient from '@/lib/api-client';

interface SpinWheelSegment {
  label: string;
  color: string;
  key: string;
}

interface SpinWheelProps {
  onResult?: (prize: { key: string; label: string; discountCode: string | null }) => void;
}

const DEFAULT_SEGMENTS: SpinWheelSegment[] = [
  { label: '%5 İndirim', color: '#16a34a', key: 'discount_5' },
  { label: 'Ücretsiz Danışmanlık', color: '#2563eb', key: 'free_consult' },
  { label: '%10 İndirim', color: '#dc2626', key: 'discount_10' },
  { label: 'Tekrar Dene', color: '#9333ea', key: 'retry' },
  { label: '%3 İndirim', color: '#ea580c', key: 'discount_3' },
  { label: 'VIP Üyelik', color: '#0891b2', key: 'vip_1month' },
  { label: '%15 İndirim', color: '#e11d48', key: 'discount_15' },
  { label: 'Hediye Çek', color: '#65a30d', key: 'gift_card' },
];

export function SpinWheel({ onResult }: SpinWheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{
    key: string;
    label: string;
    discountCode: string | null;
  } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [eligible, setEligible] = useState(true);
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null);
  const [nextSpinAt, setNextSpinAt] = useState<Date | null>(null);
  const [segments, setSegments] = useState<SpinWheelSegment[]>(DEFAULT_SEGMENTS);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const segmentAngle = 360 / segments.length;

  // Check eligibility on mount
  useEffect(() => {
    apiClient
      .get<{
        eligible: boolean;
        reason?: string;
        nextSpinAt?: string;
        prizes: Array<{ key: string; label: string; color: string }>;
      }>('/campaigns/spin/eligibility')
      .then(({ data }) => {
        setEligible(data.eligible);
        setEligibilityReason(data.reason ?? null);
        if (data.nextSpinAt) setNextSpinAt(new Date(data.nextSpinAt));
        if (data.prizes?.length > 0) {
          setSegments(data.prizes);
        }
      })
      .catch(() => {
        // Not authenticated or no campaign — disable
        setEligible(false);
        setEligibilityReason('Çark çevirmek için giriş yapmalısınız.');
      });
  }, []);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;

    ctx.clearRect(0, 0, size, size);

    segments.forEach((segment, i) => {
      const startAngle = (i * segmentAngle * Math.PI) / 180;
      const endAngle = ((i + 1) * segmentAngle * Math.PI) / 180;

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      const midAngle = startAngle + (endAngle - startAngle) / 2;
      const textRadius = radius * 0.65;
      const x = center + textRadius * Math.cos(midAngle);
      const y = center + textRadius * Math.sin(midAngle);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(midAngle);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(segment.label, 0, 0);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [segments, segmentAngle]);

  // Draw wheel on mount and when segments change
  useEffect(() => {
    const timer = setTimeout(drawWheel, 100);
    return () => clearTimeout(timer);
  }, [drawWheel]);

  const spin = useCallback(async () => {
    if (spinning || !eligible) return;

    setSpinning(true);
    setResult(null);

    try {
      // Call backend to get the actual prize (server-determined)
      const { data } = await apiClient.post<{
        prize: { key: string; label: string; color: string };
        discountCode: string | null;
        expiresAt: string;
      }>('/campaigns/spin');

      // Find the winning segment index
      const winnerIndex = segments.findIndex((s) => s.key === data.prize.key);
      const targetIdx = winnerIndex >= 0 ? winnerIndex : 0;

      // Calculate rotation to land on the winning segment
      const fullRotations = 3 + Math.floor(Math.random() * 3);
      // The pointer is at the top (12 o'clock).
      // We need the segment's center aligned with the pointer.
      const targetAngle = 360 - (targetIdx * segmentAngle + segmentAngle / 2);
      const totalRotation = fullRotations * 360 + targetAngle;

      setRotation((prev) => prev + totalRotation);

      // Show result after animation completes
      setTimeout(() => {
        const prize = {
          key: data.prize.key,
          label: data.prize.label,
          discountCode: data.discountCode,
        };
        setResult(prize);
        setSpinning(false);
        setEligible(false);
        setEligibilityReason('Günde bir kez çark çevirebilirsiniz.');
        setNextSpinAt(new Date(Date.now() + 24 * 60 * 60 * 1000));
        onResult?.(prize);
      }, 4000);
    } catch (err: unknown) {
      setSpinning(false);
      const message =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Bir hata oluştu.')
          : 'Bir hata oluştu.';
      setEligibilityReason(message);
      setEligible(false);
    }
  }, [spinning, eligible, segments, segmentAngle, onResult]);

  // Countdown timer for next spin
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (!nextSpinAt) return;

    const update = () => {
      const diff = nextSpinAt.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        setEligible(true);
        setEligibilityReason(null);
        setNextSpinAt(null);
        return;
      }
      const hours = Math.floor(diff / (60 * 60 * 1000));
      const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((diff % (60 * 1000)) / 1000);
      setCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextSpinAt]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {/* Pointer arrow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-red-600" />
        </div>

        {/* Wheel */}
        <div
          className="transition-transform ease-out"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionDuration: spinning ? '4s' : '0s',
            transitionTimingFunction: 'cubic-bezier(0.17, 0.67, 0.12, 0.99)',
          }}
        >
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="rounded-full shadow-lg"
          />
        </div>
      </div>

      {/* Spin button */}
      <button
        onClick={spin}
        disabled={spinning || !eligible}
        className={`rounded-full px-8 py-3 text-lg font-bold text-white shadow-lg transition-all ${
          spinning || !eligible
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-brand-500 hover:bg-brand-600 hover:scale-105 active:scale-95'
        }`}
      >
        {spinning ? 'Dönüyor...' : 'Çevir!'}
      </button>

      {/* Countdown to next spin */}
      {countdown && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Sonraki çevirme: <span className="font-mono font-semibold">{countdown}</span>
        </p>
      )}

      {/* Ineligibility reason */}
      {!eligible && eligibilityReason && !countdown && (
        <p className="text-sm text-[var(--muted-foreground)]">{eligibilityReason}</p>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl bg-brand-50 border border-brand-200 p-4 text-center animate-bounce">
          <p className="text-sm text-brand-600 font-medium">Tebrikler!</p>
          <p className="text-lg font-bold text-brand-700 mt-1">{result.label}</p>
          {result.discountCode && (
            <div className="mt-2">
              <p className="text-xs text-[var(--muted-foreground)]">İndirim kodunuz:</p>
              <p className="mt-1 font-mono text-lg font-bold text-brand-600 bg-white rounded-lg px-4 py-2 border border-brand-200 select-all">
                {result.discountCode}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                30 gün içinde kullanabilirsiniz.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

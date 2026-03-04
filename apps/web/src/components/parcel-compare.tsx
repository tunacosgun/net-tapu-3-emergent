'use client';

import { useCompareStore } from '@/stores/compare-store';
import { formatPrice } from '@/lib/format';
import { parcelStatusConfig } from '@/components/ui/badge';
import { Badge, Button } from '@/components/ui';

/** Floating bar that appears when parcels are selected for comparison */
export function CompareBar() {
  const { selectedParcels, clearAll, openModal } = useCompareStore();

  if (selectedParcels.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-xl bg-brand-600 px-6 py-3 shadow-xl text-white">
      <span className="text-sm font-medium">
        {selectedParcels.length} arsa seçildi
      </span>
      <Button
        onClick={openModal}
        variant="secondary"
        size="sm"
        className="bg-white text-brand-700 hover:bg-brand-50"
        disabled={selectedParcels.length < 2}
      >
        Karşılaştır
      </Button>
      <button onClick={clearAll} className="text-white/70 hover:text-white text-sm">
        Temizle
      </button>
    </div>
  );
}

/** Full comparison modal/table */
export function CompareModal() {
  const { selectedParcels, isOpen, closeModal, toggleParcel } = useCompareStore();

  if (!isOpen) return null;

  const rows: { label: string; getValue: (p: (typeof selectedParcels)[0]) => string }[] = [
    {
      label: 'Durum',
      getValue: (p) => parcelStatusConfig(p.status).label,
    },
    {
      label: 'Şehir',
      getValue: (p) => p.city,
    },
    {
      label: 'İlçe',
      getValue: (p) => p.district,
    },
    {
      label: 'Mahalle',
      getValue: (p) => p.neighborhood || '—',
    },
    {
      label: 'Fiyat',
      getValue: (p) => formatPrice(p.price),
    },
    {
      label: 'Alan (m²)',
      getValue: (p) =>
        p.areaM2 ? Number(p.areaM2).toLocaleString('tr-TR') + ' m²' : '—',
    },
    {
      label: 'Fiyat / m²',
      getValue: (p) => (p.pricePerM2 ? formatPrice(p.pricePerM2) : '—'),
    },
    {
      label: 'İmar Durumu',
      getValue: (p) => p.zoningStatus || '—',
    },
    {
      label: 'Arazi Türü',
      getValue: (p) => p.landType || '—',
    },
    {
      label: 'Ada / Parsel',
      getValue: (p) =>
        p.ada && p.parsel ? `${p.ada} / ${p.parsel}` : '—',
    },
    {
      label: 'Açık Artırma',
      getValue: (p) => (p.isAuctionEligible ? 'Evet' : 'Hayır'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-xl bg-[var(--background)] shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] p-4 z-10">
          <h2 className="text-lg font-semibold">
            Arsa Karşılaştırma ({selectedParcels.length})
          </h2>
          <button
            onClick={closeModal}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-3 pr-4 text-left font-medium text-[var(--muted-foreground)] w-32">
                  Özellik
                </th>
                {selectedParcels.map((p) => (
                  <th
                    key={p.id}
                    className="py-3 px-4 text-left font-semibold min-w-[200px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="truncate max-w-[180px]">{p.title}</p>
                        <p className="text-xs text-[var(--muted-foreground)] font-normal">
                          {p.listingId}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleParcel(p)}
                        className="text-[var(--muted-foreground)] hover:text-red-500 text-xs"
                        title="Karşılaştırmadan çıkar"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-[var(--border)] hover:bg-[var(--muted)]"
                >
                  <td className="py-3 pr-4 text-[var(--muted-foreground)] font-medium">
                    {row.label}
                  </td>
                  {selectedParcels.map((p) => (
                    <td key={p.id} className="py-3 px-4">
                      {row.getValue(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

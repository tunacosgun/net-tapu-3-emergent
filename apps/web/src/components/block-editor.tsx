'use client';

import { useState, useCallback } from 'react';
import { RichTextEditor } from './rich-text-editor';

/* ── Block Types ── */
export type BlockType = 'hero' | 'text' | 'cards' | 'stats' | 'steps' | 'cta' | 'quote' | 'checklist' | 'table' | 'spacer';

export interface HeroBlock { type: 'hero'; title: string; subtitle: string; gradient: string }
export interface TextBlock { type: 'text'; content: string }
export interface CardItem { icon: string; title: string; description: string }
export interface CardsBlock { type: 'cards'; heading: string; subtitle: string; columns: 2 | 3 | 4; items: CardItem[] }
export interface StatItem { value: string; label: string }
export interface StatsBlock { type: 'stats'; useLiveData?: boolean; items: StatItem[] }
export interface StepItem { title: string; description: string }
export interface StepsBlock { type: 'steps'; heading: string; items: StepItem[] }
export interface CtaBlock { type: 'cta'; title: string; subtitle: string; buttonText: string; buttonLink: string; gradient: string }
export interface QuoteBlock { type: 'quote'; text: string; author: string }
export interface ChecklistBlock { type: 'checklist'; heading: string; items: string[] }
export interface TableRow { cells: string[] }
export interface TableBlock { type: 'table'; headers: string[]; rows: TableRow[] }
export interface SpacerBlock { type: 'spacer'; size: 'sm' | 'md' | 'lg' }

export type ContentBlock =
  | HeroBlock | TextBlock | CardsBlock | StatsBlock | StepsBlock
  | CtaBlock | QuoteBlock | ChecklistBlock | TableBlock | SpacerBlock;

/* ── Default blocks ── */
const defaultBlocks: Record<BlockType, () => ContentBlock> = {
  hero: () => ({ type: 'hero', title: '', subtitle: '', gradient: 'from-brand-500 to-brand-700' }),
  text: () => ({ type: 'text', content: '' }),
  cards: () => ({ type: 'cards', heading: '', subtitle: '', columns: 3, items: [{ icon: '🏠', title: '', description: '' }] }),
  stats: () => ({ type: 'stats', useLiveData: false, items: [{ value: '', label: '' }] }),
  steps: () => ({ type: 'steps', heading: '', items: [{ title: '', description: '' }] }),
  cta: () => ({ type: 'cta', title: '', subtitle: '', buttonText: 'Keşfet', buttonLink: '/parcels', gradient: 'from-brand-500 to-brand-600' }),
  quote: () => ({ type: 'quote', text: '', author: '' }),
  checklist: () => ({ type: 'checklist', heading: '', items: [''] }),
  table: () => ({ type: 'table', headers: ['Başlık 1', 'Başlık 2'], rows: [{ cells: ['', ''] }] }),
  spacer: () => ({ type: 'spacer', size: 'md' }),
};

const blockLabels: Record<BlockType, { label: string; icon: string; desc: string }> = {
  hero: { label: 'Hero Banner', icon: '🎨', desc: 'Gradient başlık bölümü' },
  text: { label: 'Metin Bloğu', icon: '📝', desc: 'Zengin metin editörü' },
  cards: { label: 'Kart Grid', icon: '🃏', desc: 'İkonlu bilgi kartları' },
  stats: { label: 'İstatistikler', icon: '📊', desc: 'Sayısal göstergeler' },
  steps: { label: 'Adımlar', icon: '🔢', desc: 'Numaralı adım listesi' },
  cta: { label: 'CTA Butonu', icon: '🔘', desc: 'Aksiyon çağrısı bölümü' },
  quote: { label: 'Alıntı', icon: '💬', desc: 'Vurgulanan alıntı' },
  checklist: { label: 'Kontrol Listesi', icon: '✅', desc: 'Madde işaretli liste' },
  table: { label: 'Tablo', icon: '📋', desc: 'Veri tablosu' },
  spacer: { label: 'Boşluk', icon: '↕️', desc: 'Dikey boşluk' },
};

const gradientOptions = [
  { value: 'from-brand-500 to-brand-700', label: 'Marka (Yeşil)' },
  { value: 'from-indigo-600 to-violet-600', label: 'Mor' },
  { value: 'from-emerald-600 to-teal-500', label: 'Deniz Yeşili' },
  { value: 'from-amber-600 to-orange-500', label: 'Turuncu' },
  { value: 'from-slate-700 to-slate-900', label: 'Koyu' },
  { value: 'from-blue-500 to-blue-700', label: 'Mavi' },
  { value: 'from-rose-500 to-pink-600', label: 'Pembe' },
];

/* ── Main Component ── */
interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [showAddMenu, setShowAddMenu] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const updateBlock = useCallback((index: number, updated: ContentBlock) => {
    const next = [...blocks];
    next[index] = updated;
    onChange(next);
  }, [blocks, onChange]);

  const removeBlock = useCallback((index: number) => {
    if (!confirm('Bu bloğu silmek istediğinize emin misiniz?')) return;
    onChange(blocks.filter((_, i) => i !== index));
  }, [blocks, onChange]);

  const moveBlock = useCallback((from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }, [blocks, onChange]);

  const addBlock = useCallback((type: BlockType, atIndex: number) => {
    const next = [...blocks];
    next.splice(atIndex, 0, defaultBlocks[type]());
    onChange(next);
    setShowAddMenu(null);
  }, [blocks, onChange]);

  const duplicateBlock = useCallback((index: number) => {
    const next = [...blocks];
    next.splice(index + 1, 0, JSON.parse(JSON.stringify(blocks[index])));
    onChange(next);
  }, [blocks, onChange]);

  return (
    <div className="space-y-3">
      {/* Add block at the top if empty */}
      {blocks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] p-10">
          <p className="text-sm text-[var(--muted-foreground)] mb-4">Henüz içerik bloğu eklenmedi</p>
          <AddBlockButton onClick={() => setShowAddMenu(-1)} />
          {showAddMenu === -1 && (
            <AddBlockMenu
              onSelect={(type) => addBlock(type, 0)}
              onClose={() => setShowAddMenu(null)}
            />
          )}
        </div>
      )}

      {blocks.map((block, idx) => (
        <div key={idx}>
          {/* Block */}
          <div
            className={`group relative rounded-xl border transition-all ${
              dragIdx === idx ? 'border-brand-400 shadow-lg scale-[1.01]' : 'border-[var(--border)] hover:border-brand-200'
            }`}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveBlock(dragIdx, idx); setDragIdx(null); }}
            onDragEnd={() => setDragIdx(null)}
          >
            {/* Block Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--muted)] px-3 py-2 rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="cursor-grab text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Sürükle">⠿</span>
                <span className="text-sm">{blockLabels[block.type].icon}</span>
                <span className="text-xs font-semibold text-[var(--foreground)]">{blockLabels[block.type].label}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => moveBlock(idx, idx - 1)} disabled={idx === 0} className="rounded p-1 text-xs hover:bg-[var(--background)] disabled:opacity-30" title="Yukarı">↑</button>
                <button type="button" onClick={() => moveBlock(idx, idx + 1)} disabled={idx === blocks.length - 1} className="rounded p-1 text-xs hover:bg-[var(--background)] disabled:opacity-30" title="Aşağı">↓</button>
                <button type="button" onClick={() => duplicateBlock(idx)} className="rounded p-1 text-xs hover:bg-[var(--background)]" title="Kopyala">⧉</button>
                <button type="button" onClick={() => removeBlock(idx)} className="rounded p-1 text-xs text-red-500 hover:bg-red-50" title="Sil">✕</button>
              </div>
            </div>

            {/* Block Content Editor */}
            <div className="p-4">
              <BlockContentEditor block={block} onChange={(updated) => updateBlock(idx, updated)} />
            </div>
          </div>

          {/* Add block between */}
          <div className="relative flex items-center justify-center py-1">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--border)] opacity-0 group-hover:opacity-100" />
            <AddBlockButton onClick={() => setShowAddMenu(showAddMenu === idx ? null : idx)} small />
            {showAddMenu === idx && (
              <AddBlockMenu
                onSelect={(type) => addBlock(type, idx + 1)}
                onClose={() => setShowAddMenu(null)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Add Block Button ── */
function AddBlockButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative z-10 flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:border-brand-300 hover:text-brand-500 transition-all ${
        small ? 'px-2 py-0.5 text-xs' : 'px-4 py-2 text-sm font-medium'
      }`}
    >
      <span className="text-brand-500 font-bold">+</span>
      {!small && 'Blok Ekle'}
    </button>
  );
}

/* ── Add Block Menu ── */
function AddBlockMenu({ onSelect, onClose }: { onSelect: (type: BlockType) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 mt-2 top-full left-1/2 -translate-x-1/2 w-80 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl p-2 grid grid-cols-2 gap-1">
        {(Object.entries(blockLabels) as [BlockType, { label: string; icon: string; desc: string }][]).map(([type, meta]) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className="flex items-start gap-2 rounded-lg p-2.5 text-left hover:bg-brand-50 transition-colors"
          >
            <span className="text-lg">{meta.icon}</span>
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)]">{meta.label}</p>
              <p className="text-[10px] text-[var(--muted-foreground)]">{meta.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/* ── Block Content Editors ── */
function BlockContentEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  switch (block.type) {
    case 'hero': return <HeroEditor block={block} onChange={onChange} />;
    case 'text': return <TextEditor block={block} onChange={onChange} />;
    case 'cards': return <CardsEditor block={block} onChange={onChange} />;
    case 'stats': return <StatsEditor block={block} onChange={onChange} />;
    case 'steps': return <StepsEditor block={block} onChange={onChange} />;
    case 'cta': return <CtaEditor block={block} onChange={onChange} />;
    case 'quote': return <QuoteEditor block={block} onChange={onChange} />;
    case 'checklist': return <ChecklistEditor block={block} onChange={onChange} />;
    case 'table': return <TableEditor block={block} onChange={onChange} />;
    case 'spacer': return <SpacerEditor block={block} onChange={onChange} />;
  }
}

/* ── Shared field component ── */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">{label}</label>
      {children}
    </div>
  );
}
const input = 'w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-200';
const selectCls = input;

/* ── Hero Editor ── */
function HeroEditor({ block, onChange }: { block: HeroBlock; onChange: (b: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className={`rounded-lg bg-gradient-to-r ${block.gradient} p-4 text-white`}>
        <p className="text-lg font-bold">{block.title || 'Başlık...'}</p>
        <p className="text-sm text-white/70">{block.subtitle || 'Alt başlık...'}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Başlık">
          <input className={input} value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Sayfa başlığı" />
        </Field>
        <Field label="Gradient Renk">
          <select className={selectCls} value={block.gradient} onChange={(e) => onChange({ ...block, gradient: e.target.value })}>
            {gradientOptions.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Alt Başlık">
        <input className={input} value={block.subtitle} onChange={(e) => onChange({ ...block, subtitle: e.target.value })} placeholder="Kısa açıklama" />
      </Field>
    </div>
  );
}

/* ── Text Editor ── */
function TextEditor({ block, onChange }: { block: TextBlock; onChange: (b: ContentBlock) => void }) {
  return (
    <RichTextEditor
      value={block.content}
      onChange={(val) => onChange({ ...block, content: val })}
      placeholder="İçerik yazın..."
    />
  );
}

/* ── Cards Editor ── */
function CardsEditor({ block, onChange }: { block: CardsBlock; onChange: (b: ContentBlock) => void }) {
  const updateItem = (idx: number, field: keyof CardItem, val: string) => {
    const items = [...block.items];
    items[idx] = { ...items[idx], [field]: val };
    onChange({ ...block, items });
  };
  const addItem = () => onChange({ ...block, items: [...block.items, { icon: '📌', title: '', description: '' }] });
  const removeItem = (idx: number) => onChange({ ...block, items: block.items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bölüm Başlığı">
          <input className={input} value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} placeholder="Kartlar başlığı" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Alt Başlık">
            <input className={input} value={block.subtitle} onChange={(e) => onChange({ ...block, subtitle: e.target.value })} />
          </Field>
          <Field label="Sütun">
            <select className={selectCls} value={block.columns} onChange={(e) => onChange({ ...block, columns: parseInt(e.target.value) as 2 | 3 | 4 })}>
              <option value={2}>2 Sütun</option>
              <option value={3}>3 Sütun</option>
              <option value={4}>4 Sütun</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        {block.items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start rounded-lg border border-[var(--border)] p-3 bg-[var(--muted)]/30">
            <div className="shrink-0 w-12">
              <Field label="İkon">
                <input className={`${input} text-center text-lg`} value={item.icon} onChange={(e) => updateItem(idx, 'icon', e.target.value)} />
              </Field>
            </div>
            <div className="flex-1 grid gap-2 sm:grid-cols-2">
              <Field label="Başlık">
                <input className={input} value={item.title} onChange={(e) => updateItem(idx, 'title', e.target.value)} />
              </Field>
              <Field label="Açıklama">
                <input className={input} value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
              </Field>
            </div>
            <button type="button" onClick={() => removeItem(idx)} className="mt-5 text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addItem} className="rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:border-brand-300 hover:text-brand-500">
        + Kart Ekle
      </button>
    </div>
  );
}

/* ── Stats Editor ── */
function StatsEditor({ block, onChange }: { block: StatsBlock; onChange: (b: ContentBlock) => void }) {
  const updateItem = (idx: number, field: keyof StatItem, val: string) => {
    const items = [...block.items];
    items[idx] = { ...items[idx], [field]: val };
    onChange({ ...block, items });
  };
  const addItem = () => onChange({ ...block, items: [...block.items, { value: '', label: '' }] });
  const removeItem = (idx: number) => onChange({ ...block, items: block.items.filter((_, i) => i !== idx) });

  const toggleLiveData = () => {
    if (!block.useLiveData) {
      // When enabling live data, set default live stat labels
      onChange({
        ...block,
        useLiveData: true,
        items: [
          { value: '—', label: 'Arsa İlanı' },
          { value: '—', label: 'Kayıtlı Üye' },
          { value: '—', label: 'Tamamlanan İhale' },
          { value: '—', label: 'Aktif İl' },
        ],
      });
    } else {
      onChange({ ...block, useLiveData: false });
    }
  };

  return (
    <div className="space-y-3">
      {/* Live Data Toggle */}
      <div className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
        block.useLiveData
          ? 'border-green-300 bg-green-50'
          : 'border-[var(--border)] bg-[var(--muted)]/30'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-lg">{block.useLiveData ? '📡' : '✏️'}</span>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {block.useLiveData ? 'Canlı Veriler Aktif' : 'Manuel Değerler'}
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {block.useLiveData
                ? 'Veriler veritabanından otomatik çekilir (arsa, üye, ihale, il sayıları)'
                : 'Değerleri kendiniz girin'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleLiveData}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            block.useLiveData ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            block.useLiveData ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {block.useLiveData ? (
        /* Live data info */
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-800 mb-2">📊 Gösterilecek canlı veriler:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md bg-white border border-blue-100 p-2.5 text-center">
              <p className="text-xs font-bold text-blue-600">totalParcels</p>
              <p className="text-[10px] text-blue-500">Arsa İlanı</p>
            </div>
            <div className="rounded-md bg-white border border-blue-100 p-2.5 text-center">
              <p className="text-xs font-bold text-blue-600">totalUsers</p>
              <p className="text-[10px] text-blue-500">Kayıtlı Üye</p>
            </div>
            <div className="rounded-md bg-white border border-blue-100 p-2.5 text-center">
              <p className="text-xs font-bold text-blue-600">completedAuctions</p>
              <p className="text-[10px] text-blue-500">Tamamlanan İhale</p>
            </div>
            <div className="rounded-md bg-white border border-blue-100 p-2.5 text-center">
              <p className="text-xs font-bold text-blue-600">activeCities</p>
              <p className="text-[10px] text-blue-500">Aktif İl</p>
            </div>
          </div>
        </div>
      ) : (
        /* Manual data */
        <>
          {/* Preview */}
          <div className="grid grid-cols-4 gap-2">
            {block.items.map((item, idx) => (
              <div key={idx} className="rounded-lg bg-[var(--muted)] p-3 text-center">
                <p className="text-lg font-bold text-brand-600">{item.value || '0'}</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">{item.label || 'Etiket'}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {block.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <Field label="Değer" className="w-32">
                  <input className={input} value={item.value} onChange={(e) => updateItem(idx, 'value', e.target.value)} placeholder="1.500+" />
                </Field>
                <Field label="Etiket" className="flex-1">
                  <input className={input} value={item.label} onChange={(e) => updateItem(idx, 'label', e.target.value)} placeholder="Mutlu Müşteri" />
                </Field>
                <button type="button" onClick={() => removeItem(idx)} className="mb-1 text-red-400 hover:text-red-600 text-xs p-1">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:border-brand-300 hover:text-brand-500">
            + İstatistik Ekle
          </button>
        </>
      )}
    </div>
  );
}

/* ── Steps Editor ── */
function StepsEditor({ block, onChange }: { block: StepsBlock; onChange: (b: ContentBlock) => void }) {
  const updateItem = (idx: number, field: keyof StepItem, val: string) => {
    const items = [...block.items];
    items[idx] = { ...items[idx], [field]: val };
    onChange({ ...block, items });
  };
  const addItem = () => onChange({ ...block, items: [...block.items, { title: '', description: '' }] });
  const removeItem = (idx: number) => onChange({ ...block, items: block.items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <Field label="Bölüm Başlığı">
        <input className={input} value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} placeholder="Adımlar başlığı" />
      </Field>
      <div className="space-y-2">
        {block.items.map((item, idx) => (
          <div key={idx} className="flex gap-3 items-start rounded-lg border border-[var(--border)] p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {String(idx + 1).padStart(2, '0')}
            </div>
            <div className="flex-1 grid gap-2 sm:grid-cols-2">
              <Field label="Adım Başlığı">
                <input className={input} value={item.title} onChange={(e) => updateItem(idx, 'title', e.target.value)} />
              </Field>
              <Field label="Açıklama">
                <input className={input} value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
              </Field>
            </div>
            <button type="button" onClick={() => removeItem(idx)} className="mt-5 text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addItem} className="rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:border-brand-300 hover:text-brand-500">
        + Adım Ekle
      </button>
    </div>
  );
}

/* ── CTA Editor ── */
function CtaEditor({ block, onChange }: { block: CtaBlock; onChange: (b: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className={`rounded-lg bg-gradient-to-r ${block.gradient} p-4 text-center text-white`}>
        <p className="font-bold">{block.title || 'CTA Başlık'}</p>
        <p className="text-xs text-white/70">{block.subtitle || 'Alt metin'}</p>
        <span className="mt-2 inline-block rounded bg-white px-3 py-1 text-xs font-medium text-brand-600">
          {block.buttonText || 'Buton'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Başlık"><input className={input} value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} /></Field>
        <Field label="Alt Metin"><input className={input} value={block.subtitle} onChange={(e) => onChange({ ...block, subtitle: e.target.value })} /></Field>
        <Field label="Buton Metni"><input className={input} value={block.buttonText} onChange={(e) => onChange({ ...block, buttonText: e.target.value })} /></Field>
        <Field label="Buton Linki"><input className={input} value={block.buttonLink} onChange={(e) => onChange({ ...block, buttonLink: e.target.value })} placeholder="/parcels" /></Field>
      </div>
      <Field label="Gradient Renk">
        <select className={selectCls} value={block.gradient} onChange={(e) => onChange({ ...block, gradient: e.target.value })}>
          {gradientOptions.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </Field>
    </div>
  );
}

/* ── Quote Editor ── */
function QuoteEditor({ block, onChange }: { block: QuoteBlock; onChange: (b: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border-l-4 border-brand-500 bg-brand-50/50 p-4">
        <p className="italic text-sm">&ldquo;{block.text || 'Alıntı metni...'}&rdquo;</p>
        <p className="mt-1 text-xs font-medium text-brand-600">— {block.author || 'Yazar'}</p>
      </div>
      <Field label="Alıntı Metni">
        <textarea className={`${input} min-h-[60px]`} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} rows={2} />
      </Field>
      <Field label="Yazar / Kaynak">
        <input className={input} value={block.author} onChange={(e) => onChange({ ...block, author: e.target.value })} />
      </Field>
    </div>
  );
}

/* ── Checklist Editor ── */
function ChecklistEditor({ block, onChange }: { block: ChecklistBlock; onChange: (b: ContentBlock) => void }) {
  const updateItem = (idx: number, val: string) => {
    const items = [...block.items];
    items[idx] = val;
    onChange({ ...block, items });
  };
  const addItem = () => onChange({ ...block, items: [...block.items, ''] });
  const removeItem = (idx: number) => onChange({ ...block, items: block.items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <Field label="Başlık">
        <input className={input} value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
      </Field>
      <div className="space-y-1.5">
        {block.items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-green-500 text-sm">✓</span>
            <input className={`${input} flex-1`} value={item} onChange={(e) => updateItem(idx, e.target.value)} placeholder="Liste maddesi" />
            <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addItem} className="rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:border-brand-300 hover:text-brand-500">
        + Madde Ekle
      </button>
    </div>
  );
}

/* ── Table Editor ── */
function TableEditor({ block, onChange }: { block: TableBlock; onChange: (b: ContentBlock) => void }) {
  const updateHeader = (idx: number, val: string) => {
    const headers = [...block.headers];
    headers[idx] = val;
    onChange({ ...block, headers });
  };
  const updateCell = (rowIdx: number, colIdx: number, val: string) => {
    const rows = block.rows.map((r, ri) =>
      ri === rowIdx ? { cells: r.cells.map((c, ci) => ci === colIdx ? val : c) } : r
    );
    onChange({ ...block, rows });
  };
  const addRow = () => onChange({ ...block, rows: [...block.rows, { cells: block.headers.map(() => '') }] });
  const addCol = () => onChange({
    ...block,
    headers: [...block.headers, `Sütun ${block.headers.length + 1}`],
    rows: block.rows.map((r) => ({ cells: [...r.cells, ''] })),
  });
  const removeRow = (idx: number) => onChange({ ...block, rows: block.rows.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--muted)]">
              {block.headers.map((h, i) => (
                <th key={i} className="px-2 py-1.5">
                  <input className={`${input} text-xs font-semibold`} value={h} onChange={(e) => updateHeader(i, e.target.value)} />
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-[var(--border)]">
                {row.cells.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1">
                    <input className={`${input} text-xs`} value={cell} onChange={(e) => updateCell(ri, ci, e.target.value)} />
                  </td>
                ))}
                <td className="px-1"><button type="button" onClick={() => removeRow(ri)} className="text-red-400 text-xs">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="rounded-md border border-dashed border-[var(--border)] px-3 py-1 text-xs text-[var(--muted-foreground)] hover:border-brand-300 hover:text-brand-500">+ Satır</button>
        <button type="button" onClick={addCol} className="rounded-md border border-dashed border-[var(--border)] px-3 py-1 text-xs text-[var(--muted-foreground)] hover:border-brand-300 hover:text-brand-500">+ Sütun</button>
      </div>
    </div>
  );
}

/* ── Spacer Editor ── */
function SpacerEditor({ block, onChange }: { block: SpacerBlock; onChange: (b: ContentBlock) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--muted-foreground)]">Boşluk boyutu:</span>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange({ ...block, size })}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
            block.size === size ? 'bg-brand-500 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
          }`}
        >
          {size === 'sm' ? 'Küçük' : size === 'md' ? 'Orta' : 'Büyük'}
        </button>
      ))}
    </div>
  );
}

/* ── Blocks to HTML converter ── */
export function blocksToHtml(blocks: ContentBlock[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case 'hero':
        return `<div class="nt-hero" data-gradient="${block.gradient}"><h1>${block.title}</h1><p>${block.subtitle}</p></div>`;
      case 'text':
        return block.content;
      case 'cards':
        return `<div class="nt-section">${block.heading ? `<h2>${block.heading}</h2>` : ''}${block.subtitle ? `<p>${block.subtitle}</p>` : ''}<div class="nt-cards" data-cols="${block.columns}">${block.items.map((c) => `<div class="nt-card"><span class="nt-card-icon">${c.icon}</span><h3>${c.title}</h3><p>${c.description}</p></div>`).join('')}</div></div>`;
      case 'stats':
        return `<div class="nt-stats"${block.useLiveData ? ' data-live="true"' : ''}>${block.items.map((s) => `<div class="nt-stat"><strong>${s.value}</strong><span>${s.label}</span></div>`).join('')}</div>`;
      case 'steps':
        return `<div class="nt-section">${block.heading ? `<h2>${block.heading}</h2>` : ''}<div class="nt-steps">${block.items.map((s, i) => `<div class="nt-step"><span class="nt-step-num">${String(i + 1).padStart(2, '0')}</span><h3>${s.title}</h3><p>${s.description}</p></div>`).join('')}</div></div>`;
      case 'cta':
        return `<div class="nt-cta" data-gradient="${block.gradient}"><h2>${block.title}</h2><p>${block.subtitle}</p><a href="${block.buttonLink}" class="nt-cta-btn">${block.buttonText}</a></div>`;
      case 'quote':
        return `<blockquote class="nt-quote"><p>${block.text}</p><cite>${block.author}</cite></blockquote>`;
      case 'checklist':
        return `<div class="nt-section">${block.heading ? `<h2>${block.heading}</h2>` : ''}<ul class="nt-checklist">${block.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
      case 'table':
        return `<table class="nt-table"><thead><tr>${block.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${block.rows.map((r) => `<tr>${r.cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      case 'spacer':
        return `<div class="nt-spacer nt-spacer-${block.size}"></div>`;
    }
  }).join('\n');
}

/* ── HTML to Blocks parser (for existing content) ── */
export function htmlToBlocks(html: string): ContentBlock[] {
  if (!html || html.trim() === '') return [];
  // If the content contains nt- classes, try parsing structured blocks
  // Otherwise treat as a single text block
  if (!html.includes('nt-')) {
    return [{ type: 'text', content: html }];
  }
  // For structured content, parse blocks
  const blocks: ContentBlock[] = [];
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  if (!parser) return [{ type: 'text', content: html }];

  const doc = parser.parseFromString(html, 'text/html');
  const children = Array.from(doc.body.children);

  for (const el of children) {
    const cls = el.className || '';
    if (cls.includes('nt-hero')) {
      blocks.push({
        type: 'hero',
        title: el.querySelector('h1')?.textContent || '',
        subtitle: el.querySelector('p')?.textContent || '',
        gradient: el.getAttribute('data-gradient') || 'from-brand-500 to-brand-700',
      });
    } else if (cls.includes('nt-stats')) {
      const items = Array.from(el.querySelectorAll('.nt-stat')).map((s) => ({
        value: s.querySelector('strong')?.textContent || '',
        label: s.querySelector('span')?.textContent || '',
      }));
      const useLiveData = el.getAttribute('data-live') === 'true';
      blocks.push({ type: 'stats', useLiveData, items });
    } else if (cls.includes('nt-cta')) {
      blocks.push({
        type: 'cta',
        title: el.querySelector('h2')?.textContent || '',
        subtitle: el.querySelector('p')?.textContent || '',
        buttonText: el.querySelector('a')?.textContent || '',
        buttonLink: el.querySelector('a')?.getAttribute('href') || '',
        gradient: el.getAttribute('data-gradient') || 'from-brand-500 to-brand-600',
      });
    } else if (cls.includes('nt-quote')) {
      blocks.push({
        type: 'quote',
        text: el.querySelector('p')?.textContent || '',
        author: el.querySelector('cite')?.textContent || '',
      });
    } else if (cls.includes('nt-section')) {
      const heading = el.querySelector('h2')?.textContent || '';
      const subtitle = el.querySelector(':scope > p')?.textContent || '';
      if (el.querySelector('.nt-cards')) {
        const items = Array.from(el.querySelectorAll('.nt-card')).map((c) => ({
          icon: c.querySelector('.nt-card-icon')?.textContent || '📌',
          title: c.querySelector('h3')?.textContent || '',
          description: c.querySelector('p')?.textContent || '',
        }));
        const cols = parseInt(el.querySelector('.nt-cards')?.getAttribute('data-cols') || '3') as 2 | 3 | 4;
        blocks.push({ type: 'cards', heading, subtitle, columns: cols, items });
      } else if (el.querySelector('.nt-steps')) {
        const items = Array.from(el.querySelectorAll('.nt-step')).map((s) => ({
          title: s.querySelector('h3')?.textContent || '',
          description: s.querySelector('p')?.textContent || '',
        }));
        blocks.push({ type: 'steps', heading, items });
      } else if (el.querySelector('.nt-checklist')) {
        const items = Array.from(el.querySelectorAll('.nt-checklist li')).map((li) => li.textContent || '');
        blocks.push({ type: 'checklist', heading, items });
      }
    } else if (cls.includes('nt-table')) {
      const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent || '');
      const rows = Array.from(el.querySelectorAll('tbody tr')).map((tr) => ({
        cells: Array.from(tr.querySelectorAll('td')).map((td) => td.textContent || ''),
      }));
      blocks.push({ type: 'table', headers, rows });
    } else if (cls.includes('nt-spacer')) {
      const size = cls.includes('nt-spacer-lg') ? 'lg' : cls.includes('nt-spacer-sm') ? 'sm' : 'md';
      blocks.push({ type: 'spacer', size });
    } else {
      // Unknown element, treat as text
      blocks.push({ type: 'text', content: el.outerHTML });
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', content: html }];
}

/* ── Pre-built page templates ── */
export const pageTemplates: Record<string, ContentBlock[]> = {
  about: [
    { type: 'hero', title: 'Hakkımızda', subtitle: 'Türkiye\'nin güvenilir gayrimenkul platformu', gradient: 'from-brand-500 to-brand-700' },
    { type: 'text', content: '<p>NetTapu, gayrimenkul alım-satım süreçlerini dijitalleştirerek, güvenli ve şeffaf bir platform sunmaktadır.</p>' },
    { type: 'stats', items: [{ value: '81', label: 'İl Kapsamı' }, { value: '1.500+', label: 'Arsa İlanı' }, { value: '10.000+', label: 'Kayıtlı Üye' }, { value: '500+', label: 'Başarılı Satış' }] },
    { type: 'cards', heading: 'Değerlerimiz', subtitle: 'Bizi farklı kılan temel prensipler', columns: 4, items: [
      { icon: '🛡️', title: 'Güvenlik', description: '3D Secure ödeme ve yasal uyum' },
      { icon: '🔍', title: 'Şeffaflık', description: 'Tüm işlemler kayıt altında' },
      { icon: '🌐', title: 'Erişilebilirlik', description: 'Her yerden kolay erişim' },
      { icon: '⚡', title: 'İnovasyon', description: 'Canlı ihale ve akıllı analiz' },
    ] },
    { type: 'cta', title: 'Bize Katılın', subtitle: 'Güvenilir gayrimenkul yatırımı için hemen başlayın.', buttonText: 'Arsaları Keşfet', buttonLink: '/parcels', gradient: 'from-brand-500 to-brand-600' },
  ],
  vision: [
    { type: 'hero', title: 'Vizyonumuz', subtitle: 'Gayrimenkul sektöründe dijital dönüşümün öncüsü olmak', gradient: 'from-indigo-600 to-violet-600' },
    { type: 'quote', text: 'Teknoloji ve güven bir araya geldiğinde, gayrimenkul yatırımı herkes için erişilebilir hale gelir.', author: 'NetTapu Kurucu Ekibi' },
    { type: 'cards', heading: 'Stratejik Hedefler', subtitle: 'Vizyonumuzu şekillendiren üç temel sütun', columns: 3, items: [
      { icon: '💻', title: 'Dijital Dönüşüm', description: 'Sektörü tamamen dijital ve şeffaf bir ekosisteme dönüştürmek' },
      { icon: '🌍', title: 'Küresel Erişim', description: 'Türkiye gayrimenkul piyasasını uluslararası yatırımcılara açmak' },
      { icon: '👥', title: 'Toplumsal Fayda', description: 'Gayrimenkul yatırımını demokratikleştirmek' },
    ] },
    { type: 'stats', items: [{ value: '2025', label: 'Platform Lansmanı' }, { value: '2025', label: 'Canlı İhale' }, { value: '2026', label: 'Mobil Uygulama' }, { value: '2026', label: 'Uluslararası' }] },
  ],
  mission: [
    { type: 'hero', title: 'Misyonumuz', subtitle: 'Gayrimenkul alım-satımını herkes için güvenli, şeffaf ve erişilebilir kılmak', gradient: 'from-emerald-600 to-teal-500' },
    { type: 'cards', heading: '', subtitle: '', columns: 2, items: [
      { icon: '💡', title: 'Şeffaflık', description: 'Her işlemi kayıt altına alarak, alıcı ve satıcı arasında tam şeffaflık sağlamak' },
      { icon: '🔒', title: 'Güvenlik', description: '3D Secure ödeme altyapısı, kimlik doğrulama ve yasal çerçevede işlem garantisi' },
      { icon: '🌐', title: 'Erişilebilirlik', description: 'Her bütçeye uygun gayrimenkul fırsatları sunarak yatırımı demokratikleştirmek' },
      { icon: '⚡', title: 'İnovasyon', description: 'Canlı ihale motoru, harita tabanlı arayüz ve akıllı fiyat analizi' },
    ] },
    { type: 'checklist', heading: 'Taahhütlerimiz', items: ['Tüm işlemlerde yasal uyumluluk', 'Kişisel verilerin KVKK kapsamında korunması', '7/24 müşteri desteği ve danışmanlık', 'Adil ve rekabetçi ihale ortamı'] },
    { type: 'cta', title: 'Birlikte Güçlüyüz', subtitle: 'Güvenilir gayrimenkul yatırımı için bize katılın.', buttonText: 'Arsaları Keşfet', buttonLink: '/parcels', gradient: 'from-emerald-700 to-teal-800' },
  ],
  press: [
    { type: 'hero', title: 'Basın Odası', subtitle: 'NetTapu basın bültenleri, medya haberleri ve kurumsal duyurular', gradient: 'from-slate-700 to-slate-900' },
    { type: 'cards', heading: '', subtitle: '', columns: 3, items: [
      { icon: '🖼️', title: 'Logo & Marka', description: 'Basın kiti ve marka varlıkları' },
      { icon: '📧', title: 'Basın İletişim', description: 'basin@nettapu.com' },
      { icon: '🎬', title: 'Medya Arşivi', description: 'Fotoğraf ve video galerisi' },
    ] },
    { type: 'text', content: '<h2>Son Duyurular</h2><p>Platformumuzla ilgili en güncel haberleri buradan takip edebilirsiniz.</p>' },
  ],
  'real-estate-guide': [
    { type: 'hero', title: 'Gayrimenkul Rehberi', subtitle: 'Arsa alım-satım süreçlerinde bilmeniz gereken her şey', gradient: 'from-amber-600 to-orange-500' },
    { type: 'steps', heading: 'Rehber Bölümleri', items: [
      { title: 'Arsa Satın Almadan Önce', description: 'İmar durumu, tapu sorgu, şerh ve ipotek kontrolü' },
      { title: 'Tapu İşlemleri', description: 'Gerekli belgeler, tapu harcı, noter onay ve devir süreci' },
      { title: 'İhale ile Gayrimenkul Alma', description: 'Katılım şartları, teminat, canlı ihale ve kazanma sonrası' },
      { title: 'Yatırım Değerlendirmesi', description: 'Bölgesel analiz, projeksiyonlar, altyapı ve risk faktörleri' },
    ] },
    { type: 'cards', heading: 'Hızlı İpuçları', subtitle: '', columns: 3, items: [
      { icon: '🔎', title: 'Kadastro Sorgulama', description: 'TKGM Parsel Sorgu ile resmi bilgileri doğrulayın' },
      { icon: '📐', title: 'Çap Belgesi', description: 'Arsanın sınırlarını gösteren resmi belgeyi alın' },
      { icon: '🏗️', title: 'İmar Durumu', description: 'Belediyeden yapılaşma koşullarını öğrenin' },
    ] },
    { type: 'cta', title: 'Yatırıma Başlayın', subtitle: 'Uzman danışmanlarımızla görüşerek doğru arsayı bulun.', buttonText: 'Arsaları İncele', buttonLink: '/parcels', gradient: 'from-amber-600 to-orange-600' },
  ],
  legal: [
    { type: 'hero', title: 'Yasal Bilgiler', subtitle: 'Kullanim kosullari, gizlilik politikasi, KVKK aydinlatma metni ve yasal duzenlemeler', gradient: 'from-slate-700 to-slate-900' },
    { type: 'text', content: '<h2>1. Kullanim Kosullari</h2><h3>1.1 Genel Hukumler</h3><p>Bu kullanim kosullari, NetTapu platformunu ("Platform") kullanan tum kullanicilar ("Kullanici") icin gecerlidir. Platforma erisim saglayarak ve/veya uye olarak bu kosullari kabul etmis sayilirsiniz. Platform, 6098 sayili Turk Borclar Kanunu, 6102 sayili Turk Ticaret Kanunu, 6502 sayili Tuketicinin Korunmasi Hakkinda Kanun ve ilgili mevzuat cercevesinde hizmet vermektedir.</p><h3>1.2 Hizmet Tanimi</h3><p>NetTapu, gayrimenkul ve arsa alim-satim islemlerinin cevrimici ortamda gerceklestirilmesini saglayan bir acik artirma ve ilan platformudur. Platform; arsa ilan yayinlama, canli acik artirma, teklif yonetimi, guvenli odeme altyapisi ve danismanlik hizmetleri sunmaktadir.</p><h3>1.3 Uyelik Kosullari</h3><p>Platforma uye olmak icin 18 yasini doldurmus olmak ve T.C. vatandasi veya Turkiye\'de yasal ikamet hakkina sahip olmak gerekmektedir. Uyelik sirasinda beyan edilen bilgilerin dogrulugundan kullanici sorumludur. Yanlis veya yaniltici bilgi verilmesi halinde uyelik askiya alinabilir veya iptal edilebilir.</p><h3>1.4 Kullanici Yukumlulukleri</h3><p>Kullanicilar; Platform uzerinden gerceklestirdikleri tum islemlerde ilgili mevzuata uymakla yukumludur. Sahte veya yaniltici ilan yayinlamak, manipulatif teklif vermek, diger kullanicilarin haklarini ihlal etmek ve platformun teknik altyapisina zarar vermek kesinlikle yasaktir. Bu kurallara aykiri davranis, uyeligin derhal sonlandirilmasi ve yasal islem baslatilmasi ile sonuclanabilir.</p><h3>1.5 Fikri Mulkiyet</h3><p>Platform uzerindeki tum icerikler, tasarimlar, yazilim kodlari, logolar ve markalar NetTapu\'ya aittir ve 5846 sayili Fikir ve Sanat Eserleri Kanunu ile korunmaktadir. Izinsiz kopyalama, dagitma veya ticari amacla kullanma yasaktir.</p>' },
    { type: 'spacer', size: 'sm' },
    { type: 'text', content: '<h2>2. Gizlilik Politikasi</h2><h3>2.1 Toplanan Veriler</h3><p>Platform, hizmet kalitesini artirmak ve yasal yukumluluklerini yerine getirmek amaciyla asagidaki verileri toplamaktadir:</p><ul><li><strong>Kimlik Bilgileri:</strong> Ad, soyad, T.C. kimlik numarasi, dogum tarihi</li><li><strong>Iletisim Bilgileri:</strong> E-posta adresi, telefon numarasi, posta adresi</li><li><strong>Finansal Bilgiler:</strong> Odeme gecmisi, depozito bilgileri (kredi karti bilgileri saklanmaz)</li><li><strong>Kullanim Verileri:</strong> IP adresi, tarayici bilgisi, sayfa goruntulenme istatistikleri, cerez verileri</li><li><strong>Islem Verileri:</strong> Teklif gecmisi, ilan etkilesimleri, acik artirma katilim bilgileri</li></ul><h3>2.2 Verilerin Kullanim Amaci</h3><p>Toplanan veriler; hizmet sunumu, kullanici deneyiminin iyilestirilmesi, guvenlik onlemlerinin alinmasi, yasal yukumluluklerin yerine getirilmesi, pazarlama iletisimleri (onay dahilinde) ve istatistiksel analizler icin kullanilmaktadir.</p><h3>2.3 Veri Paylasimi</h3><p>Kisisel verileriniz, yasal zorunluluklar disinda ucuncu taraflarla paylasilmaz. Odeme islemleri icin guvenli POS entegrasyonlari (3D Secure) kullanilmakta olup, kredi karti bilgileri sunucularimizda saklanmamaktadir. Yasal makamlar tarafindan talep edilmesi halinde, ilgili mevzuat cercevesinde veri paylasimi yapilabilir.</p><h3>2.4 Cerez Politikasi</h3><p>Platform, oturum yonetimi, tercih hatirlama ve analitik amaclarla cerezler kullanmaktadir. Zorunlu cerezler platformun calismasi icin gereklidir. Analitik ve pazarlama cerezleri icin kullanicidan onay alinmaktadir. Cerez tercihlerinizi tarayici ayarlarinizdan yonetebilirsiniz.</p>' },
    { type: 'spacer', size: 'sm' },
    { type: 'text', content: '<h2>3. KVKK Aydinlatma Metni</h2><h3>3.1 Veri Sorumlusu</h3><p>6698 sayili Kisisel Verilerin Korunmasi Kanunu ("KVKK") kapsaminda veri sorumlusu NetTapu Teknoloji A.S.\'dir. Kisisel verileriniz asagida aciklanan amaclar dogrultusunda, hukuka ve durustluk kuralina uygun sekilde islenebilecek, kaydedilebilecek, saklanabilecek, siniflandirilabilecek, guncellenebilecek ve mevzuatin izin verdigi hallerde ucuncu kisilere aktarilabilecektir.</p><h3>3.2 Isleme Amaci ve Hukuki Sebep</h3><p>Kisisel verileriniz; KVKK\'nin 5. ve 6. maddelerinde belirtilen hukuki sebeplere dayanarak islenmektedir. Sozlesmenin kurulmasi ve ifasi, yasal yukumluluklerin yerine getirilmesi, meşru menfaat ve acik rizaniz temel hukuki sebeplerimizdir.</p><h3>3.3 Veri Sahibi Haklari (KVKK Madde 11)</h3><p>KVKK\'nin 11. maddesi uyarinca her veri sahibi asagidaki haklara sahiptir:</p><ul><li>Kisisel verilerin islenip islenmedigini ogrenme</li><li>Islenme amacini ve amaca uygun kullanilip kullanilmadigini ogrenme</li><li>Yurt icinde veya disinda aktarilip aktarilmadigini ogrenme</li><li>Eksik veya yanlis islenmis ise duzeltilmesini isteme</li><li>Islenmesini gerektiren sebeplerin ortadan kalkmasi halinde silinmesini isteme</li><li>Islenen verilerin munhasiran otomatik sistemler vasitasiyla analiz edilmesi suretiyle aleyhine bir sonucun ortaya cikmasi halinde itiraz etme</li><li>Kanuna aykiri islenmesi sebebiyle zarara ugramasi halinde zararin giderilmesini talep etme</li></ul><h3>3.4 Basvuru Yontemi</h3><p>KVKK kapsamindaki haklarinizi kullanmak icin kvkk@nettapu.com adresine yazili basvuru yapabilirsiniz. Basvurular en gec 30 gun icinde ucretsiz olarak sonuclandirilacaktir.</p>' },
    { type: 'spacer', size: 'sm' },
    { type: 'text', content: '<h2>4. Elektronik Ticaret Mevzuati</h2><p>NetTapu, 6563 sayili Elektronik Ticaretin Duzenlenmesi Hakkinda Kanun ve Mesafeli Sozlesmeler Yonetmeligi\'ne uygun olarak faaliyet gostermektedir. Tum islemler oncesinde kullaniciya on bilgilendirme yapilmakta, mesafeli satis sozlesmesi sunulmakta ve cayma hakki taninan islemler icin yasal sureler icinde iade imkani saglanmaktadir.</p><h3>4.1 Odeme Guvenligi</h3><p>Platform uzerinden yapilan tum odemeler, PCI DSS uyumlu odeme altyapisi ve 3D Secure dogrulama ile gerceklestirilmektedir. Kredi karti bilgileri sunucularimizda saklanmamaktadir. Tum finansal islemler sifrelenmis baglanti uzerinden yurütulmektedir.</p><h3>4.2 Uyusmazlik Cozumu</h3><p>Bu kosullardan kaynaklanan uyusmazliklarda Istanbul Tahkim Merkezi (ISTAC) kurallari uygulanacaktir. Tuketici islemlerinden kaynaklanan uyusmazliklarda tuketici hakem heyetleri ve tuketici mahkemeleri yetkilidir. Uyusmazlik sinirlari her yil Ticaret Bakanligi tarafindan guncellenmektedir.</p>' },
    { type: 'checklist', heading: 'Yasal Uyum Taahhutlerimiz', items: [
      'KVKK (6698 sayili Kanun) tam uyumluluk',
      'Elektronik Ticaret Kanunu (6563) cercevesinde faaliyet',
      'Tuketicinin Korunmasi Kanunu (6502) uyumu',
      'PCI DSS uyumlu odeme altyapisi',
      '3D Secure ile guvenli odeme islemleri',
      'Kisisel verilerin yurt disina aktarilmamasi',
      'Duzenlì bagimsiz guvenlik denetimleri',
    ] },
  ],
  'withdrawal-rights': [
    { type: 'hero', title: 'Cayma Hakki', subtitle: 'Tuketici haklariniz ve cayma kosullari hakkinda detayli bilgilendirme', gradient: 'from-slate-700 to-slate-900' },
    { type: 'text', content: '<h2>1. Cayma Hakki Nedir?</h2><p>6502 sayili Tuketicinin Korunmasi Hakkinda Kanun\'un 48. maddesi ve Mesafeli Sozlesmeler Yonetmeligi uyarinca, mesafeli sozlesmelerden dogan cayma hakki, tuketicinin herhangi bir gerekce gostermeksizin ve cezai sart odemeksizin sozlesmeden donme hakkidir.</p><h3>1.1 Cayma Suresi</h3><p>Tuketici, hizmetin ifasina baslama tarihinden itibaren <strong>14 (on dort) gun</strong> icinde cayma hakkini kullanabilir. Cayma hakki suresinin hesabinda; sozlesmenin kuruldugu gun dahil edilir ve sure takip eden 14. gunun sonunda sona erer.</p><h3>1.2 Cayma Hakkinin Kullanimi</h3><p>Cayma hakkini kullanmak icin asagidaki yontemlerden birini tercih edebilirsiniz:</p><ul><li><strong>E-posta:</strong> cayma@nettapu.com adresine yazili bildirim</li><li><strong>Platform Uzerinden:</strong> Hesabim &gt; Siparislerim &gt; Cayma Talebi</li><li><strong>Posta:</strong> Firma adresine iadeli taahhutlu mektup</li></ul>' },
    { type: 'spacer', size: 'sm' },
    { type: 'text', content: '<h2>2. Cayma Hakki Kapsamindaki Islemler</h2><h3>2.1 Cayma Hakkinin Gecerli Oldugu Durumlar</h3><ul><li>Platform uzerinden yapilan depozito (kaparo) odemeleri</li><li>Danismanlik hizmeti basvurulari</li><li>Premium uyelik islemleri</li><li>Henuz ifa edilmemis hizmet alimlari</li></ul><h3>2.2 Cayma Hakkinin Kullanilamayacagi Durumlar</h3><p>Asagidaki hallerde cayma hakki kullanilamaz:</p><ul><li>Tamamlanan acik artirma islemleri (ihale sonuclanan ve tescil baslayan islemler)</li><li>Tuketicinin onayiyla cayma hakki suresi icinde ifa edilen hizmetler</li><li>Tuketiciye ozel hazirlanan degerlemeve rapor hizmetleri</li><li>Fiyati finansal piyasalardaki dalgalanmalara bagli olarak degisen gayrimenkul alimlari (Yonetmelik Madde 15/c)</li></ul>' },
    { type: 'spacer', size: 'sm' },
    { type: 'text', content: '<h2>3. Iade Sureci</h2><h3>3.1 Iade Basvurusu</h3><p>Cayma hakkinin kullanilmasi halinde, cayma bildiriminin NetTapu\'ya ulastigi tarihten itibaren en gec <strong>14 gun</strong> icinde odeme iadesi gerceklestirilir. Iade, odemenin yapildigi odeme yontemine uygun olarak yapilir.</p><h3>3.2 Iade Oncelikleri</h3><p>Iade islemlerinde; odemenin yapildigi kanal uzerinden iade yapilmasi esastir. Kredi karti ile yapilan odemelerde iade kredi kartina, banka havalesi ile yapilan odemelerde belirtilen IBAN\'a aktarilir.</p>' },
    { type: 'table', headers: ['Odeme Yontemi', 'Iade Suresi', 'Aciklama'], rows: [
      { cells: ['Kredi Karti', '5-10 is gunu', 'Banka islem surelerine bagli'] },
      { cells: ['Banka Karti (Debit)', '5-10 is gunu', 'Karta iade edilir'] },
      { cells: ['Banka Havalesi / EFT', '3-5 is gunu', 'IBAN bilgisi gereklidir'] },
      { cells: ['Sanal POS', '5-10 is gunu', 'Odeme saglayicisina bagli'] },
    ] },
    { type: 'spacer', size: 'sm' },
    { type: 'text', content: '<h2>4. Depozito (Kaparo) Iade Politikasi</h2><p>Acik artirma surecinde yatirilan depozitolar icin ozel iade kosullari gecerlidir:</p><ul><li><strong>Ihaley katilmayan:</strong> Depozito tam olarak iade edilir (2 is gunu icinde)</li><li><strong>Ihaleyi kazanamayan:</strong> Depozito tam olarak iade edilir (ihale sonlanmasindan itibaren 3 is gunu icinde)</li><li><strong>Ihaleyi kazanan ancak odemey tamamlamayan:</strong> Depozito iade edilmez, platform komisyonundan mahsup edilir</li><li><strong>Ihale iptali:</strong> Tum depozitolar tam olarak iade edilir</li></ul>' },
    { type: 'text', content: '<h2>5. Iletisim</h2><p>Cayma hakki ve iade islemleri hakkinda sorulariniz icin:</p><ul><li><strong>E-posta:</strong> cayma@nettapu.com</li><li><strong>Telefon:</strong> 0850 XXX XX XX (Hafta ici 09:00 - 18:00)</li><li><strong>Adres:</strong> NetTapu Teknoloji A.S.</li></ul><p><em>Bu bilgilendirme metni, 6502 sayili Kanun ve Mesafeli Sozlesmeler Yonetmeligi kapsaminda hazirlanmis olup, mevzuat degisiklikleri dogrultusunda guncellenebilir.</em></p>' },
  ],
};

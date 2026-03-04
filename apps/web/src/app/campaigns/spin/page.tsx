import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const SpinWheel = dynamic(
  () => import('@/components/spin-wheel').then((m) => m.SpinWheel),
  { ssr: false },
);

export const metadata: Metadata = {
  title: 'Şans Çarkı | NetTapu',
  description: 'NetTapu şans çarkını çevirin ve indirim fırsatlarından yararlanın!',
};

export default function SpinWheelPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Şans Çarkı</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Çarkı çevirin ve özel indirim fırsatlarından yararlanın! Her gün bir hakkınız var.
        </p>
      </div>

      <SpinWheel />

      <div className="mt-12 rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold">Nasıl Çalışır?</h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
          <li className="flex items-start gap-2">
            <span className="text-brand-500 font-bold">1.</span>
            Giriş yapın ve çarkı çevirmek için butona tıklayın.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-500 font-bold">2.</span>
            Çark durduktan sonra kazandığınız ödül ekranda gösterilecektir.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-500 font-bold">3.</span>
            Kazandığınız indirim kodunu 30 gün içinde kullanabilirsiniz.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-500 font-bold">4.</span>
            Her gün yeni bir çevirme hakkınız olur.
          </li>
        </ul>
      </div>
    </div>
  );
}

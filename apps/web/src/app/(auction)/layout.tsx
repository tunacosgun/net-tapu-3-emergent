import { BanGate } from '@/components/ban-gate';

export default function AuctionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <BanGate feature="auctions">{children}</BanGate>
    </main>
  );
}

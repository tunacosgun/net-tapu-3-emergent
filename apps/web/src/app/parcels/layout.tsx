import { BanGate } from '@/components/ban-gate';

export default function ParcelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BanGate feature="parcels">{children}</BanGate>
  );
}

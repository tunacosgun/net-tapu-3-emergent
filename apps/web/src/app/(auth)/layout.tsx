import Link from 'next/link';
import { Shield, Lock, Gavel } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left side - form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2.5 group cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/30 transition-shadow duration-200">
                <span className="text-sm font-black text-white tracking-tight">NT</span>
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">NetTapu</span>
            </Link>
          </div>
          <div className="rounded-2xl border border-gray-200/60 bg-white p-8 shadow-xl shadow-gray-100/80">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} NetTapu. Tüm hakları saklıdır.
          </p>
        </div>
      </div>

      {/* Right side - brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-brand-950 items-center justify-center p-12">
        {/* Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-500/10 rounded-full blur-[100px] -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-brand-400/8 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />

        <div className="relative z-10 max-w-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm mb-8">
            <span className="flex h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
            <span className="text-xs font-medium text-brand-300">Güvenilir Platform</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight tracking-tight">
            Türkiye'nin En Güvenilir{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-brand-500">
              Arsa Platformu
            </span>
          </h2>
          <p className="mt-4 text-gray-400 leading-relaxed">
            Binlerce doğrulanmış arsa ilanı, canlı açık artırmalar ve güvenli ödeme sistemiyle hayalinizdeki arsaya kolayca sahip olun.
          </p>

          <div className="mt-10 space-y-5">
            {[
              { icon: Shield, title: 'Güvenli Alışveriş', desc: '3D Secure ve SSL ile korunan ödemeler' },
              { icon: Gavel, title: 'Canlı Açık Artırma', desc: 'Gerçek zamanlı teklif sistemi' },
              { icon: Lock, title: 'Yasal Güvence', desc: 'KVKK uyumlu, noter onaylı süreçler' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] border border-white/10">
                    <Icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

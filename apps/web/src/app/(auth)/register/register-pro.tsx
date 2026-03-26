'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/ui';

export default function RegisterPagePro() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Register Page - Under Construction</h1>
        <p className="text-slate-600 mt-4">Coming soon...</p>
      </div>
    </div>
  );
}

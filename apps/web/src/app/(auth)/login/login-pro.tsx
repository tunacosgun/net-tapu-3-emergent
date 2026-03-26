'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useLogin } from '@/providers/auth-provider';
import { loginSchema, type LoginFormData } from '@/lib/validators';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { LoadingState } from '@/components/ui';
import type { ApiError } from '@/types';
import { AxiosError } from 'axios';
import { Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff, CheckCircle2, Shield, Zap } from 'lucide-react';

export default function LoginPagePro() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function LoginContent() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const login = useLogin();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/';

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    if (isLimited) return;

    try {
      await login(data.email, data.password);
      window.location.href = redirectTo;
    } catch (err) {
      if (checkRateLimit(err)) return;
      
      if (err instanceof AxiosError) {
        const apiErr = err.response?.data as ApiError | undefined;
        const errorMsg = Array.isArray(apiErr?.message) ? apiErr.message[0] : apiErr?.message;
        setServerError(errorMsg || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
      } else {
        setServerError('Beklenmeyen bir hata oluştu.');
      }
    }
  };

  const handleGoogleLogin = () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    window.location.href = `/api/auth/social/google?redirect=${encodeURIComponent(currentUrl)}`;
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo & Title */}
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-3 mb-8" data-testid="login-logo">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white text-base font-bold shadow-emerald">
                NT
              </div>
              <div className="flex flex-col leading-tight text-left">
                <span className="text-xl font-bold font-heading text-slate-900 tracking-tight">NetTapu</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Arsa Platformu</span>
              </div>
            </Link>
            <h1 className="text-3xl font-bold font-heading text-slate-900 mb-2">Hoş Geldiniz</h1>
            <p className="text-slate-500">Hesabınıza giriş yapın</p>
          </div>

          {/* Social Login */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
            data-testid="google-login-btn"
          >
            <GoogleIcon />
            <span>Google ile Giriş Yap</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-sm text-slate-400 font-medium">veya</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          {/* Error Alert */}
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 rounded-xl flex items-start gap-3"
              data-testid="login-error"
            >
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{serverError}</p>
            </motion.div>
          )}

          {/* Rate Limit Warning */}
          {isLimited && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-amber-50 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Çok fazla deneme yaptınız. Lütfen {cooldown} saniye bekleyin.
              </p>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" data-testid="login-form">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                E-posta Adresi
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  placeholder="ornek@email.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all duration-200"
                  data-testid="email-input"
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Şifre
                </label>
                <Link href="/forgot-password" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all duration-200"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isLimited}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-emerald hover:shadow-emerald-lg transition-all duration-200"
              data-testid="login-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Giriş Yapılıyor...</span>
                </>
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="mt-8 text-center text-slate-500">
            Hesabınız yok mu?{' '}
            <Link href="/register" className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
              Hemen Kaydolun
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right Side - Hero Section */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-900 p-12 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
        
        {/* Glowing orbs */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 max-w-xl text-center"
        >
          <h2 className="text-4xl lg:text-5xl font-bold font-heading text-white mb-6 leading-tight">
            Türkiye'nin En Güvenilir{' '}
            <span className="text-emerald-400">
              Arsa Platformu
            </span>
          </h2>
          <p className="text-lg text-slate-400 mb-12 leading-relaxed">
            Binlerce doğrulanmış arsa ilanı, canlı açık artırmalar ve güvenli ödeme sistemiyle hayalinizdeki arsaya kolayca sahip olun.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 gap-4 text-left">
            {[
              { icon: Shield, title: 'Güvenli Alışveriş', desc: '3D Secure ve SSL ile korunan ödemeler', color: 'emerald' },
              { icon: Zap, title: 'Canlı Açık Artırma', desc: 'Gerçek zamanlı teklif sistemi', color: 'emerald' },
              { icon: CheckCircle2, title: 'Doğrulanmış İlanlar', desc: 'Tapu kontrolü yapılmış arsalar', color: 'emerald' },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-0.5">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

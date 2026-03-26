'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useRegister } from '@/providers/auth-provider';
import { registerSchema, type RegisterFormData } from '@/lib/validators';
import { FormField } from '@/components/form-field';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button, Alert } from '@/components/ui';
import type { ApiError } from '@/types';
import { AxiosError } from 'axios';
import { User, Mail, Lock, Phone, AlertCircle, ArrowRight, Eye, EyeOff, Sparkles, UserCircle } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.10z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const {
    register: reg,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  const registerUser = useRegister();

  async function onSubmit(data: RegisterFormData) {
    setServerError(null);
    try {
      const tokens = await registerUser({
        username: data.username,
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
      });
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          role: 'user',
        }),
      });
      window.location.href = '/';
    } catch (err) {
      if (checkRateLimit(err)) return;
      if (err instanceof AxiosError) {
        const apiErr = err.response?.data as ApiError | undefined;
        const msg = apiErr?.message;
        setServerError(
          Array.isArray(msg) ? msg.join(', ') : msg || 'Kayıt başarısız.',
        );
      } else {
        setServerError('Kayıt başarısız.');
      }
    }
  }

  function handleGoogleRegister() {
    const googleUrl = `${window.location.origin}/api/v1/auth/google?returnTo=${encodeURIComponent('/')}`;
    window.location.href = googleUrl;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      
      {/* Animated Gradient Mesh Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-[128px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[128px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[128px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-lg"
        >
          
          {/* Logo & Brand */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-6 shadow-2xl shadow-purple-500/50 relative"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 blur-xl opacity-60 animate-pulse" />
              <span className="relative text-3xl font-black text-white">NT</span>
            </motion.div>
            <h1 className="text-4xl font-heading font-extrabold text-white mb-2 tracking-tight">
              Aramıza Katılın
            </h1>
            <p className="text-lg text-slate-400">
              Ücretsiz hesap oluşturun
            </p>
          </div>

          {/* Glass Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative"
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
            
            {/* Card */}
            <div className="relative bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
              
              {/* Server Error */}
              {serverError && (
                <Alert variant="error" className="mb-6 bg-red-500/10 border-red-500/50 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="ml-2">{serverError}</span>
                </Alert>
              )}

              {/* Rate Limit Warning */}
              {isLimited && (
                <Alert variant="warning" className="mb-6 bg-amber-500/10 border-amber-500/50 text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="ml-2">
                    Çok fazla deneme. {cooldown} saniye bekleyin.
                  </span>
                </Alert>
              )}

              {/* Google Register */}
              <button
                type="button"
                onClick={handleGoogleRegister}
                className="group relative w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all duration-200 overflow-hidden mb-6"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                <GoogleIcon />
                <span className="relative">Google ile Kaydol</span>
              </button>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-slate-900 text-slate-400 font-medium">veya</span>
                </div>
              </div>

              {/* Register Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                
                {/* Username */}
                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-slate-300 mb-2">
                    Kullanıcı Adı
                  </label>
                  <div className="relative group">
                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                      {...reg('username')}
                      type="text"
                      id="username"
                      placeholder="kullaniciadi"
                      className={`w-full pl-12 pr-4 py-3 bg-slate-800/50 border rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all ${
                        errors.username ? 'border-red-500/50' : 'border-slate-700'
                      }`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.username && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.username.message}
                    </p>
                  )}
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-semibold text-slate-300 mb-2">
                      Ad
                    </label>
                    <input
                      {...reg('firstName')}
                      type="text"
                      id="firstName"
                      placeholder="Ad"
                      className={`w-full px-4 py-3 bg-slate-800/50 border rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all ${
                        errors.firstName ? 'border-red-500/50' : 'border-slate-700'
                      }`}
                      disabled={isSubmitting}
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-semibold text-slate-300 mb-2">
                      Soyad
                    </label>
                    <input
                      {...reg('lastName')}
                      type="text"
                      id="lastName"
                      placeholder="Soyad"
                      className={`w-full px-4 py-3 bg-slate-800/50 border rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all ${
                        errors.lastName ? 'border-red-500/50' : 'border-slate-700'
                      }`}
                      disabled={isSubmitting}
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-300 mb-2">
                    E-posta
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                      {...reg('email')}
                      type="email"
                      id="email"
                      placeholder="ornek@email.com"
                      className={`w-full pl-12 pr-4 py-3 bg-slate-800/50 border rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all ${
                        errors.email ? 'border-red-500/50' : 'border-slate-700'
                      }`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-slate-300 mb-2">
                    Telefon <span className="text-slate-500 font-normal">(Opsiyonel)</span>
                  </label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                      {...reg('phone')}
                      type="tel"
                      id="phone"
                      placeholder="0555 123 45 67"
                      className={`w-full pl-12 pr-4 py-3 bg-slate-800/50 border rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all ${
                        errors.phone ? 'border-red-500/50' : 'border-slate-700'
                      }`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.phone && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.phone.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-300 mb-2">
                    Şifre
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                      {...reg('password')}
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      placeholder="En az 8 karakter"
                      className={`w-full pl-12 pr-12 py-3 bg-slate-800/50 border rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all ${
                        errors.password ? 'border-red-500/50' : 'border-slate-700'
                      }`}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isLimited}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-[2px] transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                  <div className="relative flex items-center justify-center gap-2 bg-slate-900 rounded-[10px] px-6 py-3 font-bold text-white group-hover:bg-transparent transition-colors">
                    {isSubmitting ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Hesap Oluşturuluyor...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Ücretsiz Kaydol
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </button>

                {/* Terms */}
                <p className="text-xs text-center text-slate-500 leading-relaxed mt-4">
                  Kaydolarak{' '}
                  <Link href="/legal" className="text-purple-400 hover:underline">
                    Kullanım Koşulları
                  </Link>
                  {' '}ve{' '}
                  <Link href="/legal" className="text-purple-400 hover:underline">
                    Gizlilik Politikası
                  </Link>
                  'nı kabul edersiniz.
                </p>
              </form>

              {/* Login Link */}
              <div className="mt-6 text-center">
                <p className="text-slate-400">
                  Zaten hesabınız var mı?{' '}
                  <Link
                    href="/login"
                    className="font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Giriş Yapın
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-slate-500">
            <Link href="/legal" className="hover:text-slate-400 transition-colors">
              Gizlilik
            </Link>
            <span className="mx-2">•</span>
            <Link href="/legal" className="hover:text-slate-400 transition-colors">
              Koşullar
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

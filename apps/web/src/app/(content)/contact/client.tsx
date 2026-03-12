'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { Button, Alert } from '@/components/ui';
import { FormField } from '@/components/form-field';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteSettings } from '@/hooks/use-site-settings';

const contactSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalıdır'),
  phone: z
    .string()
    .min(10, 'Geçerli bir telefon numarası giriniz')
    .regex(/^[0-9+\-\s()]+$/, 'Geçerli bir telefon numarası giriniz'),
  email: z
    .string()
    .email('Geçerli bir e-posta adresi giriniz')
    .optional()
    .or(z.literal('')),
  subject: z.string().min(1, 'Konu seçiniz'),
  message: z.string().min(10, 'Mesajınız en az 10 karakter olmalıdır'),
});

type ContactFormData = z.infer<typeof contactSchema>;

const subjects = [
  { value: 'general', label: 'Genel Bilgi' },
  { value: 'parcel', label: 'Arsa / Gayrimenkul Bilgisi' },
  { value: 'auction', label: 'Açık Artırma / İhale' },
  { value: 'payment', label: 'Ödeme / Depozito' },
  { value: 'technical', label: 'Teknik Destek' },
  { value: 'partnership', label: 'İş Birliği / Bayilik' },
  { value: 'complaint', label: 'Şikayet / Öneri' },
];

export function ContactPageContent() {
  const [success, setSuccess] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const s = useSiteSettings();

  const phone = s.contact_phone || '0850 XXX XX XX';
  const email = s.contact_email || 'info@nettapu.com';
  const address = s.contact_address || 'NetTapu Gayrimenkul Teknoloji A.Ş.\nİstanbul, Türkiye';
  const whatsapp = s.whatsapp_number;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { subject: '' },
  });

  // Auto-fill for logged-in users
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient
      .get<{ firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null }>('/auth/me')
      .then(({ data }) => {
        const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
        if (fullName) setValue('name', fullName);
        if (data.phone) setValue('phone', data.phone);
        if (data.email) setValue('email', data.email);
      })
      .catch(() => {});
  }, [isAuthenticated, setValue]);

  async function onSubmit(data: ContactFormData) {
    try {
      const subjectLabel = subjects.find((s) => s.value === data.subject)?.label ?? data.subject;
      await apiClient.post('/crm/contact-requests', {
        type: 'general',
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        message: `[Konu: ${subjectLabel}] ${data.message}`,
      });
      setSuccess(true);
    } catch (err) {
      showApiError(err);
    }
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold lg:text-4xl">İletişim</h1>
          <p className="mt-2 text-base text-white/70 lg:text-lg">
            Sorularınız, önerileriniz veya destek talepleriniz için bize ulaşın
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Contact Form */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[var(--border)] p-6 lg:p-8">
            {success ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Mesajınız Alındı!</h2>
                <p className="mt-2 text-[var(--muted-foreground)]">
                  En kısa sürede size geri dönüş yapacağız. Teşekkür ederiz.
                </p>
                <Button onClick={() => setSuccess(false)} className="mt-6">
                  Yeni Mesaj Gönder
                </Button>
              </div>
            ) : (
              <>
                <h2 className="mb-6 text-xl font-bold text-[var(--foreground)]">Bize Mesaj Gönderin</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      label="Ad Soyad *"
                      error={errors.name?.message}
                      {...register('name')}
                      placeholder="Adınız Soyadınız"
                    />
                    <FormField
                      label="Telefon *"
                      error={errors.phone?.message}
                      {...register('phone')}
                      placeholder="0 5XX XXX XX XX"
                      type="tel"
                    />
                  </div>

                  <FormField
                    label="E-posta (opsiyonel)"
                    error={errors.email?.message}
                    {...register('email')}
                    placeholder="ornek@mail.com"
                    type="email"
                  />

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Konu *</label>
                    <select
                      {...register('subject')}
                      className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">Konu seçiniz...</option>
                      {subjects.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject.message}</p>}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Mesajınız *</label>
                    <textarea
                      {...register('message')}
                      placeholder="Mesajınızı buraya yazınız..."
                      rows={5}
                      className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                    />
                    {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message.message}</p>}
                  </div>

                  <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Gönderiliyor...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                        Mesaj Gönder
                      </span>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Right: Contact Info Cards */}
        <div className="space-y-4">
          {/* Phone */}
          <div className="rounded-xl border border-[var(--border)] p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/30">
              <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--foreground)]">Telefon</h3>
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="mt-1 block text-sm text-brand-600 hover:underline">{phone}</a>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Hafta içi 09:00 - 18:00</p>
          </div>

          {/* WhatsApp */}
          {whatsapp && (
            <div className="rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900 p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950/30">
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[var(--foreground)]">WhatsApp</h3>
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Merhaba, NetTapu hakkında bilgi almak istiyorum.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-green-600 hover:underline"
              >
                Mesaj Gönder
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          )}

          {/* Email */}
          <div className="rounded-xl border border-[var(--border)] p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--foreground)]">E-posta</h3>
            <a href={`mailto:${email}`} className="mt-1 block text-sm text-blue-600 hover:underline">{email}</a>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">7/24 yanıt</p>
          </div>

          {/* Address */}
          <div className="rounded-xl border border-[var(--border)] p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--foreground)]">Adres</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)] whitespace-pre-line">
              {address}
            </p>
          </div>

          {/* Working hours */}
          <div className="rounded-xl border border-[var(--border)] p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--foreground)]">Çalışma Saatleri</h3>
            <div className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
              <div className="flex justify-between">
                <span>Pazartesi - Cuma</span>
                <span className="font-medium text-[var(--foreground)]">09:00 - 18:00</span>
              </div>
              <div className="flex justify-between">
                <span>Cumartesi</span>
                <span className="font-medium text-[var(--foreground)]">10:00 - 14:00</span>
              </div>
              <div className="flex justify-between">
                <span>Pazar</span>
                <span className="font-medium text-red-500">Kapalı</span>
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="rounded-xl border border-[var(--border)] p-5">
            <h3 className="font-semibold text-[var(--foreground)] mb-3">Sosyal Medya</h3>
            <div className="flex gap-3">
              <a
                href={s.social_instagram || 'https://instagram.com/nettapu'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:text-pink-500 hover:border-pink-500 transition-colors"
                aria-label="Instagram"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
              <a
                href={s.social_twitter || 'https://twitter.com/nettapu'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:text-black dark:hover:text-white hover:border-gray-800 transition-colors"
                aria-label="X (Twitter)"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={s.social_youtube || 'https://youtube.com/@nettapu'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:text-red-500 hover:border-red-500 transition-colors"
                aria-label="YouTube"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href={s.social_linkedin || 'https://linkedin.com/company/nettapu'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:text-blue-600 hover:border-blue-600 transition-colors"
                aria-label="LinkedIn"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="mt-8 rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="bg-[var(--muted)] px-6 py-4 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
            <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Konum
          </h3>
        </div>
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d385396.3802506651!2d28.731966506249975!3d41.00498243490602!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14caa7040068086b%3A0xe1ccfe98bc01b0d0!2zxLBzdGFuYnVsLCBUw7xya2l5ZQ!5e0!3m2!1str!2str!4v1709000000000!5m2!1str!2str"
          width="100%"
          height="350"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full"
        />
      </div>
    </div>
  );
}

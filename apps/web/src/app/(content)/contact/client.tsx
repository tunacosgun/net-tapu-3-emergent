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
            <a href="tel:+908501234567" className="mt-1 block text-sm text-brand-600 hover:underline">0 850 123 45 67</a>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Hafta içi 09:00 - 18:00</p>
          </div>

          {/* Email */}
          <div className="rounded-xl border border-[var(--border)] p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--foreground)]">E-posta</h3>
            <a href="mailto:info@nettapu.com" className="mt-1 block text-sm text-blue-600 hover:underline">info@nettapu.com</a>
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
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              NetTapu Gayrimenkul Teknoloji A.Ş.<br />
              İstanbul, Türkiye
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
        </div>
      </div>
    </div>
  );
}

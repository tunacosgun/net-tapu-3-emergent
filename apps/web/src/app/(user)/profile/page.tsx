'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import Image from 'next/image';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { useAuthStore } from '@/stores/auth-store';
import { Card, Button, Alert, LoadingState } from '@/components/ui';
import { FormField } from '@/components/form-field';

interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isVerified: boolean;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  roles?: string[];
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ firstName: string; lastName: string; phone: string }>();

  useEffect(() => {
    apiClient
      .get<UserProfile>('/auth/me')
      .then(({ data }) => {
        setProfile(data);
        reset({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reset]);

  async function onSubmit(data: { firstName: string; lastName: string; phone: string }) {
    setSaving(true);
    setSuccess(false);
    try {
      const { data: updated } = await apiClient.patch<UserProfile>('/auth/profile', data);
      setProfile(updated);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendVerification() {
    setSendingVerification(true);
    try {
      await apiClient.post('/auth/send-verification');
      setVerificationSent(true);
    } catch (err) {
      showApiError(err);
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post<{ avatarUrl: string }>('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : prev);
      useAuthStore.getState().setAvatarUrl(data.avatarUrl);
    } catch (err) {
      showApiError(err);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) return <LoadingState />;
  if (!profile) return <Alert>Profil bilgileri yüklenemedi.</Alert>;

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const initials = [profile.firstName?.[0], profile.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-5">
        <div className="relative group">
          <div className="relative h-20 w-20 overflow-hidden rounded-full shadow-lg">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt="Profil fotoğrafı"
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-500 text-2xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>
          {/* Upload overlay */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/50 transition-colors cursor-pointer"
          >
            <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
              {uploadingAvatar ? '...' : '📷'}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          {/* Green dot for verified */}
          {profile.isVerified && (
            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-2 border-white dark:border-gray-900 bg-green-500" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">
            {fullName || 'İsimsiz Kullanıcı'}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">{profile.email}</p>
          <div className="mt-1 flex items-center gap-2">
            {profile.isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                Doğrulanmış Hesap
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Doğrulanmamış
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Verification alert */}
      {!profile.isVerified && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">E-posta Doğrulaması Gerekli</h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Hesabınızın tüm özelliklerinden yararlanabilmek için e-posta adresinizi doğrulamanız gerekmektedir.
                İhaleye katılım ve teklif verme gibi işlemler için doğrulama zorunludur.
              </p>
              {verificationSent ? (
                <p className="mt-3 text-sm font-medium text-green-700 dark:text-green-400">
                  ✅ Doğrulama e-postası gönderildi! Lütfen gelen kutunuzu kontrol edin.
                </p>
              ) : (
                <Button
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleSendVerification}
                  disabled={sendingVerification}
                >
                  {sendingVerification ? 'Gönderiliyor...' : 'Doğrulama E-postası Gönder'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Profile Info Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Profil Bilgilerim</h2>
          {!editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Düzenle
            </Button>
          )}
        </div>

        {success && (
          <Alert variant="success" className="mt-4">
            Profil bilgileriniz güncellendi.
          </Alert>
        )}

        {editing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Ad"
                {...register('firstName')}
                placeholder="Adınız"
              />
              <FormField
                label="Soyad"
                {...register('lastName')}
                placeholder="Soyadınız"
              />
            </div>
            <FormField
              label="Telefon"
              {...register('phone')}
              placeholder="0 5XX XXX XX XX"
              type="tel"
            />
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  reset({
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    phone: profile.phone || '',
                  });
                }}
              >
                İptal
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 divide-y divide-[var(--border)]">
            <InfoRow label="E-posta" value={profile.email} />
            <InfoRow label="Ad Soyad" value={fullName || 'Belirtilmemiş'} />
            <InfoRow label="Telefon" value={profile.phone || 'Belirtilmemiş'} />
            <InfoRow
              label="Hesap Durumu"
              value={profile.isVerified ? '✅ Doğrulanmış' : '⏳ Doğrulanmamış'}
            />
            <InfoRow
              label="Üyelik Tarihi"
              value={new Date(profile.createdAt).toLocaleDateString('tr-TR', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            />
            {profile.lastLoginAt && (
              <InfoRow
                label="Son Giriş"
                value={new Date(profile.lastLoginAt).toLocaleDateString('tr-TR', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              />
            )}
          </div>
        )}
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickStatCard icon="❤️" label="Favori İlanlar" href="/profile/favorites" description="Takip ettiğiniz arsalar" />
        <QuickStatCard icon="💰" label="Tekliflerim" href="/profile/offers" description="Verdiğiniz teklifler" />
        <QuickStatCard icon="🔨" label="İhale Geçmişim" href="/profile/auctions" description="Katıldığınız ihaleler" />
      </div>

      {/* Password Change */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Güvenlik</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Şifrenizi düzenli olarak değiştirmenizi öneririz.
        </p>
        <PasswordChangeForm />
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-3 text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function QuickStatCard({
  icon,
  label,
  href,
  description,
}: {
  icon: string;
  label: string;
  href: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] p-5 hover:border-brand-500 hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <svg className="h-5 w-5 text-[var(--muted-foreground)] group-hover:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
      <span className="font-semibold">{label}</span>
      <span className="text-xs text-[var(--muted-foreground)]">{description}</span>
    </a>
  );
}

function PasswordChangeForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>();

  async function onSubmit(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    if (data.newPassword !== data.confirmPassword) {
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setSuccess(true);
      setOpen(false);
      reset();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <Alert variant="success" className="mt-4">
        Şifreniz başarıyla değiştirildi.
      </Alert>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        Şifre Değiştir
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
      <FormField
        label="Mevcut Şifre"
        type="password"
        {...register('currentPassword', { required: 'Zorunlu alan' })}
        error={errors.currentPassword?.message}
      />
      <FormField
        label="Yeni Şifre"
        type="password"
        {...register('newPassword', {
          required: 'Zorunlu alan',
          minLength: { value: 8, message: 'En az 8 karakter' },
        })}
        error={errors.newPassword?.message}
      />
      <FormField
        label="Yeni Şifre (Tekrar)"
        type="password"
        {...register('confirmPassword', { required: 'Zorunlu alan' })}
        error={errors.confirmPassword?.message}
      />
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Değiştiriliyor...' : 'Şifre Değiştir'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => { setOpen(false); reset(); }}>
          İptal
        </Button>
      </div>
    </form>
  );
}

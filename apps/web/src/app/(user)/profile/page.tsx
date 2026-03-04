'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
  createdAt: string;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

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

  if (loading) return <LoadingState />;

  if (!profile) return <Alert>Profil bilgileri yüklenemedi.</Alert>;

  return (
    <div className="space-y-6">
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
          <div className="mt-4 space-y-3">
            <InfoRow label="E-posta" value={profile.email} />
            <InfoRow
              label="Ad Soyad"
              value={
                [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
                'Belirtilmemiş'
              }
            />
            <InfoRow label="Telefon" value={profile.phone || 'Belirtilmemiş'} />
            <InfoRow
              label="Hesap Durumu"
              value={profile.isVerified ? '✅ Doğrulanmış' : '⏳ Doğrulanmamış'}
            />
            <InfoRow
              label="Üyelik Tarihi"
              value={new Date(profile.createdAt).toLocaleDateString('tr-TR')}
            />
          </div>
        )}
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickStatCard icon="❤️" label="Favori İlanlar" href="/profile/favorites" />
        <QuickStatCard icon="💰" label="Tekliflerim" href="/profile/offers" />
        <QuickStatCard icon="🔨" label="İhale Geçmişim" href="/profile/auctions" />
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
    <div className="flex justify-between text-sm border-b border-[var(--border)] pb-2">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QuickStatCard({
  icon,
  label,
  href,
}: {
  icon: string;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-4 hover:border-brand-500 hover:shadow-sm transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
      <span className="ml-auto text-[var(--muted-foreground)]">→</span>
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

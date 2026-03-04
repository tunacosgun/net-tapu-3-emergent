'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { PageHeader, Card, Button, Alert } from '@/components/ui';
import { FormField, FormTextarea, FormSelect } from '@/components/form-field';
import { useForm } from 'react-hook-form';

interface CampaignForm {
  name: string;
  description: string;
  type: string;
  discountPercentage: string;
  discountAmount: string;
  startDate: string;
  endDate: string;
  status: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CampaignForm>({
    defaultValues: {
      type: 'discount',
      status: 'draft',
    },
  });

  const campaignType = watch('type');

  async function onSubmit(data: CampaignForm) {
    setSaving(true);
    try {
      const payload = {
        name: data.name,
        description: data.description || null,
        type: data.type,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        discountPercentage: data.discountPercentage ? parseFloat(data.discountPercentage) : null,
        discountAmount: data.discountAmount ? parseFloat(data.discountAmount) : null,
      };
      await apiClient.post('/admin/campaigns', payload);
      router.push('/admin/campaigns');
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Yeni Kampanya" subtitle="Yeni bir kampanya oluşturun" />

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            label="Kampanya Adı"
            {...register('name', { required: 'Zorunlu alan' })}
            error={errors.name?.message}
            placeholder="Kampanya adını girin"
          />

          <FormTextarea
            label="Açıklama"
            {...register('description')}
            placeholder="Kampanya detayları"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Kampanya Türü</label>
              <select
                {...register('type')}
                className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="discount">İndirim</option>
                <option value="promotion">Promosyon</option>
                <option value="spin_wheel">Çark</option>
                <option value="referral">Referans</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Durum</label>
              <select
                {...register('status')}
                className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="draft">Taslak</option>
                <option value="active">Aktif</option>
                <option value="paused">Duraklatıldı</option>
              </select>
            </div>
          </div>

          {(campaignType === 'discount' || campaignType === 'promotion') && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="İndirim Yüzdesi (%)"
                type="number"
                step="0.1"
                {...register('discountPercentage')}
                placeholder="Örn: 10"
              />
              <FormField
                label="İndirim Tutarı (TL)"
                type="number"
                {...register('discountAmount')}
                placeholder="Örn: 5000"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Başlangıç Tarihi"
              type="date"
              {...register('startDate', { required: 'Zorunlu alan' })}
              error={errors.startDate?.message}
            />
            <FormField
              label="Bitiş Tarihi"
              type="date"
              {...register('endDate', { required: 'Zorunlu alan' })}
              error={errors.endDate?.message}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Oluşturuluyor...' : 'Kampanya Oluştur'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              İptal
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

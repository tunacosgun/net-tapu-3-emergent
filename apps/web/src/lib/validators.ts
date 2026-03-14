import { z } from 'zod';

// ── Auth ────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'E-posta gerekli')
    .email('Geçerli bir e-posta girin')
    .max(255, 'E-posta en fazla 255 karakter olabilir'),
  password: z
    .string()
    .min(1, 'Parola gerekli')
    .max(128, 'Parola en fazla 128 karakter olabilir'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Ad gerekli')
    .max(100, 'Ad en fazla 100 karakter olabilir'),
  lastName: z
    .string()
    .min(1, 'Soyad gerekli')
    .max(100, 'Soyad en fazla 100 karakter olabilir'),
  email: z
    .string()
    .min(1, 'E-posta gerekli')
    .email('Geçerli bir e-posta girin')
    .max(255, 'E-posta en fazla 255 karakter olabilir'),
  password: z
    .string()
    .min(8, 'Parola en az 8 karakter olmalı')
    .max(128, 'Parola en fazla 128 karakter olabilir'),
  phone: z
    .string()
    .max(20, 'Telefon en fazla 20 karakter olabilir')
    .optional()
    .or(z.literal('')),
  acceptTerms: z.literal(true, {
    message: 'Kullanim kosullarini kabul etmelisiniz',
  }),
  acceptKvkk: z.literal(true, {
    message: 'KVKK aydinlatma metnini kabul etmelisiniz',
  }),
});
export type RegisterFormData = z.infer<typeof registerSchema>;

// ── Admin: Parcel ───────────────────────────────────────────────────────

export const parcelSchema = z.object({
  title: z
    .string()
    .min(1, 'Başlık gerekli')
    .max(500, 'Başlık en fazla 500 karakter olabilir'),
  city: z
    .string()
    .min(1, 'Şehir gerekli')
    .max(100, 'Şehir en fazla 100 karakter olabilir'),
  district: z
    .string()
    .min(1, 'İlçe gerekli')
    .max(100, 'İlçe en fazla 100 karakter olabilir'),
  neighborhood: z.string().max(100).optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  areaM2: z.string().optional().or(z.literal('')),
  price: z.string().optional().or(z.literal('')),
  zoningStatus: z.string().max(200).optional().or(z.literal('')),
  landType: z.string().max(100).optional().or(z.literal('')),
  ada: z.string().max(20).optional().or(z.literal('')),
  parsel: z.string().max(20).optional().or(z.literal('')),
  latitude: z.string().optional().or(z.literal('')),
  longitude: z.string().optional().or(z.literal('')),
  isAuctionEligible: z.boolean(),
  isFeatured: z.boolean(),
  description: z.string().optional().or(z.literal('')),
});
export type ParcelFormData = z.infer<typeof parcelSchema>;

// ── Admin: Auction ──────────────────────────────────────────────────────

export const auctionSchema = z.object({
  parcelId: z.string().uuid('Geçerli bir UUID girin'),
  title: z
    .string()
    .min(1, 'Başlık gerekli')
    .max(500, 'Başlık en fazla 500 karakter olabilir'),
  startTime: z.string().min(1, 'Başlangıç tarihi gerekli'),
  endTime: z.string().min(1, 'Bitiş tarihi gerekli'),
  depositDeadline: z.string().min(1, 'Depozito son tarihi gerekli'),
  startingPrice: z.string().min(1, 'Başlangıç fiyatı gerekli'),
  minimumIncrement: z.string().min(1, 'Minimum artış gerekli'),
  requiredDeposit: z.string().min(1, 'Gerekli depozito gerekli'),
  currency: z.string().max(3).optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  sniperEnabled: z.boolean().optional(),
  sniperWindowSeconds: z.number().optional(),
  sniperExtensionSeconds: z.number().optional(),
  maxSniperExtensions: z.number().optional(),
});
export type AuctionFormData = z.infer<typeof auctionSchema>;

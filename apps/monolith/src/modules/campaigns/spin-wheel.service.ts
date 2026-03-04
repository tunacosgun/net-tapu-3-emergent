import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { SpinResult } from './entities/spin-result.entity';
import { randomBytes } from 'crypto';

/**
 * Prize configuration — weights determine probability.
 * Higher weight = more likely to win.
 */
interface PrizeConfig {
  key: string;
  label: string;
  weight: number;
  color: string;
  discountPercent?: number;
}

const DEFAULT_PRIZES: PrizeConfig[] = [
  { key: 'discount_3', label: '%3 İndirim', weight: 25, color: '#ea580c', discountPercent: 3 },
  { key: 'discount_5', label: '%5 İndirim', weight: 20, color: '#16a34a', discountPercent: 5 },
  { key: 'free_consult', label: 'Ücretsiz Danışmanlık', weight: 15, color: '#2563eb' },
  { key: 'retry', label: 'Tekrar Dene', weight: 20, color: '#9333ea' },
  { key: 'discount_10', label: '%10 İndirim', weight: 10, color: '#dc2626', discountPercent: 10 },
  { key: 'vip_1month', label: 'VIP Üyelik', weight: 5, color: '#0891b2' },
  { key: 'discount_15', label: '%15 İndirim', weight: 3, color: '#e11d48', discountPercent: 15 },
  { key: 'gift_card', label: 'Hediye Çek', weight: 2, color: '#65a30d' },
];

@Injectable()
export class SpinWheelService {
  private readonly logger = new Logger(SpinWheelService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(SpinResult)
    private readonly spinResultRepo: Repository<SpinResult>,
  ) {}

  /**
   * Get the active gamification campaign and its prize configuration.
   */
  async getActiveSpinCampaign(): Promise<{
    campaign: Campaign;
    prizes: PrizeConfig[];
  } | null> {
    const now = new Date();
    const campaign = await this.campaignRepo.findOne({
      where: {
        campaignType: 'gamification',
        status: 'active',
      },
    });

    if (!campaign) return null;
    if (now < campaign.startsAt || now > campaign.endsAt) return null;

    // Prizes can be stored in campaign metadata or use defaults
    const prizes: PrizeConfig[] =
      (campaign.metadata?.prizes as PrizeConfig[]) ?? DEFAULT_PRIZES;

    return { campaign, prizes };
  }

  /**
   * Get spin eligibility for a user.
   */
  async getEligibility(userId: string): Promise<{
    eligible: boolean;
    reason?: string;
    nextSpinAt?: Date;
    prizes: Array<{ key: string; label: string; color: string }>;
  }> {
    const active = await this.getActiveSpinCampaign();
    if (!active) {
      return { eligible: false, reason: 'Aktif çark kampanyası bulunamadı.', prizes: [] };
    }

    const { campaign, prizes } = active;

    // Check if campaign has reached max uses
    if (campaign.maxUses && campaign.currentUses >= campaign.maxUses) {
      return {
        eligible: false,
        reason: 'Kampanya kullanım limiti dolmuştur.',
        prizes: prizes.map((p) => ({ key: p.key, label: p.label, color: p.color })),
      };
    }

    // Check user spin cooldown: 1 spin per 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSpin = await this.spinResultRepo.findOne({
      where: {
        userId,
        campaignId: campaign.id,
        createdAt: MoreThan(twentyFourHoursAgo),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentSpin) {
      const nextSpinAt = new Date(recentSpin.createdAt.getTime() + 24 * 60 * 60 * 1000);
      return {
        eligible: false,
        reason: 'Günde bir kez çark çevirebilirsiniz.',
        nextSpinAt,
        prizes: prizes.map((p) => ({ key: p.key, label: p.label, color: p.color })),
      };
    }

    return {
      eligible: true,
      prizes: prizes.map((p) => ({ key: p.key, label: p.label, color: p.color })),
    };
  }

  /**
   * Execute a spin — determine prize via weighted random, record result.
   */
  async spin(userId: string): Promise<{
    prize: { key: string; label: string; color: string };
    discountCode: string | null;
    expiresAt: Date;
  }> {
    const active = await this.getActiveSpinCampaign();
    if (!active) {
      throw new NotFoundException('Aktif çark kampanyası bulunamadı.');
    }

    const { campaign, prizes } = active;

    // Eligibility check
    if (campaign.maxUses && campaign.currentUses >= campaign.maxUses) {
      throw new BadRequestException('Kampanya kullanım limiti dolmuştur.');
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSpin = await this.spinResultRepo.findOne({
      where: {
        userId,
        campaignId: campaign.id,
        createdAt: MoreThan(twentyFourHoursAgo),
      },
    });

    if (recentSpin) {
      throw new ConflictException('Günde bir kez çark çevirebilirsiniz.');
    }

    // Weighted random prize selection
    const winner = this.selectWeightedPrize(prizes);

    // Generate discount code if prize has a discount
    const discountCode = winner.discountPercent
      ? this.generateDiscountCode()
      : null;

    // Prize expires in 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Save result
    const spinResult = this.spinResultRepo.create({
      userId,
      campaignId: campaign.id,
      prizeKey: winner.key,
      prizeLabel: winner.label,
      discountCode,
      expiresAt,
    });
    await this.spinResultRepo.save(spinResult);

    // Increment campaign usage
    await this.campaignRepo.increment({ id: campaign.id }, 'currentUses', 1);

    this.logger.log(
      `User ${userId} won "${winner.label}" in campaign ${campaign.id}`,
    );

    return {
      prize: { key: winner.key, label: winner.label, color: winner.color },
      discountCode,
      expiresAt,
    };
  }

  /**
   * Get user's spin history.
   */
  async getUserSpinHistory(userId: string) {
    return this.spinResultRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  /**
   * Redeem a discount code from a spin result.
   */
  async redeemCode(code: string, userId: string) {
    const result = await this.spinResultRepo.findOne({
      where: { discountCode: code, userId },
    });

    if (!result) {
      throw new NotFoundException('İndirim kodu bulunamadı.');
    }

    if (result.isRedeemed) {
      throw new BadRequestException('Bu kod zaten kullanılmış.');
    }

    if (new Date() > result.expiresAt) {
      throw new BadRequestException('Bu kodun süresi dolmuş.');
    }

    result.isRedeemed = true;
    result.redeemedAt = new Date();
    await this.spinResultRepo.save(result);

    return { success: true, prizeKey: result.prizeKey, prizeLabel: result.prizeLabel };
  }

  // ── Private helpers ──

  private selectWeightedPrize(prizes: PrizeConfig[]): PrizeConfig {
    const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const prize of prizes) {
      random -= prize.weight;
      if (random <= 0) return prize;
    }

    // Fallback (should never reach here)
    return prizes[prizes.length - 1];
  }

  private generateDiscountCode(): string {
    const bytes = randomBytes(4);
    return `NT-${bytes.toString('hex').toUpperCase().slice(0, 8)}`;
  }
}

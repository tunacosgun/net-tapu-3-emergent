import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceAlert } from '../entities/price-alert.entity';
import { ParcelService } from './parcel.service';

@Injectable()
export class PriceAlertService {
  private readonly logger = new Logger(PriceAlertService.name);

  constructor(
    @InjectRepository(PriceAlert)
    private readonly alertRepo: Repository<PriceAlert>,
    private readonly parcelService: ParcelService,
  ) {}

  /**
   * Subscribe to price drop alerts for a parcel.
   */
  async subscribe(
    userId: string,
    parcelId: string,
    options?: { targetPrice?: number; alertType?: string },
  ): Promise<PriceAlert> {
    // Verify parcel exists
    await this.parcelService.findById(parcelId);

    // Check for existing subscription
    const existing = await this.alertRepo.findOne({
      where: { userId, parcelId },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('Price alert already exists for this parcel');
      }
      // Reactivate existing alert
      existing.isActive = true;
      existing.targetPrice = options?.targetPrice?.toFixed(2) ?? null;
      existing.alertType = options?.alertType ?? 'any_drop';
      return this.alertRepo.save(existing);
    }

    const alert = this.alertRepo.create({
      userId,
      parcelId,
      targetPrice: options?.targetPrice?.toFixed(2) ?? null,
      alertType: options?.alertType ?? 'any_drop',
      isActive: true,
    });

    const saved = await this.alertRepo.save(alert);
    this.logger.log(`User ${userId} subscribed to price alerts for parcel ${parcelId}`);
    return saved;
  }

  /**
   * Unsubscribe from price drop alerts.
   */
  async unsubscribe(userId: string, parcelId: string): Promise<void> {
    const alert = await this.alertRepo.findOne({
      where: { userId, parcelId, isActive: true },
    });

    if (!alert) {
      throw new NotFoundException('No active price alert found');
    }

    alert.isActive = false;
    await this.alertRepo.save(alert);
    this.logger.log(`User ${userId} unsubscribed from price alerts for parcel ${parcelId}`);
  }

  /**
   * Get all active alerts for a user.
   */
  async getUserAlerts(userId: string): Promise<PriceAlert[]> {
    return this.alertRepo.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if a user has an active price alert for a parcel.
   */
  async hasAlert(userId: string, parcelId: string): Promise<boolean> {
    const count = await this.alertRepo.count({
      where: { userId, parcelId, isActive: true },
    });
    return count > 0;
  }

  /**
   * Find all active alerts for a parcel (used when price changes).
   */
  async findActiveAlertsForParcel(parcelId: string): Promise<PriceAlert[]> {
    return this.alertRepo.find({
      where: { parcelId, isActive: true },
    });
  }

  /**
   * Process price drop: check all active alerts for this parcel and trigger notifications.
   * Called by PricingService after a price change.
   */
  async processPriceDrop(
    parcelId: string,
    oldPrice: number,
    newPrice: number,
  ): Promise<{ notified: number }> {
    if (newPrice >= oldPrice) {
      return { notified: 0 }; // Not a price drop
    }

    const alerts = await this.findActiveAlertsForParcel(parcelId);
    let notified = 0;

    for (const alert of alerts) {
      const shouldNotify =
        alert.alertType === 'any_drop' ||
        (alert.alertType === 'target_price' &&
          alert.targetPrice &&
          newPrice <= parseFloat(alert.targetPrice));

      if (shouldNotify) {
        // Update alert record
        alert.triggeredCount++;
        alert.lastNotifiedAt = new Date();
        await this.alertRepo.save(alert);

        // TODO: Enqueue notification via NotificationService
        // notificationService.enqueue({
        //   userId: alert.userId,
        //   eventType: 'price_drop',
        //   data: { parcelId, oldPrice, newPrice },
        // });

        notified++;
      }
    }

    if (notified > 0) {
      this.logger.log(
        `Price drop on parcel ${parcelId}: ${oldPrice} → ${newPrice}, notified ${notified} users`,
      );
    }

    return { notified };
  }
}

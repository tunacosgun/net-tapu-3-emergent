import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ParcelReservation } from '../entities/parcel-reservation.entity';
import { Parcel } from '../entities/parcel.entity';

const RESERVATION_DURATION_HOURS = 48;

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    @InjectRepository(ParcelReservation)
    private readonly reservationRepo: Repository<ParcelReservation>,
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Reserve a parcel for 48 hours. Only one active reservation per parcel.
   */
  async reserve(parcelId: string, userId: string): Promise<ParcelReservation> {
    return this.dataSource.transaction(async (manager) => {
      // Lock parcel for concurrent reservation attempts
      const parcel = await manager
        .getRepository(Parcel)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: parcelId })
        .getOne();

      if (!parcel) {
        throw new NotFoundException(`Parcel ${parcelId} not found`);
      }

      if (parcel.status !== 'active') {
        throw new BadRequestException(
          `Parcel is not available for reservation (current status: ${parcel.status})`,
        );
      }

      // Check for existing active reservation
      const existing = await manager
        .getRepository(ParcelReservation)
        .findOne({
          where: { parcelId, status: 'active' },
        });

      if (existing) {
        if (existing.userId === userId) {
          throw new ConflictException('You already have an active reservation for this parcel');
        }
        throw new ConflictException('This parcel is already reserved by another user');
      }

      // Check if user already has too many active reservations (max 3)
      const userActiveCount = await manager
        .getRepository(ParcelReservation)
        .count({ where: { userId, status: 'active' } });

      if (userActiveCount >= 3) {
        throw new BadRequestException(
          'Maximum 3 active reservations allowed. Please cancel an existing reservation first.',
        );
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + RESERVATION_DURATION_HOURS * 60 * 60 * 1000);

      const reservation = manager.getRepository(ParcelReservation).create({
        parcelId,
        userId,
        status: 'active',
        reservedAt: now,
        expiresAt,
      });

      const saved = await manager.getRepository(ParcelReservation).save(reservation);
      this.logger.log(`Parcel ${parcelId} reserved by user ${userId} until ${expiresAt.toISOString()}`);
      return saved;
    });
  }

  /**
   * Cancel a reservation.
   */
  async cancel(reservationId: string, userId: string): Promise<ParcelReservation> {
    const reservation = await this.reservationRepo.findOne({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }

    if (reservation.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own reservations');
    }

    if (reservation.status !== 'active') {
      throw new BadRequestException(`Reservation is already ${reservation.status}`);
    }

    reservation.status = 'cancelled';
    reservation.cancelledAt = new Date();

    const saved = await this.reservationRepo.save(reservation);
    this.logger.log(`Reservation ${reservationId} cancelled by user ${userId}`);
    return saved;
  }

  /**
   * Get active reservation for a parcel (if any).
   */
  async getActiveReservation(parcelId: string): Promise<ParcelReservation | null> {
    return this.reservationRepo.findOne({
      where: { parcelId, status: 'active' },
    });
  }

  /**
   * Get all reservations for a user.
   */
  async getUserReservations(userId: string): Promise<ParcelReservation[]> {
    return this.reservationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Cron job: Expire reservations that have passed their 48h window.
   * Runs every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleReservations(): Promise<void> {
    const now = new Date();

    const expired = await this.reservationRepo.find({
      where: {
        status: 'active',
        expiresAt: LessThan(now),
      },
    });

    if (expired.length === 0) return;

    for (const reservation of expired) {
      reservation.status = 'expired';
    }

    await this.reservationRepo.save(expired);
    this.logger.log(`Expired ${expired.length} stale reservations`);
  }
}

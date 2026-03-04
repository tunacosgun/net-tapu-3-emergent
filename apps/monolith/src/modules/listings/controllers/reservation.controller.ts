import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { ReservationService } from '../services/reservation.service';

@Controller('parcels')
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  /**
   * POST /parcels/:id/reserve — Reserve a parcel for 48 hours
   */
  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async reserve(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reservationService.reserve(parcelId, user.sub);
  }

  /**
   * GET /parcels/:id/reservation — Get active reservation for a parcel
   */
  @Get(':id/reservation')
  async getReservation(@Param('id', ParseUUIDPipe) parcelId: string) {
    const reservation = await this.reservationService.getActiveReservation(parcelId);
    return { parcelId, reservation };
  }
}

/**
 * User-level reservation management.
 */
@Controller('user/reservations')
@UseGuards(JwtAuthGuard)
export class UserReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  /**
   * GET /user/reservations — Get all reservations for the current user
   */
  @Get()
  async getMyReservations(@CurrentUser() user: JwtPayload) {
    return this.reservationService.getUserReservations(user.sub);
  }

  /**
   * PATCH /user/reservations/:id/cancel — Cancel a reservation
   */
  @Patch(':id/cancel')
  async cancelReservation(
    @Param('id', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reservationService.cancel(reservationId, user.sub);
  }
}

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RefundService } from '../services/refund.service';
import { InitiateRefundDto } from '../dto/initiate-refund.dto';

@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @Body() dto: InitiateRefundDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.refundService.initiateRefund(dto, user.sub);
  }

  @Get('payment/:paymentId')
  async findByPayment(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.refundService.findByPayment(paymentId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.refundService.findById(id);
  }
}

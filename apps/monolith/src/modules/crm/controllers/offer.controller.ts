import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { OfferService } from '../services/offer.service';
import { CreateOfferDto } from '../dto/create-offer.dto';
import { RespondToOfferDto } from '../dto/respond-to-offer.dto';
import { ListOffersQueryDto } from '../dto/list-offers-query.dto';

@Controller('crm/offers')
@UseGuards(JwtAuthGuard)
export class OfferController {
  constructor(private readonly service: OfferService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOfferDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'consultant')
  async findAll(@Query() query: ListOffersQueryDto) {
    return this.service.findAll(query);
  }

  @Get('mine')
  async findMyOffers(@CurrentUser() user: JwtPayload) {
    return this.service.findByUser(user.sub);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post(':id/respond')
  @UseGuards(RolesGuard)
  @Roles('admin', 'consultant')
  @HttpCode(HttpStatus.OK)
  async respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondToOfferDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.respond(id, dto, user.sub);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.withdraw(id, user.sub);
  }
}

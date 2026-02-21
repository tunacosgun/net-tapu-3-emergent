import {
  Controller,
  Get,
  Post,
  Patch,
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
import { ParcelService } from '../services/parcel.service';
import { CreateParcelDto } from '../dto/create-parcel.dto';
import { UpdateParcelDto } from '../dto/update-parcel.dto';
import { UpdateParcelStatusDto } from '../dto/update-parcel-status.dto';
import { ListParcelsQueryDto } from '../dto/list-parcels-query.dto';

@Controller('parcels')
export class ParcelController {
  constructor(private readonly parcelService: ParcelService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateParcelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parcelService.create(dto, user.sub);
  }

  @Get()
  async findAll(@Query() query: ListParcelsQueryDto) {
    return this.parcelService.findAll(query);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.parcelService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParcelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parcelService.update(id, dto, user.sub);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParcelStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parcelService.updateStatus(id, dto, user.sub);
  }
}

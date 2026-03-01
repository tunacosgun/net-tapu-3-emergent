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
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../dto/update-appointment.dto';
import { ListAppointmentsQueryDto } from '../dto/list-appointments-query.dto';

@Controller('crm/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'consultant')
export class AppointmentController {
  constructor(private readonly service: AppointmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  async findAll(@Query() query: ListAppointmentsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
}

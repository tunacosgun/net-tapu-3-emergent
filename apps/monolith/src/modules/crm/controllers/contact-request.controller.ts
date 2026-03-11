import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { ContactRequestService } from '../services/contact-request.service';
import { CreateContactRequestDto } from '../dto/create-contact-request.dto';
import { UpdateContactRequestDto } from '../dto/update-contact-request.dto';
import { ListContactRequestsQueryDto } from '../dto/list-contact-requests-query.dto';

@Controller('crm/contact-requests')
export class ContactRequestController {
  constructor(private readonly service: ContactRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateContactRequestDto,
    @Req() req: Request,
  ) {
    const userId = (req as unknown as { user?: JwtPayload }).user?.sub;
    const ip = req.ip ?? req.socket.remoteAddress;
    return this.service.create(dto, userId, ip);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  async findAll(@Query() query: ListContactRequestsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Get(':id/activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  async getActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getActivity(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
}

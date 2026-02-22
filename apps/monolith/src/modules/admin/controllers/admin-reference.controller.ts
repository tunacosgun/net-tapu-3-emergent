import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReferenceService } from '../services/reference.service';
import { CreateReferenceDto } from '../dto/create-reference.dto';
import { UpdateReferenceDto } from '../dto/update-reference.dto';
import { AuditInterceptor } from '../interceptors/audit.interceptor';

@Controller('admin/references')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditInterceptor)
export class AdminReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateReferenceDto) {
    return this.referenceService.create(dto);
  }

  @Get()
  async findAll() {
    return this.referenceService.findAll();
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.referenceService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReferenceDto,
  ) {
    return this.referenceService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.referenceService.remove(id);
  }
}

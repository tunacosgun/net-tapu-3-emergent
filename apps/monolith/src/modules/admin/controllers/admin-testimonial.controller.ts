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
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { TestimonialService } from '../services/testimonial.service';

@Controller('admin/testimonials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditInterceptor)
export class AdminTestimonialController {
  constructor(private readonly testimonialService: TestimonialService) {}

  @Get()
  async findAll() {
    return this.testimonialService.findAll();
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.testimonialService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: {
    name: string;
    title?: string;
    comment: string;
    rating: number;
    photoUrl?: string;
    videoUrl?: string;
  }) {
    return this.testimonialService.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Partial<{
      name: string;
      title: string;
      comment: string;
      rating: number;
      photoUrl: string;
      videoUrl: string;
      isApproved: boolean;
      sortOrder: number;
    }>,
  ) {
    return this.testimonialService.update(id, body);
  }

  @Patch(':id/approve')
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.testimonialService.approve(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.testimonialService.remove(id);
  }
}

/**
 * Public endpoint for approved testimonials
 */
@Controller('testimonials')
export class PublicTestimonialController {
  constructor(private readonly testimonialService: TestimonialService) {}

  @Get()
  async findApproved() {
    return this.testimonialService.findAll(true);
  }
}

import {
  Controller,
  Get,
  Post,
  Delete,
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
import { JwtPayload } from '../../auth/auth.service';
import { ParcelMediaService } from '../services/parcel-media.service';
import { CreateParcelImageDto } from '../dto/create-parcel-image.dto';
import { CreateParcelDocumentDto } from '../dto/create-parcel-document.dto';

@Controller('parcels/:parcelId')
export class ParcelMediaController {
  constructor(private readonly mediaService: ParcelMediaService) {}

  // ── Images ──

  @Post('images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  @HttpCode(HttpStatus.CREATED)
  async addImage(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @Body() dto: CreateParcelImageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mediaService.addImage(parcelId, dto, user.sub);
  }

  @Get('images')
  async listImages(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    return this.mediaService.listImages(parcelId);
  }

  @Delete('images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeImage(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.mediaService.removeImage(parcelId, imageId, user.sub);
  }

  // ── Documents ──

  @Post('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  @HttpCode(HttpStatus.CREATED)
  async addDocument(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @Body() dto: CreateParcelDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mediaService.addDocument(parcelId, dto, user.sub);
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard)
  async listDocuments(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    return this.mediaService.listDocuments(parcelId);
  }

  @Delete('documents/:docId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDocument(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.mediaService.removeDocument(parcelId, docId, user.sub);
  }
}

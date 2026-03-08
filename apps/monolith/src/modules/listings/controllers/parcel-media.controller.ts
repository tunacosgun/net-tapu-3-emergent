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
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { ParcelMediaService } from '../services/parcel-media.service';
import { CreateParcelImageDto } from '../dto/create-parcel-image.dto';
import { CreateParcelDocumentDto } from '../dto/create-parcel-document.dto';

const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

  /** Direct file upload — accepts up to 10 images via multipart */
  @Post('images/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const parcelId = (_req as { params: Record<string, string> }).params.parcelId;
          const dest = join(UPLOADS_DIR, 'parcels', parcelId);
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('fs').mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadImages(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtPayload,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const originalUrl = `/uploads/parcels/${parcelId}/${file.filename}`;
      const dto: CreateParcelImageDto = {
        originalUrl,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        sortOrder: i,
        isCover: i === 0,
      };
      const image = await this.mediaService.addImage(parcelId, dto, user.sub);
      results.push(image);
    }

    return results;
  }

  @Get('images')
  async listImages(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    return this.mediaService.listImages(parcelId);
  }

  /** POST /parcels/:parcelId/images/:imageId/cover — Set cover image */
  @Post('images/:imageId/cover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  @HttpCode(HttpStatus.OK)
  async setCover(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.mediaService.setCoverImage(parcelId, imageId, user.sub);
    return { success: true };
  }

  /** POST /parcels/:parcelId/images/reorder — Reorder images */
  @Post('images/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'consultant')
  @HttpCode(HttpStatus.OK)
  async reorderImages(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @Body() body: { imageIds: string[] },
    @CurrentUser() user: JwtPayload,
  ) {
    await this.mediaService.reorderImages(parcelId, body.imageIds, user.sub);
    return { success: true };
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

import {
  Controller,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { ParcelImportService } from '../services/parcel-import.service';

@Controller('admin/parcels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminParcelController {
  constructor(private readonly importService: ParcelImportService) {}

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRunStr?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    const ext = file.originalname.toLowerCase().endsWith('.csv');
    const mime =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel';
    if (!ext && !mime) {
      throw new BadRequestException('Only CSV files are accepted');
    }

    const dryRun = dryRunStr === 'true';
    return this.importService.importCsv(file.buffer, user!.sub, dryRun);
  }
}

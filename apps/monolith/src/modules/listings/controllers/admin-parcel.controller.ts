import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { ParcelService } from '../services/parcel.service';
import { ParcelImportService } from '../services/parcel-import.service';
import { ListParcelsQueryDto } from '../dto/list-parcels-query.dto';
import { UpdateParcelDto } from '../dto/update-parcel.dto';
import { UpdateParcelStatusDto } from '../dto/update-parcel-status.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../entities/parcel.entity';

@Controller('admin/parcels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminParcelController {
  constructor(
    private readonly parcelService: ParcelService,
    private readonly importService: ParcelImportService,
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
  ) {}

  /** List all parcels (admin view — includes drafts, withdrawn, etc.) */
  @Get()
  async findAll(@Query() query: ListParcelsQueryDto) {
    return this.parcelService.findAll(query);
  }

  /** Export parcels as CSV — MUST be before :id route */
  @Get('export')
  async exportCsv(@Res() res: Response) {
    const parcels = await this.parcelRepo.find({
      order: { createdAt: 'DESC' },
      take: 10000,
    });

    const headers = [
      'listing_id', 'title', 'status', 'city', 'district', 'neighborhood',
      'ada', 'parsel', 'area_m2', 'price', 'currency', 'price_per_m2',
      'zoning_status', 'land_type', 'latitude', 'longitude',
      'is_featured', 'is_auction_eligible', 'created_at',
    ];

    const csvRows = [headers.join(',')];
    for (const p of parcels) {
      const row = [
        p.listingId,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        p.status,
        p.city,
        p.district,
        p.neighborhood || '',
        p.ada || '',
        p.parsel || '',
        p.areaM2 || '',
        p.price || '',
        p.currency,
        p.pricePerM2 || '',
        `"${(p.zoningStatus || '').replace(/"/g, '""')}"`,
        `"${(p.landType || '').replace(/"/g, '""')}"`,
        p.latitude || '',
        p.longitude || '',
        p.isFeatured,
        p.isAuctionEligible,
        p.createdAt?.toISOString() || '',
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="parcels-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
    res.send('\uFEFF' + csv); // BOM for Turkish chars in Excel
  }

  /** Bulk price adjustment (percentage-based) */
  @Post('bulk-price-update')
  @HttpCode(HttpStatus.OK)
  async bulkPriceUpdate(
    @Body()
    body: {
      percentage: number;
      filters?: { city?: string; district?: string; status?: string };
    },
    @CurrentUser() user: JwtPayload,
  ) {
    if (typeof body.percentage !== 'number' || body.percentage === 0) {
      throw new BadRequestException('percentage must be a non-zero number');
    }
    if (Math.abs(body.percentage) > 50) {
      throw new BadRequestException('Percentage change cannot exceed ±50%');
    }

    const qb = this.parcelRepo.createQueryBuilder('p');
    qb.where('p.price IS NOT NULL');

    if (body.filters?.city) {
      qb.andWhere('p.city = :city', { city: body.filters.city });
    }
    if (body.filters?.district) {
      qb.andWhere('p.district = :district', { district: body.filters.district });
    }
    if (body.filters?.status) {
      qb.andWhere('p.status = :status', { status: body.filters.status });
    }

    const parcels = await qb.getMany();
    const multiplier = 1 + body.percentage / 100;
    let updated = 0;

    for (const parcel of parcels) {
      if (parcel.price) {
        const oldPrice = parseFloat(parcel.price as any);
        const newPrice = Math.round(oldPrice * multiplier * 100) / 100;
        await this.parcelRepo.update(parcel.id, {
          price: newPrice as any,
          pricePerM2: parcel.areaM2
            ? (Math.round((newPrice / parseFloat(parcel.areaM2 as any)) * 100) / 100) as any
            : parcel.pricePerM2,
        });
        updated++;
      }
    }

    return {
      message: `${updated} parsel fiyatı güncellendi`,
      totalMatched: parcels.length,
      totalUpdated: updated,
      percentage: body.percentage,
    };
  }

  /** Get a single parcel by ID */
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.parcelService.findById(id);
  }

  /** Update parcel fields */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParcelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parcelService.update(id, dto, user.sub);
  }

  /** Update parcel status */
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParcelStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parcelService.updateStatus(id, dto, user.sub);
  }

  /** Import parcels from CSV */
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

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParcelImage } from '../entities/parcel-image.entity';
import { ParcelDocument } from '../entities/parcel-document.entity';
import { CreateParcelImageDto } from '../dto/create-parcel-image.dto';
import { CreateParcelDocumentDto } from '../dto/create-parcel-document.dto';
import { ParcelService } from './parcel.service';

@Injectable()
export class ParcelMediaService {
  private readonly logger = new Logger(ParcelMediaService.name);

  constructor(
    @InjectRepository(ParcelImage)
    private readonly imageRepo: Repository<ParcelImage>,
    @InjectRepository(ParcelDocument)
    private readonly docRepo: Repository<ParcelDocument>,
    private readonly parcelService: ParcelService,
  ) {}

  // ── Images ──

  async addImage(parcelId: string, dto: CreateParcelImageDto, userId: string): Promise<ParcelImage> {
    await this.parcelService.findById(parcelId);

    const image = this.imageRepo.create({
      parcelId,
      originalUrl: dto.originalUrl,
      mimeType: dto.mimeType ?? null,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isCover: dto.isCover ?? false,
      status: 'uploading',
    });

    const saved = await this.imageRepo.save(image);
    this.logger.log(`Image ${saved.id} added to parcel ${parcelId} by user ${userId}`);
    return saved;
  }

  async listImages(parcelId: string): Promise<ParcelImage[]> {
    await this.parcelService.findById(parcelId);
    return this.imageRepo.find({
      where: { parcelId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async removeImage(parcelId: string, imageId: string, userId: string): Promise<void> {
    const image = await this.imageRepo.findOne({ where: { id: imageId, parcelId } });
    if (!image) {
      throw new NotFoundException(`Image ${imageId} not found on parcel ${parcelId}`);
    }
    await this.imageRepo.remove(image);
    this.logger.log(`Image ${imageId} removed from parcel ${parcelId} by user ${userId}`);
  }

  // ── Documents ──

  async addDocument(parcelId: string, dto: CreateParcelDocumentDto, userId: string): Promise<ParcelDocument> {
    await this.parcelService.findById(parcelId);

    const doc = this.docRepo.create({
      parcelId,
      documentType: dto.documentType,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      uploadedBy: userId,
    });

    const saved = await this.docRepo.save(doc);
    this.logger.log(`Document ${saved.id} added to parcel ${parcelId} by user ${userId}`);
    return saved;
  }

  async listDocuments(parcelId: string): Promise<ParcelDocument[]> {
    await this.parcelService.findById(parcelId);
    return this.docRepo.find({
      where: { parcelId },
      order: { createdAt: 'ASC' },
    });
  }

  async removeDocument(parcelId: string, docId: string, userId: string): Promise<void> {
    const doc = await this.docRepo.findOne({ where: { id: docId, parcelId } });
    if (!doc) {
      throw new NotFoundException(`Document ${docId} not found on parcel ${parcelId}`);
    }
    await this.docRepo.remove(doc);
    this.logger.log(`Document ${docId} removed from parcel ${parcelId} by user ${userId}`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { ParcelImage } from '../entities/parcel-image.entity';

const WATERMARK_OPACITY = 0.35;
const THUMBNAIL_WIDTH = 400;
const FULL_SIZE_MAX_WIDTH = 1600;

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor(
    @InjectRepository(ParcelImage)
    private readonly imageRepo: Repository<ParcelImage>,
    private readonly config: ConfigService,
  ) {
    this.uploadsDir = this.config.get<string>('UPLOADS_DIR') || path.join(process.cwd(), 'uploads');
    this.baseUrl = this.config.get<string>('UPLOADS_BASE_URL') || '/uploads';
  }

  /**
   * Process a parcel image: download from originalUrl, apply watermark, generate thumbnail.
   * Updates the ParcelImage record with watermarkedUrl, thumbnailUrl, and status.
   */
  async processImage(imageId: string): Promise<ParcelImage> {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });
    if (!image) {
      throw new Error(`Image ${imageId} not found`);
    }

    try {
      // Update status to processing
      image.status = 'processing';
      await this.imageRepo.save(image);

      // Ensure upload directories exist
      const parcelDir = path.join(this.uploadsDir, 'parcels', image.parcelId);
      await fs.mkdir(parcelDir, { recursive: true });

      // Download original image
      const imageBuffer = await this.downloadImage(image.originalUrl);

      // Generate unique filename
      const hash = crypto.createHash('md5').update(imageId).digest('hex').slice(0, 8);
      const ext = this.getExtension(image.mimeType || 'image/jpeg');

      // Process watermarked version
      const watermarkedFilename = `${hash}-watermarked${ext}`;
      const watermarkedPath = path.join(parcelDir, watermarkedFilename);
      await this.applyWatermark(imageBuffer, watermarkedPath);

      // Generate thumbnail
      const thumbnailFilename = `${hash}-thumb${ext}`;
      const thumbnailPath = path.join(parcelDir, thumbnailFilename);
      await this.generateThumbnail(imageBuffer, thumbnailPath);

      // Update image record with new URLs
      const relativeDir = `parcels/${image.parcelId}`;
      image.watermarkedUrl = `${this.baseUrl}/${relativeDir}/${watermarkedFilename}`;
      image.thumbnailUrl = `${this.baseUrl}/${relativeDir}/${thumbnailFilename}`;
      image.status = 'ready';

      const saved = await this.imageRepo.save(image);
      this.logger.log(`Image ${imageId} processed successfully`);
      return saved;
    } catch (err) {
      image.status = 'failed';
      await this.imageRepo.save(image);
      this.logger.error(`Image ${imageId} processing failed: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Apply semi-transparent watermark text to the image and save.
   */
  private async applyWatermark(buffer: Buffer, outputPath: string): Promise<void> {
    const metadata = await sharp(buffer).metadata();
    const width = Math.min(metadata.width || FULL_SIZE_MAX_WIDTH, FULL_SIZE_MAX_WIDTH);
    const height = metadata.height
      ? Math.round((width / (metadata.width || width)) * metadata.height)
      : undefined;

    // Create SVG watermark overlay
    const watermarkSvg = this.createWatermarkSvg(width, height || 900);

    await sharp(buffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          gravity: 'center',
        },
      ])
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(outputPath);
  }

  /**
   * Generate a thumbnail image.
   */
  private async generateThumbnail(buffer: Buffer, outputPath: string): Promise<void> {
    await sharp(buffer)
      .resize(THUMBNAIL_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, mozjpeg: true })
      .toFile(outputPath);
  }

  /**
   * Create an SVG watermark with "NetTapu" text rendered diagonally and tiled.
   */
  private createWatermarkSvg(width: number, height: number): string {
    const opacity = WATERMARK_OPACITY;
    const fontSize = Math.max(24, Math.round(width * 0.04));
    const spacing = Math.round(fontSize * 5);

    // Create tiled diagonal watermark pattern
    let textElements = '';
    for (let y = -spacing; y < height + spacing; y += spacing) {
      for (let x = -spacing; x < width + spacing; x += spacing) {
        textElements += `<text x="${x}" y="${y}" transform="rotate(-30, ${x}, ${y})" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" opacity="${opacity}">NetTapu</text>`;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${textElements}
    </svg>`;
  }

  /**
   * Download image from URL and return as buffer.
   */
  private async downloadImage(url: string): Promise<Buffer> {
    // Handle local file URLs
    if (url.startsWith('/') || url.startsWith('file://')) {
      const filePath = url.replace('file://', '');
      return fs.readFile(filePath);
    }

    // Handle remote URLs
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return map[mimeType.toLowerCase()] || '.jpg';
  }
}

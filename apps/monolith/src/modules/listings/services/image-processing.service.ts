import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
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
   * Apply watermark to the image. Uses admin-uploaded logo if available,
   * otherwise falls back to text-based watermark.
   */
  private async applyWatermark(buffer: Buffer, outputPath: string): Promise<void> {
    const metadata = await sharp(buffer).metadata();
    const width = Math.min(metadata.width || FULL_SIZE_MAX_WIDTH, FULL_SIZE_MAX_WIDTH);
    const height = metadata.height
      ? Math.round((width / (metadata.width || width)) * metadata.height)
      : undefined;

    // Try to load admin-uploaded watermark logo
    const logoBuffer = await this.getWatermarkLogo();

    let watermarkInput: Buffer;
    if (logoBuffer) {
      watermarkInput = await this.createLogoWatermark(logoBuffer, width, height || 900);
    } else {
      const watermarkSvg = this.createTextWatermarkSvg(width, height || 900);
      watermarkInput = Buffer.from(watermarkSvg);
    }

    await sharp(buffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .composite([
        {
          input: watermarkInput,
          gravity: 'center',
        },
      ])
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(outputPath);
  }

  /**
   * Get the admin-uploaded watermark logo from system settings.
   * Returns the logo as a Buffer, or null if not configured.
   */
  private async getWatermarkLogo(): Promise<Buffer | null> {
    try {
      const result = await this.dataSource.query(
        `SELECT value FROM admin.system_settings WHERE key = 'watermark_logo'`,
      );
      if (!result?.[0]?.value) return null;

      // JSONB value: pg driver returns parsed JSON. Could be string directly or object.
      let logoUrl: string = result[0].value;
      // If it's still an object (shouldn't happen for a string), stringify
      if (typeof logoUrl !== 'string') {
        logoUrl = String(logoUrl);
      }
      // Strip any surrounding quotes
      logoUrl = logoUrl.replace(/^"|"$/g, '').trim();

      if (!logoUrl || logoUrl === 'null' || logoUrl.length < 5) return null;

      this.logger.log(`Loading watermark logo from: ${logoUrl}`);
      return this.downloadImage(logoUrl);
    } catch (err) {
      this.logger.warn(`Failed to load watermark logo: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Create a tiled watermark overlay using the logo image.
   * The logo is repeated across the image with transparency.
   */
  private async createLogoWatermark(
    logoBuffer: Buffer,
    width: number,
    height: number,
  ): Promise<Buffer> {
    // Resize logo to a reasonable watermark size
    const logoSize = Math.max(60, Math.round(width * 0.1));
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .png()
      .toBuffer();

    const logoMeta = await sharp(resizedLogo).metadata();
    const lw = logoMeta.width || logoSize;
    const lh = logoMeta.height || logoSize;

    // Make logo semi-transparent by compositing with an alpha mask
    const opacity = WATERMARK_OPACITY;
    const alphaMask = await sharp({
      create: { width: lw, height: lh, channels: 4, background: { r: 255, g: 255, b: 255, alpha: opacity } },
    }).png().toBuffer();

    const semiTransparentLogo = await sharp(resizedLogo)
      .composite([{ input: alphaMask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    // Tile logos across the canvas
    const spacingX = Math.round(lw * 2.5);
    const spacingY = Math.round(lh * 2.5);
    const compositeOps: { input: Buffer; left: number; top: number }[] = [];

    for (let y = spacingY / 2; y < height; y += spacingY) {
      for (let x = spacingX / 2; x < width; x += spacingX) {
        const left = Math.round(x - lw / 2);
        const top = Math.round(y - lh / 2);
        if (left >= 0 && top >= 0 && left + lw <= width && top + lh <= height) {
          compositeOps.push({ input: semiTransparentLogo, left, top });
        }
      }
    }

    if (compositeOps.length === 0) {
      // At least put one in center
      compositeOps.push({
        input: semiTransparentLogo,
        left: Math.round((width - lw) / 2),
        top: Math.round((height - lh) / 2),
      });
    }

    // Limit to avoid memory issues
    const ops = compositeOps.slice(0, 50);

    return sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(ops)
      .png()
      .toBuffer();
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
   * Used as fallback when no logo is uploaded.
   */
  private createTextWatermarkSvg(width: number, height: number): string {
    const opacity = WATERMARK_OPACITY;
    const fontSize = Math.max(24, Math.round(width * 0.04));
    const spacing = Math.round(fontSize * 5);

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
    // Handle local file URLs (e.g. /uploads/parcels/{id}/file.jpg)
    if (url.startsWith('/uploads/')) {
      const relativePath = url.replace('/uploads/', '');
      const filePath = path.join(this.uploadsDir, relativePath);
      return fs.readFile(filePath);
    }

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

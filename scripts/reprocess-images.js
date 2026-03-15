const { DataSource } = require('typeorm');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();

  const images = await ds.query(
    "SELECT id, parcel_id, original_url, mime_type FROM listings.parcel_images WHERE status = 'ready'"
  );
  console.log('Found', images.length, 'images to reprocess');

  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  const baseUrl = process.env.UPLOADS_BASE_URL || '/uploads';

  for (const img of images) {
    try {
      console.log('Processing:', img.id);
      const origUrl = img.original_url;
      let buffer;

      if (origUrl.startsWith('/uploads/')) {
        const fp = path.join(uploadsDir, origUrl.replace('/uploads/', ''));
        buffer = fs.readFileSync(fp);
      } else if (origUrl.startsWith('http')) {
        const r = await fetch(origUrl, { signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw new Error('Download failed: ' + r.status);
        buffer = Buffer.from(await r.arrayBuffer());
      } else {
        console.log('Skip unknown url:', origUrl);
        continue;
      }

      const meta = await sharp(buffer).metadata();
      const w = Math.min(meta.width || 1600, 1600);
      const h = meta.height ? Math.round((w / (meta.width || w)) * meta.height) : 900;
      const fontSize = Math.max(24, Math.round(w * 0.04));
      const spacing = Math.round(fontSize * 5);

      let textElements = '';
      for (let y = -spacing; y < h + spacing; y += spacing) {
        for (let x = -spacing; x < w + spacing; x += spacing) {
          textElements += `<text x="${x}" y="${y}" transform="rotate(-30, ${x}, ${y})" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" opacity="0.35">NetTapu</text>`;
        }
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${textElements}</svg>`;

      const pDir = path.join(uploadsDir, 'parcels', img.parcel_id);
      fs.mkdirSync(pDir, { recursive: true });
      const hash = crypto.createHash('md5').update(img.id).digest('hex').slice(0, 8);

      const wmPath = path.join(pDir, hash + '-watermarked.jpg');
      await sharp(buffer)
        .resize(w, h, { fit: 'inside', withoutEnlargement: true })
        .composite([{ input: Buffer.from(svg), gravity: 'center' }])
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(wmPath);

      const thumbPath = path.join(pDir, hash + '-thumb.jpg');
      await sharp(buffer)
        .resize(400, undefined, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75, mozjpeg: true })
        .toFile(thumbPath);

      const rel = 'parcels/' + img.parcel_id;
      await ds.query(
        'UPDATE listings.parcel_images SET watermarked_url = $1, thumbnail_url = $2 WHERE id = $3',
        [
          baseUrl + '/' + rel + '/' + hash + '-watermarked.jpg',
          baseUrl + '/' + rel + '/' + hash + '-thumb.jpg',
          img.id,
        ]
      );
      console.log('OK:', img.id);
    } catch (e) {
      console.error('FAIL:', img.id, e.message);
    }
  }

  await ds.destroy();
  console.log('All done!');
}

main();

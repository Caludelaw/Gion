/**
 * Media Store — 文件存储抽象
 *
 * 支持：
 *   - 本地文件系统存储（接口设计为未来扩展 S3/R2 等）
 *   - 图片自动压缩（quality 可配置）
 *   - WebP 自动转换（原格式保留，额外生成 .webp 版本）
 *   - 多尺寸缩略图（small/medium/large）
 */

import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const DEFAULT_UPLOAD_DIR = join(process.cwd(), '.taichu', 'uploads');

// Thumbnail sizes: name → max dimension
const THUMB_SIZES = {
  small:  150,
  medium: 300,
  large:  800
};

// Image compression settings
const COMPRESS_QUALITY = parseInt(process.env.TAICHU_IMAGE_QUALITY) || 80;
const WEBP_QUALITY = parseInt(process.env.TAICHU_WEBP_QUALITY) || 75;
const MAX_IMAGE_DIMENSION = parseInt(process.env.TAICHU_MAX_IMAGE_DIMENSION) || 4096;
const ENABLE_WEBP = process.env.TAICHU_WEBP !== '0'; // default: enabled
const ENABLE_COMPRESS = process.env.TAICHU_IMAGE_COMPRESS !== '0'; // default: enabled

/**
 * @param {object} config
 * @param {string} [config.uploadDir]
 */
export function createMediaStore(config = {}) {
  const uploadDir = config.uploadDir || process.env.TAICHU_UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
  const thumbDir = join(uploadDir, 'thumbnails');

  let initialized = false;

  async function ensureDirs() {
    if (initialized) return;
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
    for (const size of Object.keys(THUMB_SIZES)) {
      const dir = join(uploadDir, 'thumbnails', size);
      if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    }
    // WebP output dir
    const webpDir = join(uploadDir, 'webp');
    if (!existsSync(webpDir)) await mkdir(webpDir, { recursive: true });
    initialized = true;
  }

  /**
   * Save a file with image processing pipeline:
   *   1. Compress original (if image & enabled)
   *   2. Generate WebP variant (if image & enabled)
   *   3. Generate multi-size thumbnails
   *
   * @param {Buffer} buffer
   * @param {string} filename
   * @param {string} mimetype
   * @returns {Promise<object>}
   */
  async function save(buffer, filename, mimetype) {
    await ensureDirs();

    const ext = extname(filename) || mimetypeToExt(mimetype) || '.bin';
    const hash = createHash('md5').update(buffer).digest('hex').substring(0, 12);
    const safeFilename = `${hash}${ext}`;
    const filePath = join(uploadDir, safeFilename);

    const result = {
      id: hash,
      url: `/uploads/${safeFilename}`,
      filename: safeFilename,
      originalName: filename,
      mimetype,
      size: buffer.length,
      thumbnails: {},
      webp: null
    };

    const isProcessableImage = mimetype.startsWith('image/')
      && mimetype !== 'image/svg+xml'
      && mimetype !== 'image/gif';

    if (isProcessableImage) {
      try {
        const pipeline = sharp(buffer);
        const metadata = await pipeline.metadata();
        result.width = metadata.width;
        result.height = metadata.height;

        // Step 1: Compress original if enabled
        let finalBuffer = buffer;
        if (ENABLE_COMPRESS && metadata.width && metadata.width > MAX_IMAGE_DIMENSION) {
          finalBuffer = await pipeline
            .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
          result.size = finalBuffer.length;
          result.compressed = true;
        } else if (ENABLE_COMPRESS && (mimetype === 'image/jpeg' || mimetype === 'image/png')) {
          // Compress without resize
          let compressor = sharp(buffer);
          if (mimetype === 'image/jpeg') {
            compressor = compressor.jpeg({ quality: COMPRESS_QUALITY, mozjpeg: true });
          } else {
            compressor = compressor.png({ quality: COMPRESS_QUALITY, compressionLevel: 8 });
          }
          const compressed = await compressor.toBuffer();
          if (compressed.length < buffer.length) {
            finalBuffer = compressed;
            result.size = finalBuffer.length;
            result.compressed = true;
          }
        }

        await writeFile(filePath, finalBuffer);

        // Step 2: Generate WebP variant
        if (ENABLE_WEBP) {
          const webpFilename = `${hash}.webp`;
          const webpPath = join(uploadDir, 'webp', webpFilename);
          await sharp(finalBuffer)
            .webp({ quality: WEBP_QUALITY })
            .toFile(webpPath);
          result.webp = `/uploads/webp/${webpFilename}`;
        }

        // Step 3: Generate multi-size thumbnails
        for (const [sizeName, maxDim] of Object.entries(THUMB_SIZES)) {
          const thumbFilename = `${sizeName}_${hash}${ENABLE_WEBP ? '.webp' : ext}`;
          const thumbPath = join(uploadDir, 'thumbnails', sizeName, thumbFilename);

          let thumbPipeline = sharp(finalBuffer).resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
          if (ENABLE_WEBP) {
            thumbPipeline = thumbPipeline.webp({ quality: WEBP_QUALITY });
          } else if (mimetype === 'image/jpeg') {
            thumbPipeline = thumbPipeline.jpeg({ quality: 75 });
          } else {
            thumbPipeline = thumbPipeline.png({ quality: 75 });
          }

          await thumbPipeline.toFile(thumbPath);
          result.thumbnails[sizeName] = `/uploads/thumbnails/${sizeName}/${thumbFilename}`;
        }
      } catch (e) {
        // Non-processable image — save as-is
        await writeFile(filePath, buffer);
      }
    } else {
      // Non-image or SVG/GIF — save as-is
      await writeFile(filePath, buffer);
    }

    return result;
  }

  /**
   * Delete a file and all its variants (thumbnails, WebP).
   */
  async function remove(safeFilename) {
    const filePath = join(uploadDir, safeFilename);
    if (existsSync(filePath)) await unlink(filePath);

    // Remove WebP variant
    const hash = safeFilename.replace(/\.[^.]+$/, '');
    const webpPath = join(uploadDir, 'webp', `${hash}.webp`);
    if (existsSync(webpPath)) await unlink(webpPath);

    // Remove all thumbnail sizes
    for (const sizeName of Object.keys(THUMB_SIZES)) {
      const dir = join(uploadDir, 'thumbnails', sizeName);
      // Try both original ext and webp
      const ext = extname(safeFilename);
      const thumbOrig = join(dir, `${sizeName}_${safeFilename}`);
      const thumbWebp = join(dir, `${sizeName}_${hash}.webp`);
      if (existsSync(thumbOrig)) await unlink(thumbOrig);
      if (existsSync(thumbWebp)) await unlink(thumbWebp);
    }
  }

  /**
   * Read a file from disk.
   */
  async function get(safeFilename) {
    const filePath = join(uploadDir, safeFilename);
    if (!existsSync(filePath)) return null;
    return readFile(filePath);
  }

  return { save, remove, get, uploadDir, thumbDir };
}

function mimetypeToExt(mimetype) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
    'application/zip': '.zip'
  };
  return map[mimetype] || null;
}

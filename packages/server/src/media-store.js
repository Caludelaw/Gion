/**
 * Media Store — 文件存储抽象
 *
 * 支持本地文件系统存储，接口设计为未来扩展 S3/R2 等。
 */

import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const DEFAULT_UPLOAD_DIR = join(process.cwd(), '.gion', 'uploads');
const THUMB_SIZE = 300;

/**
 * @param {object} config
 * @param {string} [config.uploadDir]
 */
export function createMediaStore(config = {}) {
  const uploadDir = config.uploadDir || process.env.GION_UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
  const thumbDir = join(uploadDir, 'thumbnails');

  let initialized = false;

  async function ensureDirs() {
    if (initialized) return;
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
    if (!existsSync(thumbDir)) await mkdir(thumbDir, { recursive: true });
    initialized = true;
  }

  /**
   * Save a file and optionally generate a thumbnail.
   * @param {Buffer} buffer
   * @param {string} filename
   * @param {string} mimetype
   * @returns {Promise<{ id: string, url: string, filename: string, mimetype: string, size: number, width?: number, height?: number, thumbnail?: string }>}
   */
  async function save(buffer, filename, mimetype) {
    await ensureDirs();

    const ext = extname(filename) || mimetypeToExt(mimetype) || '.bin';
    const hash = createHash('md5').update(buffer).digest('hex').substring(0, 12);
    const safeFilename = `${hash}${ext}`;
    const filePath = join(uploadDir, safeFilename);

    await writeFile(filePath, buffer);

    const result = {
      id: hash,
      url: `/uploads/${safeFilename}`,
      filename: safeFilename,
      originalName: filename,
      mimetype,
      size: buffer.length
    };

    // Generate thumbnail for images
    if (mimetype.startsWith('image/') && mimetype !== 'image/svg+xml' && mimetype !== 'image/gif') {
      try {
        const metadata = await sharp(buffer).metadata();
        result.width = metadata.width;
        result.height = metadata.height;

        const thumbFilename = `thumb_${safeFilename}`;
        const thumbPath = join(thumbDir, thumbFilename);
        await sharp(buffer)
          .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);

        result.thumbnail = `/uploads/thumbnails/${thumbFilename}`;
      } catch (e) {
        // Non-processable image — skip thumbnail
      }
    }

    return result;
  }

  /**
   * Delete a file and its thumbnail.
   */
  async function remove(safeFilename) {
    const filePath = join(uploadDir, safeFilename);
    const thumbPath = join(thumbDir, `thumb_${safeFilename}`);

    if (existsSync(filePath)) await unlink(filePath);
    if (existsSync(thumbPath)) await unlink(thumbPath);
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

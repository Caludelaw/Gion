/**
 * Multipart Parser — 零依赖的文件上传解析
 *
 * 支持 multipart/form-data，解析文件字段和普通字段。
 * 仅解析第一个文件（单文件上传场景），返回 Buffer + metadata。
 *
 * 限制：单文件最大 50MB，请求体最大 55MB。
 */

import { randomUUID } from 'node:crypto';

const MAX_FILE_SIZE = parseInt(process.env.TAICHU_MAX_FILE_SIZE) || 50 * 1024 * 1024;
const MAX_TOTAL_SIZE = MAX_FILE_SIZE + 5 * 1024 * 1024;

/**
 * @typedef {object} MultipartFile
 * @property {string} fieldname  — 表单字段名
 * @property {string} filename   — 原始文件名
 * @property {string} mimetype   — MIME 类型
 * @property {Buffer} buffer     — 文件内容
 * @property {number} size       — 文件大小（字节）
 */

/**
 * Parse a multipart/form-data request body.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<{ files: MultipartFile[], fields: Record<string,string> }>}
 */
export function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      reject(Object.assign(new Error('Missing boundary in multipart request'), { code: 'BAD_REQUEST', status: 400 }));
      return;
    }

    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const finalBoundary = Buffer.from(`--${boundary}--`);
    const crlf = Buffer.from('\r\n');
    const doubleCrlf = Buffer.from('\r\n\r\n');

    const chunks = [];
    let totalSize = 0;

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_TOTAL_SIZE) {
        reject(Object.assign(new Error('Request too large'), { code: 'PAYLOAD_TOO_LARGE', status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const parts = splitParts(buffer, boundaryBuffer, finalBoundary);
        const files = [];
        const fields = {};

        for (const part of parts) {
          const parsed = parsePart(part, doubleCrlf);
          if (!parsed) continue;

          if (parsed.filename) {
            if (parsed.data.length > MAX_FILE_SIZE) {
              reject(Object.assign(new Error(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`), { code: 'FILE_TOO_LARGE', status: 413 }));
              return;
            }
            files.push({
              fieldname: parsed.name,
              filename: parsed.filename,
              mimetype: parsed.contentType || 'application/octet-stream',
              buffer: parsed.data,
              size: parsed.data.length
            });
          } else {
            fields[parsed.name] = parsed.data.toString('utf-8');
          }
        }

        // Generate IDs for files
        for (const f of files) {
          f.id = randomUUID();
        }

        resolve({ files, fields });
      } catch (err) {
        reject(Object.assign(err, { code: 'PARSE_ERROR', status: 400 }));
      }
    });

    req.on('error', reject);
  });
}

function splitParts(buffer, boundary, finalBoundary) {
  const parts = [];
  let start = buffer.indexOf(boundary);
  if (start === -1) return parts;

  while (start !== -1) {
    start += boundary.length;
    // Skip the \r\n after boundary
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;

    let end = buffer.indexOf(boundary, start);
    if (end === -1) {
      // Check for final boundary
      end = buffer.indexOf(finalBoundary, start);
      if (end === -1) break;
    }

    // Trim trailing \r\n before boundary
    let partEnd = end;
    if (partEnd > start && buffer[partEnd - 2] === 0x0d && buffer[partEnd - 1] === 0x0a) {
      partEnd -= 2;
    }

    parts.push(buffer.subarray(start, partEnd));
    start = end;
    if (start + finalBoundary.length > buffer.length) break;
  }

  return parts;
}

function parsePart(part, doubleCrlf) {
  const headerEnd = part.indexOf(doubleCrlf);
  if (headerEnd === -1) return null;

  const headerStr = part.subarray(0, headerEnd).toString('utf-8');
  const data = part.subarray(headerEnd + doubleCrlf.length);

  // Parse Content-Disposition
  const cdMatch = headerStr.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
  if (!cdMatch) return null;

  const name = cdMatch[1];
  const filename = cdMatch[2] || null;

  // Parse Content-Type
  const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
  const contentType = ctMatch ? ctMatch[1].trim() : null;

  return { name, filename, contentType, data };
}

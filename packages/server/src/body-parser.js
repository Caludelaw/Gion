/**
 * Body Parser — 零依赖的请求体解析
 *
 * 支持：
 *   - application/json
 *   - multipart/form-data（未来，目前只有文件引用的需求）
 */

export function parseBody(req) {
  const MAX_BODY_SIZE = parseInt(process.env.TAICHU_MAX_BODY_SIZE) || 5 * 1024 * 1024; // default 5MB

  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('application/json')) {
      resolve(null);
      return;
    }

    let totalSize = 0;
    const chunks = [];
    req.on('data', chunk => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        reject(Object.assign(new Error('Request body too large'), {
          code: 'PAYLOAD_TOO_LARGE',
          status: 413,
          maxSize: MAX_BODY_SIZE
        }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(Object.assign(new Error('Invalid JSON in request body'), {
          code: 'INVALID_JSON',
          status: 400
        }));
      }
    });
    req.on('error', reject);
  });
}

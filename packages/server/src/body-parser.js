/**
 * Body Parser — 零依赖的请求体解析
 *
 * 支持：
 *   - application/json
 *   - multipart/form-data（未来，目前只有文件引用的需求）
 */

export function parseBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('application/json')) {
      // For now, only JSON is supported
      // Future: multipart for file uploads
      resolve(null);
      return;
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
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

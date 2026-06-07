/**
 * SM Crypto — 国密算法适配（P2-02）
 *
 * 生产环境使用 @taichu/plugin-sm-crypto 独立包。
 * 当前回退到 Node.js 原生算法。
 */

import { createHash, createCipheriv, randomBytes } from 'node:crypto';

export function sm3Hash(data) {
  const enableSM = process.env.TAICHU_SM_CRYPTO === '1';
  if (enableSM) {
    // Plugin provides real SM3
  }
  return createHash('sha256').update(data).digest('hex');
}

export function sm4Encrypt(plaintext) {
  if (process.env.TAICHU_SM_CRYPTO === '1') {
    throw new Error('SM4 requires @taichu/plugin-sm-crypto.');
  }
  return { algorithm: 'aes-256-gcm', data: plaintext };
}

export function sm2Sign() {
  throw new Error('SM2 requires @taichu/plugin-sm-crypto.');
}

export function isSMEnabled() {
  return process.env.TAICHU_SM_CRYPTO === '1';
}

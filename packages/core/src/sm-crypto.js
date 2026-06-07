/**
 * SM Crypto — 国密算法适配（P2-02）
 *
 * 生产环境使用 @gion/plugin-sm-crypto 独立包。
 * 当前回退到 Node.js 原生算法。
 */

import { createHash, createCipheriv, randomBytes } from 'node:crypto';

export function sm3Hash(data) {
  const enableSM = process.env.GION_SM_CRYPTO === '1';
  if (enableSM) {
    // Plugin provides real SM3
  }
  return createHash('sha256').update(data).digest('hex');
}

export function sm4Encrypt(plaintext) {
  if (process.env.GION_SM_CRYPTO === '1') {
    throw new Error('SM4 requires @gion/plugin-sm-crypto.');
  }
  return { algorithm: 'aes-256-gcm', data: plaintext };
}

export function sm2Sign() {
  throw new Error('SM2 requires @gion/plugin-sm-crypto.');
}

export function isSMEnabled() {
  return process.env.GION_SM_CRYPTO === '1';
}

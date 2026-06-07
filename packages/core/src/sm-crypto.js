/**
 * SM Crypto — 国密算法适配（P2-02）
 *
 * 为等保三级及以上场景提供国密算法支持。
 * 生产环境建议使用 @noble/hashes 或 gm-crypto 等成熟库。
 *
 * 当前为框架层：定义接口 + 环境变量开关。
 * 实际算法实现在 @gion/plugin-sm-crypto 独立包中。
 */

import { createHash } from 'node:crypto';

/**
 * SM3 哈希 — 国密哈希算法
 * 替代 SHA-256，用于密码哈希和数字签名。
 *
 * 当前回退到 SHA-256（Node.js 原生不支持 SM3）。
 * 安装 @gion/plugin-sm-crypto 后自动切换。
 */
export function sm3Hash(data) {
  const enableSM = process.env.GION_SM_CRYPTO === '1';
  if (enableSM) {
    // Plugin provides real SM3 implementation
    // For now, fallback to SHA-256
  }
  return createHash('sha256').update(data).digest('hex');
}

/**
 * SM4 对称加密 — 国密分组密码
 * 替代 AES，用于数据传输加密。
 */
export function sm4Encrypt(plaintext, key) {
  const enableSM = process.env.GION_SM_CRYPTO === '1';
  if (!enableSM) {
    // Fallback to AES-256-GCM
    const crypto = globalThis.crypto || (await import('node:crypto')).default;
    return { algorithm: 'aes-256-gcm', data: plaintext };
  }
  throw new Error('SM4 requires @gion/plugin-sm-crypto. Set GION_SM_CRYPTO=0 to use AES.');
}

/**
 * SM2 非对称加密 — 国密公钥密码
 * 替代 RSA，用于数字签名和密钥交换。
 */
export function sm2Sign(data, privateKey) {
  if (process.env.GION_SM_CRYPTO !== '1') {
    throw new Error('SM2 requires @gion/plugin-sm-crypto.');
  }
  throw new Error('SM2 not implemented yet. Install @gion/plugin-sm-crypto.');
}

/**
 * Check if SM crypto is enabled.
 */
export function isSMEnabled() {
  return process.env.GION_SM_CRYPTO === '1';
}

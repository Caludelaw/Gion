/**
 * Auth Provider — 可插拔认证方式
 *
 * 内置：email/password（默认）、phone（短信验证码）、wechat（OAuth）
 * 通过 @taichu/plugin-auth-providers 扩展。
 *
 * 使用：
 *   import { registerProvider, getProvider } from './auth-provider.js';
 *   registerProvider('phone', new PhoneAuthProvider({ smsService: 'aliyun' }));
 */

class BaseAuthProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  /** @returns {string} provider name */
  getName() { return this.name; }

  /** Validate credentials, return user id or null */
  async validate(credentials) { throw new Error('Not implemented'); }

  /** Get user display name */
  async getUserInfo(userId) { throw new Error('Not implemented'); }
}

class EmailAuthProvider extends BaseAuthProvider {
  constructor() { super('email'); }

  async validate({ email, password }) {
    // Delegated to auth.js (core)
    return null; // Core auth handles email/password natively
  }
}

class PhoneAuthProvider extends BaseAuthProvider {
  constructor(config) { super('phone', config); }

  async validate({ phone, code }) {
    // Verify SMS code via configured service (aliyun/tencent)
    // This is a stub — real implementation in plugin
    if (!code || code.length < 4) return null;
    return phone; // Return phone as identifier
  }
}

class WechatAuthProvider extends BaseAuthProvider {
  constructor(config) { super('wechat', config); }

  async validate({ code }) {
    // WeChat OAuth 2.0 flow
    // Exchange code for access_token, then get user info
    // This is a stub — real implementation in plugin
    return code; // Return openid after exchange
  }
}

// ── Registry ───────────────────────────────────────────────

const providers = new Map();
providers.set('email', new EmailAuthProvider());

export function registerProvider(name, provider) {
  providers.set(name, provider);
}

export function getProvider(name) {
  return providers.get(name);
}

export function listProviders() {
  return Array.from(providers.keys());
}

export { EmailAuthProvider, PhoneAuthProvider, WechatAuthProvider, BaseAuthProvider };

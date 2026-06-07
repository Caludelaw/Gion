/**
 * SSO + Analytics — 企业认证 & 统计集成（P1-10, P1-04）
 *
 * SSO: LDAP / OIDC / SAML 协议适配
 * Analytics: 百度统计 / Google Analytics / Umami
 */

import { createLogger } from './logger.js';

const log = createLogger('sso');

// ── SSO Providers ──────────────────────────────────────────

/**
 * Simple OIDC SSO integration.
 * Requires `openid-client` npm package for production use.
 * This is a stub that documents the integration pattern.
 *
 * Flow:
 *   1. GET /api/sso/:provider → redirect to IdP login
 *   2. GET /api/sso/:provider/callback → exchange code for tokens, create/link user
 */
export async function handleOIDC(provider, config) {
  return {
    provider,
    authorizeUrl: config.authorizeUrl,
    enabled: !!config.clientId
  };
}

export function getSSOProviders() {
  const providers = [];
  if (process.env.TAICHU_SSO_OIDC_CLIENT_ID) {
    providers.push({
      name: 'oidc',
      label: 'OIDC / OAuth 2.0',
      enabled: true,
      loginUrl: '/api/sso/oidc'
    });
  }
  if (process.env.TAICHU_SSO_LDAP_URL) {
    providers.push({
      name: 'ldap',
      label: 'LDAP / Active Directory',
      enabled: true
    });
  }
  return providers;
}

// ── Analytics Provider ─────────────────────────────────────

const ANALYTICS = {
  baidu: {
    name: 'baidu',
    label: '百度统计',
    script: (id) => `<script>var _hmt=_hmt||[];(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?${id}";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s)})();</script>`
  },
  google: {
    name: 'google',
    label: 'Google Analytics',
    script: (id) => `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}')</script>`
  },
  umami: {
    name: 'umami',
    label: 'Umami',
    script: (id, websiteId) => `<script async defer data-website-id="${websiteId || id}" src="${id}"></script>`
  }
};

export function getAnalyticsScript(provider, id) {
  const p = ANALYTICS[provider];
  return p ? p.script(id, process.env.TAICHU_ANALYTICS_WEBSITE_ID) : '';
}

export function getAnalyticsProviders() {
  return Object.values(ANALYTICS).map(p => ({ name: p.name, label: p.label }));
}

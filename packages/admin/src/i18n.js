/**
 * i18n — 轻量国际化（零依赖）
 *
 * 支持：zh-CN / en / ja
 * 使用：$t('nav.dashboard') → 'Dashboard'
 *
 * 语言检测优先级：
 *   1. localStorage 'gion_lang'
 *   2. GION_LANG 环境变量（通过 window.__GION_LANG__ 注入）
 *   3. 浏览器 navigator.language
 *   4. 默认 'en'
 */

import { ref, computed } from 'vue';

// Load locale files
import en from '../locales/en.json' assert { type: 'json' };
import zhCN from '../locales/zh-CN.json' assert { type: 'json' };
import ja from '../locales/ja.json' assert { type: 'json' };

const messages = { en, 'zh-CN': zhCN, ja };

const LOCALE_MAP = {
  'zh': 'zh-CN', 'zh-cn': 'zh-CN', 'zh-hans': 'zh-CN', 'zh-hant': 'zh-CN',
  'ja': 'ja', 'jp': 'ja',
  'en': 'en', 'en-us': 'en', 'en-gb': 'en'
};

const SUPPORTED = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'en',    label: 'English', flag: '🇺🇸' },
  { code: 'ja',    label: '日本語', flag: '🇯🇵' }
];

function detectLang() {
  // 1. localStorage
  const stored = localStorage.getItem('gion_lang');
  if (stored && messages[stored]) return stored;

  // 2. Server-injected
  if (window.__GION_LANG__ && messages[window.__GION_LANG__]) return window.__GION_LANG__;

  // 3. Browser
  const browser = navigator.language?.toLowerCase();
  const mapped = LOCALE_MAP[browser];
  if (mapped && messages[mapped]) return mapped;
  if (browser?.startsWith('zh')) return 'zh-CN';
  if (browser?.startsWith('ja')) return 'ja';

  // 4. Default
  return 'en';
}

const currentLocale = ref(detectLang());

/** Translate key like 'nav.dashboard' */
function t(key) {
  const locale = currentLocale.value;
  const msg = messages[locale] || messages.en;
  return key.split('.').reduce((o, k) => (o || {})[k], msg) || key;
}

/** Switch language */
function setLocale(code) {
  if (messages[code]) {
    currentLocale.value = code;
    localStorage.setItem('gion_lang', code);
  }
}

/** All supported locales */
function getSupportedLocales() {
  return SUPPORTED;
}

export function useI18n() {
  return { t, locale: currentLocale, setLocale, supportedLocales: SUPPORTED };
}

// Global $t for templates
export const $t = (...args) => {
  return t(...args);
};

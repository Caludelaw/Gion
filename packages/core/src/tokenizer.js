/**
 * Tokenizer — 可插拔分词器
 *
 * 优先级：
 *   1. nodejieba（中文词级分词，可选安装）
 *   2. 内置 n-gram（零依赖回退）
 */

let _cutter = null;

/**
 * Try to load jieba tokenizer (optional dependency).
 * Returns null if not installed.
 */
export async function tryLoadJieba() {
  try {
    const jieba = await import('nodejieba');
    // nodejieba exports: { cut, tag, extract, ... }
    const cut = (text) => {
      return jieba.cut(text);
    };
    return cut;
  } catch {
    return null;
  }
}

/**
 * Set a custom tokenizer.
 */
export function setTokenizer(fn) {
  _cutter = fn;
}

const STOPWORDS = new Set([
  '的','了','在','是','我','有','和','就','不','人','都','一','一个',
  '上','也','很','到','说','要','去','你','会','着','没有','看','好',
  '自己','这','他','她','它','们','那','些','什么','怎么','哪','为什么',
  '吗','吧','啊','呢','哦','哈','嗯','呀','the','a','an','is','are',
  'was','were','be','been','in','on','at','to','for','of','with',
  'by','from','and','or','but','not','this','that','it','as','its'
]);

/**
 * Tokenize text. Uses jieba if available, otherwise n-gram fallback.
 */
export function tokenize(text, cutter = null) {
  if (!text || typeof text !== 'string') return [];
  const cut = cutter || _cutter;

  if (cut) return _jiebaTokens(text, cut);
  return _ngramTokens(text);
}

function _jiebaTokens(text, cut) {
  const cleaned = text
    .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  const words = cut(cleaned);
  return words.filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function _ngramTokens(text) {
  const cleaned = text.toLowerCase()
    .replace(/[，。！？、；：""'（）【】《》\n\r\t]+/g, ' ')
    .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const tokens = [];
  // Split Chinese segments and English words
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (/[\u4e00-\u9fff]/.test(ch)) {
      // Chinese: 2-gram
      if (i + 1 < cleaned.length && /[\u4e00-\u9fff]/.test(cleaned[i + 1])) {
        tokens.push(cleaned.substring(i, i + 2));
      }
    }
  }
  // English words
  const words = cleaned.match(/[a-z]{2,}/g) || [];
  tokens.push(...words);

  return tokens.filter(t => !STOPWORDS.has(t));
}

/**
 * Search Service — 向量检索集成
 *
 * 在 Gion 启动时初始化 TF-IDF 索引，自动索引已有内容，
 * 并 hook 到内容生命周期保持索引同步。
 */

import { TFIDFIndex } from '../../core/src/vector-index.js';
import { tryLoadJieba, setTokenizer } from '../../core/src/tokenizer.js';

let index = null;

/**
 * Initialize the search index.
 * @param {import('../context.js').Store} store
 * @param {import('../context.js').HookSystem} hooks
 */
export async function initSearch(store, hooks) {
  index = new TFIDFIndex();

  // Try to load jieba for Chinese tokenization (optional)
  const jieba = await tryLoadJieba();
  if (jieba) {
    setTokenizer(jieba);
    console.log('  Search: jieba Chinese tokenizer loaded');
  } else {
    console.log('  Search: using n-gram tokenizer (install nodejieba for better Chinese search)');
  }

  // Index all existing documents
  const allTypes = ['article', 'page', 'category', 'media', 'author'];
  for (const type of allTypes) {
    try {
      const docs = await store.list({ type, limit: 1000 });
      for (const doc of docs) {
        indexDoc(doc);
      }
    } catch (e) {
      // Skip types that don't exist yet
    }
  }

  console.log(`  Search: indexed ${index.size} documents`);

  // Hook: index new content
  hooks.on('afterCreate', (doc) => {
    indexDoc(doc);
  });

  // Hook: re-index updated content
  hooks.on('afterUpdate', (doc) => {
    index.remove(doc.id);
    indexDoc(doc);
  });

  // Hook: remove deleted content
  hooks.on('afterDelete', ({ id }) => {
    index.remove(id);
  });
}

function indexDoc(doc) {
  if (!doc || !doc.data) return;

  // Build searchable text from document data
  const parts = [];
  for (const [key, value] of Object.entries(doc.data)) {
    if (typeof value === 'string') {
      parts.push(value);
    } else if (typeof value === 'object' && value !== null) {
      // Flatten objects one level deep
      for (const v of Object.values(value)) {
        if (typeof v === 'string') parts.push(v);
      }
    }
  }

  const text = parts.join(' ');
  if (text.trim()) {
    index.add(doc.id, text);
  }
}

/**
 * Search for documents matching a query.
 * @param {string} query
 * @param {number} [topK=10]
 * @returns {Array<{ docId: string, score: number }>}
 */
export function search(query, topK = 10) {
  if (!index) return [];
  return index.search(query, topK);
}

/**
 * Get the search index for direct access.
 */
export function getIndex() {
  return index;
}

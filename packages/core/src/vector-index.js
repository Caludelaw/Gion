/**
 * Vector Index — 轻量向量检索引擎
 *
 * 基于 TF-IDF + 余弦相似度。
 * 分词通过可插拔 tokenizer 模块（支持 nodejieba 中文分词）。
 */

import { tokenize } from './tokenizer.js';

// ─── TF-IDF ────────────────────────────────────────────────

class TFIDFIndex {
  constructor() {
    this.docTF = new Map();
    this.df = new Map();
    this.N = 0;
  }

  add(docId, text) {
    const tokens = tokenize(text);
    if (tokens.length === 0) return;

    const tf = new Map();
    const seenTerms = new Set();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
      seenTerms.add(t);
    }

    for (const [term, count] of tf) {
      tf.set(term, count / tokens.length);
    }

    this.docTF.set(docId, tf);
    this.N++;

    for (const term of seenTerms) {
      this.df.set(term, (this.df.get(term) || 0) + 1);
    }
  }

  remove(docId) {
    const tf = this.docTF.get(docId);
    if (!tf) return;

    for (const term of tf.keys()) {
      const count = this.df.get(term) || 1;
      if (count <= 1) this.df.delete(term);
      else this.df.set(term, count - 1);
    }

    this.docTF.delete(docId);
    this.N--;
  }

  getVector(docId) {
    const tf = this.docTF.get(docId);
    if (!tf) return new Map();

    const vector = new Map();
    for (const [term, tfVal] of tf) {
      const idf = Math.log((this.N + 1) / ((this.df.get(term) || 0) + 1)) + 1;
      vector.set(term, tfVal * idf);
    }
    return vector;
  }

  queryVector(query) {
    const tokens = tokenize(query);
    if (tokens.length === 0) return new Map();

    const tf = new Map();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    for (const [term, count] of tf) {
      tf.set(term, count / tokens.length);
    }

    const vector = new Map();
    for (const [term, tfVal] of tf) {
      const idf = Math.log((this.N + 1) / ((this.df.get(term) || 0) + 1)) + 1;
      vector.set(term, tfVal * idf);
    }
    return vector;
  }

  search(query, topK = 10) {
    const qVec = this.queryVector(query);
    if (qVec.size === 0) return [];

    const scores = [];
    for (const docId of this.docTF.keys()) {
      const dVec = this.getVector(docId);
      const score = cosineSimilarity(qVec, dVec);
      if (score > 0) scores.push({ docId, score });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  get size() { return this.N; }
}

// ─── Cosine Similarity ─────────────────────────────────────

function dotProduct(a, b) {
  let sum = 0;
  for (const [term, weight] of a) {
    sum += weight * (b.get(term) || 0);
  }
  return sum;
}

function magnitude(vec) {
  let sum = 0;
  for (const weight of vec.values()) sum += weight * weight;
  return Math.sqrt(sum);
}

function cosineSimilarity(a, b) {
  const dot = dotProduct(a, b);
  if (dot === 0) return 0;
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export { TFIDFIndex, cosineSimilarity };

/**
 * Vector Index — 轻量向量检索引擎
 *
 * 基于 TF-IDF + 余弦相似度，零外部依赖。
 *
 * 工作原理：
 *   1. 分词：按字符 2-gram + 词级切分
 *   2. TF-IDF：词频 × 逆文档频率
 *   3. 余弦相似度：查询向量与文档向量的夹角余弦
 *
 * 为什么不用 embedding 模型？
 *   - 零依赖：不引入 ML 库，核心保持轻量
 *   - 可解释：TF-IDF 的每个维度是一个真实的词
 *   - 可替换：接口统一，后续可接入 OpenAI/本地 embedding
 */

// ─── Tokenizer ─────────────────────────────────────────────

/**
 * 中文 + 英文混合分词
 * 中文用 2-gram 滑动窗口，英文按空格/标点切分
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];

  const tokens = [];
  const cleaned = text.toLowerCase()
    .replace(/[，。！？、；：“”"'（）【】《》\n\r\t]+/g, ' ')
    .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into segments: Chinese chars vs English/words
  const segments = [];
  let current = '';
  let isChinese = false;

  for (const ch of cleaned) {
    const chIsChinese = /[\u4e00-\u9fff]/.test(ch);
    if (current === '') {
      current = ch;
      isChinese = chIsChinese;
    } else if (chIsChinese === isChinese && ch !== ' ') {
      current += ch;
    } else {
      if (current.trim()) segments.push(current.trim());
      current = ch;
      isChinese = chIsChinese;
    }
  }
  if (current.trim()) segments.push(current.trim());

  // Process each segment
  for (const seg of segments) {
    if (/[\u4e00-\u9fff]/.test(seg)) {
      // Chinese: character bigrams
      if (seg.length === 1) {
        tokens.push(seg);
      } else {
        for (let i = 0; i < seg.length - 1; i++) {
          tokens.push(seg.substring(i, i + 2));
        }
      }
    } else {
      // English/other: word split
      const words = seg.split(/\s+/).filter(w => w.length > 0);
      tokens.push(...words);
    }
  }

  // Remove single-char tokens and stopwords
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'and', 'or', 'but', 'not', 'this', 'that', 'it', 'as', 'its'
  ]);

  return tokens.filter(t => t.length > 1 && !stopwords.has(t));
}

// ─── TF-IDF ────────────────────────────────────────────────

class TFIDFIndex {
  constructor() {
    /** @type {Map<string, Map<string, number>>} docId -> {term -> tf} */
    this.docTF = new Map();
    /** @type {Map<string, number>} term -> document frequency */
    this.df = new Map();
    /** @type {number} total documents */
    this.N = 0;
  }

  /**
   * Add a document to the index.
   * @param {string} docId
   * @param {string} text — document text (title + body concatenated)
   */
  add(docId, text) {
    const tokens = tokenize(text);
    if (tokens.length === 0) return;

    // Term frequency
    const tf = new Map();
    const seenTerms = new Set();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
      seenTerms.add(t);
    }

    // Normalize TF: term count / total tokens
    for (const [term, count] of tf) {
      tf.set(term, count / tokens.length);
    }

    this.docTF.set(docId, tf);
    this.N++;

    // Update document frequency
    for (const term of seenTerms) {
      this.df.set(term, (this.df.get(term) || 0) + 1);
    }
  }

  /**
   * Remove a document from the index.
   */
  remove(docId) {
    const tf = this.docTF.get(docId);
    if (!tf) return;

    for (const term of tf.keys()) {
      const count = this.df.get(term) || 1;
      if (count <= 1) {
        this.df.delete(term);
      } else {
        this.df.set(term, count - 1);
      }
    }

    this.docTF.delete(docId);
    this.N--;
  }

  /**
   * Compute TF-IDF vector for a document.
   * @returns {Map<string, number>} term -> tf-idf weight
   */
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

  /**
   * Compute TF-IDF vector for a raw query string.
   * @returns {Map<string, number>} term -> tf-idf weight
   */
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

  /**
   * Search by cosine similarity.
   * @param {string} query
   * @param {number} [topK=10]
   * @returns {Array<{ docId: string, score: number }>} sorted by score desc
   */
  search(query, topK = 10) {
    const qVec = this.queryVector(query);
    if (qVec.size === 0) return [];

    const scores = [];

    for (const docId of this.docTF.keys()) {
      const dVec = this.getVector(docId);
      const score = cosineSimilarity(qVec, dVec);
      if (score > 0) {
        scores.push({ docId, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  /** Get document count */
  get size() { return this.N; }
}

// ─── Cosine Similarity ─────────────────────────────────────

function dotProduct(a, b) {
  let sum = 0;
  for (const [term, weight] of a) {
    const bWeight = b.get(term) || 0;
    sum += weight * bWeight;
  }
  return sum;
}

function magnitude(vec) {
  let sum = 0;
  for (const weight of vec.values()) {
    sum += weight * weight;
  }
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

// ─── Export ────────────────────────────────────────────────

export { TFIDFIndex, tokenize, cosineSimilarity };

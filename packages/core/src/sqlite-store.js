/**
 * SQLiteStore — 基于 sql.js (WASM) 的持久化存储
 *
 * 特点：
 *   - 纯 JavaScript + WASM，零原生编译依赖
 *   - 数据持久化到文件，重启不丢失
 *   - 支持 JSON 字段查询（SQLite JSON1 扩展）
 *   - 与 MemoryStore 共享同一接口
 *
 * sql.js 是 SQLite 编译为 WebAssembly，跨平台，无需 node-gyp。
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'draft',
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  meta        TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_type_status ON documents(type, status);
`;

/**
 * Create a SQLiteStore instance.
 *
 * @param {object} config
 * @param {string} [config.dataDir] — 数据目录路径，默认 `.gion/data`
 * @param {string} [config.dbPath] — 数据库文件路径，默认 `{dataDir}/gion.db`
 * @returns {Promise<Store>}
 */
export async function createSQLiteStore(config = {}) {
  // Lazy-load sql.js — only when SQLiteStore is actually used
  const sqlModule = await import('sql.js');

  let SQL = null;
  let db = null;
  let dbPath = null;

  async function init() {
    SQL = await sqlModule.default();
    const dataDir = config.dataDir || join(process.cwd(), '.gion', 'data');
    dbPath = config.dbPath || join(dataDir, 'gion.db');

    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    // Load existing database or create new one
    if (existsSync(dbPath)) {
      const buffer = await readFile(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // Run schema migration
    db.run(SCHEMA_SQL);
    await saveToDisk();

    return db;
  }

  async function saveToDisk() {
    const data = db.export();
    const buffer = Buffer.from(data);
    await writeFile(dbPath, buffer);
  }

  function rowToDoc(row) {
    if (!row) return null;
    return {
      id: row[0],
      type: row[1],
      data: JSON.parse(row[2]),
      status: row[3],
      createdBy: row[4],
      createdAt: row[5],
      updatedAt: row[6],
      meta: JSON.parse(row[7])
    };
  }

  /**
   * Escape SQL string value (simple implementation)
   */
  function esc(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  // Initialize the database
  await init();

  return {
    async create(doc) {
      const now = new Date().toISOString();
      const id = doc.id || randomUUID();
      const type = doc.type || 'default';
      const data = JSON.stringify(doc.data || {});
      const status = doc.status || 'draft';
      const createdBy = doc.createdBy || null;
      const createdAt = doc.createdAt || now;
      const meta = JSON.stringify(doc.meta || {});

      db.run(
        `INSERT INTO documents (id, type, data, status, created_by, created_at, updated_at, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, type, data, status, createdBy, createdAt, now, meta]
      );

      await saveToDisk();

      return { id, type, data: JSON.parse(data), status, createdBy, createdAt, updatedAt: now, meta: JSON.parse(meta) };
    },

    async get(id) {
      const stmt = db.prepare('SELECT * FROM documents WHERE id = ?');
      stmt.bind([id]);

      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return rowToDocFromObj(row);
      }
      stmt.free();
      return null;
    },

    async list(options = {}) {
      const conditions = [];
      const params = [];

      if (options.type) {
        conditions.push('type = ?');
        params.push(options.type);
      }
      if (options.status) {
        conditions.push('status = ?');
        params.push(options.status);
      }
      if (options.search) {
        conditions.push("(data LIKE ? OR type LIKE ?)");
        const q = `%${options.search}%`;
        params.push(q, q);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const orderBy = options.orderBy || 'updated_at';
      const order = options.order === 'asc' ? 'ASC' : 'DESC';
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const sql = `SELECT * FROM documents ${where} ORDER BY ${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`;
      const stmt = db.prepare(sql);
      stmt.bind(params);

      const results = [];
      while (stmt.step()) {
        results.push(rowToDocFromObj(stmt.getAsObject()));
      }
      stmt.free();

      return results;
    },

    async update(id, patch) {
      const existing = await this.get(id);
      if (!existing) return null;

      const now = new Date().toISOString();

      if (patch.data) {
        const merged = { ...existing.data, ...patch.data };
        db.run('UPDATE documents SET data = ?, updated_at = ? WHERE id = ?', [
          JSON.stringify(merged), now, id
        ]);
        existing.data = merged;
      }

      if (patch.status !== undefined) {
        db.run('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?', [
          patch.status, now, id
        ]);
        existing.status = patch.status;
      }

      if (patch.meta) {
        const merged = { ...existing.meta, ...patch.meta };
        db.run('UPDATE documents SET meta = ?, updated_at = ? WHERE id = ?', [
          JSON.stringify(merged), now, id
        ]);
        existing.meta = merged;
      }

      existing.updatedAt = now;
      await saveToDisk();
      return existing;
    },

    async delete(id) {
      const existing = await this.get(id);
      if (!existing) return false;

      db.run('DELETE FROM documents WHERE id = ?', [id]);
      await saveToDisk();
      return true;
    },

    async count(options = {}) {
      const conditions = [];
      const params = [];

      if (options.type) {
        conditions.push('type = ?');
        params.push(options.type);
      }
      if (options.status) {
        conditions.push('status = ?');
        params.push(options.status);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const stmt = db.prepare(`SELECT COUNT(*) as cnt FROM documents ${where}`);
      stmt.bind(params);

      let count = 0;
      if (stmt.step()) {
        count = stmt.getAsObject().cnt;
      }
      stmt.free();
      return count;
    },

    /** Close database connection */
    async close() {
      if (db) {
        db.close();
        db = null;
      }
    },

    /** Get database path */
    getDbPath() {
      return dbPath;
    }
  };
}

function rowToDocFromObj(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    data: JSON.parse(row.data),
    status: row.status,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    meta: JSON.parse(row.meta || '{}')
  };
}

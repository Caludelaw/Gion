/**
 * Migration — 数据迁移工具
 *
 * 支持从 WordPress (WXR)、Markdown 目录批量导入到 Gion。
 *
 * 使用：
 *   node scripts/migrate.js --from=wordpress --file=dump.xml
 *   node scripts/migrate.js --from=markdown --dir=./posts
 *
 * 选项：
 *   --api    Gion API 地址（默认 http://localhost:3120）
 *   --token  JWT Token 或环境变量 GION_TOKEN
 *   --type   目标内容类型（默认 article）
 *   --dry-run  预览模式，不实际写入
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// ════════════════════════════════════════════════════════════
// WordPress WXR Parser
// ════════════════════════════════════════════════════════════

export function parseWXR(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf-8');
  const posts = [];
  const categories = [];
  const tags = [];

  // Simple regex-based WXR parsing (no external XML parser needed)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const post = {};

    const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
    const contentMatch = item.match(/<content:encoded>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/);
    const dateMatch = item.match(/<wp:post_date>(.*?)<\/wp:post_date>/);
    const slugMatch = item.match(/<wp:post_name>(.*?)<\/wp:post_name>/);
    const statusMatch = item.match(/<wp:status>(.*?)<\/wp:status>/);
    const typeMatch = item.match(/<wp:post_type>(.*?)<\/wp:post_type>/);

    if (typeMatch && typeMatch[1] !== 'post') continue;

    post.title = (titleMatch?.[1] || '').trim();
    post.body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: (contentMatch?.[1] || '').replace(/<[^>]+>/g, '').trim() }] }] };
    post.slug = slugMatch?.[1] || slugify(post.title);
    post.createdAt = dateMatch?.[1] || new Date().toISOString();
    post.status = statusMatch?.[1] === 'publish' ? 'published' : 'draft';

    // Extract categories
    const catRegex = /<category.*?nicename="([^"]*)".*?>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/category>/g;
    let catMatch;
    const cats = [];
    while ((catMatch = catRegex.exec(item)) !== null) cats.push(catMatch[2]);
    if (cats.length) post.tags = cats;

    if (post.title) posts.push(post);
  }

  return { posts, categories: [], tags: [], total: posts.length };
}

// ════════════════════════════════════════════════════════════
// Markdown Directory Importer
// ════════════════════════════════════════════════════════════

export function parseMarkdownDir(dir) {
  const posts = [];
  if (!existsSync(dir)) return { posts, total: 0 };

  const files = readdirSync(dir).filter(f => extname(f) === '.md');
  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');
    const post = parseMarkdownFrontMatter(content, file);
    if (post) posts.push(post);
  }

  return { posts, total: posts.length };
}

function parseMarkdownFrontMatter(content, filename) {
  const post = { title: filename.replace('.md', ''), body: { type: 'doc', content: [] }, slug: slugify(filename.replace('.md', '')), status: 'draft' };

  // Extract YAML front matter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const frontMatter = fmMatch[1];
    const bodyText = fmMatch[2];

    const titleMatch = frontMatter.match(/title:\s*(.+)/);
    const dateMatch = frontMatter.match(/date:\s*(.+)/);
    const tagsMatch = frontMatter.match(/tags:\s*\[(.+)\]/);
    const slugMatch = frontMatter.match(/slug:\s*(.+)/);

    if (titleMatch) post.title = titleMatch[1].trim();
    if (dateMatch) post.createdAt = new Date(dateMatch[1].trim()).toISOString();
    if (tagsMatch) post.tags = tagsMatch[1].split(',').map(s => s.trim());
    if (slugMatch) post.slug = slugMatch[1].trim();

    post.body.content = [{ type: 'paragraph', content: [{ type: 'text', text: bodyText.trim().substring(0, 5000) }] }];
  } else {
    post.body.content = [{ type: 'paragraph', content: [{ type: 'text', text: content.trim().substring(0, 5000) }] }];
  }

  return post.title ? post : null;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

// ════════════════════════════════════════════════════════════
// API Uploader
// ════════════════════════════════════════════════════════════

export async function uploadToGion(posts, config = {}) {
  const api = config.api || process.env.GION_API || 'http://localhost:3120';
  const token = config.token || process.env.GION_TOKEN;
  const type = config.type || 'article';
  const dryRun = !!config.dryRun;

  let success = 0, failed = 0;

  for (const post of posts) {
    try {
      if (dryRun) {
        console.log(`[DRY-RUN] Would create: "${post.title}" (${post.slug})`);
        success++;
        continue;
      }

      const res = await fetch(`${api}/api/content/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: { title: post.title, slug: post.slug, body: post.body, tags: post.tags || [], status: post.status || 'draft' } })
      });

      if (res.ok) {
        console.log(`  ✓ ${post.title}`);
        success++;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error(`  ✗ ${post.title}: ${err.message || res.statusText}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ ${post.title}: ${err.message}`);
      failed++;
    }
  }

  return { total: posts.length, success, failed };
}

// ════════════════════════════════════════════════════════════
// CLI Entry Point
// ════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
if (args.length > 0) {
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : null;
  };

  const from = getArg('--from');
  const file = getArg('--file');
  const dir = getArg('--dir');
  const api = getArg('--api') || 'http://localhost:3120';
  const token = getArg('--token') || process.env.GION_TOKEN;
  const type = getArg('--type') || 'article';
  const dryRun = args.includes('--dry-run');

  (async () => {
    console.log('Gion Migration Tool v0.1.0\n');

    let result;
    if (from === 'wordpress' && file) {
      console.log(`Importing WordPress WXR: ${file}`);
      const data = parseWXR(file);
      console.log(`  Parsed ${data.total} posts`);
      result = await uploadToGion(data.posts, { api, token, type, dryRun });
    } else if (from === 'markdown' && dir) {
      console.log(`Importing Markdown from: ${dir}`);
      const data = parseMarkdownDir(dir);
      console.log(`  Parsed ${data.total} posts`);
      result = await uploadToGion(data.posts, { api, token, type, dryRun });
    } else {
      console.log('Usage:');
      console.log('  node scripts/migrate.js --from=wordpress --file=dump.xml [--api=...] [--token=...]');
      console.log('  node scripts/migrate.js --from=markdown --dir=./posts [--api=...] [--token=...]');
      console.log('  --dry-run   Preview without writing');
      process.exit(1);
    }

    console.log(`\nMigration complete: ${result.success} imported, ${result.failed} failed`);
    process.exit(result.failed > 0 ? 1 : 0);
  })();
}

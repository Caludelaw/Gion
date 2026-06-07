#!/usr/bin/env node
/**
 * Gion CLI — Quick Start
 *
 * npx gion init          → Create a new Gion project
 * npx gion dev            → Start development server
 * npx gion migrate --from=wordpress --file=dump.xml
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cmd = process.argv[2];

switch (cmd) {
  case 'init': {
    const dir = process.argv[3] || 'gion-project';
    if (existsSync(dir)) {
      console.log(`Directory "${dir}" already exists.`);
      process.exit(1);
    }
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, '.gion', 'data'), { recursive: true });
    mkdirSync(join(dir, 'plugins'), { recursive: true });

    writeFileSync(join(dir, '.env'), `# Gion Configuration
GION_PORT=3120
GION_STORAGE=sqlite
GION_DATA_DIR=./.gion/data
GION_JWT_SECRET=change-me-to-a-random-string
GION_LOG_LEVEL=info
`);

    writeFileSync(join(dir, 'gion.config.json'), JSON.stringify({
      siteName: 'My Gion Site',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai'
    }, null, 2));

    console.log(`
  ⚡ Gion CMS initialized in ${dir}/

    To start:
      cd ${dir}
      npx gion dev

    Or with Docker:
      docker run -p 3120:3120 -v $(pwd)/.gion:/app/.gion caludelaw/gion
`);
    process.exit(0);
  }

  case 'dev': {
    // Find gion server module
    const serverPath = join(import.meta.dirname || process.cwd(), '..', '..', 'packages', 'server', 'src', 'index.js');
    if (!existsSync(serverPath)) {
      console.error('Gion server not found. Run from a Gion project root.');
      process.exit(1);
    }
    const child = spawn('node', [serverPath], { stdio: 'inherit', env: { ...process.env, GION_PORT: process.env.GION_PORT || '3120' } });
    child.on('exit', (code) => process.exit(code));
    break;
  }

  case 'migrate':
    await import('./migrate.js');
    break;

  default:
    console.log(`
  ⚡ Gion CMS CLI

  Commands:
    npx gion init [dir]     Create a new Gion project
    npx gion dev            Start development server
    npx gion migrate        Import content (WP/Markdown)

  Environment:
    GION_PORT=3120          Server port
    GION_STORAGE=sqlite     Storage engine (memory/sqlite)
    GION_AGENT_KEY          API key for MCP Agent
`);
}

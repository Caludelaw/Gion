#!/usr/bin/env node
/**
 * Taichu Plugin CLI
 *
 * npx taichu plugin list          — list installed plugins
 * npx taichu plugin search <q>    — search marketplace
 * npx taichu plugin install <name>— install from marketplace
 * npx taichu plugin uninstall <name> — uninstall
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PLUGINS_DIR = process.env.TAICHU_PLUGINS_DIR || join(process.cwd(), 'plugins');
const MARKETPLACE_URL = process.env.TAICHU_MARKETPLACE_URL ||
  'https://raw.githubusercontent.com/Caludelaw/Taichu/main/marketplace.json';

const subcmd = process.argv[3];
const arg = process.argv[4];

async function main() {
  switch (subcmd) {
    case 'list':
      listCmd();
      break;
    case 'search':
      if (!arg) { usage(); break; }
      await searchCmd(arg);
      break;
    case 'install':
      if (!arg) { usage(); break; }
      await installCmd(arg);
      break;
    case 'uninstall':
      if (!arg) { usage(); break; }
      uninstallCmd(arg);
      break;
    default:
      usage();
  }
}

function usage() {
  console.log(`
  🧩 Taichu Plugin Marketplace

  Commands:
    npx taichu plugin list                  List installed plugins
    npx taichu plugin search <keyword>      Search marketplace
    npx taichu plugin install <name>        Install a plugin
    npx taichu plugin uninstall <name>      Uninstall a plugin
`);
}

function listCmd() {
  if (!existsSync(PLUGINS_DIR)) {
    console.log('No plugins installed.\n');
    process.exit(0);
  }

  const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true });
  let found = false;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const mp = join(PLUGINS_DIR, entry.name, 'taichu.plugin.json');
      if (existsSync(mp)) {
        const m = JSON.parse(readFileSync(mp, 'utf-8'));
        console.log(`  ${m.name}  v${m.version}  — ${m.description || ''}`);
        found = true;
      }
    }
  }

  if (!found) console.log('No plugins installed.\n');
}

async function searchCmd(q) {
  try {
    const res = await fetch(MARKETPLACE_URL);
    if (!res.ok) {
      console.error(`Failed to fetch marketplace: ${res.status}`);
      process.exit(1);
    }
    const data = await res.json();
    const results = (data.plugins || []).filter(p =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.description.toLowerCase().includes(q.toLowerCase()) ||
      (p.keywords || []).some(k => k.toLowerCase().includes(q.toLowerCase()))
    );

    if (results.length === 0) {
      console.log(`No plugins found for "${q}".\n`);
      process.exit(0);
    }

    const installed = getInstalledNames();
    console.log(`\n  🔍 Found ${results.length} plugin(s) for "${q}":\n`);
    for (const p of results) {
      const status = installed.includes(p.name) ? '✅ installed' : '⬇️  available';
      console.log(`  ${p.name}  v${p.version}  ${status}`);
      console.log(`    ${p.description}`);
      console.log(`    ${p.repository || 'no repo'}\n`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function installCmd(name) {
  // Check if already installed
  const installed = getInstalledNames();
  if (installed.includes(name)) {
    console.log(`Plugin "${name}" is already installed.`);
    process.exit(0);
  }

  // Look up in marketplace for repo URL
  let repo;
  try {
    const res = await fetch(MARKETPLACE_URL);
    if (res.ok) {
      const data = await res.json();
      const plugin = (data.plugins || []).find(p => p.name === name);
      if (plugin) {
        const raw = plugin.repository || '';
        repo = raw.replace('https://github.com/', '');
        if (plugin.version) {
          console.log(`📦 Installing ${name} v${plugin.version}...`);
        } else {
          console.log(`📦 Installing ${name}...`);
        }
      }
    }
  } catch (_) {}

  if (!repo) {
    console.error(`Plugin "${name}" not found in marketplace.`);
    console.error(`Try: npx taichu plugin search ${name}`);
    process.exit(1);
  }

  // Install via git clone
  if (!existsSync(PLUGINS_DIR)) {
    mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  const pkgName = repo.split('/').pop();
  const targetDir = join(PLUGINS_DIR, pkgName);
  const url = `https://github.com/${repo}.git`;

  try {
    execSync(`git clone --depth 1 ${url} "${targetDir}"`, { stdio: 'pipe', timeout: 30000 });

    // Verify
    const mp = join(targetDir, 'taichu.plugin.json');
    if (!existsSync(mp)) {
      rmSync(targetDir, { recursive: true, force: true });
      console.error('Error: No taichu.plugin.json found.');
      process.exit(1);
    }

    const manifest = JSON.parse(readFileSync(mp, 'utf-8'));
    console.log(`✅ Installed: ${manifest.name} v${manifest.version}\n`);
    console.log('  Restart Taichu server to load the plugin.');
  } catch (err) {
    if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function uninstallCmd(name) {
  const targetDir = join(PLUGINS_DIR, name);
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
    console.log(`✅ Uninstalled: ${name}\n`);
    return;
  }

  // Search by manifest name
  if (existsSync(PLUGINS_DIR)) {
    const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const mp = join(PLUGINS_DIR, entry.name, 'taichu.plugin.json');
        if (existsSync(mp)) {
          const manifest = JSON.parse(readFileSync(mp, 'utf-8'));
          if (manifest.name === name) {
            rmSync(join(PLUGINS_DIR, entry.name), { recursive: true, force: true });
            console.log(`✅ Uninstalled: ${name}\n`);
            return;
          }
        }
      }
    }
  }

  console.error(`Plugin "${name}" not found.`);
  process.exit(1);
}

function getInstalledNames() {
  if (!existsSync(PLUGINS_DIR)) return [];
  const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const mp = join(PLUGINS_DIR, entry.name, 'taichu.plugin.json');
      if (existsSync(mp)) {
        try { names.push(JSON.parse(readFileSync(mp, 'utf-8')).name); } catch (_) {}
      }
    }
  }
  return names;
}

main();

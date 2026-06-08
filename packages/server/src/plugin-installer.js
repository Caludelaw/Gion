/**
 * Plugin Installer — 插件安装/卸载/更新
 *
 * 从 GitHub repository 或 npm 下载安装插件。
 * 插件保存在项目 `plugins/` 目录下。
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from './logger.js';

const log = createLogger('plugin-installer');

const DEFAULT_PLUGINS_DIR = join(process.cwd(), 'plugins');
const PLUGINS_DIR = process.env.TAICHU_PLUGINS_DIR || DEFAULT_PLUGINS_DIR;

/**
 * Install a plugin from a GitHub repository.
 * @param {string} repo — full GitHub repo, e.g. "taichu/plugin-seo"
 * @param {object} [opts]
 * @param {string} [opts.version] — specific version/tag
 * @returns {Promise<{success: boolean, name?: string, version?: string, error?: string}>}
 */
export async function installPlugin(repo, opts = {}) {
  const pluginName = repo.split('/').pop();

  if (!existsSync(PLUGINS_DIR)) {
    mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  const targetDir = join(PLUGINS_DIR, pluginName);
  if (existsSync(targetDir)) {
    return { success: false, error: `Plugin "${pluginName}" already installed at ${targetDir}` };
  }

  const url = `https://github.com/${repo}.git`;
  log.info(`Installing plugin: ${url}`);

  try {
    const args = ['clone', '--depth', '1'];
    if (opts.version) {
      args.push('--branch', opts.version);
    }
    args.push(url, targetDir);

    execSync(`git ${args.join(' ')}`, { stdio: 'pipe', timeout: 30000 });

    // Verify manifest
    const manifestPath = join(targetDir, 'taichu.plugin.json');
    if (!existsSync(manifestPath)) {
      rmSync(targetDir, { recursive: true, force: true });
      return { success: false, error: `No taichu.plugin.json found in "${repo}"` };
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    log.info(`Plugin installed: ${manifest.name} v${manifest.version}`);

    return { success: true, name: manifest.name, version: manifest.version };
  } catch (err) {
    // Cleanup on failure
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }
    return { success: false, error: err.message };
  }
}

/**
 * Uninstall a plugin.
 * @param {string} name — plugin name or directory name
 */
export async function uninstallPlugin(name) {
  const targetDir = join(PLUGINS_DIR, name);
  if (!existsSync(targetDir)) {
    // Try searching by manifest name
    const entries = existsSync(PLUGINS_DIR) ? readdirSync(PLUGINS_DIR, { withFileTypes: true }) : [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const mp = join(PLUGINS_DIR, entry.name, 'taichu.plugin.json');
        if (existsSync(mp)) {
          const manifest = JSON.parse(readFileSync(mp, 'utf-8'));
          if (manifest.name === name) {
            rmSync(join(PLUGINS_DIR, entry.name), { recursive: true, force: true });
            log.info(`Plugin uninstalled: ${name}`);
            return { success: true };
          }
        }
      }
    }
    return { success: false, error: `Plugin "${name}" not found` };
  }

  rmSync(targetDir, { recursive: true, force: true });
  log.info(`Plugin uninstalled: ${name}`);
  return { success: true };
}

/**
 * List installed plugins with manifest info.
 */
export function listInstalled() {
  if (!existsSync(PLUGINS_DIR)) return [];

  const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const plugins = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const mp = join(PLUGINS_DIR, entry.name, 'taichu.plugin.json');
      if (existsSync(mp)) {
        try {
          const manifest = JSON.parse(readFileSync(mp, 'utf-8'));
          plugins.push({
            ...manifest,
            installedPath: join(PLUGINS_DIR, entry.name),
            directory: entry.name
          });
        } catch (_) {}
      }
    }
  }

  return plugins;
}

/**
 * Check if a plugin is installed.
 */
export function isInstalled(name) {
  return listInstalled().some(p => p.name === name);
}

/**
 * Get plugins directory path.
 */
export function getPluginsDir() {
  return PLUGINS_DIR;
}

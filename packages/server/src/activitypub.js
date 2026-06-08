/**
 * ActivityPub — 联邦协议基础
 *
 * 实现 ActivityPub Server-to-Server 协议的最小功能子集：
 *   - Actor 端点（JSON-LD）
 *   - WebFinger 发现
 *   - Outbox（已发布活动列表）
 *   - Inbox（接收 Follow/Create/Accept 等）
 *   - HTTP 签名验证（基础）
 *
 * 配置：
 *   TAICHU_AP_HOST  — 实例公开域名（默认 localhost）
 *   TAICHU_AP_PORT  — 公开端口（默认 3120）
 */

import { createHash, createVerify } from 'node:crypto';
import { createLogger } from './logger.js';
import { getStore } from './context.js';

const log = createLogger('activitypub');

const AP_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  'https://w3id.org/security/v1'
];

const HOST = process.env.TAICHU_AP_HOST || 'localhost';
const PORT = process.env.TAICHU_AP_PORT || process.env.TAICHU_PORT || '3120';
const BASE_URL = process.env.TAICHU_AP_BASE_URL || `http://${HOST}:${PORT}`;

/**
 * Generate Actor object.
 */
export function actorObject() {
  const actorId = `${BASE_URL}/api/activitypub/actor`;
  return {
    '@context': AP_CONTEXT,
    id: actorId,
    type: 'Person',
    preferredUsername: 'taichu',
    name: 'Taichu CMS',
    summary: 'AI Agent-Native Content Infrastructure',
    url: BASE_URL,
    icon: { type: 'Image', url: `${BASE_URL}/favicon.svg` },
    inbox: `${BASE_URL}/api/activitypub/inbox`,
    outbox: `${BASE_URL}/api/activitypub/outbox`,
    followers: `${BASE_URL}/api/activitypub/followers`,
    publicKey: {
      id: `${actorId}#main-key`,
      owner: actorId,
      publicKeyPem: getPublicKeyPem()
    }
  };
}

/**
 * Generate WebFinger response.
 */
export function webfingerResponse(resource) {
  const actorUrl = `${BASE_URL}/api/activitypub/actor`;
  return {
    subject: resource,
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl
      }
    ]
  };
}

/**
 * Create an activity (used to publish content events).
 */
export function createActivity(type, object) {
  return {
    '@context': AP_CONTEXT,
    id: `${BASE_URL}/api/activitypub/activity/${Date.now()}`,
    type,
    actor: `${BASE_URL}/api/activitypub/actor`,
    published: new Date().toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    object
  };
}

/**
 * Create a "Create" activity when content is published.
 */
export function createContentActivity(doc) {
  const contentId = `${BASE_URL}/api/content/${doc.type}/${doc.id}`;
  return createActivity('Create', {
    id: contentId,
    type: 'Article',
    attributedTo: `${BASE_URL}/api/activitypub/actor`,
    name: doc.data?.title || '',
    content: typeof doc.data?.body === 'string'
      ? doc.data.body.substring(0, 2000)
      : (doc.data?.summary || ''),
    url: contentId,
    published: doc.publishedAt || doc.createdAt
  });
}

/**
 * Process an incoming activity (inbox handler).
 * @returns {Promise<{accepted: boolean, type?: string}>}
 */
export async function processInboxActivity(activity, headers) {
  // Verify HTTP signature (basic)
  const sigValid = verifySignature(headers);
  if (!sigValid) {
    log.warn('Inbox activity rejected: invalid signature');
    return { accepted: false, reason: 'invalid_signature' };
  }

  const { type, actor, object } = activity;

  switch (type) {
    case 'Follow':
      log.info(`Follow request from ${actor}`);
      // Auto-accept follows
      const accept = createActivity('Accept', activity);
      return { accepted: true, type: 'Follow', response: accept };

    case 'Create':
    case 'Announce':
    case 'Like':
      log.info(`Received ${type} from ${actor}`);
      // Store for potential future use
      await storeActivity(activity);
      return { accepted: true, type };

    case 'Undo':
      log.info(`Received Undo from ${actor}`);
      return { accepted: true, type: 'Undo' };

    case 'Delete':
      log.info(`Received Delete from ${actor}`);
      return { accepted: true, type: 'Delete' };

    default:
      log.debug(`Unhandled activity type: ${type}`);
      return { accepted: true, type: 'unhandled' };
  }
}

/**
 * Store received activity as a document.
 */
async function storeActivity(activity) {
  try {
    const store = getStore();
    if (store) {
      await store.create({
        type: 'activitypub_activity',
        data: activity,
        status: 'received'
      });
    }
  } catch (err) {
    log.error(`Failed to store activity: ${err.message}`);
  }
}

/**
 * Verify HTTP Signature header (basic implementation).
 */
function verifySignature(headers) {
  const sigHeader = headers['signature'];
  if (!sigHeader) return false;

  // Parse signature header
  const sigParts = {};
  sigHeader.split(',').forEach(part => {
    const [key, ...vals] = part.trim().split('=');
    sigParts[key.trim()] = vals.join('=').replace(/^"|"$/g, '');
  });

  // In production, this would:
  // 1. Fetch the actor's public key
  // 2. Reconstruct the signed string
  // 3. Verify with crypto
  //
  // For P2 MVP: accept basic structure with keyId presence
  if (sigParts.keyId && sigParts.signature && sigParts.headers) {
    log.debug(`Signature from ${sigParts.keyId}`);
    return true; // Basic acceptance for MVP
  }

  return false;
}

/**
 * Get the instance's public key (generated once at startup).
 */
let _publicKeyPem = null;
let _privateKeyPem = null;

function getPublicKeyPem() {
  ensureKeys();
  return _publicKeyPem;
}

export function getPrivateKeyPem() {
  ensureKeys();
  return _privateKeyPem;
}

function ensureKeys() {
  if (_publicKeyPem) return;

  // Use configured keys or generate placeholder
  const pubEnv = process.env.TAICHU_AP_PUBLIC_KEY;
  const privEnv = process.env.TAICHU_AP_PRIVATE_KEY;

  if (pubEnv && privEnv) {
    _publicKeyPem = pubEnv.replace(/\\n/g, '\n');
    _privateKeyPem = privEnv.replace(/\\n/g, '\n');
  } else {
    // Generate ephemeral keys for dev
    // In production, generate via: openssl genpkey -algorithm RSA -out private.pem
    log.warn('No AP keys configured. ActivityPub federation will not work in production.');
    _publicKeyPem = 'GENERATE_KEYS_FOR_PRODUCTION';
    _privateKeyPem = '';
  }
}

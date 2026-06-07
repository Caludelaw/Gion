/**
 * WeChat MCP Tool Routes — 微信生态桥接
 *
 * 通过 MCP Tool 暴露微信 API，Agent 可操作公众号/小程序内容。
 * 实际对接微信开放平台 API，需要用户自行申请 AppID/AppSecret。
 *
 * 环境变量：
 *   GION_WECHAT_APPID     — 微信公众号 AppID
 *   GION_WECHAT_SECRET    — 公众号 AppSecret
 *   GION_WECHAT_TOKEN     — 服务器配置 Token（消息推送验证）
 */

import { requireAuth } from '../middleware/auth.js';
import { createLogger } from '../logger.js';

const log = createLogger('wechat');

let _accessToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  const appId = process.env.GION_WECHAT_APPID;
  const secret = process.env.GION_WECHAT_SECRET;
  if (!appId || !secret) throw new Error('WeChat not configured (GION_WECHAT_APPID/SECRET)');

  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`);
  const data = await res.json();
  if (data.errcode) throw new Error(`WeChat token error: ${data.errmsg}`);

  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  return _accessToken;
}

/**
 * Push article draft to WeChat Official Account.
 */
async function pushToDraft(title, content, thumbMediaId = '') {
  const token = await getAccessToken();
  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`, {
    method: 'POST',
    body: JSON.stringify({
      articles: [{
        title,
        content,
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        show_cover_pic: 0
      }]
    })
  });
  return res.json();
}

/**
 * Get WeChat user list (followers).
 */
async function getUserList() {
  const token = await getAccessToken();
  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/user/get?access_token=${token}`);
  return res.json();
}

export async function wechatRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  const authResult = await requireAuth(ctx);
  if (!authResult.authenticated) {
    ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
    return;
  }

  try {
    // GET /api/wechat/status
    if (pathname === '/api/wechat/status' && method === 'GET') {
      const configured = !!(process.env.GION_WECHAT_APPID && process.env.GION_WECHAT_SECRET);
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ configured, appId: process.env.GION_WECHAT_APPID?.substring(0, 8) + '...' || '' }));
      return;
    }

    // POST /api/wechat/push — sync article to WeChat draft
    if (pathname === '/api/wechat/push' && method === 'POST') {
      const { title, content, thumbMediaId } = ctx.body || {};
      if (!title || !content) {
        ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'title and content required' }));
        return;
      }
      const result = await pushToDraft(title, content, thumbMediaId);
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
      return;
    }

    // GET /api/wechat/followers
    if (pathname === '/api/wechat/followers' && method === 'GET') {
      const result = await getUserList();
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
      return;
    }
  } catch (err) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: err.message }));
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}

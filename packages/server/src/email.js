/**
 * Email Notification — 邮件通知渠道
 *
 * 零外部依赖 SMTP 客户端（基于 node:net + node:tls + node:crypto）。
 * 环境变量：
 *   TAICHU_SMTP_HOST     — SMTP 服务器地址
 *   TAICHU_SMTP_PORT     — 端口（默认 587 STARTTLS, 465 SMTPS）
 *   TAICHU_SMTP_USER     — 认证用户名
 *   TAICHU_SMTP_PASS     — 认证密码
 *   TAICHU_SMTP_FROM     — 发件人地址
 *   TAICHU_SMTP_TO       — 收件人（逗号分隔）
 *   TAICHU_SMTP_CC       — 抄送（可选，逗号分隔）
 *   TAICHU_SMTP_BCC      — 密送（可选，逗号分隔）
 *   TAICHU_SMTP_SECURE   — 设为 '1' 强制 TLS 直连（端口 465 模式）
 *   TAICHU_SMTP_TLS_REJECT_UNAUTHORIZED — 设为 '0' 跳过证书验证（仅开发）
 */

import { createConnection } from 'node:net';
import { connect } from 'node:tls';
import { randomBytes } from 'node:crypto';
import { createLogger } from './logger.js';

const log = createLogger('email');

const CONNECT_TIMEOUT = 15000;

/**
 * Send an HTML email via SMTP.
 * @param {object} opts
 * @param {string} opts.to       — recipient(s), comma-separated
 * @param {string} opts.subject  — email subject
 * @param {string} opts.html     — HTML body
 * @param {string} [opts.cc]     — CC recipient(s)
 * @param {string} [opts.bcc]    — BCC recipient(s)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail(opts) {
  const host = process.env.TAICHU_SMTP_HOST;
  const port = parseInt(process.env.TAICHU_SMTP_PORT) || 587;
  const user = process.env.TAICHU_SMTP_USER;
  const pass = process.env.TAICHU_SMTP_PASS;
  const from = process.env.TAICHU_SMTP_FROM;

  if (!host || !user || !pass || !from) {
    return { success: false, error: 'SMTP not configured (missing TAICHU_SMTP_HOST/USER/PASS/FROM)' };
  }

  const to = opts.to || process.env.TAICHU_SMTP_TO;
  if (!to) {
    return { success: false, error: 'No recipients' };
  }

  const cc = opts.cc || process.env.TAICHU_SMTP_CC || '';
  const bcc = opts.bcc || process.env.TAICHU_SMTP_BCC || '';
  const useTLS = process.env.TAICHU_SMTP_SECURE === '1' || port === 465;
  const rejectUnauthorized = process.env.TAICHU_SMTP_TLS_REJECT_UNAUTHORIZED !== '0';

  try {
    const messageId = await smtpSend({
      host, port, user, pass, from, to, cc, bcc,
      subject: opts.subject, html: opts.html,
      useTLS, rejectUnauthorized
    });
    return { success: true, messageId };
  } catch (err) {
    log.error(`Email send failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Low-level SMTP transaction.
 */
function smtpSend(cfg) {
  return new Promise((resolve, reject) => {
    const socket = cfg.useTLS
      ? connect({ host: cfg.host, port: cfg.port, rejectUnauthorized: cfg.rejectUnauthorized, timeout: CONNECT_TIMEOUT })
      : createConnection({ host: cfg.host, port: cfg.port, timeout: CONNECT_TIMEOUT });

    let buffer = '';
    let authMethod = null;

    socket.setEncoding('utf8');

    const readResponse = () => {
      return new Promise((res) => {
        const check = () => {
          const idx = buffer.indexOf('\r\n');
          if (idx >= 0) {
            const line = buffer.substring(0, idx);
            buffer = buffer.substring(idx + 2);
            const code = parseInt(line.substring(0, 3));
            res({ code, line, continued: line[3] === '-' });
          } else {
            socket.once('data', () => check());
          }
        };
        check();
      });
    };

    const send = (cmd) => {
      socket.write(cmd + '\r\n');
    };

    const multiLine = async () => {
      const lines = [];
      let resp = await readResponse();
      lines.push(resp.line);
      while (resp.continued) {
        resp = await readResponse();
        lines.push(resp.line);
      }
      if (resp.code >= 400) throw new Error(`SMTP ${resp.code}: ${resp.line}`);
      return { code: resp.code, lines };
    };

    socket.on('data', (data) => {
      buffer += data;
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP connection timeout'));
    });

    socket.on('error', reject);

    (async () => {
      try {
        // 1. Read banner
        let resp = await multiLine();

        // 2. EHLO
        const hostname = 'taichu.local';
        send(`EHLO ${hostname}`);
        resp = await multiLine();

        const capabilities = resp.lines.map(l => l.substring(4)).join(' ');

        // 3. STARTTLS (if not already secure)
        if (!cfg.useTLS && capabilities.includes('STARTTLS')) {
          send('STARTTLS');
          resp = await readResponse();
          if (resp.code !== 220) throw new Error(`STARTTLS rejected: ${resp.line}`);

          // Upgrade socket to TLS
          const tlsSocket = connect({
            socket,
            host: cfg.host,
            rejectUnauthorized: cfg.rejectUnauthorized,
            timeout: CONNECT_TIMEOUT
          });
          // Replace socket refs
          tlsSocket.setEncoding('utf8');
          tlsSocket.on('data', (d) => { buffer += d; });
          tlsSocket.on('timeout', () => { tlsSocket.destroy(); reject(new Error('TLS timeout')); });
          tlsSocket.on('error', reject);

          // Re-EHLO over TLS
          send(`EHLO ${hostname}`);
          resp = await multiLine();
          const tlsCapabilities = resp.lines.map(l => l.substring(4)).join(' ');
          authMethod = detectAuth(tlsCapabilities);
        } else {
          authMethod = detectAuth(capabilities);
        }

        // 4. AUTH LOGIN
        if (authMethod === 'LOGIN') {
          send('AUTH LOGIN');
          resp = await readResponse();
          if (resp.code !== 334) throw new Error(`AUTH LOGIN not accepted: ${resp.line}`);

          send(Buffer.from(cfg.user).toString('base64'));
          resp = await readResponse();
          if (resp.code !== 334) throw new Error(`Username rejected: ${resp.line}`);

          send(Buffer.from(cfg.pass).toString('base64'));
          resp = await readResponse();
          if (resp.code !== 235) throw new Error(`Password rejected: ${resp.line}`);
        } else if (authMethod === 'PLAIN') {
          const token = Buffer.from(`\0${cfg.user}\0${cfg.pass}`).toString('base64');
          send('AUTH PLAIN ' + token);
          resp = await readResponse();
          if (resp.code !== 235) throw new Error(`AUTH PLAIN rejected: ${resp.line}`);
        } else {
          throw new Error('No supported AUTH method (need LOGIN or PLAIN)');
        }

        // 5. MAIL FROM
        send(`MAIL FROM:<${cfg.from}>`);
        resp = await readResponse();
        if (resp.code !== 250) throw new Error(`MAIL FROM rejected: ${resp.line}`);

        // 6. RCPT TO
        const allRecipients = [
          ...cfg.to.split(',').map(s => s.trim()).filter(Boolean),
          ...cfg.cc.split(',').map(s => s.trim()).filter(Boolean),
          ...cfg.bcc.split(',').map(s => s.trim()).filter(Boolean)
        ];
        for (const rcpt of allRecipients) {
          send(`RCPT TO:<${rcpt}>`);
          resp = await readResponse();
          if (resp.code >= 400) log.warn(`RCPT TO ${rcpt} rejected: ${resp.line}`);
        }

        // 7. DATA
        send('DATA');
        resp = await readResponse();
        if (resp.code !== 354) throw new Error(`DATA not accepted: ${resp.line}`);

        const messageId = `<${Date.now()}.${randomBytes(6).toString('hex')}@taichu>`;
        const date = new Date().toUTCString();
        const boundary = `--_Taichu_${randomBytes(12).toString('hex')}`;

        const rawEmail = [
          `From: ${cfg.from}`,
          `To: ${cfg.to}`,
          cfg.cc ? `Cc: ${cfg.cc}` : '',
          `Date: ${date}`,
          `Message-ID: ${messageId}`,
          `Subject: =?UTF-8?B?${Buffer.from(cfg.subject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(stripHtml(cfg.html)).toString('base64'),
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(cfg.html).toString('base64'),
          '',
          `--${boundary}--`,
          '.'
        ].filter(l => l !== '').join('\r\n');

        send(rawEmail);
        resp = await readResponse();
        if (resp.code !== 250) throw new Error(`Message rejected: ${resp.line}`);

        // 8. QUIT
        send('QUIT');
        socket.end();

        resolve(messageId);
      } catch (err) {
        try { send('QUIT'); socket.end(); } catch (_) {}
        reject(err);
      }
    })();
  });
}

function detectAuth(capabilities) {
  if (capabilities.includes('AUTH LOGIN')) return 'LOGIN';
  if (capabilities.includes('AUTH PLAIN')) return 'PLAIN';
  return null;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Build notification email HTML.
 */
export function buildEmailHtml(event, data) {
  const { title, url, actor, summary } = normalizeEmailData(data);
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1E1B4B;">
  <div style="background: linear-gradient(135deg, #1E1B4B, #312E81); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">Taichu CMS ${eventLabelEmail(event)}</h2>
  </div>
  <div style="border: 1px solid #E5E7EB; border-top: 0; border-radius: 0 0 12px 12px; padding: 24px;">
    <h3 style="margin: 0 0 12px; color: #1E1B4B;">${escapeHtml(title)}</h3>
    <p style="color: #6B7280; line-height: 1.6;">${escapeHtml(summary)}</p>
    <p style="color: #9CA3AF; font-size: 13px;">${escapeHtml(actor)} · ${new Date().toLocaleString('zh-CN')}</p>
    ${url ? `<a href="${url}" style="display: inline-block; margin-top: 16px; background: #1E1B4B; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none;">查看详情</a>` : ''}
  </div>
  <p style="color: #D1D5DB; font-size: 12px; text-align: center; margin-top: 16px;">
    Taichu CMS Notification · <a href="https://github.com/Caludelaw/Taichu" style="color: #9CA3AF;">github.com/Caludelaw/Taichu</a>
  </p>
</body></html>`;
}

function normalizeEmailData(data) {
  return {
    title: data.doc?.data?.title || data.doc?.id || 'Untitled',
    url: data.url || '',
    actor: data.actor || 'System',
    summary: typeof data.doc?.data?.body === 'string'
      ? data.doc.data.body.substring(0, 200)
      : (data.summary || '')
  };
}

function eventLabelEmail(e) {
  const map = {
    content_created: '📝 内容创建', content_updated: '✏️ 内容更新',
    content_deleted: '🗑️ 内容删除', content_published: '🚀 内容发布',
    content_scheduled: '⏰ 定时发布', review_requested: '👀 请求审核',
    agent_action: '🤖 Agent 操作'
  };
  return map[e] || '📌 通知';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

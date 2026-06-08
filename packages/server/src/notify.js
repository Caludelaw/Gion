/**
 * Notification — 多渠道通知（飞书/钉钉/企业微信 + 邮件）
 *
 * 通过 Webhook 发送 IM 消息 + SMTP 发送邮件。
 * 环境变量：
 *   TAICHU_NOTIFY_FEISHU     — 飞书机器人 Webhook URL
 *   TAICHU_NOTIFY_DINGTALK   — 钉钉机器人 Webhook URL
 *   TAICHU_NOTIFY_WECOM      — 企业微信机器人 Webhook URL
 *   TAICHU_SMTP_HOST         — SMTP 服务器（启用邮件通知）
 *   TAICHU_SMTP_PORT         — SMTP 端口（默认 587）
 *   TAICHU_SMTP_USER         — SMTP 用户名
 *   TAICHU_SMTP_PASS         — SMTP 密码
 *   TAICHU_SMTP_FROM         — 发件人地址
 *   TAICHU_SMTP_TO           — 默认收件人
 */

import { createLogger } from './logger.js';
import { sendEmail, buildEmailHtml } from './email.js';

const log = createLogger('notify');

/**
 * Send notification to all configured channels.
 * @param {string} event — event type
 * @param {object} data  — event payload
 */
export async function notify(event, data) {
  const promises = [];

  if (process.env.TAICHU_NOTIFY_FEISHU) {
    promises.push(sendFeishu(process.env.TAICHU_NOTIFY_FEISHU, event, data));
  }
  if (process.env.TAICHU_NOTIFY_DINGTALK) {
    promises.push(sendDingTalk(process.env.TAICHU_NOTIFY_DINGTALK, event, data));
  }
  if (process.env.TAICHU_NOTIFY_WECOM) {
    promises.push(sendWecom(process.env.TAICHU_NOTIFY_WECOM, event, data));
  }
  if (process.env.TAICHU_SMTP_HOST) {
    promises.push(sendEmailNotify(event, data));
  }

  await Promise.allSettled(promises);
}

/**
 * Send email notification via configured SMTP.
 */
async function sendEmailNotify(event, data) {
  const { title } = normalize(data);
  const html = buildEmailHtml(event, data);

  const result = await sendEmail({
    subject: `[Taichu] ${eventLabel(event)}: ${title}`,
    html
  });

  if (result.success) {
    log.info(`Email sent: ${event} — ${title}`);
  } else {
    log.warn(`Email failed: ${result.error}`);
  }
}

/** 飞书消息卡片 */
async function sendFeishu(webhook, event, data) {
  const { title, url, actor, summary } = normalize(data);
  const body = {
    msg_type: 'interactive',
    card: {
      header: { title: { tag: 'plain_text', content: `${icon(event)} ${eventLabel(event)}` }, template: 'green' },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: `**${escapeMd(title)}**\n${summary}` } },
        { tag: 'note', elements: [{ tag: 'plain_text', content: `${actor} · ${new Date().toLocaleString('zh-CN')}` }] }
      ]
    }
  };
  if (url) body.card.elements.push({ tag: 'action', actions: [{ tag: 'button', text: { tag: 'plain_text', content: '查看详情' }, type: 'default', url }] });

  try {
    await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err) { log.error(`Feishu notify failed: ${err.message}`); }
}

/** 钉钉 Markdown 消息 */
async function sendDingTalk(webhook, event, data) {
  const { title, url, actor, summary } = normalize(data);
  let text = `## ${icon(event)} ${eventLabel(event)}\n\n**${title}**\n${summary}\n\n> ${actor}`;
  if (url) text += `\n\n[查看详情](${url})`;

  try {
    await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msgtype: 'markdown', markdown: { title: `${eventLabel(event)}: ${title}`, text } }) });
  } catch (err) { log.error(`DingTalk notify failed: ${err.message}`); }
}

/** 企业微信 Markdown 消息 */
async function sendWecom(webhook, event, data) {
  const { title, url, actor, summary } = normalize(data);
  let content = `**${icon(event)} ${eventLabel(event)}**\n> ${title}\n${summary}\n> ${actor} · ${new Date().toLocaleString('zh-CN')}`;
  if (url) content += `\n[查看详情](${url})`;

  try {
    await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msgtype: 'markdown', markdown: { content } }) });
  } catch (err) { log.error(`WeCom notify failed: ${err.message}`); }
}

function normalize(data) {
  return {
    title: data.doc?.data?.title || data.doc?.id || 'Untitled',
    url: data.url || '',
    actor: data.actor || data.doc?._meta?.createdBy?.label || 'System',
    summary: data.summary || (typeof data.doc?.data?.body === 'string' ? data.doc.data.body.substring(0, 100) : '')
  };
}

function eventLabel(e) {
  return { content_created: '内容创建', content_updated: '内容更新', content_deleted: '内容删除', review_requested: '请求审核', agent_action: 'Agent 操作' }[e] || e;
}

function icon(e) {
  return { content_created: '📝', content_updated: '✏️', content_deleted: '🗑️', review_requested: '👀', agent_action: '🤖' }[e] || '📌';
}

function escapeMd(text) {
  return String(text).replace(/[*_~`>#[\]()\\]/g, '\\$&');
}

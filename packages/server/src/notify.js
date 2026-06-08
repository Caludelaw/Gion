/**
 * Notification — 企业 IM 通知模板（飞书/钉钉/企业微信）
 *
 * 通过 Webhook 发送消息卡、Markdown 通知。
 * 环境变量：
 *   TAICHU_NOTIFY_FEISHU     — 飞书机器人 Webhook URL
 *   TAICHU_NOTIFY_DINGTALK   — 钉钉机器人 Webhook URL
 *   TAICHU_NOTIFY_WECOM      — 企业微信机器人 Webhook URL
 */

import { createLogger } from './logger.js';

const log = createLogger('notify');

/**
 * Send notification to configured IM platforms.
 * @param {string} event — "content_created" | "content_updated" | "content_deleted" | "review_requested" | "agent_action"
 * @param {object} data — event payload
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

  await Promise.allSettled(promises);
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

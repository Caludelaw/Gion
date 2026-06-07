/**
 * Pipeline Engine — Agent 内容编排管道
 *
 * 声明式定义多步骤内容操作（翻译→润色→SEO→审核→发布）。
 * 基于现有 Hook 系统构建。
 */

import { createLogger } from './logger.js';

const log = createLogger('pipeline');

/**
 * @typedef {object} PipelineStep
 * @property {string} name — step name
 * @property {string} action — "translate" | "polish" | "seo" | "review" | "publish" | custom
 * @property {object} [config] — step-specific config
 */

/**
 * @typedef {object} PipelineTemplate
 * @property {string} name
 * @property {string} label
 * @property {PipelineStep[]} steps
 */

/** Built-in pipeline templates */
const TEMPLATES = {
  translation: {
    name: 'translation',
    label: '翻译管道',
    steps: [
      { name: 'detect-language', action: 'detect' },
      { name: 'translate', action: 'translate', config: { targetLang: 'en' } },
      { name: 'polish', action: 'polish' },
      { name: 'publish', action: 'publish' }
    ]
  },
  seo: {
    name: 'seo',
    label: 'SEO 优化管道',
    steps: [
      { name: 'analyze-keywords', action: 'seo_analyze' },
      { name: 'optimize-title', action: 'seo_title' },
      { name: 'optimize-body', action: 'seo_body' },
      { name: 'add-meta', action: 'seo_meta' },
      { name: 'publish', action: 'publish' }
    ]
  },
  review: {
    name: 'review',
    label: '审核发布管道',
    steps: [
      { name: 'ai-review', action: 'review', config: { autoApprove: false } },
      { name: 'publish', action: 'publish' }
    ]
  }
};

class PipelineEngine {
  constructor(store, hooks) {
    this.store = store;
    this.hooks = hooks;
    /** @type {Map<string, PipelineTemplate>} */
    this.templates = new Map(Object.entries(TEMPLATES));
  }

  /**
   * Register a custom pipeline template.
   */
  registerTemplate(template) {
    this.templates.set(template.name, template);
  }

  /**
   * List available templates.
   */
  listTemplates() {
    return Array.from(this.templates.values());
  }

  /**
   * Execute a pipeline on a document.
   * @param {string} templateName
   * @param {object} doc — the document to process
   * @returns {Promise<{ steps: Array<{ name: string, status: string, result?: any }> }>}
   */
  async execute(templateName, doc) {
    const template = this.templates.get(templateName);
    if (!template) throw new Error(`Pipeline template "${templateName}" not found`);

    const results = [];
    let currentDoc = doc;

    for (const step of template.steps) {
      try {
        // Fire before-step hook
        await this.hooks.run(`pipeline:before:${step.action}`, { doc: currentDoc, step });

        // Execute step (delegated to hook handlers or built-in logic)
        const stepResult = await this.hooks.run(`pipeline:${step.action}`, {
          doc: currentDoc,
          config: step.config || {},
          stepName: step.name
        });

        results.push({ name: step.name, status: 'completed', result: stepResult });

        // Fire after-step hook
        await this.hooks.run(`pipeline:after:${step.action}`, { doc: currentDoc, result: stepResult });

        log.info(`Pipeline step "${step.name}" completed for doc ${doc.id}`);
      } catch (err) {
        results.push({ name: step.name, status: 'failed', error: err.message });
        log.error(`Pipeline step "${step.name}" failed: ${err.message}`);
        break;
      }
    }

    return { steps: results };
  }
}

// ── Agent Metadata ─────────────────────────────────────────

/**
 * Attach agent metadata to a content document.
 * Called automatically when an Agent (API Key) creates or modifies content.
 *
 * @param {object} doc — document being created/updated
 * @param {object} actor — from auth middleware
 * @param {string} action — "create" | "update"
 * @returns {object} doc with metadata attached
 */
export function attachAgentMeta(doc, actor, action = 'create') {
  if (actor?.type !== 'agent') return doc;

  const meta = doc._meta || (doc._meta = {});
  meta.createdBy = meta.createdBy || {
    type: 'agent',
    agentId: actor.keyPrefix || actor.id,
    label: actor.label || 'Unknown Agent',
    timestamp: new Date().toISOString()
  };
  meta.lastModifiedBy = {
    type: 'agent',
    agentId: actor.keyPrefix || actor.id,
    label: actor.label || 'Unknown Agent',
    action,
    timestamp: new Date().toISOString()
  };

  return doc;
}

// ── Review Policy ─────────────────────────────────────────

/**
 * Review policy for Agent-generated content.
 */
class ReviewPolicy {
  constructor(config = {}) {
    this.requireHumanReview = config.requireHumanReview ?? true;
    this.autoApproveThreshold = config.autoApproveThreshold ?? null;
    this.blockedPatterns = config.blockedPatterns || [];
    this.minConfidence = config.minConfidence ?? 0.7;
  }

  /**
   * Evaluate content against the review policy.
   * @returns {{ approved: boolean, reason?: string, score?: number }}
   */
  evaluate(doc) {
    // Check blocked patterns
    const text = JSON.stringify(doc.data || {}).toLowerCase();
    for (const pattern of this.blockedPatterns) {
      if (text.includes(pattern.toLowerCase())) {
        return { approved: false, reason: `Blocked pattern: "${pattern}"` };
      }
    }

    // Check if marked as AI-generated → require review
    const isAgentContent = doc._meta?.createdBy?.type === 'agent';
    if (isAgentContent && this.requireHumanReview) {
      return { approved: false, reason: 'Agent-generated content requires human review' };
    }

    return { approved: true };
  }

  /** Serialize to JSON for storage */
  toJSON() {
    return {
      requireHumanReview: this.requireHumanReview,
      autoApproveThreshold: this.autoApproveThreshold,
      blockedPatterns: this.blockedPatterns,
      minConfidence: this.minConfidence
    };
  }

  /** Create from stored JSON */
  static fromJSON(json) {
    return new ReviewPolicy(json);
  }
}

export { PipelineEngine, ReviewPolicy, TEMPLATES };

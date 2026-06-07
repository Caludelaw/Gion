/**
 * @taichu/llm-providers — 国产 LLM API 适配层
 *
 * 提供统一的 ChatProvider 接口，内置 4 个国产模型 Adapter：
 *   - qwen     通义千问 (阿里云 DashScope)
 *   - ernie    文心一言 (百度千帆)
 *   - deepseek DeepSeek
 *   - moonshot 月之暗面 Kimi
 *
 * 所有 Provider 实现 OpenAI-compatible 接口，可以无缝切换。
 *
 * 使用：
 *   import { createProvider } from '@taichu/llm-providers';
 *   const llm = createProvider('qwen', { apiKey: 'xxx' });
 *   const reply = await llm.chat([{ role: 'user', content: 'Hello' }]);
 */

// ─── Base Provider Interface ───────────────────────────────

class BaseChatProvider {
  constructor(config) {
    this.config = config;
  }

  /** Must be overridden */
  get baseURL() { throw new Error('Not implemented'); }

  /** Default model name */
  get defaultModel() { return 'default'; }

  /**
   * Send a chat completion request.
   * @param {Array<{ role: string, content: string }>} messages
   * @param {object} [options]
   * @returns {Promise<{ content: string, model: string, usage?: object }>}
   */
  async chat(messages, options = {}) {
    const apiKey = options.apiKey || this.config.apiKey || process.env.TAICHU_LLM_API_KEY;
    const model = options.model || this.config.model || this.defaultModel;
    const url = options.baseURL || this.baseURL;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.7,
        ...options.extra
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LLM API error (${res.status}): ${err.error?.message || err.message || res.statusText}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || model,
      usage: data.usage
    };
  }

  /**
   * Get embeddings for text (if provider supports).
   */
  async embed(text, options = {}) {
    throw new Error('Embeddings not supported by this provider');
  }
}

// ─── Provider Implementations ──────────────────────────────

class QwenProvider extends BaseChatProvider {
  get baseURL() {
    return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  }
  get defaultModel() { return 'qwen-turbo'; }
}

class ErnieProvider extends BaseChatProvider {
  get baseURL() {
    return `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro`;
  }
  get defaultModel() { return 'ernie-speed-128k'; }

  async chat(messages, options = {}) {
    const apiKey = options.apiKey || this.config.apiKey;
    const model = options.model || this.defaultModel;

    // Baidu ERNIE uses a different auth flow — get access token first
    let accessToken = this._accessToken;
    if (!accessToken) {
      const tokenRes = await fetch(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.config.clientId || apiKey}&client_secret=${this.config.clientSecret || ''}`
      );
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      this._accessToken = accessToken;
    }

    const res = await fetch(
      `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          max_output_tokens: options.maxTokens || 2048,
          temperature: options.temperature ?? 0.7
        })
      }
    );

    if (!res.ok) throw new Error(`ERNIE API error: ${res.status}`);
    const data = await res.json();
    return {
      content: data.result || '',
      model,
      usage: data.usage
    };
  }
}

class DeepSeekProvider extends BaseChatProvider {
  get baseURL() { return 'https://api.deepseek.com/v1/chat/completions'; }
  get defaultModel() { return 'deepseek-chat'; }
}

class MoonshotProvider extends BaseChatProvider {
  get baseURL() { return 'https://api.moonshot.cn/v1/chat/completions'; }
  get defaultModel() { return 'moonshot-v1-8k'; }
}

/**
 * OpenAI-compatible provider (for any service exposing OpenAI API).
 * Use this for local models (vLLM, Ollama) or custom endpoints.
 */
class OpenAICompatibleProvider extends BaseChatProvider {
  get baseURL() {
    return this.config.baseURL || 'https://api.openai.com/v1/chat/completions';
  }
  get defaultModel() { return this.config.model || 'gpt-3.5-turbo'; }
}

// ─── Factory ───────────────────────────────────────────────

const PROVIDERS = {
  qwen: QwenProvider,
  ernie: ErnieProvider,
  deepseek: DeepSeekProvider,
  moonshot: MoonshotProvider,
  'openai-compatible': OpenAICompatibleProvider
};

/**
 * Create a chat provider instance.
 * @param {string} name — provider name (qwen/ernie/deepseek/moonshot/openai-compatible)
 * @param {object} config — { apiKey, model?, baseURL?, ... }
 * @returns {BaseChatProvider}
 */
export function createProvider(name, config = {}) {
  const Provider = PROVIDERS[name];
  if (!Provider) throw new Error(`Unknown LLM provider: "${name}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
  return new Provider(config);
}

/**
 * List available providers.
 */
export function listProviders() {
  return Object.keys(PROVIDERS);
}

export { BaseChatProvider };

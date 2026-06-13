# Taichu Plugin Developer Guide

Taichu 插件系统允许开发者通过钩子 (Hooks) 扩展 CMS 功能。插件在服务器启动时加载，可以拦截内容生命周期、注册自定义路由、调用存储 API。

---

## 快速开始

最小的插件只需要两个文件：

```
my-plugin/
├── taichu.plugin.json    # 清单文件
└── index.js              # 入口
```

### 1. 创建清单文件 `taichu.plugin.json`

```json
{
  "name": "@taichu/plugin-my-plugin",
  "version": "0.1.0",
  "description": "我的第一个 Taichu 插件",
  "hooks": ["afterCreate", "afterUpdate"],
  "routes": false,
  "adminPanel": false,
  "permissions": ["content:read", "content:write"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | **是** | 插件唯一标识，推荐 `@taichu/plugin-*` 格式 |
| `version` | string | **是** | semver 版本号 |
| `description` | string | 否 | 功能描述 |
| `hooks` | string[] | 否 | 声明使用的钩子名称 |
| `routes` | boolean | 否 | 是否注册了自定义 REST 路由 |
| `adminPanel` | boolean | 否 | 是否有管理面板 UI |
| `permissions` | string[] | 否 | 所需权限范围 |

### 2. 编写入口文件 `index.js`

导出默认函数，接收 `PluginAPI` 对象：

```js
export default function(api) {
  // api.store   — 数据存储（CRUD）
  // api.hooks   — 钩子系统
  // api.logger  — 日志记录器
  // api.config  — 应用配置
  // api.hook()   — 注册钩子的便捷方法
  // api.route()  — 注册路由的便捷方法

  api.hook('afterCreate', async (doc) => {
    await api.logger.info('新文档已创建', { id: doc.id, type: doc.type })
  })
}
```

---

## PluginAPI 参考

插件入口函数接收的 `api` 对象包含以下属性：

| 属性 | 类型 | 说明 |
|------|------|------|
| `api.store` | Store | Taichu 数据存储，提供 `create` / `get` / `list` / `update` / `delete` / `count` |
| `api.hooks` | HookSystem | 原始钩子系统实例 |
| `api.logger` | Logger | 插件专用日志，输出前缀 `plugin:<name>` |
| `api.config` | Object | 当前应用配置 |
| `api.hook(name, fn, priority?)` | Function | 注册钩子，`priority` 默认 10（越小越先执行） |
| `api.route(method, path, handler)` | Function | 注册自定义 REST 路由 |

---

## 可用钩子

### 内容生命周期

| 钩子 | 类型 | 载荷 | 触发时机 |
|------|------|------|----------|
| `beforeCreate` | 过滤器 | `{ type, data, status }` | 文档写入之前 |
| `afterCreate` | 动作 | `Document` | 文档创建之后 |
| `beforeUpdate` | 过滤器 | `{ id, type, data }` | 文档更新之前 |
| `afterUpdate` | 动作 | `Document` | 文档更新之后 |
| `beforeDelete` | 过滤器 | `{ id, type }` | 文档删除之前 |
| `afterDelete` | 动作 | `{ id, type }` | 文档删除之后 |
| `beforePublish` | 过滤器 | `Document` | 发布之前 |
| `afterPublish` | 动作 | `Document` | 发布之后 |

### 管道步骤

| 模式 | 示例 |
|------|------|
| `pipeline:before:<action>` | `pipeline:before:translate` |
| `pipeline:<action>` | `pipeline:translate` |
| `pipeline:after:<action>` | `pipeline:after:seo_analyze` |

### Agent 交互

| 钩子 | 类型 | 说明 |
|------|------|------|
| `agent:onRequest` | 过滤器 | Agent API 请求到达时 |
| `agent:onResponse` | 过滤器 | Agent API 响应准备时 |

### 渲染（主题）

| 钩子 | 类型 | 说明 |
|------|------|------|
| `beforeRender` | 过滤器 | HTML 输出渲染之前 |
| `afterRender` | 动作 | HTML 输出渲染之后 |

---

## 钩子语义

```js
api.hook('beforeCreate', async (payload) => {
  // 返回 null → 停止链，后续处理函数不执行
  // 返回 undefined → 透传，payload 不变
  // 返回其他值 → 替换 payload
  return modifiedPayload
}, 5)  // 优先级 5，越小越先执行
```

---

## 完整示例

### SEO 优化插件

```js
// plugins/@taichu/plugin-seo/index.js
export default function(api) {

  // 文档创建后自动分析 SEO
  api.hook('afterCreate', async (doc) => {
    if (doc.type !== 'article') return

    const seoScore = analyzeSEO(doc.data)
    await api.store.update('article', doc.id, {
      data: { ...doc.data, seoScore }
    })
  })

  // 发布前验证 meta 标签
  api.hook('beforePublish', async (doc) => {
    if (!doc.data.metaDescription) {
      api.logger.warn(`文档缺少 meta description: ${doc.id}`)
      doc.data.metaDescription = doc.data.title
    }
    return doc
  })

  // 渲染前注入 OG 标签
  api.hook('beforeRender', async (html, ctx) => {
    return html.replace('</head>',
      `<meta property="og:title" content="${ctx.doc?.data?.title}"></head>`)
  })
}

function analyzeSEO(data) {
  // SEO 评分逻辑...
  return 85
}
```

### 内容同步到微信公众号

```js
export default function(api) {

  api.hook('afterPublish', async (doc) => {
    if (doc.type !== 'article') return

    await fetch('http://localhost:3120/api/wechat/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TAICHU_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: doc.data.title,
        content: doc.data.body
      })
    })
  })
}
```

### 自动翻译插件

```js
export default function(api) {

  api.hook('pipeline:translate', async (payload) => {
    const { doc, targetLang } = payload
    const translated = await translateText(doc.data.body, targetLang)
    return { ...payload, translated }
  })
}
```

---

## 注册自定义路由

```js
export default function(api) {

  api.route('GET', '/api/plugin/my-plugin/stats', async (ctx) => {
    const count = await api.store.count('article')
    return {
      status: 200,
      body: { plugin: 'my-plugin', articles: count }
    }
  })

  api.route('POST', '/api/plugin/my-plugin/webhook', async (ctx) => {
    const body = await parseJSON(ctx.req)
    api.logger.info('收到 webhook', body)
    return { status: 200, body: { ok: true } }
  })
}
```

---

## 发布到市场

### 1. 创建 GitHub 仓库

仓库结构：
```
taichu-plugin-myplugin/
├── taichu.plugin.json
├── index.js
└── README.md
```

### 2. 添加到 marketplace.json

在 Taichu 仓库的 `marketplace.json` 中添加：

```json
{
  "plugins": [
    {
      "name": "@taichu/plugin-my-plugin",
      "version": "0.1.0",
      "description": "插件功能描述",
      "author": "你的名字",
      "repository": "https://github.com/你的用户名/taichu-plugin-my-plugin",
      "license": "MIT",
      "keywords": ["seo", "optimization"],
      "category": "seo"
    }
  ]
}
```

### 3. 提交 PR

向 `Caludelaw/Taichu` 仓库提交 PR，更新 `marketplace.json`。

### 4. 验证

```bash
# 安装
npx taichu plugin install @taichu/plugin-my-plugin

# 查看
npx taichu plugin list
```

---

## 技术约束

| 约束 | 说明 |
|------|------|
| **零外部依赖** | 插件核心系统仅使用 Node.js 内置模块 |
| **同进程运行** | 插件与服务器在同一 Node.js 进程中运行 |
| **需重启生效** | 安装/卸载后需要重启服务器 |
| **ESM 模块** | 插件必须使用 ES Module 语法 |
| **优先级** | 默认优先级 10，数字越小越先执行（类似 WordPress） |
| **去重** | 同名插件不会重复加载 |
| **错误隔离** | 插件加载失败不会导致整个服务器启动失败 |

---

## 目录

| 文件 | 说明 |
|------|------|
| `packages/core/src/hooks.js` | Hook 系统实现 |
| `packages/server/src/plugin-manager.js` | 插件管理器 |
| `packages/server/src/plugin-installer.js` | GitHub 安装器 |
| `marketplace.json` | 市场注册表 |
| `scripts/plugin-cli.js` | CLI 工具 |

---

## 下一步

- 查看 [API 参考文档](/admin/#/api-docs) 了解可用端点
- 阅读 [架构决策记录](architecture/) 了解设计理念
- 参考 `marketplace.json` 中的 7 个入门插件获取更多示例

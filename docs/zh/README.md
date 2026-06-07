# Gion CMS 中文文档

> AI Agent 时代的原生内容基础设施。人类和 Agent 同为内容的第一公民。

[![MIT License](https://img.shields.io/badge/license-MIT-green)](https://github.com/Caludelaw/Gion/blob/main/LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-镜像-red)](https://gitee.com/Caludelaw/Gion)

## 快速开始

```bash
git clone https://gitee.com/Caludelaw/Gion.git  # 国内推荐 Gitee
# 或: git clone https://github.com/Caludelaw/Gion.git

cd Gion
node packages/server/src/index.js
# → http://localhost:3120/admin/
```

## 是什么

Gion 不是又一个 Headless CMS。它是为 **AI Agent 时代设计的内容基础设施**：

- **三通道 API**：REST + GraphQL + MCP（24 tools），同时为人类和 Agent 服务
- **Agent 一等公民**：API Key 独立身份、细粒度 scope 权限、WebSocket 实时推送
- **零依赖核心**：`node packages/server/src/index.js` 即可跑，无需 MySQL/Redis
- **MIT 开源**：完全免费，自托管，无 vendor lock-in

## 核心能力

| 能力 | 说明 |
|------|------|
| 🏗️ 结构化内容模型 | 9 种字段类型、JSON Schema 导出、语义映射(schema.org) |
| 🔌 三通道 API | REST(20+端点) + GraphQL + **MCP(24 tools)** |
| 🔐 双通道认证 | JWT(人类) + API Key(Agent)，scope 细粒度权限 |
| 📝 富文本编辑 | TipTap ProseMirror，14 工具栏，Markdown 快捷输入 |
| 🔍 向量搜索 | TF-IDF 中文分词，语义级内容发现 |
| 📡 实时推送 | WebSocket 频道订阅，内容变更即时广播 |
| 🔗 Webhook | HMAC-SHA256 签名，指数退避重试，事件过滤 |
| 🧩 插件系统 | gion.plugin.json manifest，Worker Thread 沙箱 |
| 🤝 Agent 协作 | 乐观锁冲突检测，5min TTL 编辑会话 |
| 🖼️ 媒体管理 | 零依赖 multipart 解析，sharp 缩略图，/uploads 静态服务 |
| 🐳 Docker | 多阶段构建(alpine)，SQLite 持久化卷，健康检查 |

## 对比 WordPress & Strapi

| | Gion | WordPress | Strapi |
|---|------|-----------|--------|
| Agent 原生 | ✅ 设计哲学级 | ❌ 插件附加 | 🟡 MCP 封装层 |
| MCP Tools | 24 | 通过 Adapter | v5.47 内置（CRUD） |
| 零依赖启动 | ✅ | ❌ 需 MySQL | ❌ 需数据库 |
| 向量搜索 | ✅ 内置 | ❌ | ❌ |
| WebSocket | ✅ 内置 | ❌ | ❌ |
| 许可证 | MIT | GPL | MIT |

## 文档目录

- [架构决策记录](../architecture/README.md) — 4 篇 ADR，了解"为什么这样设计"
- [API 文档](../api/README.md) — REST + GraphQL 完整端点说明
- [部署指南](./deploy.md) — Docker / 阿里云 / 腾讯云
- [开发指南](./development.md) — 本地开发、插件编写、贡献流程
- [MCP 接入指南](./mcp.md) — Agent 如何通过 MCP 操控 Gion

## 社区

- [GitHub Issues](https://github.com/Caludelaw/Gion/issues) — Bug 报告、功能建议
- [Gitee Issues](https://gitee.com/Caludelaw/Gion/issues) — 国内用户反馈入口
- 微信交流群：添加 wxid_gion 备注"Gion"

## 兼容中国市场

Gion 核心保持 MIT 纯净。以下能力通过**独立 Plugin** 提供，按需安装：

| Plugin | 功能 |
|--------|------|
| `@gion/plugin-compliance-cn` | ICP 备案号配置、公安联网备案 |
| `@gion/plugin-content-filter` | 敏感词过滤（对接百度/阿里云/腾讯云审核 API） |
| `@gion/plugin-auth-providers` | 手机号注册、微信登录、SSO |
| `@gion/plugin-wechat-mcp` | 微信公众号/小程序 MCP Tool |
| `@gion/llm-providers` | 通义千问 / 文心一言 / DeepSeek / Moonshot |

> 所有合规 Plugin **默认关闭、用户自行启用**，核心代码不包含任何审查逻辑。

# MCP 接入指南

Gion 内置 24 个 MCP Tools，Agent 可通过 Model Context Protocol 直接操控 CMS。

## 配置

### Claude Desktop

```json
{
  "mcpServers": {
    "gion": {
      "command": "node",
      "args": ["/path/to/gion/packages/mcp/src/index.js"],
      "env": {
        "GION_API": "http://localhost:3120",
        "GION_AGENT_KEY": "gion_xxxx..."
      }
    }
  }
}
```

### WorkBuddy (mcp.json)

```json
{
  "gion": {
    "command": "node",
    "args": ["packages/mcp/src/index.js"],
    "env": {
      "GION_API": "http://localhost:3120",
      "GION_AGENT_KEY": "gion_xxxx..."
    }
  }
}
```

## 24 MCP Tools

| 类别 | Tool | 说明 |
|------|------|------|
| **CRUD** | `list_content` | 列出某类型文档 |
| | `get_content` | 获取单篇 |
| | `create_content` | 创建文档 |
| | `update_content` | 更新文档 |
| | `delete_content` | 删除文档 |
| **搜索** | `search_content` | TF-IDF 语义搜索 |
| | `get_content_by_field` | 按字段值查找 |
| **Schema** | `list_content_types` | 列出所有内容类型 |
| | `get_content_type_schema` | 获取 Schema 详情 |
| **发布** | `publish_content` | 发布草稿 |
| | `archive_content` | 归档文档 |
| **批量** | `batch_create_content` | 批量创建 |
| | `batch_update_content` | 批量更新 |
| | `clear_content` | 清空某类型 |
| **导入导出** | `export_content` | 导出为 JSON |
| | `import_content` | 批量导入 |
| **媒体** | `list_media` | 媒体列表 |
| **系统** | `get_stats` | 系统统计 |
| | `health_check` | 健康检查 |
| | `rebuild_search_index` | 重建搜索索引 |
| **密钥** | `get_api_keys` | 列出 API Keys |
| | `create_api_key` | 创建 API Key |
| **关系** | `get_content_relations` | 发现关联内容 |

## Agent 权限

创建 API Key 时指定 scope：

```bash
curl -X POST http://localhost:3120/api/auth/apikeys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"label":"My Agent","scopes":["article:read","article:write"]}'
```

scope 格式：`<类型>:<操作>`，支持 `*:*`（管理员）、`*:read`（只读）。

## Agent 注意事项

1. **速率限制**：默认 300 req/min（已认证 Agent），超限返回 429
2. **乐观锁**：更新时传入 `_version` 避免覆盖
3. **审计日志**：所有 Agent 操作记录在 AuditLog 中
4. **来源标记**：Agent 创建的内容自动标记 `_meta.createdBy.agentId`

/**
 * Bootstrap — 初始化内置内容类型
 *
 * Taichu 启动时自动注册内置内容类型。
 * 第三方扩展/插件可以通过 hook 系统注册自定义类型。
 */

import { createContentType } from '../../core/src/content-type.js';
import { registerContentType } from './routes/api.js';

export function bootstrap() {
  // Article — 博客文章
  registerContentType(createContentType('article', {
    label: '文章',
    description: '博客文章类型，支持标题、正文、摘要、标签、分类等',
    schemaOrg: 'Article',
    fields: {
      title:       { type: 'string',  required: true,  maxLength: 200, semantic: 'headline' },
      slug:        { type: 'string',  required: true,  semantic: 'identifier' },
      body:        { type: 'json',    required: true,  semantic: 'articleBody' },
      excerpt:     { type: 'string',  maxLength: 500,  semantic: 'description' },
      featuredImage: { type: 'media', semantic: 'image' },
      tags:        { type: 'array',   items: { type: 'string' }, semantic: 'keywords' },
      category:    { type: 'relation', target: 'category' },
      status:      { type: 'enum',    values: ['draft', 'scheduled', 'published', 'archived'] },
      publishedAt: { type: 'datetime' }
    }
  }));

  // Page — 静态页面
  registerContentType(createContentType('page', {
    label: '页面',
    description: '静态页面，如关于、联系、隐私政策',
    schemaOrg: 'WebPage',
    fields: {
      title:  { type: 'string', required: true, maxLength: 200 },
      slug:   { type: 'string', required: true },
      body:   { type: 'json',   required: true },
      status: { type: 'enum',   values: ['draft', 'scheduled', 'published', 'archived'] },
      order:  { type: 'number' }
    }
  }));

  // Category — 分类
  registerContentType(createContentType('category', {
    label: '分类',
    description: '内容分类（关联文章等）',
    fields: {
      name:        { type: 'string', required: true, maxLength: 100 },
      slug:        { type: 'string', required: true },
      description: { type: 'string', maxLength: 500 },
      parent:      { type: 'relation', target: 'category' }
    }
  }));

  // Media — 媒体文件元数据
  registerContentType(createContentType('media', {
    label: '媒体',
    description: '上传文件的元数据记录',
    schemaOrg: 'MediaObject',
    fields: {
      filename:    { type: 'string', required: true },
      mimeType:    { type: 'string', required: true },
      size:        { type: 'number' },
      url:         { type: 'string', required: true },
      width:       { type: 'number' },
      height:      { type: 'number' },
      altText:     { type: 'string' },
      caption:     { type: 'string' },
      uploadedBy:  { type: 'string' }
    }
  }));

  // Author — 作者/贡献者（未来支持 Agent 作者）
  registerContentType(createContentType('author', {
    label: '作者',
    description: '内容作者——可以是人类也可以是 AI Agent',
    schemaOrg: 'Person',
    fields: {
      name:     { type: 'string', required: true },
      slug:     { type: 'string', required: true },
      bio:      { type: 'string', maxLength: 1000 },
      avatar:   { type: 'media' },
      website:  { type: 'string' },
      email:    { type: 'string' },
      type:     { type: 'enum', values: ['human', 'agent'], default: 'human' }
    }
  }));

  // User — 系统用户（人类管理员/作者）
  registerContentType(createContentType('user', {
    label: '用户',
    description: '系统用户——人类作者、编辑、管理员',
    fields: {
      username: { type: 'string', required: true, maxLength: 50 },
      email:    { type: 'string' },
      password: { type: 'string', required: true }, // 只存哈希
      role:     { type: 'enum', values: ['admin', 'editor', 'author'], default: 'author' }
    }
  }));

  // API Key — Agent 认证密钥
  registerContentType(createContentType('api_key', {
    label: 'API Key',
    description: 'AI Agent 认证密钥（用于 Agent 访问 API）',
    fields: {
      prefix:  { type: 'string', required: true },
      hash:    { type: 'string', required: true },
      label:   { type: 'string' },
      ownerId: { type: 'string', required: true },
      scopes:  { type: 'array', items: { type: 'string' } }
    }
  }));

  // Webhook — 内容变更事件推送
  registerContentType(createContentType('webhook', {
    label: 'Webhook',
    description: '内容变更事件的外部推送端点',
    fields: {
      url:    { type: 'string', required: true },
      events: { type: 'array', items: { type: 'string' } },
      types:  { type: 'array', items: { type: 'string' } },
      secret: { type: 'string', required: true },
      label:  { type: 'string' },
      active: { type: 'boolean' },
      stats:  { type: 'json' }
    }
  }));

  // AuditLog — 操作审计日志（append-only，≥180天）
  registerContentType(createContentType('audit_log', {
    label: '审计日志',
    description: '操作审计日志，满足等保合规要求，保留≥180天',
    fields: {
      actorId:      { type: 'string', required: true },
      actorType:    { type: 'string', required: true },
      action:       { type: 'string', required: true },
      resourceType: { type: 'string' },
      resourceId:   { type: 'string' },
      detail:       { type: 'json' },
      ip:           { type: 'string' }
    }
  }));

  // SiteSettings — 站点全局配置
  registerContentType(createContentType('site_settings', {
    label: '站点配置',
    description: '全局站点配置：站点信息、Hero区块、作者、备案等',
    fields: {
      siteName:        { type: 'string' },
      siteDescription: { type: 'string' },
      icpNumber:       { type: 'string' },
      gonganNumber:    { type: 'string' },
      analyticsId:     { type: 'string' },
      language:        { type: 'string' },
      timezone:        { type: 'string' },
      seoTitle:        { type: 'string' },
      seoDescription:  { type: 'string' },
      seoKeywords:     { type: 'array', items: { type: 'string' } },
      authorName:      { type: 'string' },
      authorTitle:     { type: 'string' },
      authorBio:       { type: 'string' },
      authorAvatar:    { type: 'media' },
      hero_style:      { type: 'string' },
      hero_video_url:  { type: 'string' },
      hero_video_poster: { type: 'string' },
      hero_image_url:  { type: 'string' },
      hero_headline:   { type: 'string' },
      hero_subtitle:   { type: 'string' },
      hero_cta_text:   { type: 'string' },
      hero_cta_link:   { type: 'string' },
      hero_overlay_opacity: { type: 'number' },
      theme:           { type: 'json' }
    }
  }));

  // ReviewPolicy — Agent 内容审核策略
  registerContentType(createContentType('review_policy', {
    label: '审核策略',
    description: 'Agent 生成内容的自动审核策略配置',
    fields: {
      name:          { type: 'string', required: true },
      rules:         { type: 'json' },
      requireHuman:  { type: 'boolean' },
      blockedTerms:  { type: 'array', items: { type: 'string' } },
      active:        { type: 'boolean' }
    }
  }));

  // Revision — 内容版本快照
  registerContentType(createContentType('revision', {
    label: '版本历史',
    description: '文档的版本快照，用于版本管理和回滚',
    fields: {
      docId:      { type: 'string', required: true },
      docType:    { type: 'string' },
      data:       { type: 'json', required: true },
      status:     { type: 'string' },
      meta:       { type: 'json' },
      author:     { type: 'string' },
      authorType: { type: 'string' },
      timestamp:  { type: 'string' }
    }
  }));

  // Navigation — 站点导航菜单
  registerContentType(createContentType('navigation', {
    label: '导航菜单',
    description: '站点前台导航菜单项',
    fields: {
      title:  { type: 'string', required: true },
      url:    { type: 'string', required: true },
      order:  { type: 'number' },
      target: { type: 'string' }
    }
  }));

  // Comment — 文章评论（支持嵌套回复）
  registerContentType(createContentType('comment', {
    label: '评论',
    description: '文章评论，支持审核和嵌套回复',
    schemaOrg: 'Comment',
    fields: {
      postId:   { type: 'relation', target: 'article', required: true },
      author:   { type: 'string', required: true, maxLength: 100 },
      email:    { type: 'string' },
      body:     { type: 'string', required: true, maxLength: 5000 },
      status:   { type: 'enum', values: ['pending', 'approved', 'spam'], default: 'pending' },
      parentId: { type: 'relation', target: 'comment' }
    }
  }));

  // App — 应用/工具展示
  registerContentType(createContentType('app', {
    label: '应用',
    description: '应用或工具展示（Market页面）',
    schemaOrg: 'SoftwareApplication',
    fields: {
      name:        { type: 'string', required: true, maxLength: 100 },
      slug:        { type: 'string', required: true },
      description: { type: 'string', maxLength: 1000 },
      icon:        { type: 'media' },
      cover:       { type: 'media' },
      category:    { type: 'string' },
      url:         { type: 'string' },
      status:      { type: 'enum', values: ['live', 'dev', 'archived'], default: 'live' },
      featured:    { type: 'boolean', default: false },
      order:       { type: 'number' }
    }
  }));

  // Agent — AI Agent/Skill 展示
  registerContentType(createContentType('agent', {
    label: 'Agent',
    description: 'AI Agent 或 Skill 展示',
    fields: {
      name:        { type: 'string', required: true, maxLength: 100 },
      slug:        { type: 'string', required: true },
      description: { type: 'string', maxLength: 1000 },
      icon:        { type: 'media' },
      cover:       { type: 'media' },
      category:    { type: 'string' },
      type:        { type: 'string' },
      package_url: { type: 'string' },
      status:      { type: 'enum', values: ['live', 'dev', 'archived'], default: 'live' },
      featured:    { type: 'boolean', default: false },
      order:       { type: 'number' }
    }
  }));

  console.log(`  Bootstrap: 16 content types registered`);
}

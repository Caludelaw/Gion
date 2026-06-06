/**
 * Content Type — 内容类型的 Schema 定义
 *
 * 类比 WordPress 的 post_type，但：
 *   - 字段是强类型的（string / number / boolean / relation / media / json）
 *   - 内置 semantic layer（schema.org 映射）
 *   - 支持字段验证规则
 *   - Agent 可遍历的元数据
 *
 * 使用示例：
 *   const Article = createContentType('article', {
 *     label: '文章',
 *     description: '博客文章内容类型',
 *     schemaOrg: 'Article',
 *     fields: {
 *       title:       { type: 'string', required: true, maxLength: 200 },
 *       slug:        { type: 'string', required: true, pattern: /^[a-z0-9-]+$/ },
 *       body:        { type: 'json', required: true },
 *       excerpt:     { type: 'string', maxLength: 500 },
 *       featuredImage: { type: 'media' },
 *       tags:        { type: 'array', items: { type: 'string' } },
 *       category:    { type: 'relation', target: 'category' },
 *       status:      { type: 'enum', values: ['draft', 'published', 'archived'] },
 *       publishedAt: { type: 'datetime' }
 *     }
 *   });
 */

import { ValidationError } from './errors.js';

const VALID_FIELD_TYPES = [
  'string', 'number', 'boolean',
  'json', 'array', 'enum',
  'datetime', 'media', 'relation'
];

/**
 * @param {string} name — 内容类型标识符，如 'article', 'category', 'page'
 * @param {object} definition
 * @param {string} definition.label — 人类可读名称
 * @param {string} [definition.description]
 * @param {string} [definition.schemaOrg] — schema.org 类型映射，如 'Article', 'Product'
 * @param {Record<string, FieldDef>} definition.fields
 * @returns {ContentType}
 */
export function createContentType(name, definition) {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Content type name is required and must be a string');
  }
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new ValidationError(`Invalid content type name: "${name}". Must be lowercase, start with a letter, and contain only letters, numbers, and underscores.`);
  }
  if (!definition || !definition.fields) {
    throw new ValidationError(`Content type "${name}" must define at least one field`);
  }

  const fields = {};
  const requiredFields = [];

  for (const [fieldName, fieldDef] of Object.entries(definition.fields)) {
    const def = normalizeFieldDef(fieldName, fieldDef);
    fields[fieldName] = def;
    if (def.required) requiredFields.push(fieldName);
  }

  const ct = {
    name,
    label: definition.label || name,
    description: definition.description || '',
    schemaOrg: definition.schemaOrg || null,
    fields,
    requiredFields,
    features: definition.features || {},

    /**
     * Validate a document against this content type's schema.
     * Returns { valid: true } or { valid: false, errors: [...] }
     */
    validate(doc) {
      const errors = [];
      if (!doc || typeof doc !== 'object') {
        return { valid: false, errors: ['Document must be an object'] };
      }

      for (const fieldName of requiredFields) {
        if (doc[fieldName] === undefined || doc[fieldName] === null || doc[fieldName] === '') {
          errors.push(`Field "${fieldName}" is required`);
        }
      }

      for (const [fieldName, value] of Object.entries(doc)) {
        const fieldDef = fields[fieldName];
        if (!fieldDef) {
          // Unknown fields are silently accepted (extensibility)
          continue;
        }
        const fieldErrors = validateField(fieldName, value, fieldDef);
        errors.push(...fieldErrors);
      }

      return errors.length === 0
        ? { valid: true }
        : { valid: false, errors };
    },

    /**
     * Return a JSON Schema representation of this content type.
     * Useful for API documentation and OpenAPI generation.
     */
    toJSONSchema() {
      const properties = {};
      const required = [...requiredFields];

      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        properties[fieldName] = fieldToJSONSchema(fieldDef);
      }

      return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: this.label,
        description: this.description,
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }
  };

  // Freeze to prevent runtime mutations
  return Object.freeze(ct);
}

function normalizeFieldDef(name, raw) {
  if (typeof raw === 'string') {
    return { type: raw, required: false, label: name };
  }

  const type = raw.type || 'string';
  if (!VALID_FIELD_TYPES.includes(type)) {
    throw new ValidationError(
      `Field "${name}": invalid type "${type}". Valid types: ${VALID_FIELD_TYPES.join(', ')}`
    );
  }

  return {
    type,
    required: raw.required || false,
    label: raw.label || name,
    description: raw.description || '',
    default: raw.default,
    maxLength: raw.maxLength,
    pattern: raw.pattern ? raw.pattern.source : undefined,
    values: raw.values,          // for enum
    items: raw.items || null,    // for array
    target: raw.target || null,  // for relation
    indexed: raw.indexed !== false, // default indexed
    semantic: raw.semantic || null  // schema.org property mapping
  };
}

function validateField(fieldName, value, fieldDef) {
  const errors = [];

  if (value === undefined || value === null) {
    if (fieldDef.required) {
      errors.push(`Field "${fieldName}" is required`);
    }
    return errors;
  }

  switch (fieldDef.type) {
    case 'string':
      if (typeof value !== 'string') errors.push(`Field "${fieldName}" must be a string`);
      else if (fieldDef.maxLength && value.length > fieldDef.maxLength) {
        errors.push(`Field "${fieldName}" exceeds max length of ${fieldDef.maxLength}`);
      }
      break;
    case 'number':
      if (typeof value !== 'number') errors.push(`Field "${fieldName}" must be a number`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`Field "${fieldName}" must be a boolean`);
      break;
    case 'enum':
      if (!fieldDef.values.includes(value)) {
        errors.push(`Field "${fieldName}" must be one of: ${fieldDef.values.join(', ')}`);
      }
      break;
    case 'array':
      if (!Array.isArray(value)) errors.push(`Field "${fieldName}" must be an array`);
      break;
    case 'json':
      // Accept any valid JSON-serializable value
      break;
    case 'datetime':
      if (typeof value !== 'string' || isNaN(Date.parse(value))) {
        errors.push(`Field "${fieldName}" must be a valid datetime string`);
      }
      break;
    case 'media':
      // Media can be a string (id) or object (with url, alt, etc.)
      if (typeof value !== 'string' && typeof value !== 'object') {
        errors.push(`Field "${fieldName}" must be a media reference`);
      }
      break;
    case 'relation':
      // Relation can be a string (id) or array of strings
      if (typeof value !== 'string' && !Array.isArray(value)) {
        errors.push(`Field "${fieldName}" must be a relation reference`);
      }
      break;
  }

  return errors;
}

function fieldToJSONSchema(fieldDef) {
  const base = { title: fieldDef.label, description: fieldDef.description };

  switch (fieldDef.type) {
    case 'string':   return { ...base, type: 'string', maxLength: fieldDef.maxLength };
    case 'number':   return { ...base, type: 'number' };
    case 'boolean':  return { ...base, type: 'boolean' };
    case 'enum':     return { ...base, type: 'string', enum: fieldDef.values };
    case 'array':    return { ...base, type: 'array', items: fieldDef.items || { type: 'string' } };
    case 'json':     return { ...base };  // free-form
    case 'datetime': return { ...base, type: 'string', format: 'date-time' };
    case 'media':    return { ...base, oneOf: [{ type: 'string' }, { type: 'object' }] };
    case 'relation': return { ...base, oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] };
    default:         return base;
  }
}

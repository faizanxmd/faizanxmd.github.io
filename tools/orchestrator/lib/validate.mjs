// Minimal JSON-schema checker: supports type, required, properties, items,
// enum. Enough for the v1 schemas; the same schema files are also passed
// verbatim to the executor CLI's --json-schema flag.

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

export function validate(schema, value, path = '$') {
  const errors = [];
  if (schema.type) {
    const actual = typeOf(value);
    const ok = schema.type === actual || (schema.type === 'number' && actual === 'integer');
    if (!ok) {
      errors.push(`${path}: expected ${schema.type}, got ${actual}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value ${JSON.stringify(value)} not in enum [${schema.enum.join(', ')}]`);
  }
  if (schema.type === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required property "${key}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validate(sub, value[key], `${path}.${key}`));
    }
  }
  if (schema.type === 'array' && schema.items) {
    value.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
  }
  return errors;
}

export function assertValid(schema, value, label) {
  const errors = validate(schema, value);
  if (errors.length > 0) {
    throw new Error(`${label} failed validation:\n  ${errors.join('\n  ')}`);
  }
}

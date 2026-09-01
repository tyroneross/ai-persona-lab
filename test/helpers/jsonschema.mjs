/**
 * A tiny draft-07 JSON Schema SUBSET validator, written by hand because this
 * package is deliberately zero-dependency (see package.json and the header
 * of lib/library.mjs) and cannot pull in ajv just to test that the encounter
 * schema and the encounter writer still agree with each other.
 *
 * It implements only the keywords this repo's schemas actually use: type,
 * required, properties, additionalProperties, enum, const, items (single-
 * schema form), and minItems. A handful of annotation-only keywords
 * ($schema, $id, title, description, format, default, examples) are
 * recognised and deliberately ignored, since they carry no validation rule.
 *
 * Every other keyword makes validate() THROW, naming the keyword and the
 * schema path it appeared at, instead of silently passing it through. A
 * subset validator that quietly skips an unknown keyword (pattern,
 * minLength, oneOf, ...) would let a future schema edit go untested while
 * this suite still reports green — the throw is what turns "we forgot to
 * extend the validator" into a loud test failure instead of a false pass.
 */

const IMPLEMENTED_KEYWORDS = new Set([
  "type",
  "required",
  "properties",
  "additionalProperties",
  "enum",
  "const",
  "items",
  "minItems",
]);

const IGNORED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "title",
  "description",
  "format",
  "default",
  "examples",
]);

function assertKnownKeywords(schema, schemaPath) {
  for (const key of Object.keys(schema)) {
    if (IMPLEMENTED_KEYWORDS.has(key) || IGNORED_KEYWORDS.has(key)) continue;
    throw new Error(`unsupported JSON Schema keyword "${key}" at ${schemaPath || "(root)"}`);
  }
}

function matchesType(value, type) {
  switch (type) {
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "null":
      return value === null;
    default:
      throw new Error(`unsupported JSON Schema type "${type}"`);
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

/**
 * Walk the whole schema up front, independent of any instance. Checking
 * keywords only as traversal reaches them would make the guarantee above
 * depend on the test data: a `pattern` added to an optional property would
 * stay unnoticed until some instance happened to carry that property. The
 * schema is small, so scan all of it every time and keep the promise absolute.
 */
function assertSchemaSupported(schema, schemaPath) {
  assertKnownKeywords(schema, schemaPath);
  for (const [key, subschema] of Object.entries(schema.properties || {})) {
    assertSchemaSupported(subschema, `${schemaPath}/properties/${key}`);
  }
  if (schema.items) assertSchemaSupported(schema.items, `${schemaPath}/items`);
}

function validateNode(schema, value, instancePath, schemaPath, errors) {
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${instancePath || "/"}: value ${JSON.stringify(value)} is not of type ${types.join(" or ")}`);
    }
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push(`${instancePath || "/"}: value ${JSON.stringify(value)} does not equal const ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum !== undefined && !schema.enum.some((e) => deepEqual(e, value))) {
    errors.push(`${instancePath || "/"}: value ${JSON.stringify(value)} is not in enum ${JSON.stringify(schema.enum)}`);
  }

  const isPlainObject = value !== null && typeof value === "object" && !Array.isArray(value);
  if (isPlainObject) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) errors.push(`${instancePath}/${key}: required property missing`);
      }
    }
    if (schema.properties) {
      for (const [key, subschema] of Object.entries(schema.properties)) {
        if (key in value) {
          validateNode(subschema, value[key], `${instancePath}/${key}`, `${schemaPath}/properties/${key}`, errors);
        }
      }
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) {
        if (!known.has(key)) errors.push(`${instancePath}/${key}: additional property not allowed`);
      }
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${instancePath || "/"}: array has ${value.length} items, fewer than minItems ${schema.minItems}`);
    }
    if (schema.items) {
      value.forEach((item, i) => {
        validateNode(schema.items, item, `${instancePath}/${i}`, `${schemaPath}/items`, errors);
      });
    }
  }
}

/** Validate `instance` against `schema`. Returns { ok, errors }. Throws on an unrecognised schema keyword. */
export function validate(schema, instance) {
  assertSchemaSupported(schema, "");
  const errors = [];
  validateNode(schema, instance, "", "", errors);
  return { ok: errors.length === 0, errors };
}

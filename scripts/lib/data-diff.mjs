const VOLATILE_KEYS = new Set(["generatedAt", "checkedAt"]);

function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (VOLATILE_KEYS.has(key)) continue;
      out[key] = stripVolatile(val);
    }
    return out;
  }
  return value;
}

export function hasSubstantiveChange(previous, next) {
  return JSON.stringify(stripVolatile(previous)) !== JSON.stringify(stripVolatile(next));
}

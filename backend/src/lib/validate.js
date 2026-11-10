/**
 * Kleiner Validierungs-Helfer für API-Endpunkte.
 *
 * Zwei Ebenen:
 *  - `validate(body, schema)` prüft ein ganzes Request-Body-Objekt und liefert
 *    `{ value, errors }` (nur Felder, die im Body vorhanden sind, landen in `value`).
 *  - Einzel-Helfer (`toText`, `toNumber`, `toInt`, `toBool`, `toDate`, `toEnum`)
 *    für Listen/Bulk-Payloads.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function toText(value, { maxLength, minLength } = {}) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (str === '') return null;
  if (minLength && str.length < minLength) return null;
  return maxLength ? str.slice(0, maxLength) : str;
}

function toNumber(value, { min, max } = {}) {
  if (isBlank(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (min !== undefined && n < min) return null;
  if (max !== undefined && n > max) return null;
  return n;
}

function toInt(value, { min, max, defaultValue = null } = {}) {
  if (isBlank(value)) return defaultValue;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return defaultValue;
  if (min !== undefined && n < min) return defaultValue === null ? min : defaultValue;
  if (max !== undefined && n > max) return defaultValue === null ? max : defaultValue;
  return n;
}

function toBool(value, { defaultValue = false } = {}) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const str = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'ja', 'an'].includes(str)) return true;
  if (['false', '0', 'no', 'nein', 'aus', 'off'].includes(str)) return false;
  return defaultValue;
}

function toDate(value) {
  if (isBlank(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toEnum(value, values, defaultValue = null) {
  const allowed = values instanceof Set ? values : new Set(values || []);
  if (isBlank(value)) return defaultValue;
  const str = String(value).trim();
  return allowed.has(str) ? str : defaultValue;
}

/**
 * Prüft ein Request-Body-Objekt gegen ein Schema.
 *
 * Regel-Optionen: type ('string' | 'number' | 'integer' | 'boolean' | 'date' | 'email' | 'enum'),
 * required, nullable (Default true), label, values (enum), min/max, minLength/maxLength,
 * pattern, default.
 *
 * Optionen: `applyDefaults` (Default true) — bei false werden `default`-Werte nicht
 * gesetzt (für PUT-Requests, damit fehlende Felder unverändert bleiben).
 *
 * @returns {{ value: object, errors: string[] }}
 */
function validate(body = {}, schema = {}, options = {}) {
  const applyDefaults = options.applyDefaults !== false;
  const value = {};
  const errors = [];

  for (const [field, rule] of Object.entries(schema)) {
    const label = rule.label || field;
    const raw = body[field];

    if (raw === undefined) {
      if (rule.required) {
        errors.push(`${label} ist erforderlich`);
      } else if (applyDefaults && rule.default !== undefined) {
        value[field] = rule.default;
      }
      continue;
    }

    if (rule.type === 'boolean') {
      value[field] = toBool(raw, { defaultValue: rule.default ?? false });
      continue;
    }

    if (isBlank(raw)) {
      if (rule.required) {
        errors.push(`${label} ist erforderlich`);
        continue;
      }
      if (rule.nullable === false) {
        errors.push(`${label} darf nicht leer sein`);
        continue;
      }
      value[field] = null;
      continue;
    }

    switch (rule.type) {
      case 'number':
      case 'integer': {
        const n = rule.type === 'integer' ? Math.round(Number(raw)) : Number(raw);
        if (!Number.isFinite(n)) {
          errors.push(`${label} muss eine Zahl sein`);
        } else if (rule.min !== undefined && n < rule.min) {
          errors.push(`${label} muss mindestens ${rule.min} sein`);
        } else if (rule.max !== undefined && n > rule.max) {
          errors.push(`${label} darf höchstens ${rule.max} sein`);
        } else {
          value[field] = n;
        }
        break;
      }
      case 'date': {
        const d = toDate(raw);
        if (!d) errors.push(`${label} ist kein gültiges Datum`);
        else value[field] = d;
        break;
      }
      case 'email': {
        const str = String(raw).trim();
        if (!EMAIL_RE.test(str)) errors.push(`${label} ist keine gültige E-Mail-Adresse`);
        else value[field] = rule.maxLength ? str.slice(0, rule.maxLength) : str;
        break;
      }
      case 'enum': {
        const str = toEnum(raw, rule.values);
        if (str === null) errors.push(`${label} hat einen ungültigen Wert`);
        else value[field] = str;
        break;
      }
      case 'string':
      default: {
        const str = String(raw).trim();
        if (rule.minLength && str.length < rule.minLength) {
          errors.push(`${label} muss mindestens ${rule.minLength} Zeichen haben`);
        } else if (rule.maxLength && str.length > rule.maxLength) {
          errors.push(`${label} darf höchstens ${rule.maxLength} Zeichen haben`);
        } else if (rule.pattern && !rule.pattern.test(str)) {
          errors.push(`${label} hat ein ungültiges Format`);
        } else {
          value[field] = str;
        }
        break;
      }
    }
  }

  return { value, errors };
}

/**
 * Schreibt eine 400-Antwort, wenn Fehler vorliegen.
 * @returns {boolean} true, wenn bereits geantwortet wurde
 */
function sendInvalid(res, errors) {
  if (!Array.isArray(errors) || errors.length === 0) return false;
  res.status(400).json({ error: errors[0], errors });
  return true;
}

module.exports = {
  EMAIL_RE,
  isBlank,
  toText,
  toNumber,
  toInt,
  toBool,
  toDate,
  toEnum,
  validate,
  sendInvalid,
};

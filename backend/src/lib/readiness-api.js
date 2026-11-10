/**
 * lib/readiness-api.js
 * Client for the external KI-Readiness platform (ponturo / pon2ai).
 *
 * Required env (backend/.env):
 *   READINESS_API_URL    Base URL, e.g. https://readiness.example.com/api
 *   READINESS_API_TOKEN  Bearer token
 * Optional:
 *   READINESS_API_PATH        Assessment endpoint path (default: /assessments)
 *   READINESS_API_TIMEOUT_MS  Request timeout in ms (default: 30000)
 *
 * Request: POST {URL}{PATH}
 *   Authorization: Bearer <token>
 *   { "company": { "name", "segment", "bundesland", "employees", "package", "notes" } }
 *
 * Expected response (dimensions nested in "dimensions" or flat at top level,
 * optionally wrapped in "data"):
 *   {
 *     "dimensions": { "dataAvailability": 0-5, ... },
 *     "totalScore": 0-5,
 *     "findings": "...",
 *     "recommendations": "...",
 *     "useCases": [{ "title", "description", "priority", "type",
 *                    "feasibility", "estimatedValue", "basis" }]
 *   }
 */

const DIMENSION_KEYS = [
  'dataAvailability',
  'techStack',
  'processMaturity',
  'aiCompetency',
  'governance',
  'strategy',
];

class ReadinessApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'ReadinessApiError';
    this.status = status;
  }
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildPayload(target) {
  return {
    company: {
      name: target.companyName,
      segment: target.segment,
      bundesland: target.bundesland || null,
      employees: target.numberOfEmployees ?? null,
      package: target.package || null,
      notes: target.notes || null,
    },
  };
}

function normalizeUseCase(uc) {
  if (!uc || !uc.title) return null;
  return {
    title: String(uc.title),
    description: uc.description ? String(uc.description) : null,
    priority: uc.priority || 'medium',
    type: uc.type || 'implementierung',
    feasibility: uc.feasibility || null,
    estimatedValue: toNumber(uc.estimatedValue),
    basis: uc.basis || null,
  };
}

function normalizeResult(raw) {
  const body =
    raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
      ? raw.data
      : raw;

  const source =
    body.dimensions && typeof body.dimensions === 'object' ? body.dimensions : body;

  const dimensions = {};
  for (const key of DIMENSION_KEYS) dimensions[key] = toNumber(source[key]);

  const available = DIMENSION_KEYS.map((k) => dimensions[k]).filter((v) => v !== null);
  const totalScore =
    toNumber(body.totalScore) ??
    (available.length
      ? available.reduce((a, b) => a + b, 0) / available.length
      : null);

  return {
    ...dimensions,
    totalScore,
    findings: body.findings ? String(body.findings) : null,
    recommendations: body.recommendations ? String(body.recommendations) : null,
    useCases: Array.isArray(body.useCases)
      ? body.useCases.map(normalizeUseCase).filter(Boolean)
      : [],
  };
}

async function runReadinessAssessment(target) {
  const baseUrl = (process.env.READINESS_API_URL || '').replace(/\/+$/, '');
  const token = process.env.READINESS_API_TOKEN || '';

  if (!baseUrl || !token) {
    throw new ReadinessApiError(
      'KI-Readiness-Plattform ist nicht konfiguriert (READINESS_API_URL / READINESS_API_TOKEN fehlen).',
      503
    );
  }

  const path = process.env.READINESS_API_PATH || '/assessments';
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = Number(process.env.READINESS_API_TIMEOUT_MS) || 30000;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(buildPayload(target)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ReadinessApiError(
        `KI-Readiness-Plattform hat nicht innerhalb von ${timeoutMs} ms geantwortet.`,
        504
      );
    }
    throw new ReadinessApiError(
      `KI-Readiness-Plattform nicht erreichbar: ${err.message}`,
      502
    );
  }

  const text = await res.text();
  let raw;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    throw new ReadinessApiError(
      `KI-Readiness-Plattform lieferte kein gültiges JSON (HTTP ${res.status}).`,
      502
    );
  }

  if (!res.ok) {
    const msg =
      raw?.error?.message || raw?.message || raw?.error || `HTTP ${res.status}`;
    throw new ReadinessApiError(
      `KI-Readiness-Plattform meldet Fehler: ${msg}`,
      502
    );
  }

  if (!raw || typeof raw !== 'object') {
    throw new ReadinessApiError(
      'KI-Readiness-Plattform lieferte eine leere Antwort.',
      502
    );
  }

  return normalizeResult(raw);
}

module.exports = { runReadinessAssessment, ReadinessApiError, DIMENSION_KEYS };

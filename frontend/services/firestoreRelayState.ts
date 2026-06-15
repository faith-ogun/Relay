type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDoc = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

type RelayFirestoreConfig = {
  apiKey?: string;
  projectId?: string;
};

const FALLBACK_PROJECT_ID = import.meta.env.VITE_RELAY_GCP_PROJECT_ID;
const FIREBASE_PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID || FALLBACK_PROJECT_ID || '').trim();
const FIREBASE_API_KEY = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const toFirestoreValue = (value: unknown): FirestoreValue => {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (Number.isFinite(value) && Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: Number.isFinite(value) ? value : 0 };
  }
  if (isPlainObject(value)) {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      fields[key] = toFirestoreValue(nested);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
};

const fromFirestoreValue = (value: FirestoreValue | undefined): unknown => {
  if (!value) return undefined;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) {
    const values = value.arrayValue.values || [];
    return values.map((item) => fromFirestoreValue(item));
  }
  if ('mapValue' in value) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value.mapValue.fields || {})) {
      out[key] = fromFirestoreValue(nested);
    }
    return out;
  }
  return undefined;
};

const toFirestoreFields = (value: Record<string, unknown>): Record<string, FirestoreValue> => {
  const out: Record<string, FirestoreValue> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = toFirestoreValue(item);
  }
  return out;
};

const fromFirestoreFields = (fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> => {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = fromFirestoreValue(value);
  }
  return out;
};

const resolveConfig = (override?: RelayFirestoreConfig) => {
  const projectId = (override?.projectId || FIREBASE_PROJECT_ID || '').trim();
  const apiKey = (override?.apiKey || FIREBASE_API_KEY || '').trim();
  return { projectId, apiKey, enabled: Boolean(projectId && apiKey) };
};

const makeUrl = (userId: string, cfg: ReturnType<typeof resolveConfig>) =>
  `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/relay_state/${encodeURIComponent(userId)}?key=${encodeURIComponent(cfg.apiKey)}`;

export const isFirestoreConfigured = (override?: RelayFirestoreConfig) => resolveConfig(override).enabled;

export async function loadRelayState<T extends Record<string, unknown>>(
  userId: string,
  override?: RelayFirestoreConfig
): Promise<T | null> {
  const cfg = resolveConfig(override);
  if (!cfg.enabled) return null;

  const response = await fetch(makeUrl(userId, cfg), { method: 'GET' });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firestore load failed (${response.status}): ${body}`);
  }
  const doc = (await response.json()) as FirestoreDoc;
  const parsed = fromFirestoreFields(doc.fields) as T;
  return parsed;
}

export async function saveRelayState<T extends Record<string, unknown>>(
  userId: string,
  state: T,
  override?: RelayFirestoreConfig
): Promise<void> {
  const cfg = resolveConfig(override);
  if (!cfg.enabled) return;

  const payload: FirestoreDoc = { fields: toFirestoreFields(state) };
  const response = await fetch(makeUrl(userId, cfg), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firestore save failed (${response.status}): ${body}`);
  }
}


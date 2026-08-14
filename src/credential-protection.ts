/** Credential storage and redaction for the OpenClaw product boundary. */

export const MASKED_CREDENTIAL = "***masked***";

const SENSITIVE_KEY = /(?:^|[_\-.])(?:api[_-]?key|authorization|bearer|cookie|credential|password|private[_-]?key|secret|seed|signature|token)(?:$|[_\-.])/i;
const AEP_KEY = /\baep_(?:dev|agent|provider|verifier|settlement)_[A-Za-z0-9._~-]+/g;
const AUTHORIZATION = /\b(authorization\s*[:=]\s*)(?:bearer|basic)\s+[^\s,;]+/gi;
const AUTH_SCHEME = /\b((?:bearer|basic)\s+)[A-Za-z0-9._~+/=-]+/gi;
const PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
const SECRET_ASSIGNMENT = /\b([A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY)\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEY.test(key)) return true;
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ").toLowerCase().split(" ").filter(Boolean);
  return words.some((word) => [
    "authorization", "bearer", "cookie", "credential", "password", "secret", "seed",
    "signature", "token",
  ].includes(word)) || words.some((word, index) =>
    (word === "api" || word === "private") && words[index + 1] === "key");
}

export class SecretValue {
  readonly #value: string;

  constructor(value: string) {
    const normalized = value.trim();
    if (!normalized) throw new Error("AEP_API_KEY is required");
    this.#value = normalized;
    Object.freeze(this);
  }

  revealForTransport(): string {
    return this.#value;
  }

  toString(): string {
    return MASKED_CREDENTIAL;
  }

  toJSON(): string {
    return MASKED_CREDENTIAL;
  }
}

export function redactText(value: string, knownSecrets: readonly string[] = []): string {
  let redacted = value;
  const secrets = [...new Set(knownSecrets.filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  for (const secret of secrets) redacted = redacted.split(secret).join(MASKED_CREDENTIAL);
  return redacted
    .replace(PRIVATE_KEY, MASKED_CREDENTIAL)
    .replace(AUTHORIZATION, `$1${MASKED_CREDENTIAL}`)
    .replace(AUTH_SCHEME, `$1${MASKED_CREDENTIAL}`)
    .replace(AEP_KEY, MASKED_CREDENTIAL)
    .replace(SECRET_ASSIGNMENT, `$1${MASKED_CREDENTIAL}`);
}

export function redactValue(
  value: unknown,
  options: { key?: string; knownSecrets?: readonly string[]; depth?: number } = {},
): unknown {
  const { key = "", knownSecrets = [], depth = 0 } = options;
  if (key && isSensitiveKey(key)) return MASKED_CREDENTIAL;
  if (depth >= 8) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) =>
      redactValue(item, { knownSecrets, depth: depth + 1 }));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([itemKey, item]) => [
      itemKey,
      redactValue(item, { key: itemKey, knownSecrets, depth: depth + 1 }),
    ]));
  }
  if (typeof value === "string") return redactText(value, knownSecrets);
  return value;
}

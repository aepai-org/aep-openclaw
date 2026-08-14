­r‡^Ñf¥–Ø¦{N,yÊ'vÃ®¶›­export const HTTPS_REQUIRED = "HTTPS_REQUIRED" as const;

export type CredentialTransportOptions = {
  allowInsecureLocalhost?: boolean;
};

export class CredentialTransportError extends Error {
  readonly code = HTTPS_REQUIRED;

  constructor() {
    super(
      `${HTTPS_REQUIRED}: Developer API credentials require HTTPS; ` +
        "loopback HTTP is allowed only with allowInsecureLocalhost=true",
    );
    this.name = "CredentialTransportError";
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "::1" || normalized === "[::1]") {
    return true;
  }
  const octets = normalized.split(".");
  return (
    octets.length === 4 &&
    octets[0] === "127" &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  );
}

export function validateCredentialTransportUrl(
  value: string,
  options: CredentialTransportOptions = {},
): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("AEP base URL must be an absolute HTTP(S) URL");
  }
  if (parsed.username || parsed.password) {
    throw new Error("AEP base URL must not contain credentials");
  }
  if (parsed.protocol === "https:") return parsed;
  if (
    parsed.protocol === "http:" &&
    options.allowInsecureLocalhost === true &&
    isLoopbackHostname(parsed.hostname)
  ) {
    return parsed;
  }
  if (parsed.protocol === "http:") throw new CredentialTransportError();
  throw new Error("AEP base URL must use HTTPS");
}

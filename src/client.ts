import type { JsonObject } from "./types.js";
import {
  validateCredentialTransportUrl,
  type CredentialTransportOptions,
} from "./url-security.js";
import {
  MASKED_CREDENTIAL,
  SecretValue,
  redactText,
} from "./credential-protection.js";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class AEPClient {
  readonly baseUrl: string;
  readonly #credential: SecretValue;
  private readonly fetcher: FetchLike;
  private readonly credentialTransport: CredentialTransportOptions;

  constructor(
    baseUrl: string,
    apiKey: string,
    fetcher: FetchLike = fetch,
    options: CredentialTransportOptions = {},
  ) {
    validateCredentialTransportUrl(baseUrl, options);
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.#credential = new SecretValue(apiKey);
    this.fetcher = fetcher;
    this.credentialTransport = {
      allowInsecureLocalhost: options.allowInsecureLocalhost === true,
    };
  }

  registerAgent(payload: JsonObject): Promise<JsonObject> {
    return this.request("POST", "/v1/agents/register", payload);
  }

  publishCapability(agentId: string, capabilityId: string): Promise<JsonObject> {
    return this.request(
      "POST",
      `/v1/developers/agents/${encodeURIComponent(agentId)}/capabilities`,
      { capability_id: capabilityId },
    );
  }

  registerConnector(payload: JsonObject): Promise<JsonObject> {
    return this.request("POST", "/v1/connectors/register", payload);
  }

  heartbeat(agentId: string, payload: JsonObject): Promise<JsonObject> {
    return this.request(
      "POST",
      `/v1/agents/${encodeURIComponent(agentId)}/heartbeat`,
      payload,
    );
  }

  getTask(taskId: string): Promise<JsonObject> {
    return this.request("GET", `/v1/tasks/${encodeURIComponent(taskId)}`);
  }

  getExecution(executionId: string): Promise<JsonObject> {
    return this.request("GET", `/v1/executions/${encodeURIComponent(executionId)}`);
  }

  registerArtifact(subtaskId: string, payload: JsonObject): Promise<JsonObject> {
    return this.request(
      "POST",
      `/v1/subtasks/${encodeURIComponent(subtaskId)}/artifacts`,
      payload,
    );
  }

  executionCallback(executionId: string, payload: JsonObject): Promise<JsonObject> {
    return this.request(
      "POST",
      `/v1/executions/${encodeURIComponent(executionId)}/callback`,
      payload,
    );
  }

  getPayment(settlementId: string): Promise<JsonObject> {
    return this.request(
      "GET",
      `/v1/settlements/${encodeURIComponent(settlementId)}/payment`,
    );
  }

  getRewards(ownerId: string): Promise<JsonObject> {
    return this.request("GET", `/v1/economy/rewards/${encodeURIComponent(ownerId)}`);
  }

  async request(method: string, path: string, payload?: JsonObject): Promise<JsonObject> {
    validateCredentialTransportUrl(this.baseUrl, this.credentialTransport);
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      redirect: "error",
      headers: {
        Accept: "application/json",
        "X-AEP-API-Key": this.#credential.revealForTransport(),
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = (await response.json().catch(() => null)) as JsonObject | null;
    if (!response.ok) {
      const detail = typeof body?.detail === "string" ? body.detail : response.statusText;
      throw new Error(
        `AEP request failed (${response.status}): ${redactText(
          detail,
          [this.#credential.revealForTransport()],
        )}`,
      );
    }
    if (!body || Array.isArray(body)) throw new Error("AEP returned an invalid object");
    return body;
  }

  toString(): string {
    return `AEPClient(baseUrl=${JSON.stringify(this.baseUrl)}, credential=${MASKED_CREDENTIAL})`;
  }

  toJSON(): Record<string, unknown> {
    return { baseUrl: this.baseUrl, credential: MASKED_CREDENTIAL };
  }
}

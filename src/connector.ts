≠rá^—f•ñÿ¶{N,y 'v√Æ∂õ≠import { AEPClient } from "./client.js";
import { resultToArtifact, taskToOpenClaw } from "./mapping.js";
import type {
  AEPTask,
  JsonObject,
  OpenClawBinding,
  OpenClawConnectInput,
  OpenClawResult,
} from "./types.js";

function stringField(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${name} is missing`);
  return value;
}

export async function connectOpenClaw(
  input: OpenClawConnectInput,
  client: AEPClient,
): Promise<OpenClawBinding> {
  if (!input.capabilities.length) throw new Error("At least one Capability is required");
  const capabilityIds = [...new Set(input.capabilities.map((item) => item.capabilityId))];
  const registration = await client.registerAgent({
    name: input.displayName,
    description: input.description,
    endpoint: input.endpoint,
    protocolVersion: input.protocolVersion,
    capabilities: capabilityIds,
  });
  const agentId = stringField(registration.id, "Agent ID");
  const connector = await client.registerConnector({
    agent_id: agentId,
    connector_type: "OPENCLAW",
    runtime_name: `OpenClaw:${input.runtimeAgentId}`,
    endpoint_url: input.endpoint,
    configuration: {
      protocol_version: input.protocolVersion,
      runtime_agent_id: input.runtimeAgentId,
    },
    capability_mappings: input.capabilities.map((item) => ({
      external_capability: item.externalCapability,
      capability_id: item.capabilityId,
    })),
  });
  const sessions = Array.isArray(connector.sessions) ? connector.sessions : [];
  const firstSession = sessions[0] as JsonObject | undefined;
  const heartbeat = await client.heartbeat(agentId, {
    status: input.currentLoad >= input.maxConcurrency ? "BUSY" : "AVAILABLE",
    health_status: "HEALTHY",
    current_load: input.currentLoad,
    max_concurrency: input.maxConcurrency,
    timestamp: new Date().toISOString(),
    metadata: { connector: "OPENCLAW" },
  });
  return {
    agentId,
    connectorId: stringField(connector.id, "Connector ID"),
    connectorSessionId: stringField(firstSession?.id, "Connector Session ID"),
    registrationStatus: stringField(registration.status, "Registration status"),
    runtimeStatus: stringField(heartbeat.status, "Runtime status"),
    capabilities: input.capabilities,
  };
}

export async function syncCapabilities(
  client: AEPClient,
  agentId: string,
  capabilityIds: string[],
): Promise<JsonObject[]> {
  const output: JsonObject[] = [];
  for (const capabilityId of [...new Set(capabilityIds)]) {
    output.push(await client.publishCapability(agentId, capabilityId));
  }
  return output;
}

export async function sendHeartbeat(
  client: AEPClient,
  agentId: string,
  currentLoad: number,
  maxConcurrency: number,
): Promise<JsonObject> {
  return client.heartbeat(agentId, {
    status: currentLoad >= maxConcurrency ? "BUSY" : "AVAILABLE",
    health_status: "HEALTHY",
    current_load: currentLoad,
    max_concurrency: maxConcurrency,
    timestamp: new Date().toISOString(),
    metadata: { connector: "OPENCLAW" },
  });
}

export { taskToOpenClaw };

export async function submitOpenClawResult(
  client: AEPClient,
  subtaskId: string,
  executionId: string,
  result: OpenClawResult,
): Promise<{ artifact: JsonObject; execution: JsonObject }> {
  const artifact = await client.registerArtifact(subtaskId, resultToArtifact(result));
  const artifactId = stringField(artifact.id, "Artifact ID");
  const execution = await client.executionCallback(executionId, {
    status: "COMPLETED",
    result_artifact_id: artifactId,
  });
  return { artifact, execution };
}

export function mapAepTask(task: AEPTask) {
  return taskToOpenClaw(task);
}

≠rá^—f•ñÿ¶{N,y 'v√Æ∂õ≠export type JsonObject = Record<string, unknown>;

export type CapabilityBinding = {
  externalCapability: string;
  capabilityId: string;
};

export type OpenClawConnectInput = {
  baseUrl: string;
  runtimeAgentId: string;
  displayName: string;
  description: string;
  endpoint: string;
  protocolVersion: string;
  capabilities: CapabilityBinding[];
  currentLoad: number;
  maxConcurrency: number;
  allowInsecureLocalhost?: boolean;
};

export type OpenClawBinding = {
  agentId: string;
  connectorId: string;
  connectorSessionId: string;
  registrationStatus: string;
  runtimeStatus: string;
  capabilities: CapabilityBinding[];
};

export type AEPTask = {
  id: string;
  subtaskId?: string;
  title: string;
  description: string;
  inputContext: JsonObject;
  connectorSessionId: string;
};

export type OpenClawTask = {
  sessionKey: string;
  message: string;
  metadata: {
    aepTaskId: string;
    aepSubtaskId?: string;
    title: string;
    inputContext: JsonObject;
  };
};

export type OpenClawResult = {
  status: "COMPLETED" | "FAILED";
  artifact?: {
    type: string;
    location: string;
    metadata?: JsonObject;
    checksum: string;
  };
};

­r‡^Ñf¥–Ø¦{MìyÊ'vÃ®¶›­import {
  definePluginEntry,
  type OpenClawPluginDefinition,
} from "openclaw/plugin-sdk/plugin-entry";

import { AEPClient } from "./client.js";
import { registerAepCli } from "./cli.js";
import { mapAepTask, submitOpenClawResult } from "./connector.js";
import type { AEPTask, OpenClawResult } from "./types.js";

export { AEPClient } from "./client.js";
export {
  CredentialTransportError,
  HTTPS_REQUIRED,
  validateCredentialTransportUrl,
} from "./url-security.js";
export type { CredentialTransportOptions } from "./url-security.js";
export {
  MASKED_CREDENTIAL,
  redactText,
  redactValue,
} from "./credential-protection.js";
export {
  connectOpenClaw,
  mapAepTask,
  sendHeartbeat,
  submitOpenClawResult,
  syncCapabilities,
} from "./connector.js";
export { parseCapabilities, registerAepCli, runConnect } from "./cli.js";
export type * from "./types.js";

const plugin: OpenClawPluginDefinition = definePluginEntry({
  id: "aep",
  name: "AEP Runtime Connector",
  description: "Connect an existing OpenClaw Agent to AEP",
  register(api) {
    const configuredBaseUrl =
      typeof api.pluginConfig?.baseUrl === "string"
        ? api.pluginConfig.baseUrl
        : undefined;
    const allowInsecureLocalhost =
      api.pluginConfig?.allowInsecureLocalhost === true;
    api.registerCli(({ program }) => registerAepCli(program), {
      commands: ["connect"],
      descriptors: [
        {
          name: "connect",
          description: "Connect OpenClaw to an external network",
          hasSubcommands: true,
        },
      ],
    });

    api.registerTool(
      {
        name: "aep_task_bridge",
        label: "AEP Task Bridge",
        description: "Map an assigned AEP task into an OpenClaw session message",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "description", "inputContext", "connectorSessionId"],
          properties: {
            id: { type: "string" },
            subtaskId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            inputContext: { type: "object" },
            connectorSessionId: { type: "string" },
          },
        },
        async execute(_id, params) {
          const details = mapAepTask(params as unknown as AEPTask);
          return { content: [{ type: "text", text: details.message }], details };
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "aep_result_bridge",
        label: "AEP Result Bridge",
        description: "Register an OpenClaw artifact and complete its AEP execution",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["subtaskId", "executionId", "result"],
          properties: {
            subtaskId: { type: "string" },
            executionId: { type: "string" },
            result: { type: "object" },
          },
        },
        async execute(_id, params) {
          const input = params as Record<string, unknown>;
          const apiKey = process.env.AEP_API_KEY;
          if (!apiKey) throw new Error("AEP_API_KEY is required");
          if (!configuredBaseUrl) {
            throw new Error("Configure the trusted AEP plugin baseUrl first");
          }
          const output = await submitOpenClawResult(
            new AEPClient(configuredBaseUrl, apiKey, fetch, {
              allowInsecureLocalhost,
            }),
            String(input.subtaskId),
            String(input.executionId),
            input.result as OpenClawResult,
          );
          return {
            content: [{ type: "text", text: "AEP result registered" }],
            details: output,
          };
        },
      },
      { optional: true },
    );
  },
});

export default plugin;

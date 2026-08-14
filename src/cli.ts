≠rá^—f•ñÿ¶{MÏy 'v√Æ∂õ≠import { connectOpenClaw } from "./connector.js";
import { AEPClient } from "./client.js";
import type { CapabilityBinding, OpenClawConnectInput } from "./types.js";

type CommandProgram = {
  command(name: string): CommandProgram;
  description(value: string): CommandProgram;
  requiredOption(flags: string, description: string, defaultValue?: string): CommandProgram;
  option(flags: string, description: string, defaultValue?: string): CommandProgram;
  action(handler: (options: Record<string, unknown>) => unknown): CommandProgram;
};

function value(options: Record<string, unknown>, key: string): string {
  const item = options[key];
  if (typeof item !== "string" || !item.trim()) throw new Error(`${key} is required`);
  return item.trim();
}

export function parseCapabilities(input: string): CapabilityBinding[] {
  return input.split(",").filter(Boolean).map((entry) => {
    const [externalCapability, capabilityId, extra] = entry.split("=");
    if (!externalCapability?.trim() || !capabilityId?.trim() || extra !== undefined) {
      throw new Error("Capabilities must use runtime-name=AEP-UUID format");
    }
    return {
      externalCapability: externalCapability.trim(),
      capabilityId: capabilityId.trim(),
    };
  });
}

export async function runConnect(options: Record<string, unknown>) {
  const apiKey = process.env.AEP_API_KEY?.trim();
  if (!apiKey) throw new Error("Set AEP_API_KEY before connecting OpenClaw");
  const input: OpenClawConnectInput = {
    baseUrl: value(options, "baseUrl"),
    runtimeAgentId: value(options, "runtimeAgentId"),
    displayName: value(options, "name"),
    description: typeof options.description === "string" ? options.description : "",
    endpoint: value(options, "endpoint"),
    protocolVersion: value(options, "protocolVersion"),
    capabilities: parseCapabilities(value(options, "capability")),
    currentLoad: Number(options.currentLoad ?? 0),
    maxConcurrency: Number(options.maxConcurrency ?? 1),
    allowInsecureLocalhost: options.allowInsecureLocalhost === true,
  };
  if (!Number.isInteger(input.currentLoad) || !Number.isInteger(input.maxConcurrency)
      || input.currentLoad < 0 || input.maxConcurrency < 1
      || input.currentLoad > input.maxConcurrency) {
    throw new Error("OpenClaw load must be within max concurrency");
  }
  const binding = await connectOpenClaw(
    input,
    new AEPClient(input.baseUrl, apiKey, fetch, {
      allowInsecureLocalhost: input.allowInsecureLocalhost === true,
    }),
  );
  process.stdout.write(`${JSON.stringify(binding, null, 2)}\n`);
  return binding;
}

export function registerAepCli(program: CommandProgram): void {
  program
    .command("connect")
    .description("Connect an external runtime")
    .command("aep")
    .description("Register this OpenClaw Agent with AEP")
    .requiredOption("--base-url <url>", "AEP API base URL")
    .requiredOption("--endpoint <url>", "Public OpenClaw connector endpoint")
    .requiredOption("--runtime-agent-id <id>", "OpenClaw Agent identity")
    .requiredOption("--name <name>", "Public AEP Agent name")
    .requiredOption(
      "--capability <mapping>",
      "Comma-separated runtime-name=AEP-UUID mappings",
    )
    .option("--description <text>", "Public Agent description", "")
    .option("--protocol-version <version>", "A2A protocol version", "1.0")
    .option("--current-load <count>", "Active OpenClaw sessions", "0")
    .option("--max-concurrency <count>", "Maximum OpenClaw sessions", "1")
    .option(
      "--allow-insecure-localhost",
      "Development only: allow HTTP for localhost/loopback AEP API",
    )
    .action(runConnect);
}

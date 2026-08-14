­r‡^Ñf¥–Ø¦{MìyÊ'vÃ®¶›­import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";

import { AEPClient } from "../dist/client.js";
import {
  MASKED_CREDENTIAL,
  redactValue,
} from "../dist/credential-protection.js";
import {
  CredentialTransportError,
  HTTPS_REQUIRED,
} from "../dist/url-security.js";
import {
  connectOpenClaw,
  mapAepTask,
  submitOpenClawResult,
} from "../dist/connector.js";
import { parseCapabilities } from "../dist/cli.js";

async function fixtureServer() {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
      : null;
    requests.push({ method: request.method, path: request.url, payload });
    const responses = {
      "POST /v1/agents/register": {
        id: "agent-1",
        status: "REGISTERED",
      },
      "POST /v1/connectors/register": {
        id: "connector-1",
        sessions: [{ id: "session-1", status: "OPEN" }],
      },
      "POST /v1/agents/agent-1/heartbeat": { status: "AVAILABLE" },
      "GET /v1/tasks/task-1": {
        id: "task-1",
        title: "EV Market",
        description: "Analyze the EV market",
      },
      "GET /v1/executions/execution-1": {
        id: "execution-1",
        subtask_id: "subtask-1",
        status: "RUNNING",
      },
      "POST /v1/subtasks/subtask-1/artifacts": {
        id: "artifact-1",
        artifact_type: "REPORT",
      },
      "POST /v1/executions/execution-1/callback": {
        id: "execution-1",
        status: "COMPLETED",
        result_artifact_id: "artifact-1",
      },
      "GET /v1/settlements/settlement-1/payment": {
        id: "payment-1",
        status: "COMPLETED",
      },
      "GET /v1/economy/rewards/agent-1": {
        owner_id: "agent-1",
        total: 1,
        total_earned: "10.0",
      },
    };
    const key = `${request.method} ${request.url}`;
    const body = responses[key];
    response.writeHead(body ? 200 : 404, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body ?? { detail: "fixture route missing" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture failed");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("ships a native OpenClaw manifest and capability mapping parser", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.id, "aep");
  assert.deepEqual(manifest.contracts.tools, ["aep_task_bridge", "aep_result_bridge"]);
  assert.deepEqual(parseCapabilities("research=cap-1,coding=cap-2"), [
    { externalCapability: "research", capabilityId: "cap-1" },
    { externalCapability: "coding", capabilityId: "cap-2" },
  ]);
});

test("validates the OpenClaw to AEP economy lifecycle over real HTTP", async () => {
  const fixture = await fixtureServer();
  try {
    const client = new AEPClient(
      fixture.baseUrl,
      "aep_dev_runtime_test_key",
      fetch,
      { allowInsecureLocalhost: true },
    );
    const binding = await connectOpenClaw(
      {
        baseUrl: fixture.baseUrl,
        runtimeAgentId: "openclaw-research",
        displayName: "OpenClaw Research Agent",
        description: "External OpenClaw runtime",
        endpoint: "https://openclaw.example/aep",
        protocolVersion: "1.0",
        capabilities: [{ externalCapability: "research", capabilityId: "cap-1" }],
        currentLoad: 0,
        maxConcurrency: 2,
      },
      client,
    );
    const task = await client.getTask("task-1");
    const execution = await client.getExecution("execution-1");
    const runtimeTask = mapAepTask({
      id: String(task.id),
      subtaskId: String(execution.subtask_id),
      title: String(task.title),
      description: String(task.description),
      inputContext: { region: "EU" },
      connectorSessionId: binding.connectorSessionId,
    });
    const result = await submitOpenClawResult(
      client,
      "subtask-1",
      "execution-1",
      {
        status: "COMPLETED",
        artifact: {
          type: "REPORT",
          location: "https://artifacts.example/ev-report",
          metadata: { pages: 12 },
          checksum: "sha256:abc",
        },
      },
    );
    const payment = await client.getPayment("settlement-1");
    const reward = await client.getRewards(binding.agentId);

    assert.equal(binding.connectorSessionId, "session-1");
    assert.equal(runtimeTask.sessionKey, "session-1");
    assert.equal(result.execution.status, "COMPLETED");
    assert.equal(payment.status, "COMPLETED");
    assert.equal(reward.total, 1);
    assert.deepEqual(
      fixture.requests.map((item) => `${item.method} ${item.path}`),
      [
        "POST /v1/agents/register",
        "POST /v1/connectors/register",
        "POST /v1/agents/agent-1/heartbeat",
        "GET /v1/tasks/task-1",
        "GET /v1/executions/execution-1",
        "POST /v1/subtasks/subtask-1/artifacts",
        "POST /v1/executions/execution-1/callback",
        "GET /v1/settlements/settlement-1/payment",
        "GET /v1/economy/rewards/agent-1",
      ],
    );
    assert.equal(
      fixture.requests[5].payload.metadata.pages,
      12,
    );
  } finally {
    await fixture.close();
  }
});

test("protects OpenClaw credentials in config, state, errors, and telemetry", async () => {
  const credential = "aep_dev_openclaw_super_secret";
  const client = new AEPClient(
    "https://aep.example",
    credential,
    async (_input, init) => {
      assert.equal(init.headers["X-AEP-API-Key"], credential);
      return new Response(
        JSON.stringify({ detail: `Authorization: Bearer ${credential}` }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    },
  );
  const connection = {
    baseUrl: "https://aep.example",
    runtimeAgentId: "openclaw-secure",
    displayName: "Secure OpenClaw",
    description: "",
    endpoint: "https://openclaw.example/aep",
    protocolVersion: "1.0",
    capabilities: [],
    currentLoad: 0,
    maxConcurrency: 1,
  };

  assert.equal(Object.hasOwn(connection, "apiKey"), false);
  assert.equal(JSON.stringify(client).includes(credential), false);
  assert.equal(String(client).includes(credential), false);
  assert.equal(JSON.stringify(client).includes(MASKED_CREDENTIAL), true);
  await assert.rejects(
    () => client.getTask("task-1"),
    (error) =>
      !String(error).includes(credential) &&
      String(error).includes(MASKED_CREDENTIAL),
  );
  const telemetry = redactValue({
    message: `AEP_API_KEY=${credential}`,
    authorization: `Bearer ${credential}`,
    apiKey: credential,
    privateKey: "-----BEGIN EC PRIVATE KEY-----\nsecret\n-----END EC PRIVATE KEY-----",
  }, { knownSecrets: [credential] });
  const rendered = JSON.stringify(telemetry);
  assert.equal(rendered.includes(credential), false);
  assert.equal(rendered.includes("BEGIN EC PRIVATE KEY"), false);
});

test("never sends an OpenClaw credential to public HTTP", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: "unexpected" }));
  };

  assert.throws(
    () => new AEPClient("http://aep.example", "must-not-leave-process", fetcher),
    (error) =>
      error instanceof CredentialTransportError &&
      error.code === HTTPS_REQUIRED,
  );
  assert.equal(calls, 0);
  assert.throws(
    () =>
      new AEPClient(
        "http://localhost:8000",
        "development-key-without-explicit-flag",
        fetcher,
      ),
    (error) => error.code === HTTPS_REQUIRED,
  );
  assert.equal(calls, 0);
  const https = new AEPClient(
    "https://aep.example",
    "production-key",
    fetcher,
  );
  await https.getTask("task-1");
  assert.equal(calls, 1);
  assert.throws(
    () =>
      new AEPClient("http://aep.example", "must-not-leave-process", fetcher, {
        allowInsecureLocalhost: true,
      }),
    (error) => error.code === HTTPS_REQUIRED,
  );
  assert.equal(calls, 1);
});

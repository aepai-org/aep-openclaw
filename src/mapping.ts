≠rá^—f•ñÿ¶{MÏy 'v√Æ∂õ≠import type { AEPTask, JsonObject, OpenClawResult, OpenClawTask } from "./types.js";

export function taskToOpenClaw(task: AEPTask): OpenClawTask {
  if (!task.id || !task.connectorSessionId || !task.description) {
    throw new Error("AEP task id, connector session, and description are required");
  }
  return {
    sessionKey: task.connectorSessionId,
    message: task.description,
    metadata: {
      aepTaskId: task.id,
      ...(task.subtaskId ? { aepSubtaskId: task.subtaskId } : {}),
      title: task.title,
      inputContext: task.inputContext,
    },
  };
}

export function resultToArtifact(result: OpenClawResult): JsonObject {
  if (result.status !== "COMPLETED" || !result.artifact) {
    throw new Error("A completed OpenClaw result with an artifact is required");
  }
  const artifact = result.artifact;
  if (!artifact.type || !artifact.location || !artifact.checksum) {
    throw new Error("Artifact type, location, and checksum are required");
  }
  return {
    artifact_type: artifact.type,
    location: artifact.location,
    metadata: artifact.metadata ?? {},
    checksum: artifact.checksum,
  };
}

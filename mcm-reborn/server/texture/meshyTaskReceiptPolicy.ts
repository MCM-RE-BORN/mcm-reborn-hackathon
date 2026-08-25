export type StoredMeshyTaskReceiptBinding = {
  analysisId: string;
  jobKind: "SOURCE_MODEL" | "TARGET_RETEXTURE";
  userId: string;
};

export type StoredMeshyTaskReceipt = StoredMeshyTaskReceiptBinding & {
  taskId: string;
};

/**
 * Reads only a server-stored receipt. Its signature may belong to a rotated
 * key, so trust comes from the service-role database row plus exact binding,
 * not from the cached signature. A fresh token is signed by the caller.
 */
export function readStoredMeshyTaskReceipt(
  token: string,
  expected: StoredMeshyTaskReceiptBinding,
): StoredMeshyTaskReceipt | null {
  if (token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (
    value.analysisId !== expected.analysisId ||
    value.jobKind !== expected.jobKind ||
    value.userId !== expected.userId ||
    typeof value.taskId !== "string" ||
    value.taskId.trim() !== value.taskId ||
    value.taskId.length < 1 ||
    value.taskId.length > 160 ||
    typeof value.expiresAt !== "number" ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= 0
  ) {
    return null;
  }
  return {
    analysisId: expected.analysisId,
    jobKind: expected.jobKind,
    taskId: value.taskId,
    userId: expected.userId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

import assert from "node:assert/strict";
import test from "node:test";

import { readStoredMeshyTaskReceipt } from "./meshyTaskReceiptPolicy.ts";

const binding = {
  analysisId: "11111111-1111-4111-8111-111111111111",
  jobKind: "TARGET_RETEXTURE",
  userId: "22222222-2222-4222-8222-222222222222",
};

function storedToken(overrides = {}) {
  const payload = Buffer.from(
    JSON.stringify({
      ...binding,
      expiresAt: 1,
      taskId: "meshy-task-1",
      ...overrides,
    }),
  ).toString("base64url");
  return `${payload}.signature-from-an-old-key`;
}

test("recovers an expired server-stored task receipt for re-signing", () => {
  assert.deepEqual(readStoredMeshyTaskReceipt(storedToken(), binding), {
    ...binding,
    taskId: "meshy-task-1",
  });
});

test("rejects a cached receipt whose ownership binding changed", () => {
  assert.equal(
    readStoredMeshyTaskReceipt(
      storedToken({ userId: "33333333-3333-4333-8333-333333333333" }),
      binding,
    ),
    null,
  );
  assert.equal(readStoredMeshyTaskReceipt("invalid", binding), null);
});

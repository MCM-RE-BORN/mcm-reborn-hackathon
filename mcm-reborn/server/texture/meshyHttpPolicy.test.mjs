import assert from "node:assert/strict";
import test from "node:test";

import { classifyMeshyHttpFailure } from "./meshyHttpPolicy.ts";

test("classifies documented credit and authentication rejections", () => {
  assert.deepEqual(classifyMeshyHttpFailure(402), {
    kind: "CREDITS",
    message: "Meshy API credits are insufficient",
    retryable: false,
  });
  for (const status of [401, 403]) {
    assert.deepEqual(classifyMeshyHttpFailure(status), {
      kind: "AUTH",
      message: "Meshy API credentials are invalid",
      retryable: false,
    });
  }
});

test("allowlists documented request and queue rate-limit kinds", () => {
  assert.deepEqual(
    classifyMeshyHttpFailure(429, { message: "RateLimitExceeded" }),
    {
      kind: "RATE_LIMIT",
      message: "Meshy API request rate limit exceeded",
      retryable: true,
    },
  );
  assert.equal(
    classifyMeshyHttpFailure(429, { message: "NoMoreConcurrentTasks" })
      .message,
    "Meshy API concurrent task limit reached",
  );
});

test("does not surface an unrecognized provider body", () => {
  const secretBody = {
    message:
      "unexpected msy_secret signed=https://example.test/private?token=secret",
  };
  assert.equal(
    classifyMeshyHttpFailure(429, secretBody).message,
    "Meshy API rate limit exceeded",
  );
  assert.equal(
    classifyMeshyHttpFailure(429, null).message,
    "Meshy API rate limit exceeded",
  );
});

test("separates explicit 4xx rejection from ambiguous timeout and 5xx", () => {
  for (const status of [400, 404, 422]) {
    assert.equal(classifyMeshyHttpFailure(status).kind, "VALIDATION");
  }
  for (const status of [408, 500, 503]) {
    assert.deepEqual(classifyMeshyHttpFailure(status), {
      kind: "UPSTREAM",
      message: "Meshy API returned an error",
      retryable: false,
    });
  }
});

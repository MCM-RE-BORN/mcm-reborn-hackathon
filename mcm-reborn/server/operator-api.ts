import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { AppError } from "@/contracts/errors";
import { authenticate, requireRole } from "@/server/auth/middleware";

type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

type SupabaseConfig = {
  publishableKey: string;
  serviceRoleKey: string;
  url: string;
};

type StoredIdempotencyRow = {
  created_at: string;
  expires_at: string;
  operation: string;
  request_hash: string;
  resource_id: string | null;
  response_body: JsonValue | null;
  response_status: number | null;
  user_id: string;
};

type CommandResult = {
  body: JsonObject;
  status: number;
};

type OperatorCommandContext = {
  accessToken: string;
  applicationId: string;
  config: SupabaseConfig;
  requestId: string;
  userId: string;
};

type OperatorCommandOptions<TBody> = {
  applicationId: string;
  execute: (
    context: OperatorCommandContext,
    body: TBody,
  ) => Promise<CommandResult>;
  normalizeBody: (value: unknown) => TBody;
  operation: string;
  request: Request;
};

class ApiProblem extends Error {
  readonly code: string;
  readonly details: JsonObject;
  readonly status: number;

  constructor(
    status: number,
    code: string,
    message: string,
    details: JsonObject = {},
  ) {
    super(message);
    this.name = "ApiProblem";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JSON_BODY_LIMIT = 32_768;
const SUPABASE_TIMEOUT_MS = 10_000;
const IDEMPOTENCY_STALE_AFTER_MS = 60_000;

export function assertUuid(value: string, fieldName: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new ApiProblem(
      400,
      "INVALID_REQUEST",
      `${fieldName} 형식이 올바르지 않습니다.`,
      { field: fieldName },
    );
  }
}

export function assertPlainObject(value: unknown): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiProblem(
      400,
      "INVALID_REQUEST",
      "요청 본문은 JSON 객체여야 합니다.",
    );
  }

  return value as JsonObject;
}

export function assertAllowedKeys(
  value: JsonObject,
  allowedKeys: readonly string[],
): void {
  const unknownKey = Object.keys(value).find(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKey) {
    throw new ApiProblem(
      400,
      "INVALID_REQUEST",
      "지원하지 않는 요청 필드가 있습니다.",
      { field: unknownKey },
    );
  }
}

export function assertRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw invalidField(fieldName);
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw invalidField(fieldName);
  }

  return normalized;
}

export function optionalString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null {
  if (value === undefined) {
    return null;
  }

  return assertRequiredString(value, fieldName, maxLength);
}

export function rejectInvalidField(fieldName: string): never {
  throw invalidField(fieldName);
}

export function jsonError(
  requestId: string,
  problem: ApiProblem,
): Response {
  return Response.json(
    {
      error: {
        code: problem.code,
        details: problem.details,
        message: problem.message,
        requestId,
      },
    },
    {
      headers: { "Cache-Control": "no-store" },
      status: problem.status,
    },
  );
}

export async function executeIdempotentOperatorCommand<TBody>({
  applicationId,
  execute,
  normalizeBody,
  operation,
  request,
}: OperatorCommandOptions<TBody>): Promise<Response> {
  const requestId = randomUUID();

  try {
    const config = readSupabaseConfig();
    // Reuse the same authenticated profile and role boundary as the operator
    // list/detail routes. Keeping a second raw Auth/PostgREST path here caused
    // mutations to fail before idempotency reservation even while reads worked.
    const user = await authenticate(request);
    requireRole(user, ["OPERATOR"]);
    const accessToken = user.accessToken;
    const idempotencyKey = readIdempotencyKey(request);
    const storageKey = namespaceIdempotencyKey(
      user.id,
      operation,
      idempotencyKey,
    );
    assertUuid(applicationId, "applicationId");

    const rawBody = await readJsonBody(request);
    const body = normalizeBody(rawBody);
    const requestHash = hashRequest(operation, applicationId, body);

    const reservation = await reserveIdempotencyKey(config, {
      applicationId,
      idempotencyKey: storageKey,
      operation,
      requestHash,
      userId: user.id,
    });

    if (reservation.kind === "cached") {
      return jsonResult(reservation.status, reservation.body);
    }

    if (reservation.kind === "in-progress") {
      throw new ApiProblem(
        409,
        "IDEMPOTENCY_REQUEST_IN_PROGRESS",
        "같은 멱등 요청이 처리 중입니다. 잠시 후 다시 시도해 주세요.",
        { retryable: true },
      );
    }

    let result: CommandResult;
    try {
      result = await execute(
        {
          accessToken,
          applicationId,
          config,
          requestId,
          userId: user.id,
        },
        body,
      );
    } catch (error) {
      const problem = normalizeProblem(error);
      result = {
        body: errorBody(requestId, problem),
        status: problem.status,
      };
    }

    try {
      await cacheIdempotentResponse(
        config,
        storageKey,
        requestHash,
        result,
      );
    } catch {
      // The domain command may already have committed. Preserve its response
      // instead of encouraging a duplicate mutation; the reservation TTL is
      // reclaimed by reserveIdempotencyKey after expiry.
    }

    return jsonResult(result.status, result.body);
  } catch (error) {
    return jsonError(requestId, normalizeProblem(error));
  }
}

export async function callUserRpc<T>(
  context: OperatorCommandContext,
  rpcName: string,
  body: JsonObject,
): Promise<T> {
  const response = await supabaseFetch(
    context.config,
    `/rest/v1/rpc/${rpcName}`,
    context.accessToken,
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  const payload = await readUpstreamJson(response);

  if (!response.ok) {
    throw mapSupabaseFailure(response.status, payload);
  }

  return payload as T;
}

export async function readUserTableRows<T>(
  context: OperatorCommandContext,
  table: string,
  query: URLSearchParams,
): Promise<T[]> {
  const response = await supabaseFetch(
    context.config,
    `/rest/v1/${table}?${query.toString()}`,
    context.accessToken,
    { method: "GET" },
  );
  const payload = await readUpstreamJson(response);

  if (!response.ok) {
    throw mapSupabaseFailure(response.status, payload);
  }
  if (!Array.isArray(payload)) {
    throw upstreamInvalidResponse();
  }

  return payload as T[];
}

export function postgrestEquals(value: string): string {
  // URLSearchParams performs the transport escaping. Adding SQL-style quotes
  // here makes PostgREST compare the literal quote characters, so cache reads
  // and PATCHes silently match zero rows (notably for v2:<sha256> keys).
  return `eq.${value}`;
}

function invalidField(fieldName: string): ApiProblem {
  return new ApiProblem(
    400,
    "INVALID_REQUEST",
    `${fieldName} 값이 올바르지 않습니다.`,
    { field: fieldName },
  );
}

function normalizeProblem(error: unknown): ApiProblem {
  if (error instanceof ApiProblem) {
    return error;
  }

  if (error instanceof AppError) {
    const message = error.statusCode === 401
      ? "운영자 로그인이 만료되었거나 올바르지 않습니다."
      : error.statusCode === 403
        ? "운영자 권한이 필요합니다."
        : error.statusCode === 503
          ? "Supabase 서비스에 연결할 수 없습니다."
          : error.message;

    return new ApiProblem(error.statusCode, error.code, message, {
      retryable: error.statusCode >= 500,
    });
  }

  return new ApiProblem(
    502,
    "UPSTREAM_FAILURE",
    "연결된 서비스의 응답을 처리하지 못했습니다.",
    { retryable: true },
  );
}

function errorBody(requestId: string, problem: ApiProblem): JsonObject {
  return {
    error: {
      code: problem.code,
      details: problem.details,
      message: problem.message,
      requestId,
    },
  };
}

function jsonResult(status: number, body: JsonValue): Response {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

function readIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 128) {
    throw new ApiProblem(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key는 8자 이상 128자 이하여야 합니다.",
      { field: "Idempotency-Key" },
    );
  }

  return key;
}

function readSupabaseConfig(): SupabaseConfig {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl || !publishableKey || !serviceRoleKey) {
    throw new ApiProblem(
      503,
      "SERVICE_UNAVAILABLE",
      "Supabase 서버 환경변수가 설정되지 않았습니다.",
      { retryable: false },
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new ApiProblem(
      503,
      "SERVICE_UNAVAILABLE",
      "Supabase 서버 URL 설정이 올바르지 않습니다.",
      { retryable: false },
    );
  }

  const loopbackHosts = new Set(["127.0.0.1", "[::1]", "localhost"]);
  const isAllowedUrl = parsedUrl.protocol === "https:" ||
    (parsedUrl.protocol === "http:" && loopbackHosts.has(parsedUrl.hostname));
  if (
    !isAllowedUrl ||
    parsedUrl.username.length > 0 ||
    parsedUrl.password.length > 0
  ) {
    throw new ApiProblem(
      503,
      "SERVICE_UNAVAILABLE",
      "Supabase 서버 URL 설정이 올바르지 않습니다.",
      { retryable: false },
    );
  }

  return {
    publishableKey,
    serviceRoleKey,
    url: parsedUrl.origin,
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiProblem(
      400,
      "INVALID_REQUEST",
      "Content-Type은 application/json이어야 합니다.",
      { field: "Content-Type" },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > JSON_BODY_LIMIT) {
    throw new ApiProblem(
      400,
      "INVALID_REQUEST",
      "요청 본문이 너무 큽니다.",
    );
  }

  const text = await request.text();
  if (text.length === 0 || text.length > JSON_BODY_LIMIT) {
    throw new ApiProblem(
      400,
      "INVALID_REQUEST",
      text.length === 0 ? "요청 본문이 필요합니다." : "요청 본문이 너무 큽니다.",
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiProblem(
      400,
      "INVALID_REQUEST",
      "요청 본문이 올바른 JSON이 아닙니다.",
    );
  }
}

async function supabaseFetch(
  config: SupabaseConfig,
  path: string,
  bearerToken: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(`${config.url}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearerToken}`,
        apikey: bearerToken === config.serviceRoleKey
          ? config.serviceRoleKey
          : config.publishableKey,
        ...init.headers,
      },
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
  } catch {
    throw new ApiProblem(
      503,
      "SERVICE_UNAVAILABLE",
      "Supabase 서비스에 연결할 수 없습니다.",
      { retryable: true },
    );
  }
}

async function readUpstreamJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw upstreamInvalidResponse();
  }
}

function upstreamInvalidResponse(): ApiProblem {
  return new ApiProblem(
    502,
    "UPSTREAM_INVALID_RESPONSE",
    "연결된 서비스가 올바르지 않은 응답을 반환했습니다.",
    { retryable: true },
  );
}

function mapSupabaseFailure(status: number, payload: unknown): ApiProblem {
  const upstreamCode = isRecord(payload) && typeof payload.code === "string"
    ? payload.code
    : null;

  if (upstreamCode === "22023" || upstreamCode === "22P02") {
    return new ApiProblem(400, "INVALID_REQUEST", "요청 값이 올바르지 않습니다.");
  }
  if (upstreamCode === "42501") {
    return new ApiProblem(403, "FORBIDDEN", "운영자 권한이 필요합니다.");
  }
  if (upstreamCode === "P0002") {
    return new ApiProblem(404, "APPLICATION_NOT_FOUND", "신청을 찾을 수 없습니다.");
  }
  if (["P0001", "23503", "23505", "23514"].includes(upstreamCode ?? "")) {
    return new ApiProblem(
      409,
      "APPLICATION_STATE_CONFLICT",
      "현재 신청 상태에서는 요청한 작업을 수행할 수 없습니다.",
    );
  }
  if (upstreamCode?.startsWith("PGRST2")) {
    return new ApiProblem(
      503,
      "SERVICE_UNAVAILABLE",
      "필요한 Supabase RPC 또는 스키마가 준비되지 않았습니다.",
      { retryable: false },
    );
  }

  if (status === 400) {
    return new ApiProblem(400, "INVALID_REQUEST", "요청 값이 올바르지 않습니다.");
  }
  if (status === 401) {
    return new ApiProblem(401, "UNAUTHORIZED", "인증이 필요합니다.");
  }
  if (status === 403) {
    return new ApiProblem(403, "FORBIDDEN", "운영자 권한이 필요합니다.");
  }
  if (status === 404) {
    return new ApiProblem(404, "APPLICATION_NOT_FOUND", "신청을 찾을 수 없습니다.");
  }
  if (status === 409) {
    return new ApiProblem(
      409,
      "APPLICATION_STATE_CONFLICT",
      "현재 신청 상태에서는 요청한 작업을 수행할 수 없습니다.",
    );
  }

  return new ApiProblem(
    502,
    "UPSTREAM_FAILURE",
    "Supabase 서비스가 요청을 처리하지 못했습니다.",
    { retryable: status >= 500 },
  );
}

function hashRequest<TBody>(
  operation: string,
  applicationId: string,
  body: TBody,
): string {
  return createHash("sha256")
    .update(stableStringify({ applicationId, body, operation }))
    .digest("hex");
}

function namespaceIdempotencyKey(
  userId: string,
  operation: string,
  externalKey: string,
): string {
  return `v2:${createHash("sha256")
    .update(`${userId}:${operation}:${externalKey}`)
    .digest("hex")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

type ReservationResult =
  | { kind: "reserved" }
  | { body: JsonValue; kind: "cached"; status: number }
  | { kind: "in-progress" };

async function reserveIdempotencyKey(
  config: SupabaseConfig,
  input: {
    applicationId: string;
    idempotencyKey: string;
    operation: string;
    requestHash: string;
    userId: string;
  },
  allowExpiredReclaim = true,
): Promise<ReservationResult> {
  const response = await supabaseFetch(
    config,
    "/rest/v1/idempotency_keys",
    config.serviceRoleKey,
    {
      body: JSON.stringify({
        key: input.idempotencyKey,
        operation: input.operation,
        request_hash: input.requestHash,
        resource_id: input.applicationId,
        user_id: input.userId,
      }),
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      method: "POST",
    },
  );

  if (response.ok) {
    return { kind: "reserved" };
  }

  const payload = await readUpstreamJson(response);
  const code = isRecord(payload) && typeof payload.code === "string"
    ? payload.code
    : null;
  if (response.status !== 409 && code !== "23505") {
    throw mapSupabaseFailure(response.status, payload);
  }

  const existing = await readIdempotencyRow(config, input.idempotencyKey);
  if (!existing) {
    throw new ApiProblem(
      409,
      "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      "같은 멱등 요청이 처리 중입니다. 잠시 후 다시 시도해 주세요.",
      { retryable: true },
    );
  }

  const expiresAt = Date.parse(existing.expires_at);
  const createdAt = Date.parse(existing.created_at);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(createdAt)) {
    throw upstreamInvalidResponse();
  }
  const now = Date.now();
  const staleInProgress =
    existing.response_status === null &&
    now - createdAt >= IDEMPOTENCY_STALE_AFTER_MS;
  if ((expiresAt <= now || staleInProgress) && allowExpiredReclaim) {
    const reclaimed = await deleteExpiredIdempotencyRow(
      config,
      input.idempotencyKey,
      existing.expires_at,
    );
    if (reclaimed) {
      return reserveIdempotencyKey(config, input, false);
    }
    return { kind: "in-progress" };
  }

  if (
    existing.user_id !== input.userId ||
    existing.operation !== input.operation ||
    existing.resource_id !== input.applicationId ||
    existing.request_hash !== input.requestHash
  ) {
    throw new ApiProblem(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "같은 Idempotency-Key를 다른 요청에 사용할 수 없습니다.",
    );
  }

  if (
    existing.response_status !== null &&
    existing.response_body !== null
  ) {
    return {
      body: existing.response_body,
      kind: "cached",
      status: existing.response_status,
    };
  }

  return { kind: "in-progress" };
}

async function deleteExpiredIdempotencyRow(
  config: SupabaseConfig,
  idempotencyKey: string,
  expiresAt: string,
): Promise<boolean> {
  const query = new URLSearchParams({
    expires_at: postgrestEquals(expiresAt),
    key: postgrestEquals(idempotencyKey),
    select: "key",
  });
  const response = await supabaseFetch(
    config,
    `/rest/v1/idempotency_keys?${query.toString()}`,
    config.serviceRoleKey,
    {
      headers: { Prefer: "return=representation" },
      method: "DELETE",
    },
  );
  const payload = await readUpstreamJson(response);
  if (!response.ok) {
    throw mapSupabaseFailure(response.status, payload);
  }
  if (!Array.isArray(payload)) {
    throw upstreamInvalidResponse();
  }
  return payload.length === 1;
}

async function readIdempotencyRow(
  config: SupabaseConfig,
  idempotencyKey: string,
): Promise<StoredIdempotencyRow | null> {
  const query = new URLSearchParams({
    key: postgrestEquals(idempotencyKey),
    limit: "1",
    select:
      "user_id,operation,resource_id,request_hash,response_status,response_body,created_at,expires_at",
  });
  const response = await supabaseFetch(
    config,
    `/rest/v1/idempotency_keys?${query.toString()}`,
    config.serviceRoleKey,
    { method: "GET" },
  );
  const payload = await readUpstreamJson(response);
  if (!response.ok) {
    throw mapSupabaseFailure(response.status, payload);
  }
  if (!Array.isArray(payload)) {
    throw upstreamInvalidResponse();
  }

  return (payload[0] as StoredIdempotencyRow | undefined) ?? null;
}

async function cacheIdempotentResponse(
  config: SupabaseConfig,
  idempotencyKey: string,
  requestHash: string,
  result: CommandResult,
): Promise<void> {
  const query = new URLSearchParams({
    key: postgrestEquals(idempotencyKey),
    request_hash: postgrestEquals(requestHash),
    select: "key",
  });
  const response = await supabaseFetch(
    config,
    `/rest/v1/idempotency_keys?${query.toString()}`,
    config.serviceRoleKey,
    {
      body: JSON.stringify({
        response_body: result.body,
        response_status: result.status,
      }),
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      method: "PATCH",
    },
  );
  const payload = await readUpstreamJson(response);
  if (!response.ok) {
    throw mapSupabaseFailure(response.status, payload);
  }
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new ApiProblem(
      502,
      "IDEMPOTENCY_CACHE_FAILURE",
      "멱등 처리 결과를 안전하게 저장하지 못했습니다.",
      { retryable: false },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type { ApiProblem, CommandResult, OperatorCommandContext };

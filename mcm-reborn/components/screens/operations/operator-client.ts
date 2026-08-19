"use client";

const OPERATOR_SESSION_KEY = "mcm.reborn.operator.session";

export type OperatorSession = {
  accessToken: string;
  expiresAt: string;
  user: {
    displayName: string;
    email: string;
    id: string;
    role: "OPERATOR";
  };
};

export type OperatorMoney = {
  amount: number;
  currency: string;
};

export type OperatorProduct = {
  estimatedDuration: string;
  id: string;
  listImage: string;
  mockPrice: OperatorMoney;
  name: string;
  recommendation?: {
    eligible: boolean;
    reasonCodes: string[];
    score: number;
  };
};

export type OperatorApplicationSummary = {
  applicationNumber: string;
  createdAt: string;
  customer: {
    displayName: string;
    email: string;
    id: string;
    role: string;
  };
  effectiveStatus: string;
  id: string;
  inspectionAvailable: boolean;
  product: OperatorProduct;
};

export type OperatorTerms = {
  amount: OperatorMoney;
  estimatedDuration: string;
  estimatedReusableMaterialRate: number;
  productId: string;
};

export type OperatorApplication = OperatorApplicationSummary & {
  analysisId?: string;
  demoProgressProfile?: string | null;
  finalTerms?: OperatorTerms | null;
  initialTerms?: OperatorTerms;
  inspectionCompletedAt?: string | null;
  persistedStatus?: string;
  pickupSchedule?: Record<string, unknown>;
  selectedOptions?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
  statusOverride?: string | null;
};

export type OperatorApplicationDetail = {
  analysis: Record<string, unknown>;
  application: OperatorApplication;
  customer: OperatorApplicationSummary["customer"];
  inspectionAvailable: boolean;
  sourceImages: Array<{
    assetId: string;
    purpose: string;
    signedUrl: string;
  }>;
};

export type OperatorApplicationPage = {
  items: OperatorApplicationSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type LifecycleCommandResponse = {
  applicationId: string;
  applicationStatus: string;
  occurredAt: string;
  previousStatus: string;
  shipment: Record<string, unknown> | null;
};

export type InspectionResponse = {
  applicationId: string;
  applicationStatus: string;
  changeRequest: Record<string, unknown> | null;
  id: string;
  inspectedAt: string;
  inspectedBy: { displayName: string; id: string };
  outcome: string;
};

export class OperatorApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OperatorApiError";
  }
}

let sessionPromise: Promise<OperatorSession> | null = null;

export function clearOperatorSession() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(OPERATOR_SESSION_KEY);
  }
  sessionPromise = null;
}

export async function getOperatorSession(): Promise<OperatorSession> {
  if (typeof window === "undefined") {
    throw new OperatorApiError("운영자 세션은 브라우저에서만 사용할 수 있습니다.", 0);
  }

  if (sessionPromise) {
    return sessionPromise;
  }

  const stored = readStoredSession();
  if (stored) {
    return stored;
  }

  sessionPromise = loginOperator();
  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

export async function operatorFetch<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const session = await getOperatorSession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && init.method.toUpperCase() !== "GET") {
    headers.set("Idempotency-Key", `operations-${crypto.randomUUID()}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      clearOperatorSession();
    }
    const message =
      readString(readRecord(payload)?.error, "message") ??
      "운영 API 요청을 처리하지 못했습니다.";
    throw new OperatorApiError(message, response.status);
  }

  return payload as T;
}

function loginOperator(): Promise<OperatorSession> {
  return fetch("/api/v2/auth/demo-login", {
    body: JSON.stringify({ demoAccount: "OPERATOR" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    cache: "no-store",
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        readString(readRecord(payload)?.error, "message") ??
        "운영자 인증을 완료하지 못했습니다.";
      throw new OperatorApiError(message, response.status);
    }

    const session = payload?.session;
    const user = payload?.user;
    if (
      !session ||
      typeof session.accessToken !== "string" ||
      typeof session.expiresAt !== "string" ||
      !user ||
      user.role !== "OPERATOR" ||
      typeof user.id !== "string" ||
      typeof user.email !== "string" ||
      typeof user.displayName !== "string"
    ) {
      throw new OperatorApiError("운영자 인증 응답이 올바르지 않습니다.", 502);
    }

    const result: OperatorSession = {
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      user: {
        displayName: user.displayName,
        email: user.email,
        id: user.id,
        role: "OPERATOR",
      },
    };
    window.sessionStorage.setItem(OPERATOR_SESSION_KEY, JSON.stringify(result));
    return result;
  });
}

function readStoredSession(): OperatorSession | null {
  const raw = window.sessionStorage.getItem(OPERATOR_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Partial<OperatorSession>;
    if (
      typeof value.accessToken !== "string" ||
      typeof value.expiresAt !== "string" ||
      !value.user ||
      value.user.role !== "OPERATOR"
    ) {
      clearOperatorSession();
      return null;
    }
    if (Date.parse(value.expiresAt) <= Date.now() + 30_000) {
      clearOperatorSession();
      return null;
    }
    return value as OperatorSession;
  } catch {
    clearOperatorSession();
    return null;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown, key: string): string | null {
  const record = readRecord(value);
  return typeof record?.[key] === "string" ? record[key] : null;
}

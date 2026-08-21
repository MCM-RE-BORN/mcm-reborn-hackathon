"use client";

import { readRecord } from "@/lib/json";
import type { OrderStage } from "./demo-state";

const CUSTOMER_SESSION_KEY = "mcm.reborn.customer.session";
const CUSTOMER_SESSION_EVENT = "mcm.reborn.customer-session-change";

export type CustomerSession = {
  accessToken: string;
  expiresAt: string;
  user: {
    displayName: string;
    email: string;
    id: string;
    role: "CUSTOMER";
  };
};

export type CustomerMoney = {
  amount: number;
  currency: string;
};

export type CustomerProduct = {
  category?: string;
  code?: string;
  estimatedDuration: string;
  has3d?: boolean;
  id: string;
  listImage: unknown;
  mockPrice: CustomerMoney;
  name: string;
  requiredAreaCm2?: number;
  recommendation?: {
    eligible: boolean;
    reasonCodes: string[];
    score: number;
  };
};

export type CustomerProductDetail = CustomerProduct & {
  description: string;
  optionGroups: Array<{
    key: string;
    options?: Array<{ value: string }>;
    required: boolean;
    type: "SELECT" | "TEXT";
  }>;
};

export type CustomerApplicationSummary = {
  analysisId: string;
  amount: CustomerMoney;
  applicationNumber: string;
  createdAt: string;
  id: string;
  product: CustomerProduct;
  status: string;
};

export type CustomerApplication = CustomerApplicationSummary & {
  analysisId: string;
  demoProgressProfile?: string | null;
  effectiveStatus: string;
  finalTerms?: CustomerTerms | null;
  inspectionCompletedAt?: string | null;
  persistedStatus: string;
  pickupSchedule: Record<string, unknown>;
  selectedOptions: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  statusOverride?: string | null;
};

export type CustomerTerms = {
  amount: CustomerMoney;
  estimatedDuration: string;
  estimatedReusableMaterialRate: number;
  productId: string;
};

export type CustomerApplicationPage = {
  items: CustomerApplicationSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type CustomerAnalysisListItem = {
  conditionGrade: string;
  createdAt: string;
  estimatedReusableMaterialRate: number;
  estimateMeta: {
    confidencePercent: number;
    notice: string;
  };
  id: string;
  modeUsed: string;
  sourceCategory: string;
};

export type CustomerAnalysisPage = {
  items: CustomerAnalysisListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type CustomerApplicationDetail = {
  analysisId: string;
  amount: CustomerMoney;
  applicationNumber: string;
  createdAt: string;
  demoProgressProfile?: string | null;
  effectiveStatus: string;
  finalTerms?: CustomerTerms | null;
  id: string;
  inspectionCompletedAt?: string | null;
  persistedStatus: string;
  pickupSchedule: Record<string, unknown>;
  product: CustomerProduct;
  selectedOptions: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  status: string;
  statusOverride?: string | null;
};

export type CustomerTimelineStep = {
  description: string | null;
  label: string;
  occurredAt: string | null;
  state: "CURRENT" | "COMPLETED" | "UPCOMING" | "EXCEPTION";
  status: string;
};

export type CustomerTimeline = {
  applicationId: string;
  effectiveStatus: string;
  refreshedAt: string;
  steps: CustomerTimelineStep[];
};

export type CustomerAnalysis = {
  condition: {
    grade: string;
    overallDamageSeverity: number;
    summary: string;
  };
  estimatedReusableAreaCm2: number;
  estimatedReusableMaterialRate: number;
  damages: Array<{
    confidence: number;
    location: string;
    severity: number;
    type: string;
  }>;
  estimateMeta?: {
    confidencePercent: number;
    notice: string;
  };
  esgPreview?: {
    estimatedCarbonSavingKgCo2e: number;
    methodologyVersion: string;
  };
  id: string;
  longStripAvailable: boolean;
  modeUsed: "DEMO_FIXTURE" | "LIVE" | "SEEDED_ESTIMATE";
  authenticityPrecheck?: {
    estimatePercent: number;
    status: string;
  };
  recommendations: Array<{
    eligible: boolean;
    estimatedReusableMaterialRate: number;
    productId: string;
    score: number;
  }>;
  sourceProduct: {
    category: string;
    confidence: number;
    materialType: string;
  };
  provider: {
    model: string;
    name: "DEMO_DATA" | "OPENAI";
    requestId: string | null;
  };
  warnings: Array<{ code: string; message: string }>;
};

export type CustomerChangeRequest = {
  applicationId: string;
  createdAt: string;
  id: string;
  previousTerms: CustomerTerms;
  proposedTerms: CustomerTerms;
  reason: string;
  respondedAt: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export type CustomerShipment = {
  applicationId: string;
  carrierCode: string;
  carrierName: string;
  status: string;
  trackingNumber: string;
};

export type CustomerCertificate = {
  applicationNumber: string;
  certificateNumber: string;
  certificateId: string;
  disclaimer: string;
  estimatedCarbonSavingKgCo2e: number;
  issuedAt: string;
  methodologyVersion: string;
  rebornProduct: string;
  reusedAreaCm2: number;
  reusedMaterialRate: number;
  sourceCategory: string;
  verificationCode: string;
};

export type CustomerMe = {
  displayName: string;
  email: string;
  id: string;
  role: "CUSTOMER";
};

export class CustomerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CustomerApiError";
  }
}

export function clearCustomerSession() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
    window.dispatchEvent(new Event(CUSTOMER_SESSION_EVENT));
  }
}

export function subscribeCustomerSession(listener: () => void) {
  window.addEventListener(CUSTOMER_SESSION_EVENT, listener);
  return () => window.removeEventListener(CUSTOMER_SESSION_EVENT, listener);
}

export async function loginCustomerCredentials(
  email: string,
  password: string,
): Promise<CustomerSession> {
  const response = await fetch("/api/v2/auth/login", {
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorRecord = readRecord(payload)?.error;
    throw new CustomerApiError(
      readStringValue(errorRecord, "message") ?? "로그인에 실패했습니다.",
      response.status,
    );
  }
  const parsed = parseCustomerSession(payload);
  storeCustomerSession(parsed);
  return parsed;
}

export async function getCustomerSession(): Promise<CustomerSession> {
  if (typeof window === "undefined") {
    throw new CustomerApiError("고객 세션은 브라우저에서만 사용할 수 있습니다.", 0);
  }

  const stored = readStoredSession();
  if (stored) {
    return stored;
  }

  throw new CustomerApiError(
    "고객 로그인이 필요합니다.",
    401,
  );
}

export async function customerFetch<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  let session: CustomerSession;
  try {
    session = await getCustomerSession();
  } catch (error) {
    redirectToLoginWhenExpired(error);
    throw error;
  }
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (
    init.method &&
    init.method.toUpperCase() !== "GET" &&
    !headers.has("Idempotency-Key")
  ) {
    headers.set("Idempotency-Key", `customer-${crypto.randomUUID()}`);
  }

  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      clearCustomerSession();
      redirectToLogin();
    }
    const errorRecord = readRecord(payload)?.error;
    const message =
      readStringValue(errorRecord, "message") ??
      "고객 API 요청을 처리하지 못했습니다.";
    throw new CustomerApiError(message, response.status);
  }
  return payload as T;
}

export function readImageUrl(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value;
  }
  const record = readRecord(value);
  return typeof record?.url === "string" ? record.url : fallback;
}

export function readJsonString(value: unknown, key: string) {
  const record = readRecord(value);
  return typeof record?.[key] === "string" ? record[key] : "";
}

export function applicationStatusToOrderStage(
  value: string,
): OrderStage {
  if (value === "CHANGE_APPROVAL_REQUIRED") {
    return "change-required";
  }
  if (value === "PRODUCTION_READY") {
    return "production-ready";
  }
  if (value === "IN_PRODUCTION") {
    return "production";
  }
  if (value === "QUALITY_CHECK") {
    return "quality";
  }
  if (value === "SHIPPED" || value === "DELIVERED") {
    return "shipping";
  }
  if (value === "COMPLETED") {
    return "completed";
  }
  if (value === "PRODUCTION_UNAVAILABLE" || value === "CANCELED") {
    return "canceled";
  }
  if (value === "PRODUCT_RECEIVED" || value === "EXPERT_INSPECTION") {
    return "inspection";
  }
  return "pickup";
}

function parseCustomerSession(payload: unknown): CustomerSession {
  const sessionRecord = readRecord(readRecord(payload)?.session);
  const userRecord = readRecord(readRecord(payload)?.user);
  const accessToken = readStringValue(sessionRecord, "accessToken");
  const expiresAt = readStringValue(sessionRecord, "expiresAt");
  const displayName = readStringValue(userRecord, "displayName");
  const email = readStringValue(userRecord, "email");
  const id = readStringValue(userRecord, "id");
  if (
    !accessToken ||
    !expiresAt ||
    readStringValue(userRecord, "role") !== "CUSTOMER" ||
    !displayName ||
    !email ||
    !id
  ) {
    throw new CustomerApiError("고객 인증 응답이 올바르지 않습니다.", 502);
  }
  return {
    accessToken,
    expiresAt,
    user: { displayName, email, id, role: "CUSTOMER" },
  };
}

function storeCustomerSession(session: CustomerSession) {
  window.sessionStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(CUSTOMER_SESSION_EVENT));
}

function readStoredSession(): CustomerSession | null {
  const raw = window.sessionStorage.getItem(CUSTOMER_SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<CustomerSession>;
    if (
      typeof value.accessToken !== "string" ||
      typeof value.expiresAt !== "string" ||
      value.user?.role !== "CUSTOMER"
    ) {
      clearCustomerSession();
      return null;
    }
    if (Date.parse(value.expiresAt) <= Date.now() + 30_000) {
      clearCustomerSession();
      throw new CustomerApiError(
        "고객 서비스 세션이 만료되었습니다. 다시 로그인해 주세요.",
        401,
      );
    }
    return value as CustomerSession;
  } catch (error) {
    clearCustomerSession();
    if (error instanceof CustomerApiError) {
      throw error;
    }
    return null;
  }
}

function redirectToLoginWhenExpired(error: unknown) {
  if (error instanceof CustomerApiError && error.status === 401) {
    redirectToLogin();
  }
}

function redirectToLogin() {
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login?reason=session-expired");
  }
}

function readStringValue(value: unknown, key: string): string | null {
  const record = readRecord(value);
  return typeof record?.[key] === "string" ? record[key] : null;
}

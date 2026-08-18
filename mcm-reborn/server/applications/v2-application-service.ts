import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AppError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  UpstreamError,
  ValidationError,
} from "@/contracts/errors";
import {
  createAdminSupabaseClient,
  createUserSupabaseClient,
} from "@/lib/supabase/server";
import { getAnalysisById } from "@/server/analyses/analysisService";
import type { AuthenticatedUser } from "@/server/auth/middleware";
import type {
  CreateApplicationRequest,
  MockPaymentRequest,
  RejectApplicationChangeRequest,
} from "@/server/applications/v2-validation";

export const APPLICATION_STATUSES = [
  "PENDING_PAYMENT",
  "ORDER_PLACED",
  "PICKUP_SCHEDULED",
  "PICKUP_IN_PROGRESS",
  "PRODUCT_RECEIVED",
  "EXPERT_INSPECTION",
  "PRODUCTION_READY",
  "CHANGE_APPROVAL_REQUIRED",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "PRODUCTION_UNAVAILABLE",
  "CANCELED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

type JsonRecord = Record<string, unknown>;

type ApplicationRow = {
  analysis_id: string;
  application_number: string;
  consents: JsonRecord;
  created_at: string;
  customer_id: string;
  demo_progress_profile: "PRIMARY_SCENARIO" | "STATIC";
  final_terms: JsonRecord | null;
  id: string;
  initial_terms: JsonRecord;
  inspection_completed_at: string | null;
  persisted_status: ApplicationStatus;
  pickup_schedule: JsonRecord;
  product_id: string;
  selected_options: JsonRecord;
  shipping_address: JsonRecord;
  status_override: "PRODUCTION_UNAVAILABLE" | "CANCELED" | null;
  updated_at: string;
};

type ProductRow = {
  active: boolean;
  category: string;
  code: string;
  estimated_duration: string;
  id: string;
  list_image: JsonRecord;
  mock_price_krw: number;
  model_3d: JsonRecord;
  model_3d_ready: boolean;
  name: string;
  option_groups: unknown;
  required_area_cm2: number;
};

type RecommendationRow = {
  analysis_id: string;
  eligible: boolean;
  estimated_reusable_material_rate: number;
  product_id: string;
  reason_codes: unknown[];
  score: number;
};

type ChangeRequestRow = {
  application_id: string;
  created_at: string;
  id: string;
  inspection_id: string;
  previous_terms: JsonRecord;
  proposed_terms: JsonRecord;
  reason: string;
  responded_at: string | null;
  response_reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type IdempotencyRow = {
  expires_at: string;
  operation: string;
  request_hash: string;
  resource_id: string | null;
  response_body: unknown;
  response_status: number | null;
  user_id: string;
};

export type ApiResult<T = unknown> = {
  body: T;
  status: number;
};

type IdempotentCommandOptions<TBody, TResult> = {
  body: TBody;
  execute: () => Promise<ApiResult<TResult>>;
  idempotencyKey: string;
  operation: string;
  resourceId: string | null;
  user: AuthenticatedUser;
};

const APPLICATION_SELECT = [
  "id",
  "application_number",
  "customer_id",
  "analysis_id",
  "product_id",
  "persisted_status",
  "status_override",
  "selected_options",
  "shipping_address",
  "pickup_schedule",
  "consents",
  "initial_terms",
  "final_terms",
  "inspection_completed_at",
  "demo_progress_profile",
  "created_at",
  "updated_at",
].join(",");

const PRODUCT_SELECT = [
  "id",
  "code",
  "name",
  "category",
  "required_area_cm2",
  "mock_price_krw",
  "estimated_duration",
  "list_image",
  "model_3d",
  "model_3d_ready",
  "option_groups",
  "active",
].join(",");

const RECOMMENDATION_SELECT = [
  "analysis_id",
  "product_id",
  "eligible",
  "score",
  "estimated_reusable_material_rate",
  "reason_codes",
].join(",");

const CHANGE_REQUEST_SELECT = [
  "id",
  "application_id",
  "inspection_id",
  "status",
  "reason",
  "previous_terms",
  "proposed_terms",
  "response_reason",
  "created_at",
  "responded_at",
].join(",");

const TIMELINE_STEPS: ReadonlyArray<{
  label: string;
  status: ApplicationStatus;
}> = [
  { label: "결제 대기", status: "PENDING_PAYMENT" },
  { label: "주문 접수", status: "ORDER_PLACED" },
  { label: "수거 예정", status: "PICKUP_SCHEDULED" },
  { label: "수거 중", status: "PICKUP_IN_PROGRESS" },
  { label: "제품 입고", status: "PRODUCT_RECEIVED" },
  { label: "전문가 실물 검수", status: "EXPERT_INSPECTION" },
  { label: "변경 조건 확인", status: "CHANGE_APPROVAL_REQUIRED" },
  { label: "제작 준비", status: "PRODUCTION_READY" },
  { label: "제작 중", status: "IN_PRODUCTION" },
  { label: "품질 검수", status: "QUALITY_CHECK" },
  { label: "배송 중", status: "SHIPPED" },
  { label: "배송 완료", status: "DELIVERED" },
  { label: "업사이클링 완료", status: "COMPLETED" },
];

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function effectiveStatus(row: ApplicationRow): ApplicationStatus {
  return row.status_override ?? row.persisted_status;
}

export async function executeIdempotentApplicationCommand<TBody, TResult>({
  body,
  execute,
  idempotencyKey,
  operation,
  resourceId,
  user,
}: IdempotentCommandOptions<TBody, TResult>): Promise<ApiResult<TResult>> {
  const admin = createAdminSupabaseClient();
  const requestHash = createHash("sha256")
    .update(stableStringify({ body, operation, resourceId }))
    .digest("hex");
  const storageKey = namespacedIdempotencyKey(
    user.id,
    operation,
    idempotencyKey,
  );

  const reservation = await reserveIdempotencyKey(admin, {
    idempotencyKey: storageKey,
    operation,
    requestHash,
    resourceId,
    userId: user.id,
  });

  if (reservation.kind === "cached") {
    return {
      body: reservation.body as TResult,
      status: reservation.status,
    };
  }
  if (reservation.kind === "in-progress") {
    throw new ConflictError(
      "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      "The same idempotent request is already in progress",
      { retryable: true },
    );
  }

  let result: ApiResult<TResult>;
  try {
    result = await execute();
  } catch (error) {
    await releaseFailedReservation(admin, storageKey, requestHash);
    throw error;
  }

  const { data, error } = await admin
    .from("idempotency_keys")
    .update({
      response_body: result.body,
      response_status: result.status,
    })
    .eq("key", storageKey)
    .eq("request_hash", requestHash)
    .select("key");

  if (error || !Array.isArray(data) || data.length !== 1) {
    // The domain write has already completed. Returning it is safer than
    // reporting a failure that could encourage a duplicate mutation.
    return result;
  }

  return result;
}

export function deterministicResourceId(
  userId: string,
  operation: string,
  idempotencyKey: string,
): string {
  const bytes = Buffer.from(
    createHash("sha256")
      .update(`${userId}:${operation}:${idempotencyKey}`)
      .digest("hex")
      .slice(0, 32),
    "hex",
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export async function createApplication(
  user: AuthenticatedUser,
  input: CreateApplicationRequest,
  applicationId: string,
): Promise<ApiResult> {
  const userClient = createUserSupabaseClient(user.accessToken);
  const admin = createAdminSupabaseClient();

  const { data: analysis, error: analysisError } = await userClient
    .from("analyses")
    .select("id,status,authenticity_precheck_status,customer_id")
    .eq("id", input.analysisId)
    .eq("customer_id", user.id)
    .maybeSingle();
  assertDatabaseRead(analysisError, "analysis");
  if (!analysis) {
    throw new NotFoundError("Analysis");
  }
  if (analysis.status !== "COMPLETED") {
    throw new ConflictError(
      "ANALYSIS_NOT_COMPLETED",
      "The analysis must be completed before an application is created",
    );
  }
  if (analysis.authenticity_precheck_status !== "ORDER_ELIGIBLE") {
    throw new ConflictError(
      "ANALYSIS_NOT_ORDER_ELIGIBLE",
      "The analysis is not eligible for ordering",
    );
  }

  const { data: existingApplication, error: existingApplicationError } =
    await admin
      .from("applications")
      .select("id")
      .eq("analysis_id", input.analysisId)
      .maybeSingle();
  assertDatabaseRead(existingApplicationError, "application by analysis");
  if (existingApplication && existingApplication.id !== applicationId) {
    throw new ConflictError(
      "ANALYSIS_ALREADY_ORDERED",
      "This analysis already belongs to another application",
    );
  }

  const [product, recommendation] = await Promise.all([
    readProduct(admin, input.productId),
    readRecommendation(admin, input.analysisId, input.productId),
  ]);
  if (!product || !product.active) {
    throw new NotFoundError("Product");
  }
  if (!recommendation?.eligible) {
    throw new ConflictError(
      "PRODUCT_NOT_RECOMMENDED",
      "The selected product is not an eligible recommendation",
    );
  }
  validateSelectedOptions(input.selectedOptions, product.option_groups);

  const initialTerms = {
    amount: money(product.mock_price_krw),
    estimatedDuration: product.estimated_duration,
    estimatedReusableMaterialRate:
      recommendation.estimated_reusable_material_rate,
    productId: product.id,
  };
  const createdAt = new Date();
  const applicationNumber = await nextApplicationNumber(admin, createdAt);

  const { data: inserted, error: insertError } = await admin
    .from("applications")
    .insert({
      analysis_id: input.analysisId,
      application_number: applicationNumber,
      consents: input.consents,
      created_at: createdAt.toISOString(),
      customer_id: user.id,
      id: applicationId,
      initial_terms: initialTerms,
      persisted_status: "PENDING_PAYMENT",
      pickup_schedule: input.pickupSchedule,
      product_id: input.productId,
      selected_options: input.selectedOptions,
      shipping_address: input.shippingAddress,
    })
    .select(APPLICATION_SELECT)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const recovered = await readApplicationById(admin, applicationId);
      if (recovered && recovered.customer_id === user.id) {
        return {
          body: applicationSummary(recovered, product, recommendation),
          status: 201,
        };
      }
      const { data: duplicateAnalysis, error: duplicateAnalysisError } =
        await admin
          .from("applications")
          .select("id")
          .eq("analysis_id", input.analysisId)
          .maybeSingle();
      assertDatabaseRead(duplicateAnalysisError, "application by analysis");
      if (duplicateAnalysis) {
        throw new ConflictError(
          "ANALYSIS_ALREADY_ORDERED",
          "This analysis already belongs to another application",
        );
      }
      throw new ConflictError(
        "APPLICATION_NUMBER_CONFLICT",
        "An application number could not be allocated; retry with a new idempotency key",
      );
    }
    throw databaseWriteFailure("application creation", insertError);
  }

  return {
    body: applicationSummary(
      inserted as unknown as ApplicationRow,
      product,
      recommendation,
    ),
    status: 201,
  };
}

export async function listMyApplications(
  user: AuthenticatedUser,
  options: {
    page: number;
    size: number;
    status: ApplicationStatus | null;
  },
): Promise<ApiResult> {
  const userClient = createUserSupabaseClient(user.accessToken);
  let query = userClient
    .from("applications")
    .select(APPLICATION_SELECT, { count: "exact" })
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.or(
      `and(status_override.is.null,persisted_status.eq.${options.status}),status_override.eq.${options.status}`,
    );
  }

  const from = options.page * options.size;
  const { count, data, error } = await query.range(
    from,
    from + options.size - 1,
  );
  assertDatabaseRead(error, "applications");

  const rows = (data ?? []) as unknown as ApplicationRow[];
  const items = await Promise.all(
    rows.map(async (row) => {
      const { product, recommendation } = await readProductContext(row);
      return applicationSummary(row, product, recommendation);
    }),
  );
  const totalElements = count ?? 0;

  return {
    body: {
      items,
      page: options.page,
      size: options.size,
      totalElements,
      totalPages: Math.ceil(totalElements / options.size),
    },
    status: 200,
  };
}

export async function getApplication(
  user: AuthenticatedUser,
  applicationId: string,
): Promise<ApiResult> {
  const row = await readOwnedApplication(user, applicationId);
  const { product, recommendation } = await readProductContext(row);
  return {
    body: applicationDetail(row, product, recommendation),
    status: 200,
  };
}

export async function listApplicationsForOperator(
  user: AuthenticatedUser,
  options: {
    page: number;
    query: string | null;
    size: number;
    status: ApplicationStatus | null;
  },
): Promise<ApiResult> {
  const userClient = createUserSupabaseClient(user.accessToken);
  let matchingIds: string[] | null = null;

  if (options.query) {
    const pattern = `%${options.query}%`;
    const [{ data: matchingProfiles, error: profileError }, {
      data: matchingApplications,
      error: applicationError,
    }] = await Promise.all([
      userClient
        .from("profiles")
        .select("id")
        .ilike("display_name", pattern)
        .limit(500),
      userClient
        .from("applications")
        .select("id")
        .ilike("application_number", pattern)
        .limit(500),
    ]);
    assertDatabaseRead(profileError, "customer search");
    assertDatabaseRead(applicationError, "application search");
    const customerIds = (matchingProfiles ?? []).map((row) => row.id);

    let customerApplicationIds: string[] = [];
    if (customerIds.length > 0) {
      const { data, error } = await userClient
        .from("applications")
        .select("id")
        .in("customer_id", customerIds)
        .limit(500);
      assertDatabaseRead(error, "customer application search");
      customerApplicationIds = (data ?? []).map((row) => row.id);
    }

    matchingIds = [
      ...new Set([
        ...(matchingApplications ?? []).map((row) => row.id),
        ...customerApplicationIds,
      ]),
    ];
    if (matchingIds.length === 0) {
      return {
        body: paged([], options.page, options.size, 0),
        status: 200,
      };
    }
  }

  let query = userClient
    .from("applications")
    .select(APPLICATION_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });
  if (matchingIds) {
    query = query.in("id", matchingIds);
  }
  if (options.status) {
    query = query.or(
      `and(status_override.is.null,persisted_status.eq.${options.status}),status_override.eq.${options.status}`,
    );
  }

  const from = options.page * options.size;
  const { count, data, error } = await query.range(
    from,
    from + options.size - 1,
  );
  assertDatabaseRead(error, "operator applications");
  const rows = (data ?? []) as unknown as ApplicationRow[];
  const items = await Promise.all(
    rows.map((row) => operatorApplicationSummary(user, row)),
  );

  return {
    body: paged(items, options.page, options.size, count ?? 0),
    status: 200,
  };
}

export async function getApplicationForOperator(
  user: AuthenticatedUser,
  applicationId: string,
): Promise<ApiResult> {
  const userClient = createUserSupabaseClient(user.accessToken);
  const { data, error } = await userClient
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .maybeSingle();
  assertDatabaseRead(error, "operator application");
  if (!data) {
    throw new NotFoundError("Application");
  }
  const row = data as unknown as ApplicationRow;
  const [{ product, recommendation }, customer, analysis, sourceImages,
    inspectionAvailable] = await Promise.all([
    readProductContext(row),
    readCustomer(user, row.customer_id),
    getAnalysisById(row.analysis_id, {
      accessToken: user.accessToken,
      id: user.id,
      role: "OPERATOR",
    }),
    readSourceImages(row.analysis_id),
    isInspectionAvailable(row),
  ]);

  return {
    body: {
      analysis,
      application: applicationDetail(row, product, recommendation),
      customer,
      inspectionAvailable,
      sourceImages,
    },
    status: 200,
  };
}

export async function completeMockPayment(
  user: AuthenticatedUser,
  applicationId: string,
  input: MockPaymentRequest,
): Promise<ApiResult> {
  const row = await readOwnedApplication(user, applicationId);
  const currentStatus = effectiveStatus(row);
  if (currentStatus !== "PENDING_PAYMENT") {
    throw new ConflictError(
      "PAYMENT_ALREADY_COMPLETED",
      "Payment can be processed only while the application is pending payment",
      { currentStatus },
    );
  }

  const terms = readTerms(row.initial_terms);
  const paidAt = new Date().toISOString();
  const paymentId = randomUUID();
  const transactionId = paymentTransactionId(applicationId, paidAt);

  if (input.simulate === "FAILURE") {
    return {
      body: {
        applicationStatus: "PENDING_PAYMENT",
        paidAmount: terms.amount,
        paidAt,
        paymentId,
        status: "FAILED",
        transactionId,
      },
      status: 200,
    };
  }

  const admin = createAdminSupabaseClient();
  const { data: existingPayment, error: existingError } = await admin
    .from("mock_payments")
    .select("id,transaction_id,status,amount_krw,paid_at")
    .eq("application_id", applicationId)
    .maybeSingle();
  assertDatabaseRead(existingError, "mock payment");
  if (existingPayment) {
    throw new ConflictError(
      "PAYMENT_ALREADY_COMPLETED",
      "A payment has already been processed for this application",
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from("mock_payments")
    .insert({
      amount_krw: terms.amount.amount,
      application_id: applicationId,
      id: paymentId,
      method: input.method,
      paid_at: paidAt,
      status: "PAID",
      transaction_id: transactionId,
    })
    .select("id,transaction_id,status,amount_krw,paid_at")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      throw new ConflictError(
        "PAYMENT_ALREADY_COMPLETED",
        "A payment has already been processed for this application",
      );
    }
    throw databaseWriteFailure("mock payment", insertError);
  }

  return {
    body: {
      applicationStatus: "ORDER_PLACED",
      paidAmount: money(inserted.amount_krw),
      paidAt: inserted.paid_at,
      paymentId: inserted.id,
      status: inserted.status,
      transactionId: inserted.transaction_id,
    },
    status: 200,
  };
}

export async function getApplicationTimeline(
  user: AuthenticatedUser,
  applicationId: string,
): Promise<ApiResult> {
  const application = await readOwnedApplication(user, applicationId);
  const userClient = createUserSupabaseClient(user.accessToken);
  const { data, error } = await userClient
    .from("application_status_history")
    .select("status,note,occurred_at")
    .eq("application_id", applicationId)
    .order("occurred_at", { ascending: true });
  assertDatabaseRead(error, "application timeline");

  const history = new Map<
    ApplicationStatus,
    { note: string | null; occurredAt: string }
  >();
  for (const row of data ?? []) {
    if (isApplicationStatus(row.status)) {
      history.set(row.status, {
        note: typeof row.note === "string" ? row.note : null,
        occurredAt: row.occurred_at,
      });
    }
  }

  const current = effectiveStatus(application);
  const visibleSteps = TIMELINE_STEPS.filter((step) =>
    step.status !== "CHANGE_APPROVAL_REQUIRED" ||
    current === "CHANGE_APPROVAL_REQUIRED" ||
    history.has("CHANGE_APPROVAL_REQUIRED")
  );
  const steps = visibleSteps.map((step) => {
    const event = history.get(step.status);
    const state = step.status === current
      ? "CURRENT"
      : event
        ? "COMPLETED"
        : "UPCOMING";
    return {
      description: event?.note ?? null,
      label: step.label,
      occurredAt: event?.occurredAt ?? null,
      state,
      status: step.status,
    };
  });

  if (current === "PRODUCTION_UNAVAILABLE" || current === "CANCELED") {
    const event = history.get(current);
    steps.push({
      description: event?.note ?? null,
      label: current === "CANCELED" ? "신청 취소" : "제작 불가",
      occurredAt: event?.occurredAt ?? null,
      state: "EXCEPTION",
      status: current,
    });
  }

  return {
    body: {
      applicationId,
      effectiveStatus: current,
      refreshedAt: new Date().toISOString(),
      steps,
    },
    status: 200,
  };
}

export async function getMockShipment(
  user: AuthenticatedUser,
  applicationId: string,
): Promise<ApiResult> {
  await readOwnedApplication(user, applicationId);
  const userClient = createUserSupabaseClient(user.accessToken);
  const { data, error } = await userClient
    .from("mock_shipments")
    .select(
      "application_id,carrier_code,carrier_name,tracking_number,status",
    )
    .eq("application_id", applicationId)
    .maybeSingle();
  assertDatabaseRead(error, "shipment");
  if (!data) {
    throw new NotFoundError("Shipment");
  }

  return {
    body: shipmentResponse(data),
    status: 200,
  };
}

export async function getCertificateByApplication(
  user: AuthenticatedUser,
  applicationId: string,
): Promise<ApiResult> {
  const application = await readOwnedApplication(user, applicationId);
  if (effectiveStatus(application) !== "COMPLETED") {
    throw new ConflictError(
      "CERTIFICATE_NOT_READY",
      "A certificate can be issued only after the application is completed",
      { currentStatus: effectiveStatus(application) },
    );
  }

  const userClient = createUserSupabaseClient(user.accessToken);
  const { data: existing, error: existingError } = await userClient
    .from("esg_certificates")
    .select(
      "id,application_id,certificate_number,verification_code,payload,issued_at",
    )
    .eq("application_id", applicationId)
    .maybeSingle();
  assertDatabaseRead(existingError, "certificate");
  if (existing) {
    return {
      body: certificateResponse(existing, application.application_number),
      status: 200,
    };
  }

  // Certificate writes are intentionally revoked from authenticated users.
  // Ownership and COMPLETED state were verified above before this service-role
  // issuance path is entered; the DB trigger independently enforces the state.
  const admin = createAdminSupabaseClient();
  const [{ data: analysis, error: analysisError }, {
    data: inspection,
    error: inspectionError,
  }, { product }] = await Promise.all([
    admin
      .from("analyses")
      .select(
        "source_category,estimated_reusable_material_rate,estimated_carbon_saving_kg",
      )
      .eq("id", application.analysis_id)
      .maybeSingle(),
    admin
      .from("physical_inspections")
      .select(
        "confirmed_reusable_material_rate,confirmed_reusable_area_cm2",
      )
      .eq("application_id", applicationId)
      .maybeSingle(),
    readProductContext(application),
  ]);
  assertDatabaseRead(analysisError, "certificate analysis");
  assertDatabaseRead(inspectionError, "physical inspection");
  if (!analysis || !inspection) {
    throw new UpstreamError("Completed application evidence is incomplete", {
      retryable: false,
    });
  }

  const estimatedCarbon = Number(analysis.estimated_carbon_saving_kg);
  const estimatedRate = Number(analysis.estimated_reusable_material_rate);
  const finalRate = inspection.confirmed_reusable_material_rate;
  const carbonSaving = Number.isFinite(estimatedCarbon) && estimatedRate > 0
    ? Math.round((estimatedCarbon * finalRate / estimatedRate) * 100) / 100
    : 0;
  const issuedAt = new Date().toISOString();
  const certificateNumber = `ESG-${application.application_number}`;
  const payload = {
    applicationNumber: application.application_number,
    disclaimer: "시연용 예상 기반 보증서이며 법적·상업적 효력이 없습니다.",
    estimatedCarbonSavingKgCo2e: carbonSaving,
    methodologyVersion: "DEMO_LCA_V2",
    rebornProduct: product.name,
    reusedAreaCm2: inspection.confirmed_reusable_area_cm2,
    reusedMaterialRate: inspection.confirmed_reusable_material_rate,
    sourceCategory: analysis.source_category,
  };
  const certificateId = randomUUID();
  const { data: inserted, error: insertError } = await admin
    .from("esg_certificates")
    .insert({
      application_id: applicationId,
      certificate_number: certificateNumber,
      id: certificateId,
      issued_at: issuedAt,
      payload,
      verification_code: verificationCode(application.application_number),
    })
    .select(
      "id,application_id,certificate_number,verification_code,payload,issued_at",
    )
    .single();

  if (insertError) {
    if (insertError.code === "23514") {
      throw new ConflictError(
        "CERTIFICATE_NOT_READY",
        "The application is no longer eligible for certificate issuance",
      );
    }
    if (insertError.code === "23505") {
      const { data: raced, error: racedError } = await admin
        .from("esg_certificates")
        .select(
          "id,application_id,certificate_number,verification_code,payload,issued_at",
        )
        .eq("application_id", applicationId)
        .maybeSingle();
      assertDatabaseRead(racedError, "certificate");
      if (raced) {
        return {
          body: certificateResponse(raced, application.application_number),
          status: 200,
        };
      }
    }
    throw databaseWriteFailure("certificate issuance", insertError);
  }

  return {
    body: certificateResponse(inserted, application.application_number),
    status: 200,
  };
}

export async function verifyCertificate(
  certificateId: string,
): Promise<ApiResult> {
  const admin = createAdminSupabaseClient();
  const { data: certificate, error } = await admin
    .from("esg_certificates")
    .select(
      "id,application_id,certificate_number,verification_code,payload,issued_at",
    )
    .eq("id", certificateId)
    .maybeSingle();
  assertDatabaseRead(error, "certificate");
  if (!certificate) {
    throw new NotFoundError("Certificate");
  }

  const application = await readApplicationById(
    admin,
    certificate.application_id,
  );
  if (!application) {
    throw new NotFoundError("Certificate application");
  }
  return {
    body: {
      certificate: certificateResponse(
        certificate,
        application.application_number,
      ),
      valid: true,
    },
    status: 200,
  };
}

export async function getApplicationChangeRequest(
  user: AuthenticatedUser,
  applicationId: string,
): Promise<ApiResult> {
  await readOwnedApplication(user, applicationId);
  const userClient = createUserSupabaseClient(user.accessToken);
  const { data, error } = await userClient
    .from("application_change_requests")
    .select(CHANGE_REQUEST_SELECT)
    .eq("application_id", applicationId)
    .maybeSingle();
  assertDatabaseRead(error, "change request");
  if (!data) {
    throw new NotFoundError("Application change request");
  }

  return {
    body: changeRequestResponse(data as unknown as ChangeRequestRow),
    status: 200,
  };
}

export async function decideApplicationChangeRequest(
  user: AuthenticatedUser,
  applicationId: string,
  decision: "APPROVED" | "REJECTED",
  input: RejectApplicationChangeRequest | null,
): Promise<ApiResult> {
  await readOwnedApplication(user, applicationId);
  const userClient = createUserSupabaseClient(user.accessToken);
  const { data: current, error: currentError } = await userClient
    .from("application_change_requests")
    .select(CHANGE_REQUEST_SELECT)
    .eq("application_id", applicationId)
    .maybeSingle();
  assertDatabaseRead(currentError, "change request");
  if (!current) {
    throw new NotFoundError("Application change request");
  }
  const currentRow = current as unknown as ChangeRequestRow;
  if (currentRow.status !== "PENDING") {
    throw new ConflictError(
      "CHANGE_REQUEST_ALREADY_DECIDED",
      "The change request has already been decided",
      { currentDecision: currentRow.status },
    );
  }

  const update = decision === "REJECTED"
    ? { response_reason: input?.reason ?? null, status: decision }
    : { status: decision };
  const { data: rows, error: updateError } = await userClient
    .from("application_change_requests")
    .update(update)
    .eq("id", currentRow.id)
    .eq("status", "PENDING")
    .select(CHANGE_REQUEST_SELECT);
  if (updateError) {
    if (["23514", "P0001"].includes(updateError.code)) {
      throw new ConflictError(
        "APPLICATION_STATE_CONFLICT",
        "The application is not ready for this change decision",
      );
    }
    throw databaseWriteFailure("change request decision", updateError);
  }
  if (!rows || rows.length !== 1) {
    throw new ConflictError(
      "CHANGE_REQUEST_ALREADY_DECIDED",
      "The change request was decided by another request",
    );
  }

  const decided = rows[0] as unknown as ChangeRequestRow;
  if (!decided.responded_at) {
    throw new UpstreamError("Change request response time was not recorded", {
      retryable: false,
    });
  }

  return {
    body: {
      applicationId,
      applicationStatus: decision === "APPROVED"
        ? "PRODUCTION_READY"
        : "CANCELED",
      changeRequestId: decided.id,
      decision,
      respondedAt: decided.responded_at,
    },
    status: 200,
  };
}

async function reserveIdempotencyKey(
  admin: SupabaseClient,
  input: {
    idempotencyKey: string;
    operation: string;
    requestHash: string;
    resourceId: string | null;
    userId: string;
  },
): Promise<
  | { kind: "reserved" }
  | { body: unknown; kind: "cached"; status: number }
  | { kind: "in-progress" }
> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await admin.from("idempotency_keys").insert({
      key: input.idempotencyKey,
      operation: input.operation,
      request_hash: input.requestHash,
      resource_id: input.resourceId,
      user_id: input.userId,
    });
    if (!error) {
      return { kind: "reserved" };
    }
    if (error.code !== "23505") {
      throw databaseWriteFailure("idempotency reservation", error);
    }

    const { data: existing, error: readError } = await admin
      .from("idempotency_keys")
      .select(
        "user_id,operation,resource_id,request_hash,response_status,response_body,expires_at",
      )
      .eq("key", input.idempotencyKey)
      .maybeSingle();
    assertDatabaseRead(readError, "idempotency reservation");
    if (!existing) {
      return { kind: "in-progress" };
    }
    const row = existing as IdempotencyRow;
    const expiresAt = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresAt)) {
      throw new UpstreamError("Stored idempotency expiry is malformed", {
        retryable: false,
      });
    }
    if (expiresAt <= Date.now()) {
      const { data: deleted, error: deleteError } = await admin
        .from("idempotency_keys")
        .delete()
        .eq("key", input.idempotencyKey)
        .eq("expires_at", row.expires_at)
        .select("key");
      if (deleteError) {
        throw databaseWriteFailure("expired idempotency reclamation", deleteError);
      }
      if (deleted?.length === 1) {
        continue;
      }
      return { kind: "in-progress" };
    }

    if (
      row.user_id !== input.userId ||
      row.operation !== input.operation ||
      row.resource_id !== input.resourceId ||
      row.request_hash !== input.requestHash
    ) {
      throw new ConflictError(
        "IDEMPOTENCY_KEY_REUSED",
        "The same Idempotency-Key cannot be reused for a different request",
      );
    }
    if (row.response_status !== null && row.response_body !== null) {
      return {
        body: row.response_body,
        kind: "cached",
        status: row.response_status,
      };
    }
    return { kind: "in-progress" };
  }

  return { kind: "in-progress" };
}

async function releaseFailedReservation(
  admin: SupabaseClient,
  idempotencyKey: string,
  requestHash: string,
): Promise<void> {
  await admin
    .from("idempotency_keys")
    .delete()
    .eq("key", idempotencyKey)
    .eq("request_hash", requestHash)
    .is("response_status", null);
}

async function readOwnedApplication(
  user: AuthenticatedUser,
  applicationId: string,
): Promise<ApplicationRow> {
  const userClient = createUserSupabaseClient(user.accessToken);
  const { data, error } = await userClient
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .eq("customer_id", user.id)
    .maybeSingle();
  assertDatabaseRead(error, "application");
  if (!data) {
    throw new NotFoundError("Application");
  }
  return data as unknown as ApplicationRow;
}

async function operatorApplicationSummary(
  operator: AuthenticatedUser,
  row: ApplicationRow,
): Promise<JsonRecord> {
  const [{ product, recommendation }, customer, inspectionAvailable] =
    await Promise.all([
      readProductContext(row),
      readCustomer(operator, row.customer_id),
      isInspectionAvailable(row),
    ]);
  return {
    applicationNumber: row.application_number,
    createdAt: row.created_at,
    customer,
    effectiveStatus: effectiveStatus(row),
    id: row.id,
    inspectionAvailable,
    product: productCard(product, recommendation),
  };
}

async function readCustomer(
  operator: AuthenticatedUser,
  customerId: string,
): Promise<JsonRecord> {
  const userClient = createUserSupabaseClient(operator.accessToken);
  const admin = createAdminSupabaseClient();
  const [{ data: profile, error: profileError }, { data: authData,
    error: authError }] = await Promise.all([
    userClient
      .from("profiles")
      .select("id,role,display_name")
      .eq("id", customerId)
      .maybeSingle(),
    admin.auth.admin.getUserById(customerId),
  ]);
  assertDatabaseRead(profileError, "customer profile");
  if (authError) {
    throw new ServiceUnavailableError("Unable to read customer identity", {
      retryable: true,
    });
  }
  if (!profile || !authData.user?.email) {
    throw new UpstreamError("Application customer identity is incomplete", {
      retryable: false,
    });
  }
  return {
    displayName: profile.display_name,
    email: authData.user.email,
    id: profile.id,
    role: profile.role,
  };
}

async function isInspectionAvailable(row: ApplicationRow): Promise<boolean> {
  if (!["PRODUCT_RECEIVED", "EXPERT_INSPECTION"].includes(row.persisted_status)) {
    return false;
  }
  const admin = createAdminSupabaseClient();
  const { count, error } = await admin
    .from("physical_inspections")
    .select("id", { count: "exact", head: true })
    .eq("application_id", row.id);
  assertDatabaseRead(error, "physical inspection");
  return (count ?? 0) === 0;
}

async function readSourceImages(analysisId: string): Promise<JsonRecord[]> {
  const admin = createAdminSupabaseClient();
  const { data: imageLinks, error: linkError } = await admin
    .from("analysis_images")
    .select("media_asset_id,display_order")
    .eq("analysis_id", analysisId)
    .order("display_order", { ascending: true });
  assertDatabaseRead(linkError, "analysis images");
  if (!imageLinks || imageLinks.length === 0) {
    return [];
  }

  const ids = imageLinks.map((row) => row.media_asset_id);
  const { data: assets, error: assetError } = await admin
    .from("media_assets")
    .select("id,bucket,path,purpose")
    .in("id", ids);
  assertDatabaseRead(assetError, "source images");
  const assetsById = new Map(
    (assets ?? []).map((asset) => [asset.id, asset]),
  );

  return Promise.all(imageLinks.map(async (link) => {
    const asset = assetsById.get(link.media_asset_id);
    if (!asset) {
      throw new UpstreamError("Analysis source image metadata is incomplete", {
        retryable: false,
      });
    }
    const { data, error } = await admin.storage
      .from(asset.bucket)
      .createSignedUrl(asset.path, 300);
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableError("Unable to sign source image URL", {
        retryable: true,
      });
    }
    return {
      assetId: asset.id,
      purpose: asset.purpose,
      signedUrl: data.signedUrl,
    };
  }));
}

async function readApplicationById(
  client: SupabaseClient,
  applicationId: string,
): Promise<ApplicationRow | null> {
  const { data, error } = await client
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .maybeSingle();
  assertDatabaseRead(error, "application");
  return data as ApplicationRow | null;
}

async function readProductContext(row: ApplicationRow): Promise<{
  product: ProductRow;
  recommendation: RecommendationRow;
}> {
  const admin = createAdminSupabaseClient();
  const [product, recommendation] = await Promise.all([
    readProduct(admin, row.product_id),
    readRecommendation(admin, row.analysis_id, row.product_id),
  ]);
  if (!product || !recommendation) {
    throw new UpstreamError("Application product context is incomplete", {
      retryable: false,
    });
  }
  return { product, recommendation };
}

async function readProduct(
  client: SupabaseClient,
  productId: string,
): Promise<ProductRow | null> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", productId)
    .maybeSingle();
  assertDatabaseRead(error, "product");
  return data as ProductRow | null;
}

function validateSelectedOptions(
  selectedOptions: CreateApplicationRequest["selectedOptions"],
  storedOptionGroups: unknown,
): void {
  if (!Array.isArray(storedOptionGroups)) {
    throw new UpstreamError("Stored product option groups are malformed", {
      retryable: false,
    });
  }

  const groups = new Map<string, {
    maxLength: number | null;
    optionValues: Set<string>;
    required: boolean;
    type: "SELECT" | "TEXT";
  }>();

  for (const value of storedOptionGroups) {
    const group = asRecord(value);
    if (
      !group ||
      typeof group.key !== "string" ||
      group.key.length === 0 ||
      group.key.length > 64 ||
      group.key.trim() !== group.key ||
      typeof group.required !== "boolean" ||
      (group.type !== "SELECT" && group.type !== "TEXT") ||
      groups.has(group.key)
    ) {
      throw new UpstreamError("Stored product option groups are malformed", {
        retryable: false,
      });
    }

    let maxLength: number | null = null;
    if (group.maxLength != null) {
      if (
        typeof group.maxLength !== "number" ||
        !Number.isInteger(group.maxLength) ||
        group.maxLength < 1
      ) {
        throw new UpstreamError("Stored product option groups are malformed", {
          retryable: false,
        });
      }
      maxLength = group.maxLength;
    }

    const optionValues = new Set<string>();
    if (group.type === "SELECT") {
      if (!Array.isArray(group.options)) {
        throw new UpstreamError("Stored product option groups are malformed", {
          retryable: false,
        });
      }
      for (const value of group.options) {
        const option = asRecord(value);
        if (
          !option ||
          typeof option.value !== "string" ||
          option.value.length > 200 ||
          optionValues.has(option.value)
        ) {
          throw new UpstreamError("Stored product option groups are malformed", {
            retryable: false,
          });
        }
        optionValues.add(option.value);
      }
    }

    groups.set(group.key, {
      maxLength,
      optionValues,
      required: group.required,
      type: group.type,
    });
  }

  for (const key of Object.keys(selectedOptions)) {
    const group = groups.get(key);
    if (!group) {
      throw new ValidationError(
        "selectedOptions contains an option not defined by the product",
        { field: "selectedOptions", optionKey: key },
      );
    }

    const selectedValue = selectedOptions[key];
    if (
      group.type === "SELECT" &&
      (typeof selectedValue !== "string" ||
        !group.optionValues.has(selectedValue))
    ) {
      throw new ValidationError(
        "selectedOptions contains an invalid product option value",
        { field: "selectedOptions", optionKey: key },
      );
    }
    if (
      group.type === "TEXT" &&
      (typeof selectedValue !== "string" ||
        (group.maxLength !== null && selectedValue.length > group.maxLength))
    ) {
      throw new ValidationError(
        "selectedOptions contains an invalid product option value",
        { field: "selectedOptions", optionKey: key },
      );
    }
  }

  for (const [key, group] of groups) {
    if (
      group.required &&
      !Object.prototype.hasOwnProperty.call(selectedOptions, key)
    ) {
      throw new ValidationError(
        "selectedOptions is missing a required product option",
        { field: "selectedOptions", optionKey: key },
      );
    }
  }
}

async function readRecommendation(
  client: SupabaseClient,
  analysisId: string,
  productId: string,
): Promise<RecommendationRow | null> {
  const { data, error } = await client
    .from("analysis_recommendations")
    .select(RECOMMENDATION_SELECT)
    .eq("analysis_id", analysisId)
    .eq("product_id", productId)
    .maybeSingle();
  assertDatabaseRead(error, "analysis recommendation");
  return data as RecommendationRow | null;
}

async function nextApplicationNumber(
  admin: SupabaseClient,
  createdAt: Date,
): Promise<string> {
  const date = createdAt.toISOString().slice(0, 10).replaceAll("-", "");
  const { data, error } = await admin
    .from("applications")
    .select("application_number")
    .like("application_number", `RB-${date}-%`)
    .order("application_number", { ascending: false })
    .limit(1);
  assertDatabaseRead(error, "application number");

  const latest = data?.[0]?.application_number;
  const sequence = typeof latest === "string"
    ? Number(latest.slice(-4)) + 1
    : 1;
  if (!Number.isSafeInteger(sequence) || sequence > 9999) {
    throw new ServiceUnavailableError("Daily application capacity is exhausted", {
      retryable: false,
    });
  }
  return `RB-${date}-${String(sequence).padStart(4, "0")}`;
}

function applicationSummary(
  row: ApplicationRow,
  product: ProductRow,
  recommendation: RecommendationRow,
): JsonRecord {
  const terms = readTerms(row.final_terms ?? row.initial_terms);
  return {
    amount: terms.amount,
    applicationNumber: row.application_number,
    createdAt: row.created_at,
    id: row.id,
    product: productCard(product, recommendation),
    status: effectiveStatus(row),
  };
}

export function applicationDetail(
  row: ApplicationRow,
  product: ProductRow,
  recommendation: RecommendationRow,
): JsonRecord {
  return {
    ...applicationSummary(row, product, recommendation),
    analysisId: row.analysis_id,
    demoProgressProfile: row.demo_progress_profile,
    effectiveStatus: effectiveStatus(row),
    inspectionCompletedAt: row.inspection_completed_at,
    persistedStatus: row.persisted_status,
    pickupSchedule: row.pickup_schedule,
    selectedOptions: row.selected_options,
    shippingAddress: row.shipping_address,
    statusOverride: row.status_override,
  };
}

function productCard(
  product: ProductRow,
  recommendation: RecommendationRow,
): JsonRecord {
  return {
    category: product.category,
    code: product.code,
    estimatedDuration: product.estimated_duration,
    has3d: product.model_3d_ready === true,
    id: product.id,
    listImage: product.list_image,
    mockPrice: money(product.mock_price_krw),
    name: product.name,
    recommendation: {
      eligible: recommendation.eligible,
      reasonCodes: recommendation.reason_codes,
      score: recommendation.score,
    },
    requiredAreaCm2: product.required_area_cm2,
  };
}

function readTerms(value: JsonRecord): {
  amount: { amount: number; currency: "KRW" };
  estimatedDuration: string;
  estimatedReusableMaterialRate: number;
  productId: string;
} {
  const amount = asRecord(value.amount);
  if (
    typeof value.productId !== "string" ||
    typeof value.estimatedDuration !== "string" ||
    typeof value.estimatedReusableMaterialRate !== "number" ||
    !amount ||
    typeof amount.amount !== "number" ||
    amount.currency !== "KRW"
  ) {
    throw new UpstreamError("Application terms are malformed", {
      retryable: false,
    });
  }
  return {
    amount: money(amount.amount),
    estimatedDuration: value.estimatedDuration,
    estimatedReusableMaterialRate: value.estimatedReusableMaterialRate,
    productId: value.productId,
  };
}

function changeRequestResponse(row: ChangeRequestRow): JsonRecord {
  return {
    applicationId: row.application_id,
    createdAt: row.created_at,
    id: row.id,
    inspectionId: row.inspection_id,
    previousTerms: row.previous_terms,
    proposedTerms: row.proposed_terms,
    reason: row.reason,
    respondedAt: row.responded_at,
    status: row.status,
  };
}

function shipmentResponse(row: {
  application_id: string;
  carrier_code: string;
  carrier_name: string;
  status: string;
  tracking_number: string;
}): JsonRecord {
  return {
    applicationId: row.application_id,
    carrierCode: row.carrier_code,
    carrierName: row.carrier_name,
    status: row.status,
    trackingNumber: row.tracking_number,
    trackingUrl: null,
  };
}

function certificateResponse(
  row: {
    certificate_number: string;
    id: string;
    issued_at: string;
    payload: unknown;
    verification_code: string;
  },
  applicationNumber: string,
): JsonRecord {
  const payload = asRecord(row.payload);
  if (
    !payload ||
    payload.methodologyVersion !== "DEMO_LCA_V2" ||
    typeof payload.sourceCategory !== "string" ||
    typeof payload.rebornProduct !== "string" ||
    typeof payload.reusedMaterialRate !== "number" ||
    typeof payload.reusedAreaCm2 !== "number" ||
    typeof payload.estimatedCarbonSavingKgCo2e !== "number" ||
    typeof payload.disclaimer !== "string"
  ) {
    throw new UpstreamError("Certificate payload is malformed", {
      retryable: false,
    });
  }

  return {
    applicationNumber,
    certificateId: row.id,
    certificateNumber: row.certificate_number,
    disclaimer: payload.disclaimer,
    estimatedCarbonSavingKgCo2e: payload.estimatedCarbonSavingKgCo2e,
    issuedAt: row.issued_at,
    methodologyVersion: "DEMO_LCA_V2",
    rebornProduct: payload.rebornProduct,
    reusedAreaCm2: payload.reusedAreaCm2,
    reusedMaterialRate: payload.reusedMaterialRate,
    sourceCategory: payload.sourceCategory,
    verificationCode: row.verification_code,
  };
}

function verificationCode(applicationNumber: string): string {
  const match = applicationNumber.match(/^RB-(\d{4})(\d{4})-(\d{4})$/);
  if (!match) {
    throw new UpstreamError("Application number is malformed", {
      retryable: false,
    });
  }
  return `MRB-${match[1]}-${match[2]}-${match[3]}`;
}

function money(amount: number): { amount: number; currency: "KRW" } {
  return { amount, currency: "KRW" };
}

function paged(
  items: JsonRecord[],
  page: number,
  size: number,
  totalElements: number,
): JsonRecord {
  return {
    items,
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
  };
}

function paymentTransactionId(applicationId: string, paidAt: string): string {
  const date = paidAt.slice(0, 10).replaceAll("-", "");
  return `MOCK-PAY-${date}-${applicationId.replaceAll("-", "").slice(0, 12)}`;
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

function namespacedIdempotencyKey(
  userId: string,
  operation: string,
  externalKey: string,
): string {
  return `v2:${createHash("sha256")
    .update(`${userId}:${operation}:${externalKey}`)
    .digest("hex")}`;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function assertDatabaseRead(
  error: { code?: string; message?: string } | null,
  resource: string,
): void {
  if (!error) {
    return;
  }
  throw new ServiceUnavailableError(`Unable to read ${resource}`, {
    retryable: true,
  });
}

function databaseWriteFailure(
  operation: string,
  error: { code?: string; message?: string },
): AppError {
  if (["23503", "23505", "23514", "P0001"].includes(error.code ?? "")) {
    return new ConflictError(
      "APPLICATION_STATE_CONFLICT",
      `The current application state does not allow ${operation}`,
    );
  }
  if (error.code === "42501") {
    return new AppError("FORBIDDEN", 403, "The operation is not permitted");
  }
  if (error.code === "22P02" || error.code === "22023") {
    return new ValidationError("The request contains an invalid value");
  }
  return new ServiceUnavailableError(`Unable to complete ${operation}`, {
    retryable: true,
  });
}

export type {
  ApplicationRow,
  ChangeRequestRow,
  ProductRow,
  RecommendationRow,
};

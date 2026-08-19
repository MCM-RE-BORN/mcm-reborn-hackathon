import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from "@/contracts/errors";
import {
  createAdminSupabaseClient,
  createUserSupabaseClient,
} from "@/lib/supabase/server";
import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate } from "@/server/auth/middleware";
import { readJsonBody, zodErrorDetails } from "@/server/http/json";

export const runtime = "nodejs";

const SENSITIVE_METADATA_KEY =
  /(address|authorization|cookie|email|image|jwt|name|password|phone|secret|token|url)/i;

const EventNameSchema = z.enum([
  "ANALYSIS_STARTED",
  "ANALYSIS_COMPLETED",
  "ANALYSIS_FALLBACK_USED",
  "PRODUCT_LIST_VIEWED",
  "PRODUCT_DETAIL_VIEWED",
  "APPLICATION_CREATED",
  "MOCK_PAYMENT_COMPLETED",
  "PHYSICAL_INSPECTION_COMPLETED",
  "APPLICATION_CHANGE_APPROVED",
  "APPLICATION_CHANGE_REJECTED",
  "CERTIFICATE_VIEWED",
]);

type EventName = z.infer<typeof EventNameSchema>;

const ALLOWED_METADATA_KEYS: Record<EventName, ReadonlySet<string>> = {
  ANALYSIS_STARTED: new Set(["mode", "screen", "source"]),
  ANALYSIS_COMPLETED: new Set([
    "durationMs",
    "mode",
    "result",
    "screen",
    "source",
  ]),
  ANALYSIS_FALLBACK_USED: new Set([
    "mode",
    "reasonCode",
    "screen",
    "source",
  ]),
  PRODUCT_LIST_VIEWED: new Set(["category", "screen", "source"]),
  PRODUCT_DETAIL_VIEWED: new Set(["productCode", "screen", "source"]),
  APPLICATION_CREATED: new Set(["screen", "source", "status"]),
  MOCK_PAYMENT_COMPLETED: new Set([
    "amountKrw",
    "screen",
    "source",
    "status",
  ]),
  PHYSICAL_INSPECTION_COMPLETED: new Set([
    "outcome",
    "screen",
    "source",
    "status",
  ]),
  APPLICATION_CHANGE_APPROVED: new Set(["screen", "source", "status"]),
  APPLICATION_CHANGE_REJECTED: new Set(["screen", "source", "status"]),
  CERTIFICATE_VIEWED: new Set([
    "certificateState",
    "screen",
    "source",
    "status",
  ]),
};

const MetadataValueSchema = z.union([
  z.string().trim().min(1).max(120),
  z.number().finite(),
  z.boolean(),
]);

const EventRequestSchema = z
  .object({
    eventName: EventNameSchema,
    occurredAt: z.string().datetime(),
    sessionId: z.string().uuid(),
    analysisId: z.string().uuid().nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
    applicationId: z.string().uuid().nullable().optional(),
    metadata: z
      .record(z.string().trim().min(1).max(40), MetadataValueSchema)
      .optional(),
  })
  .strict()
  .superRefine((event, context) => {
    const entries = Object.entries(event.metadata ?? {});
    if (entries.length > 8) {
      context.addIssue({
        code: "custom",
        message: "metadata may contain at most 8 entries",
        path: ["metadata"],
      });
    }

    const allowedKeys = ALLOWED_METADATA_KEYS[event.eventName];
    for (const [key] of entries) {
      if (SENSITIVE_METADATA_KEY.test(key) || !allowedKeys.has(key)) {
        context.addIssue({
          code: "custom",
          message: `metadata key is not allowed for ${event.eventName}`,
          path: ["metadata", key],
        });
      }
    }
  });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    const event = EventRequestSchema.parse(await readJsonBody(request));
    const userClient = createUserSupabaseClient(user.accessToken);
    await assertVisibleReferences(userClient, event);

    const admin = createAdminSupabaseClient();
    const { data: eventId, error } = await admin.rpc("record_analytics_event", {
      p_user_id: user.id,
      p_session_id: event.sessionId,
      p_event_name: event.eventName,
      p_occurred_at: event.occurredAt,
      p_analysis_id: event.analysisId ?? null,
      p_product_id: event.productId ?? null,
      p_application_id: event.applicationId ?? null,
      p_metadata: event.metadata ?? {},
    });

    if (error) {
      if (
        error.code === "P0001" &&
        error.message === "analytics event rate limit exceeded"
      ) {
        throw new RateLimitError("Analytics event rate limit exceeded");
      }
      throw new ServiceUnavailableError(
        "Supabase could not accept the analytics event",
      );
    }
    const eventIdResult = z.string().uuid().safeParse(eventId);
    if (!eventIdResult.success) {
      throw new ServiceUnavailableError(
        "Supabase returned an invalid analytics event receipt",
      );
    }

    return NextResponse.json(
      { accepted: true, eventId: eventIdResult.data },
      {
        headers: { "Cache-Control": "no-store" },
        status: 202,
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(
        new ValidationError("Invalid event data", zodErrorDetails(error)),
      );
    }
    return handleApiError(error);
  }
}

async function assertVisibleReferences(
  client: SupabaseClient,
  event: z.infer<typeof EventRequestSchema>,
): Promise<void> {
  const checks: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
  if (event.analysisId) {
    checks.push(
      client.from("analyses").select("id").eq("id", event.analysisId).maybeSingle(),
    );
  }
  if (event.productId) {
    checks.push(
      client.from("products").select("id").eq("id", event.productId).maybeSingle(),
    );
  }
  if (event.applicationId) {
    checks.push(
      client
        .from("applications")
        .select("id")
        .eq("id", event.applicationId)
        .maybeSingle(),
    );
  }

  const results = await Promise.all(checks);
  for (const result of results) {
    if (result.error) {
      throw new ServiceUnavailableError(
        "Supabase could not validate the analytics event",
      );
    }
    if (!result.data) {
      throw new ValidationError("Referenced event resource is not available");
    }
  }
}

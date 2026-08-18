import { z } from "zod";

import { ValidationError } from "@/contracts/errors";

const UUID_SCHEMA = z.string().uuid();
const MAX_SELECTED_OPTION_COUNT = 16;
const SelectedOptionKeySchema = z.string()
  .min(1)
  .max(64)
  .refine((key) => key.trim() === key, {
    message: "Option keys must not have leading or trailing whitespace",
  });
const SelectedOptionValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
]);
const SelectedOptionsSchema = z.record(
  SelectedOptionKeySchema,
  SelectedOptionValueSchema,
).superRefine((options, context) => {
  if (Object.keys(options).length > MAX_SELECTED_OPTION_COUNT) {
    context.addIssue({
      code: "custom",
      message: `selectedOptions must contain at most ${MAX_SELECTED_OPTION_COUNT} entries`,
    });
  }
});

const MoneySchema = z.object({
  amount: z.number().int().min(0),
  currency: z.literal("KRW"),
}).strict();

const ApplicationTermsSchema = z.object({
  amount: MoneySchema,
  estimatedDuration: z.string().trim().min(1),
  estimatedReusableMaterialRate: z.number().int().min(0).max(100),
  productId: UUID_SCHEMA,
}).strict();

const AddressSchema = z.object({
  address1: z.string().trim().max(200),
  address2: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().min(8).max(30),
  postalCode: z.string().trim().max(12),
  recipientName: z.string().trim().min(1).max(60),
}).strict();

const PickupScheduleSchema = z.object({
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeWindow: z.string().trim().min(1).max(60),
}).strict().superRefine(({ requestedDate }, context) => {
  const date = new Date(`${requestedDate}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== requestedDate
  ) {
    context.addIssue({
      code: "custom",
      message: "requestedDate must be a valid ISO date",
      path: ["requestedDate"],
    });
  }
});

export const CreateApplicationRequestSchema = z.object({
  analysisId: UUID_SCHEMA,
  consents: z.object({
    aiEstimateNoticeAccepted: z.literal(true),
    inspectionChangeNoticeAccepted: z.literal(true),
    serviceAndPrivacyTermsAccepted: z.literal(true),
  }).strict(),
  pickupSchedule: PickupScheduleSchema,
  productId: UUID_SCHEMA,
  selectedOptions: SelectedOptionsSchema,
  shippingAddress: AddressSchema,
}).strict();

export const MockPaymentRequestSchema = z.object({
  method: z.literal("DEMO_CARD"),
  simulate: z.enum(["SUCCESS", "FAILURE"]),
}).strict();

export const SubmitPhysicalInspectionRequestSchema = z.object({
  confirmedReusableAreaCm2: z.number().int().min(0),
  confirmedReusableMaterialRate: z.number().int().min(0).max(100),
  outcome: z.enum([
    "NO_CHANGE",
    "CHANGE_REQUIRED",
    "PRODUCTION_UNAVAILABLE",
  ]),
  proposedTerms: ApplicationTermsSchema.nullable().optional(),
  reason: z.string().trim().min(1).max(1000),
}).strict().superRefine(({ outcome, proposedTerms }, context) => {
  if (outcome === "CHANGE_REQUIRED" && !proposedTerms) {
    context.addIssue({
      code: "custom",
      message: "proposedTerms is required for CHANGE_REQUIRED",
      path: ["proposedTerms"],
    });
  }
  if (outcome !== "CHANGE_REQUIRED" && proposedTerms != null) {
    context.addIssue({
      code: "custom",
      message: "proposedTerms is allowed only for CHANGE_REQUIRED",
      path: ["proposedTerms"],
    });
  }
});

export const RejectApplicationChangeRequestSchema = z.object({
  reason: z.string().trim().min(1).max(300),
}).strict();

export type CreateApplicationRequest = z.infer<
  typeof CreateApplicationRequestSchema
>;
export type MockPaymentRequest = z.infer<typeof MockPaymentRequestSchema>;
export type SubmitPhysicalInspectionRequest = z.infer<
  typeof SubmitPhysicalInspectionRequestSchema
>;
export type RejectApplicationChangeRequest = z.infer<
  typeof RejectApplicationChangeRequestSchema
>;

export function parseUuid(value: string, field: string): string {
  const parsed = UUID_SCHEMA.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(`${field} must be a UUID`, { field });
  }
  return parsed.data;
}

export function readIdempotencyKey(request: Request): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value || value.length < 8 || value.length > 128) {
    throw new ValidationError(
      "Idempotency-Key must contain between 8 and 128 characters",
      { field: "Idempotency-Key" },
    );
  }
  return value;
}

export function parsePagination(request: Request): {
  page: number;
  size: number;
} {
  const url = new URL(request.url);
  const page = parseIntegerQuery(url.searchParams.get("page"), "page", 0, 0);
  const size = parseIntegerQuery(url.searchParams.get("size"), "size", 20, 1);
  if (size > 100) {
    throw new ValidationError("size must be at most 100", { field: "size" });
  }
  return { page, size };
}

function parseIntegerQuery(
  value: string | null,
  field: string,
  fallback: number,
  minimum: number,
): number {
  if (value === null) {
    return fallback;
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new ValidationError(`${field} must be an integer`, { field });
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new ValidationError(`${field} is outside the allowed range`, {
      field,
    });
  }
  return number;
}

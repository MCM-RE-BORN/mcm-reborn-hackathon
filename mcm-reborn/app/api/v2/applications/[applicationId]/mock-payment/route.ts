import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate, requireRole } from "@/server/auth/middleware";
import {
  completeMockPayment,
  executeIdempotentApplicationCommand,
} from "@/server/applications/v2-application-service";
import {
  jsonApiResult,
  parseJsonRequest,
} from "@/server/applications/v2-route-utils";
import {
  MockPaymentRequestSchema,
  parseUuid,
  readIdempotencyKey,
} from "@/server/applications/v2-validation";

export const runtime = "nodejs";

type ApplicationRouteContext = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(
  request: Request,
  { params }: ApplicationRouteContext,
): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);
    const { applicationId: rawApplicationId } = await params;
    const applicationId = parseUuid(rawApplicationId, "applicationId");
    const idempotencyKey = readIdempotencyKey(request);
    const body = await parseJsonRequest(request, MockPaymentRequestSchema);
    const result = await executeIdempotentApplicationCommand({
      body,
      execute: () => completeMockPayment(user, applicationId, body),
      idempotencyKey,
      operation: "completeMockPayment",
      resourceId: applicationId,
      user,
    });
    return jsonApiResult(result);
  } catch (error) {
    return handleApiError(error);
  }
}

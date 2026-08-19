import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate, requireRole } from "@/server/auth/middleware";
import {
  decideApplicationChangeRequest,
  executeIdempotentApplicationCommand,
} from "@/server/applications/v2-application-service";
import { jsonApiResult } from "@/server/applications/v2-route-utils";
import {
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
    const body = { decision: "APPROVED" as const };
    const result = await executeIdempotentApplicationCommand({
      body,
      execute: () => decideApplicationChangeRequest(
        user,
        applicationId,
        "APPROVED",
        null,
      ),
      idempotencyKey,
      operation: "approveApplicationChangeRequest",
      resourceId: applicationId,
      user,
    });
    return jsonApiResult(result);
  } catch (error) {
    return handleApiError(error);
  }
}
